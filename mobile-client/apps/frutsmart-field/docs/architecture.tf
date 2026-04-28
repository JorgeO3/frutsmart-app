###############################################################################
# 0. Providers
###############################################################################
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    azurerm = { source = "hashicorp/azurerm" version = ">= 4.31.0" }
    azuread = { source = "hashicorp/azuread" version = ">= 2.50.0" }
    random  = { source = "hashicorp/random"  version = ">= 3.6.0"  }
  }
}
provider "azurerm" { features {} }
provider "azuread" {}

data "azurerm_client_config" "current" {}

###############################################################################
# 1. Variables y etiquetas
###############################################################################
locals {
  prefix         = "aidata"
  location       = "brazilsouth"          # menor latencia para Colombia
  backend_port   = 8080
  vnet_cidr      = "10.40.0.0/16"
  ca_subnet_cidr = "10.40.1.0/23"         # /23 requerido ✔︎
  pe_subnet_cidr = "10.40.2.0/27"
  tags = { project = "ai-data-col", env = "prod" }
}

###############################################################################
# 2. Grupo de recursos, Budget 100 USD, Log Analytics Daily Cap
###############################################################################
resource "azurerm_resource_group" "rg" {
  name     = "${local.prefix}-rg"
  location = local.location
  tags     = local.tags
}

resource "azurerm_consumption_budget_subscription" "monthly_budget" {
  name            = "budget-ai-data"
  subscription_id = data.azurerm_client_config.current.subscription_id
  amount          = 100
  time_grain      = "Monthly"
  time_period { start_date = "2025-01-01T00:00:00Z" end_date = "2030-12-31T00:00:00Z" }
  notification { enabled = true threshold = 50  operator = "EqualTo" contact_emails = ["finops@empresa.com"] }
  notification { enabled = true threshold = 75  operator = "EqualTo" contact_emails = ["ops@empresa.com"] }
  notification { enabled = true threshold = 100 operator = "EqualTo" contact_emails = ["ciso@empresa.com"] }
}

resource "azurerm_log_analytics_workspace" "law" {
  name                = "${local.prefix}-law"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  retention_in_days   = 30
  daily_quota_gb      = 0.5                          # hard-cap
  tags                = local.tags
}

###############################################################################
# 3. Red: VNet + subredes (delegación Container Apps)
###############################################################################
resource "azurerm_virtual_network" "vnet" {
  name                = "${local.prefix}-vnet"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  address_space       = [local.vnet_cidr]
  tags                = local.tags
}

resource "azurerm_subnet" "snet_ca" {
  name                 = "snet-ca"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = [local.ca_subnet_cidr]
  delegation {
    name = "aca-del"
    service_delegation { name = "Microsoft.App/environments" actions = ["Microsoft.Network/virtualNetworks/subnets/action"] }
  }
}

resource "azurerm_subnet" "snet_pe" {
  name                                       = "snet-pe"
  resource_group_name                        = azurerm_resource_group.rg.name
  virtual_network_name                       = azurerm_virtual_network.vnet.name
  address_prefixes                           = [local.pe_subnet_cidr]
  private_endpoint_network_policies_enabled  = true
}

###############################################################################
# 4. Container Apps Environment (VNet-inject)
###############################################################################
resource "azurerm_container_app_environment" "env" {
  name                       = "${local.prefix}-cae"
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  infrastructure_subnet_id   = azurerm_subnet.snet_ca.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.law.id
  tags                       = local.tags
}

###############################################################################
# 5. Azure AD apps: API + NocoDB
###############################################################################
data "azuread_tenant" "current" {}

resource "azuread_application" "api_app" {
  display_name                          = "${local.prefix}-api"
  api { requested_access_token_version  = 2
    oauth2_permission_scope {
      id                               = uuidv5("api-scope","00000000-0000-0000-0000-000000000000")
      admin_consent_display_name       = "Access API"
      admin_consent_description        = "Access API"
      value                            = "user_impersonation"
      type                             = "User"
      enabled                          = true
    }
  }
}

resource "azuread_application" "nocodb_app" { display_name = "${local.prefix}-nocodb" }

###############################################################################
# 6. PostgreSQL B1ms + PE + DNS
###############################################################################
resource "random_password" "pg" { length = 24 special = true }

resource "azurerm_postgresql_flexible_server" "pg" {
  name                     = "${local.prefix}-pg"
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  administrator_login      = "pgadmin"
  administrator_password   = random_password.pg.result
  sku_name                 = "B_Standard_B1ms"
  version                  = "16"
  storage_mb               = 32768
  public_network_access_enabled = false
  delegated_subnet_id      = azurerm_subnet.snet_ca.id
  zone                     = "1"
  tags                     = local.tags
}

resource "azurerm_private_dns_zone" "pg_dns" {
  name                = "privatelink.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.rg.name
}
resource "azurerm_private_endpoint" "pg_pe" {
  name                = "${local.prefix}-pg-pe"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  subnet_id           = azurerm_subnet.snet_pe.id
  private_service_connection {
    name                           = "pg-conn"
    private_connection_resource_id = azurerm_postgresql_flexible_server.pg.id
    subresource_names              = ["postgresqlServer"]
  }
}
resource "azurerm_private_dns_zone_virtual_network_link" "pg_link" {
  name                  = "pg-link"
  resource_group_name   = azurerm_resource_group.rg.name
  private_dns_zone_name = azurerm_private_dns_zone.pg_dns.name
  virtual_network_id    = azurerm_virtual_network.vnet.id
}
resource "azurerm_private_dns_a_record" "pg_a" {
  name                = azurerm_postgresql_flexible_server.pg.name
  zone_name           = azurerm_private_dns_zone.pg_dns.name
  resource_group_name = azurerm_resource_group.rg.name
  ttl                 = 300
  records             = [azurerm_private_endpoint.pg_pe.private_service_connection[0].private_ip_address]
}

###############################################################################
# 7. Storage Account Hot LRS + PE + DNS
###############################################################################
resource "azurerm_storage_account" "sa" {
  name                     = replace("${local.prefix}sa", "-", "")
  location                 = azurerm_resource_group.rg.location
  resource_group_name      = azurerm_resource_group.rg.name
  account_tier             = "Standard"
  account_replication_type = "LRS"
  network_rules {
    default_action             = "Deny"
    virtual_network_subnet_ids = [azurerm_subnet.snet_pe.id]
  }
  blob_properties { versioning_enabled = true }
  tags = local.tags
}

resource "azurerm_private_dns_zone" "blob_dns" {
  name                = "privatelink.blob.core.windows.net"
  resource_group_name = azurerm_resource_group.rg.name
}
resource "azurerm_private_endpoint" "blob_pe" {
  name                = "${local.prefix}-blob-pe"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  subnet_id           = azurerm_subnet.snet_pe.id
  private_service_connection {
    name                           = "blob-conn"
    private_connection_resource_id = azurerm_storage_account.sa.id
    subresource_names              = ["blob"]
  }
}
resource "azurerm_private_dns_zone_virtual_network_link" "blob_link" {
  name                  = "blob-link"
  resource_group_name   = azurerm_resource_group.rg.name
  private_dns_zone_name = azurerm_private_dns_zone.blob_dns.name
  virtual_network_id    = azurerm_virtual_network.vnet.id
}

###############################################################################
# 8. Key Vault + secretos
###############################################################################
resource "azurerm_key_vault" "kv" {
  name                        = "${local.prefix}-kv"
  location                    = azurerm_resource_group.rg.location
  resource_group_name         = azurerm_resource_group.rg.name
  tenant_id                   = data.azuread_tenant.current.id
  sku_name                    = "standard"
  purge_protection_enabled    = true
  soft_delete_retention_days  = 7
  tags                        = local.tags
}

resource "azurerm_key_vault_secret" "pg_conn" {
  name         = "pg-conn"
  value        = "postgres://${azurerm_postgresql_flexible_server.pg.administrator_login}:${random_password.pg.result}@${azurerm_postgresql_flexible_server.pg.name}.postgres.database.azure.com:5432/postgres?sslmode=require"
  key_vault_id = azurerm_key_vault.kv.id
}

###############################################################################
# 9. Container Apps: Backend + NocoDB (Easy Auth)
###############################################################################
resource "azurerm_container_app" "api" {
  name                         = "${local.prefix}-api"
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = azurerm_resource_group.rg.name
  location                     = azurerm_resource_group.rg.location
  revision_mode                = "Single"
  identity { type = "SystemAssigned" }

  template {
    container {
      name   = "go-api"
      image  = "ghcr.io/org/backend:1.0.0"
      cpu    = "0.25"
      memory = "0.5Gi"
      env { name = "PG_CONN" secret_name = "pg-conn" }
    }
    scale {
      min_replicas = 0
      max_replicas = 3
      rule { name = "http" http { concurrent_requests = 50 } }
    }
  }

  secret { name = "pg-conn" value = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.kv.name};SecretName=pg-conn)" }

  ingress {
    external_enabled = true
    target_port      = local.backend_port
  }

  authentication {
    enabled                        = true
    unauthenticated_request_action = "RedirectToLogin"
    active_directory {
      type                    = "SystemAssigned"
      allowed_token_audiences = ["api://${azuread_application.api_app.application_id}"]
    }
  }
  tags = local.tags
}

resource "azurerm_container_app" "nocodb" {
  name                         = "${local.prefix}-nocodb"
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = azurerm_resource_group.rg.name
  location                     = azurerm_resource_group.rg.location
  revision_mode                = "Single"
  identity { type = "SystemAssigned" }

  template {
    container {
      name   = "nocodb"
      image  = "ghcr.io/nocodb/nocodb:latest"
      cpu    = "0.25"
      memory = "0.5Gi"
      env { name = "NC_DB" value = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.kv.name};SecretName=pg-conn)" }
      env { name = "NC_PUBLIC_URL" value = "https://${local.prefix}.fd.net/nocodb" }
      env { name = "NC_AUTH_OIDC_PROVIDER" value = "azuread" }
      env { name = "NC_AUTH_OIDC_CLIENT_ID" value = azuread_application.nocodb_app.application_id }
      env { name = "NC_AUTH_OIDC_ISSUER" value = "https://login.microsoftonline.com/${data.azuread_tenant.current.id}/v2.0" }
    }
    scale { min_replicas = 0 max_replicas = 1 }
  }

  ingress {
    external_enabled = true
    target_port      = 8080
  }
  tags = local.tags
}

###############################################################################
#10. Front Door Standard + WAF con GeoMatch (solo CO)
###############################################################################
module "frontdoor" {
  source  = "kumarvna/frontdoor/azurerm"
  version = "2.1.0"

  frontend_endpoints = { fd = { host_name = "${local.prefix}.fd.net" } }

  backend_pool = {
    pool = {
      backends = [
        { host_name = azurerm_container_app.api.latest_revision_fqdn  weight = 50 priority = 1 },
        { host_name = azurerm_container_app.nocodb.latest_revision_fqdn weight = 50 priority = 1 }
      ]
      load_balancing_name = "lb"
    }
  }

  routing_rules = {
    api = {
      accepted_protocols = ["Https"]
      patterns_to_match  = ["/api/*"]
      forward_to_backend = "pool"
      frontend_endpoints = ["fd"]
    }
    nocodb = {
      accepted_protocols = ["Https"]
      patterns_to_match  = ["/nocodb/*"]
      forward_to_backend = "pool"
      frontend_endpoints = ["fd"]
    }
  }

  waf_policy_id = azurerm_frontdoor_firewall_policy.waf.id
}

resource "azurerm_frontdoor_firewall_policy" "waf" {
  name                = "${local.prefix}-waf"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku_name            = "Classic_AzureFrontDoor"
  policy_mode         = "Prevention"

  managed_rule {
    type    = "Microsoft_DefaultRuleSet"
    version = "2.1"
  }

  # Rate-limit: 100 req/min/IP
  custom_rule {
    name      = "RateLimit100"
    priority  = 10
    rule_type = "RateLimitRule"
    rate_limit_threshold           = 100
    rate_limit_duration_in_minutes = 1
    match_condition {
      match_variable = "RemoteAddr"
      operator       = "IPMatch"
      match_values   = ["0.0.0.0/0"]
    }
  }

  # Bloquea cualquier país distinto a Colombia
  custom_rule {
    name      = "GeoBlockNonCO"
    priority  = 5
    rule_type = "MatchRule"
    action    = "Block"
    match_condition {
      match_variable   = "RemoteAddr"
      operator         = "GeoMatch"
      match_values     = ["CO"]
      negate_condition = true   # not CO ➔ block
    }
  }
}

###############################################################################
#11. Azure Policy assignments (solo región & réplicas ≤3)
###############################################################################
data "azurerm_policy_definition" "allowed_locations" { display_name = "Allowed locations" }
resource "azurerm_policy_assignment" "loc" {
  name                 = "only-brsouth"
  scope                = azurerm_resource_group.rg.id
  policy_definition_id = data.azurerm_policy_definition.allowed_locations.id
  parameters           = jsonencode({ listOfAllowedLocations = { value = ["brazilsouth"] } })
}

data "azurerm_policy_definition" "ca_replicas" { display_name = "Container Apps container replica count limits" }
resource "azurerm_policy_assignment" "replicas" {
  name                 = "limit-ca-replicas"
  scope                = azurerm_resource_group.rg.id
  policy_definition_id = data.azurerm_policy_definition.ca_replicas.id
  parameters           = jsonencode({ maximumReplicas = { value = 3 } })
}

###############################################################################
#12. Salidas
###############################################################################
output "frontdoor_url" { value = module.frontdoor.frontdoor_url }
