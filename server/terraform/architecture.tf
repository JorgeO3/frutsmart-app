# ###############################################################################
# # 0. Providers + Variables
# ###############################################################################
# terraform {
#   required_version = ">= 1.6.0"

#   required_providers {
#     azurerm = {
#       source  = "hashicorp/azurerm"
#       version = "4.50.0"
#     }
#     azuread = {
#       source  = "hashicorp/azuread"
#       version = "3.6.0"
#     }
#     random = {
#       source  = "hashicorp/random"
#       version = "3.72"
#     }
#     azapi = {
#       source  = "azure/azapi"
#       version = "2.7.0"
#     }
#     time = {
#       source  = "hashicorp/time"
#       version = "0.13.1"
#     }
#   }
# }

# variable "subscription_id" { type = string }
# variable "tenant_id" { type = string }

# # Región única para TODO
# variable "location" {
#   description = "Región donde se desplegará TODO el stack"
#   type        = string
#   default     = "canadacentral"
# }

# provider "azurerm" {
#   features {}
#   subscription_id = var.subscription_id
#   tenant_id       = var.tenant_id
# }

# provider "azuread" {}

# data "azurerm_client_config" "current" {}

# # Certificado que APIM presentará a los backends (mTLS APIM -> ACA)
# variable "apim_backend_client_cert_pfx_path" {
#   description = "Ruta al PFX del certificado de cliente que APIM usará para mTLS hacia Container Apps"
#   type        = string
# }
# variable "apim_backend_client_cert_password" {
#   description = "Password del PFX del certificado de cliente de APIM (mTLS)"
#   type        = string
#   sensitive   = true
# }

# # Toggle de modo: false = sin dominio (usa FQDN de APIM), true = con Cloudflare + mTLS
# variable "use_cloudflare" {
#   description = "true = usar dominio propio detrás de Cloudflare con mTLS; false = usar FQDN gestionado de APIM"
#   type        = bool
#   default     = false
# }

# # Requerido cuando use_cloudflare = true
# variable "public_domain" {
#   description = "FQDN público (sin path), por ejemplo api.empresa.com"
#   type        = string
#   default     = ""
# }

# # Cert cliente que presentará Cloudflare (Authenticated Origin Pulls)
# variable "cloudflare_client_cert_thumbprint" {
#   description = "Thumbprint HEX del certificado cliente que Cloudflare presentará a APIM (si use_cloudflare=true)"
#   type        = string
#   default     = ""
# }

# # Tag de imagen de NocoDB (evitar latest)
# variable "nocodb_image_tag" {
#   description = "Tag de imagen de NocoDB a usar (pin fijo)"
#   type        = string
#   default     = "0.202.10"
# }

# variable "admin_ip_whitelist" {
#   description = "IPs públicas permitidas para acceder a Key Vault (tu equipo, el de tu jefe, etc.)"
#   type        = list(string)
#   default     = []
# }

# ###############################################################################
# # 1. Locales, etiquetas y sufijos aleatorios para evitar conflictos
# ###############################################################################
# locals {
#   prefix       = "aidata"
#   location     = var.location
#   backend_port = 80

#   # Red única
#   vnet_cidr      = "10.40.0.0/16"
#   ca_subnet_cidr = "10.40.0.0/23" # /23 recomendado para ACA
#   pe_subnet_cidr = "10.40.2.0/27" # subred para Private Endpoints
#   pg_subnet_cidr = "10.40.4.0/24" # subred delegada a Flexible Server

#   # URL públicas (para OIDC de NocoDB)
#   nocodb_redirect_path = "/auth/oidc/callback"
#   tags                 = { project = "ai-data-col", env = "prod" }

#   http_methods = toset(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
# }

# # Sufijos para evitar colisiones con recursos soft-deleted o previos
# resource "random_id" "apim" { byte_length = 4 }
# resource "random_id" "diag" { byte_length = 3 }

# ###############################################################################
# # 2. RG, Budget y Log Analytics
# ###############################################################################
# resource "azurerm_resource_group" "rg" {
#   name     = "${local.prefix}-rg"
#   location = local.location
#   tags     = local.tags
# }

# resource "azurerm_consumption_budget_subscription" "monthly_budget" {
#   name            = "budget-ai-data"
#   subscription_id = "/subscriptions/${data.azurerm_client_config.current.subscription_id}"

#   amount     = 100
#   time_grain = "Monthly"

#   time_period {
#     start_date = "2025-10-01T00:00:00Z"
#     end_date   = "2030-12-31T00:00:00Z"
#   }

#   notification {
#     enabled        = true
#     operator       = "GreaterThanOrEqualTo"
#     threshold      = 50
#     contact_emails = ["joheosmo@gmail.com"]
#   }
#   notification {
#     enabled        = true
#     operator       = "GreaterThanOrEqualTo"
#     threshold      = 75
#     contact_emails = ["joheosmo@gmail.com"]
#   }
#   notification {
#     enabled        = true
#     operator       = "GreaterThanOrEqualTo"
#     threshold      = 100
#     contact_emails = ["joheosmo@gmail.com"]
#   }
#   notification {
#     enabled        = true
#     operator       = "GreaterThan"
#     threshold      = 80
#     threshold_type = "Forecasted"
#     contact_emails = ["joheosmo@gmail.com"]
#   }
# }

# resource "time_sleep" "wait_rg" {
#   depends_on      = [azurerm_resource_group.rg]
#   create_duration = "20s"
# }

# # Ya importado arriba
# resource "azurerm_log_analytics_workspace" "law" {
#   name                = "${local.prefix}-law"
#   location            = azurerm_resource_group.rg.location
#   resource_group_name = azurerm_resource_group.rg.name
#   retention_in_days   = 30
#   daily_quota_gb      = 0.5
#   tags                = local.tags

#   timeouts {
#     create = "30m"
#   }

#   depends_on = [time_sleep.wait_rg]
# }

# ###############################################################################
# # 3. Red: VNet + subredes + NSG
# ###############################################################################
# # Ya importada arriba
# resource "azurerm_virtual_network" "vnet" {
#   name                = "${local.prefix}-vnet"
#   location            = azurerm_resource_group.rg.location
#   resource_group_name = azurerm_resource_group.rg.name
#   address_space       = [local.vnet_cidr]
#   tags                = local.tags

#   timeouts {
#     create = "60m"
#   }

#   depends_on = [time_sleep.wait_rg]
# }

# # Subred de ACA (IMPORTANTE: SIN delegación)
# resource "azurerm_subnet" "snet_ca" {
#   name                 = "snet-ca"
#   resource_group_name  = azurerm_resource_group.rg.name
#   virtual_network_name = azurerm_virtual_network.vnet.name
#   address_prefixes     = [local.ca_subnet_cidr]
# }

# # Subred para Private Endpoints (políticas deshabilitadas)
# resource "azurerm_subnet" "snet_pe" {
#   name                              = "snet-pe"
#   resource_group_name               = azurerm_resource_group.rg.name
#   virtual_network_name              = azurerm_virtual_network.vnet.name
#   address_prefixes                  = [local.pe_subnet_cidr]
#   private_endpoint_network_policies = "Disabled"
# }

# # Subred para PostgreSQL Flexible Server (DELEGADA)
# resource "azurerm_subnet" "snet_pg" {
#   name                 = "snet-pg"
#   resource_group_name  = azurerm_resource_group.rg.name
#   virtual_network_name = azurerm_virtual_network.vnet.name
#   address_prefixes     = [local.pg_subnet_cidr]

#   delegation {
#     name = "pg-del"
#     service_delegation {
#       name    = "Microsoft.DBforPostgreSQL/flexibleServers"
#       actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
#     }
#   }
# }

# resource "azurerm_network_security_group" "nsg_pe" {
#   name                = "${local.prefix}-nsg-pe"
#   location            = azurerm_resource_group.rg.location
#   resource_group_name = azurerm_resource_group.rg.name
#   tags                = local.tags
# }

# # NSG (documentativo; PEs no usan NSG para el dataplane)
# resource "azurerm_network_security_rule" "allow_ca_to_pe" {
#   name                        = "allow-ca-to-pe-443"
#   priority                    = 100
#   direction                   = "Inbound"
#   access                      = "Allow"
#   protocol                    = "Tcp"
#   source_port_range           = "*"
#   destination_port_ranges     = ["443"]
#   source_address_prefix       = azurerm_subnet.snet_ca.address_prefixes[0]
#   destination_address_prefix  = azurerm_subnet.snet_pe.address_prefixes[0]
#   resource_group_name         = azurerm_resource_group.rg.name
#   network_security_group_name = azurerm_network_security_group.nsg_pe.name
# }

# resource "azurerm_subnet_network_security_group_association" "pe_assoc" {
#   subnet_id                 = azurerm_subnet.snet_pe.id
#   network_security_group_id = azurerm_network_security_group.nsg_pe.id
# }

# ###############################################################################
# # 4. Container Apps Environment (VNet-inject)
# ###############################################################################
# resource "azurerm_container_app_environment" "env" {
#   name                       = "${local.prefix}-cae"
#   location                   = azurerm_resource_group.rg.location
#   resource_group_name        = azurerm_resource_group.rg.name
#   infrastructure_subnet_id   = azurerm_subnet.snet_ca.id
#   log_analytics_workspace_id = azurerm_log_analytics_workspace.law.id
#   tags                       = local.tags

#   timeouts {
#     create = "60m"
#   }
# }

# resource "time_sleep" "wait_env_ready" {
#   depends_on      = [azurerm_container_app_environment.env]
#   create_duration = "120s"
# }

# ###############################################################################
# # 5. Azure AD apps: API + NocoDB
# ###############################################################################
# resource "azuread_application" "api_app" {
#   display_name = "${local.prefix}-api"

#   api {
#     requested_access_token_version = 2

#     oauth2_permission_scope {
#       id                         = uuidv5("00000000-0000-0000-0000-000000000000", "api-scope")
#       admin_consent_display_name = "Access API"
#       admin_consent_description  = "Access API"
#       value                      = "user_impersonation"
#       type                       = "User"
#       enabled                    = true
#     }
#   }
# }

# # Se define más abajo local.public_base_url_extend (usa APIM gateway o dominio)
# resource "azuread_application" "nocodb_app" {
#   display_name = "${local.prefix}-nocodb"

#   web {
#     redirect_uris = [
#       "${local.public_base_url_extend}/nocodb${local.nocodb_redirect_path}"
#     ]

#     implicit_grant {
#       access_token_issuance_enabled = true
#       id_token_issuance_enabled     = true
#     }
#   }

#   depends_on = [azurerm_api_management.apim]
# }

# resource "azuread_application_password" "nocodb_secret" {
#   application_id = azuread_application.nocodb_app.id
#   display_name   = "oidc-client-secret"
#   end_date       = timeadd(timestamp(), "8760h") # 1 año
# }

# ###############################################################################
# # 6. PostgreSQL Flexible Server (privado) - Burstable barato
# ###############################################################################
# resource "random_password" "pg" {
#   length           = 24
#   special          = true
#   override_special = "!#$%&*()-_=+[]{}<>:?"
# }

# resource "azurerm_private_dns_zone" "pg_dns" {
#   name                = "privatelink.postgres.database.azure.com"
#   resource_group_name = azurerm_resource_group.rg.name
# }

# resource "azurerm_private_dns_zone_virtual_network_link" "pg_link_vnet" {
#   name                  = "pg-link-vnet"
#   resource_group_name   = azurerm_resource_group.rg.name
#   private_dns_zone_name = azurerm_private_dns_zone.pg_dns.name
#   virtual_network_id    = azurerm_virtual_network.vnet.id
# }

# resource "azurerm_postgresql_flexible_server" "pg" {
#   name                = "${local.prefix}-pg"
#   location            = local.location
#   resource_group_name = azurerm_resource_group.rg.name

#   administrator_login    = "pgadmin"
#   administrator_password = random_password.pg.result

#   sku_name   = "B_Standard_B1ms"
#   version    = "16"
#   storage_mb = 32768

#   public_network_access_enabled = true
#   delegated_subnet_id           = azurerm_subnet.snet_pg.id
#   private_dns_zone_id           = azurerm_private_dns_zone.pg_dns.id
#   backup_retention_days         = 7
#   geo_redundant_backup_enabled  = false

#   maintenance_window {
#     day_of_week  = 0
#     start_hour   = 0
#     start_minute = 0
#   }

#   tags = local.tags

#   timeouts {
#     create = "90m"
#   }
# }

# ###############################################################################
# # 7. Storage Account endurecido + PE + Lifecycle (sin CORS por app nativa)
# ###############################################################################
# resource "azurerm_storage_account" "sa" {
#   name                     = replace("${local.prefix}sa", "-", "")
#   location                 = azurerm_resource_group.rg.location
#   resource_group_name      = azurerm_resource_group.rg.name
#   account_tier             = "Standard"
#   account_replication_type = "LRS"

#   min_tls_version                   = "TLS1_2"
#   shared_access_key_enabled         = true
#   https_traffic_only_enabled        = true
#   infrastructure_encryption_enabled = true

#   # App móvil sube directo con SAS; mantener público=ON y rules Allow
#   public_network_access_enabled = true

#   network_rules {
#     default_action = "Allow"
#   }

#   blob_properties {
#     last_access_time_enabled = true
#     versioning_enabled       = true

#     delete_retention_policy {
#       days = 7
#     }
#     # (Sin CORS: no es necesario para app nativa)
#   }

#   tags = local.tags
# }

# resource "azurerm_storage_container" "uploads" {
#   name                  = "uploads"
#   storage_account_id    = azurerm_storage_account.sa.id
#   container_access_type = "private"
# }

# resource "azurerm_storage_management_policy" "sa_lifecycle" {
#   storage_account_id = azurerm_storage_account.sa.id

#   rule {
#     name    = "move-old-to-cool"
#     enabled = true

#     filters {
#       blob_types = ["blockBlob"]
#     }

#     actions {
#       base_blob {
#         tier_to_cool_after_days_since_modification_greater_than = 30
#       }
#     }
#   }
# }

# resource "azurerm_private_dns_zone" "blob_dns" {
#   name                = "privatelink.blob.core.windows.net"
#   resource_group_name = azurerm_resource_group.rg.name
# }

# resource "azurerm_private_dns_zone_virtual_network_link" "blob_link" {
#   name                  = "blob-link"
#   resource_group_name   = azurerm_resource_group.rg.name
#   private_dns_zone_name = azurerm_private_dns_zone.blob_dns.name
#   virtual_network_id    = azurerm_virtual_network.vnet.id
# }

# resource "azurerm_private_endpoint" "blob_pe" {
#   name                = "${local.prefix}-blob-pe"
#   location            = azurerm_resource_group.rg.location
#   resource_group_name = azurerm_resource_group.rg.name
#   subnet_id           = azurerm_subnet.snet_pe.id

#   private_service_connection {
#     name                           = "blob-conn"
#     private_connection_resource_id = azurerm_storage_account.sa.id
#     subresource_names              = ["blob"]
#     is_manual_connection           = false
#   }

#   private_dns_zone_group {
#     name                 = "blob-dns-group"
#     private_dns_zone_ids = [azurerm_private_dns_zone.blob_dns.id]
#   }

#   tags = local.tags
# }

# ###############################################################################
# # 8. Key Vault + RBAC + secretos + PE + DNS privado (PNA temporal ON)
# ###############################################################################
# resource "random_id" "kv" {
#   byte_length = 4
#   keepers = {
#     rg       = azurerm_resource_group.rg.name
#     location = var.location
#   }
# }

# resource "azurerm_key_vault" "kv" {
#   name                = "${local.prefix}-kv-${random_id.kv.hex}"
#   location            = azurerm_resource_group.rg.location
#   resource_group_name = azurerm_resource_group.rg.name
#   tenant_id           = data.azurerm_client_config.current.tenant_id
#   sku_name            = "standard"

#   # Para ciclos de prueba: sin purge protection y retención corta
#   purge_protection_enabled   = false
#   soft_delete_retention_days = 7

#   # PNA temporalmente activo para poder crear secretos desde tu IP
#   public_network_access_enabled = true

#   network_acls {
#     default_action = "Deny"
#     bypass         = "AzureServices"
#     ip_rules       = var.admin_ip_whitelist
#   }

#   tags = local.tags
# }

# # RBAC al principal que ejecuta Terraform (para set/get de secretos)
# resource "azurerm_role_assignment" "kv_secrets_officer_me" {
#   scope                = azurerm_key_vault.kv.id
#   role_definition_name = "Key Vault Secrets Officer"
#   principal_id         = data.azurerm_client_config.current.object_id
# }

# # Espera propagación RBAC (evita 403)
# resource "time_sleep" "wait_kv_rbac" {
#   depends_on      = [azurerm_role_assignment.kv_secrets_officer_me]
#   create_duration = "60s"
# }

# resource "azurerm_private_dns_zone" "kv_dns" {
#   name                = "privatelink.vaultcore.azure.net"
#   resource_group_name = azurerm_resource_group.rg.name
# }

# resource "azurerm_private_dns_zone_virtual_network_link" "kv_link" {
#   name                  = "kv-link"
#   resource_group_name   = azurerm_resource_group.rg.name
#   private_dns_zone_name = azurerm_private_dns_zone.kv_dns.name
#   virtual_network_id    = azurerm_virtual_network.vnet.id
# }

# resource "azurerm_private_endpoint" "kv_pe" {
#   name                = "${local.prefix}-kv-pe"
#   location            = azurerm_resource_group.rg.location
#   resource_group_name = azurerm_resource_group.rg.name
#   subnet_id           = azurerm_subnet.snet_pe.id

#   private_service_connection {
#     name                           = "kv-conn"
#     private_connection_resource_id = azurerm_key_vault.kv.id
#     subresource_names              = ["vault"]
#     is_manual_connection           = false
#   }

#   private_dns_zone_group {
#     name                 = "kv-dns-group"
#     private_dns_zone_ids = [azurerm_private_dns_zone.kv_dns.id]
#   }

#   tags = local.tags
# }

# # Secretos en Key Vault (después de RBAC)
# resource "azurerm_key_vault_secret" "pg_conn" {
#   name         = "pg-conn"
#   value        = "postgres://${azurerm_postgresql_flexible_server.pg.administrator_login}:${random_password.pg.result}@${azurerm_postgresql_flexible_server.pg.fqdn}:5432/postgres?sslmode=require"
#   key_vault_id = azurerm_key_vault.kv.id

#   depends_on = [
#     time_sleep.wait_kv_rbac,
#     azurerm_postgresql_flexible_server.pg
#   ]
# }

# resource "azurerm_key_vault_secret" "nocodb_oidc_client_secret" {
#   name            = "nocodb-oidc-client-secret"
#   value           = azuread_application_password.nocodb_secret.value
#   key_vault_id    = azurerm_key_vault.kv.id
#   content_type    = "oidc-client-secret"
#   expiration_date = timeadd(timestamp(), "8760h") # 1 año

#   depends_on = [
#     time_sleep.wait_kv_rbac,
#     azuread_application_password.nocodb_secret
#   ]
# }

# ###############################################################################
# # 9. Container Apps: API + NocoDB (mTLS requerido en ingress)
# ###############################################################################
# resource "azurerm_container_app" "api" {
#   name                         = "${local.prefix}-api"
#   container_app_environment_id = azurerm_container_app_environment.env.id
#   resource_group_name          = azurerm_resource_group.rg.name
#   revision_mode                = "Single"

#   identity {
#     type = "SystemAssigned"
#   }

#   template {
#     min_replicas = 0
#     max_replicas = 2

#     http_scale_rule {
#       name                = "http"
#       concurrent_requests = 50
#     }

#     container {
#       name = "go-api"
#       # IMPORTANTE: usa una imagen PÚBLICA para validar infra o conecta credenciales del registry
#       image  = "nginxdemos/hello:plain-text"
#       cpu    = "0.25"
#       memory = "0.5Gi"
#     }
#   }

#   ingress {
#     external_enabled        = true
#     target_port             = 80
#     client_certificate_mode = "require"

#     traffic_weight {
#       latest_revision = true
#       percentage      = 100
#     }
#   }

#   tags       = local.tags
#   depends_on = [time_sleep.wait_env_ready]
# }

# resource "azurerm_container_app" "nocodb" {
#   name                         = "${local.prefix}-nocodb"
#   container_app_environment_id = azurerm_container_app_environment.env.id
#   resource_group_name          = azurerm_resource_group.rg.name
#   revision_mode                = "Single"

#   identity {
#     type = "SystemAssigned"
#   }

#   template {
#     min_replicas = 0
#     max_replicas = 1

#     http_scale_rule {
#       name                = "http"
#       concurrent_requests = 30
#     }

#     container {
#       name   = "nocodb"
#       image  = "nocodb/nocodb:${var.nocodb_image_tag}"
#       cpu    = "0.25"
#       memory = "0.5Gi"

#       env {
#         name  = "NC_PUBLIC_URL"
#         value = "https://placeholder"
#       }
#       env {
#         name  = "NC_STORAGE_KV_PROVIDER"
#         value = "azure"
#       }
#       env {
#         name  = "NC_STORAGE_AZURE_CONTAINER"
#         value = azurerm_storage_container.uploads.name
#       }
#       env {
#         name  = "NC_STORAGE_AZURE_ACCOUNT"
#         value = azurerm_storage_account.sa.name
#       }
#       env {
#         name  = "NC_AUTH_OIDC_PROVIDER"
#         value = "oidc"
#       }
#       env {
#         name  = "NC_AUTH_OIDC_CLIENT_ID"
#         value = azuread_application.nocodb_app.client_id
#       }
#       env {
#         name  = "NC_AUTH_OIDC_ISSUER"
#         value = "https://login.microsoftonline.com/${data.azurerm_client_config.current.tenant_id}/v2.0"
#       }
#     }
#   }

#   ingress {
#     external_enabled        = true
#     target_port             = 8080
#     client_certificate_mode = "require"

#     traffic_weight {
#       latest_revision = true
#       percentage      = 100
#     }
#   }

#   tags       = local.tags
#   depends_on = [time_sleep.wait_env_ready]
# }

# # Permisos KV (MSI de las apps)
# resource "azurerm_role_assignment" "kv_secrets_user_api" {
#   scope                = azurerm_key_vault.kv.id
#   role_definition_name = "Key Vault Secrets User"
#   principal_id         = azurerm_container_app.api.identity[0].principal_id
# }

# resource "azurerm_role_assignment" "kv_secrets_user_noco" {
#   scope                = azurerm_key_vault.kv.id
#   role_definition_name = "Key Vault Secrets User"
#   principal_id         = azurerm_container_app.nocodb.identity[0].principal_id
# }

# # Permisos de Blob para la API
# resource "azurerm_role_assignment" "api_blob_contrib" {
#   scope                = azurerm_storage_account.sa.id
#   role_definition_name = "Storage Blob Data Contributor"
#   principal_id         = azurerm_container_app.api.identity[0].principal_id
# }

# ###############################################################################
# # 10. Easy Auth (AuthConfigs) para la API (AAD v2)
# ###############################################################################
# resource "azapi_resource" "api_auth" {
#   type      = "Microsoft.App/containerApps/authConfigs@2025-02-02-preview"
#   name      = "current"
#   parent_id = azurerm_container_app.api.id

#   body = {
#     properties = {
#       globalValidation = {
#         unauthenticatedClientAction = "RedirectToLoginPage"
#       }
#       identityProviders = {
#         azureActiveDirectory = {
#           enabled = true
#           registration = {
#             openIdIssuer = "https://login.microsoftonline.com/${data.azurerm_client_config.current.tenant_id}/v2.0"
#             clientId     = azuread_application.api_app.client_id
#           }
#           validation = {
#             allowedAudiences = ["api://${azuread_application.api_app.client_id}"]
#           }
#           login = {}
#         }
#       }
#     }
#   }

#   depends_on = [azurerm_container_app.api]
# }

# ###############################################################################
# # 11. API Management (Consumption) + mTLS + backends
# ###############################################################################
# locals {
#   public_base_url_extend = var.use_cloudflare && var.public_domain != "" ? "https://${var.public_domain}" : azurerm_api_management.apim.gateway_url

#   cloudflare_mtls_policy = var.use_cloudflare ? join("\n", [
#     "   <!-- mTLS Cloudflare -> APIM -->",
#     "   <choose>",
#     "    <when condition=\"@(context.Request.Certificate == null)\">",
#     "      <return-response>",
#     "        <set-status code=\"401\" reason=\"Client Certificate Required\" />",
#     "      </return-response>",
#     "    </when>",
#     "   </choose>",
#     "   <validate-client-certificate>",
#     "     <identities>",
#     "       <thumbprint>${var.cloudflare_client_cert_thumbprint}</thumbprint>",
#     "     </identities>",
#     "     <certificate-error-action>Reject</certificate-error-action>",
#     "   </validate-client-certificate>",
#   ]) : ""
# }

# resource "azurerm_api_management" "apim" {
#   name                = "${local.prefix}-apim-${random_id.apim.hex}"
#   location            = azurerm_resource_group.rg.location
#   resource_group_name = azurerm_resource_group.rg.name
#   publisher_name      = "Empresa SA"
#   publisher_email     = "devops@empresa.com"
#   sku_name            = "Consumption_0"

#   identity {
#     type = "SystemAssigned"
#   }

#   tags = local.tags

#   timeouts {
#     create = "90m"
#   }

#   depends_on = [time_sleep.wait_rg]
# }

# resource "azurerm_api_management_certificate" "backend_client_cert" {
#   name                = "backend-client-cert"
#   api_management_name = azurerm_api_management.apim.name
#   resource_group_name = azurerm_resource_group.rg.name
#   data                = filebase64(var.apim_backend_client_cert_pfx_path)
#   password            = var.apim_backend_client_cert_password
# }

# resource "time_sleep" "wait_apim_ready" {
#   depends_on      = [azurerm_api_management.apim]
#   create_duration = "90s"
# }

# resource "azurerm_api_management_backend" "api_backend" {
#   name                = "api-backend"
#   resource_group_name = azurerm_resource_group.rg.name
#   api_management_name = azurerm_api_management.apim.name
#   protocol            = "http"
#   url                 = "https://${azurerm_container_app.api.latest_revision_fqdn}"

#   credentials {
#     certificate = [azurerm_api_management_certificate.backend_client_cert.id]
#   }

#   tls {
#     validate_certificate_chain = true
#     validate_certificate_name  = true
#   }

#   depends_on = [time_sleep.wait_apim_ready]
# }

# resource "azurerm_api_management_backend" "nocodb_backend" {
#   name                = "nocodb-backend"
#   resource_group_name = azurerm_resource_group.rg.name
#   api_management_name = azurerm_api_management.apim.name
#   protocol            = "http"
#   url                 = "https://${azurerm_container_app.nocodb.latest_revision_fqdn}"

#   credentials {
#     certificate = [azurerm_api_management_certificate.backend_client_cert.id]
#   }

#   tls {
#     validate_certificate_chain = true
#     validate_certificate_name  = true
#   }

#   depends_on = [time_sleep.wait_apim_ready]
# }

# resource "azurerm_api_management_api" "api" {
#   name                  = "${local.prefix}-api-gw"
#   resource_group_name   = azurerm_resource_group.rg.name
#   api_management_name   = azurerm_api_management.apim.name
#   revision              = "1"
#   display_name          = "Backend API"
#   path                  = "api"
#   protocols             = ["https"]
#   subscription_required = false

#   depends_on = [time_sleep.wait_apim_ready]
# }

# resource "azurerm_api_management_api_operation" "api_ops" {
#   for_each            = local.http_methods
#   api_management_name = azurerm_api_management.apim.name
#   resource_group_name = azurerm_resource_group.rg.name
#   api_name            = azurerm_api_management_api.api.name

#   operation_id = "op-${lower(each.key)}-wildcard"
#   display_name = "Wildcard ${each.key}"
#   method       = each.key
#   url_template = "/*"
# }

# resource "azurerm_api_management_api_policy" "api_policy" {
#   api_name            = azurerm_api_management_api.api.name
#   api_management_name = azurerm_api_management.apim.name
#   resource_group_name = azurerm_resource_group.rg.name

#   xml_content = <<XML
# <policies>
#   <inbound>
#     <base />
#     ${local.cloudflare_mtls_policy}

#     <set-backend-service backend-id="${azurerm_api_management_backend.api_backend.name}" />
#     <limit-content-length max-content-length="104857600" />

#     <validate-jwt header-name="Authorization" failed-validation-httpcode="401" failed-validation-error-message="Unauthorized">
#       <openid-config url="https://login.microsoftonline.com/${data.azurerm_client_config.current.tenant_id}/v2.0/.well-known/openid-configuration" />
#       <audiences><audience>api://${azuread_application.api_app.client_id}</audience></audiences>
#     </validate-jwt>

#     <!-- Rate limit defensivo por usuario autenticado o IP -->
#     <rate-limit-by-key calls="120" renewal-period="60" counter-key="@((string)context.Principal?.UserId ?? context.Request.IpAddress)" />

#     <set-header name="X-Content-Type-Options" exists-action="override"><value>nosniff</value></set-header>
#     <set-header name="X-Frame-Options" exists-action="override"><value>SAMEORIGIN</value></set-header>
#     <set-header name="Referrer-Policy" exists-action="override"><value>no-referrer</value></set-header>
#     <set-header name="Content-Security-Policy" exists-action="override">
#       <value>default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self';</value>
#     </set-header>
#   </inbound>
#   <backend><base /></backend>
#   <outbound><base /></outbound>
#   <on-error><base /></on-error>
# </policies>
# XML

#   depends_on = [time_sleep.wait_apim_ready]
# }

# resource "azurerm_api_management_api" "nocodb" {
#   name                  = "${local.prefix}-nocodb-gw"
#   resource_group_name   = azurerm_resource_group.rg.name
#   api_management_name   = azurerm_api_management.apim.name
#   revision              = "1"
#   display_name          = "NocoDB"
#   path                  = "nocodb"
#   protocols             = ["https"]
#   subscription_required = false

#   depends_on = [time_sleep.wait_apim_ready]
# }

# resource "azurerm_api_management_api_operation" "nocodb_ops" {
#   for_each            = local.http_methods
#   api_management_name = azurerm_api_management.apim.name
#   resource_group_name = azurerm_resource_group.rg.name
#   api_name            = azurerm_api_management_api.nocodb.name

#   operation_id = "op-nocodb-${lower(each.key)}-wildcard"
#   display_name = "Wildcard ${each.key}"
#   method       = each.key
#   url_template = "/*"
# }

# resource "azurerm_api_management_api_policy" "nocodb_policy" {
#   api_name            = azurerm_api_management_api.nocodb.name
#   api_management_name = azurerm_api_management.apim.name
#   resource_group_name = azurerm_resource_group.rg.name

#   xml_content = <<XML
# <policies>
#   <inbound>
#     <base />
#     ${local.cloudflare_mtls_policy}

#     <!-- Rate limit defensivo por IP (admin panel) -->
#     <rate-limit-by-key calls="60" renewal-period="60" counter-key="@((string)context.Request.IpAddress)" />

#     <set-backend-service backend-id="${azurerm_api_management_backend.nocodb_backend.name}" />
#     <rewrite-uri template="@{
#       var p = context.Request.OriginalUrl.Path;
#       return p.StartsWith("/nocodb") ? p.Substring(7) : p;
#     }" />
#     <limit-content-length max-content-length="104857600" />

#     <set-header name="X-Content-Type-Options" exists-action="override"><value>nosniff</value></set-header>
#     <set-header name="X-Frame-Options" exists-action="override"><value>SAMEORIGIN</value></set-header>
#     <set-header name="Referrer-Policy" exists-action="override"><value>no-referrer</value></set-header>
#     <set-header name="Content-Security-Policy" exists-action="override">
#       <value>default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self';</value>
#     </set-header>
#   </inbound>
#   <backend><base /></backend>
#   <outbound><base /></outbound>
#   <on-error><base /></on-error>
# </policies>
# XML

#   depends_on = [time_sleep.wait_apim_ready]
# }

# # Política global mínima
# resource "azurerm_api_management_policy" "global" {
#   api_management_id = azurerm_api_management.apim.id
#   xml_content       = <<XML
# <policies>
#   <inbound/>
#   <backend/>
#   <outbound/>
#   <on-error/>
# </policies>
# XML
# }

# ###############################################################################
# # 12. Diagnostic Settings (APIM, Storage, PG, ACA Env)
# ###############################################################################
# # Usa sufijos para evitar choques si ya existen diagnósticos previos
# resource "azurerm_monitor_diagnostic_setting" "diag_apim" {
#   name                       = "${local.prefix}-diag-apim-${random_id.diag.hex}"
#   target_resource_id         = azurerm_api_management.apim.id
#   log_analytics_workspace_id = azurerm_log_analytics_workspace.law.id

#   enabled_log {
#     category = "GatewayLogs"
#   }

#   enabled_metric {
#     category = "AllMetrics"
#   }
# }

# # Blob service
# resource "azurerm_monitor_diagnostic_setting" "diag_sa_blob" {
#   name                       = "${local.prefix}-diag-blob-${random_id.diag.hex}"
#   target_resource_id         = "${azurerm_storage_account.sa.id}/blobServices/default"
#   log_analytics_workspace_id = azurerm_log_analytics_workspace.law.id

#   enabled_log { category = "StorageWrite" }
#   enabled_log { category = "StorageDelete" }
#   enabled_log { category = "StorageRead" }

#   enabled_metric { category = "Transaction" }
# }

# # File service
# resource "azurerm_monitor_diagnostic_setting" "diag_sa_file" {
#   name                       = "${local.prefix}-diag-file-${random_id.diag.hex}"
#   target_resource_id         = "${azurerm_storage_account.sa.id}/fileServices/default"
#   log_analytics_workspace_id = azurerm_log_analytics_workspace.law.id

#   enabled_log { category = "StorageWrite" }
#   enabled_log { category = "StorageDelete" }
#   enabled_log { category = "StorageRead" }

#   enabled_metric { category = "Transaction" }
# }

# # Queue service
# resource "azurerm_monitor_diagnostic_setting" "diag_sa_queue" {
#   name                       = "${local.prefix}-diag-queue-${random_id.diag.hex}"
#   target_resource_id         = "${azurerm_storage_account.sa.id}/queueServices/default"
#   log_analytics_workspace_id = azurerm_log_analytics_workspace.law.id

#   enabled_log { category = "StorageWrite" }
#   enabled_log { category = "StorageDelete" }
#   enabled_log { category = "StorageRead" }

#   enabled_metric { category = "Transaction" }
# }

# # Table service
# resource "azurerm_monitor_diagnostic_setting" "diag_sa_table" {
#   name                       = "${local.prefix}-diag-table-${random_id.diag.hex}"
#   target_resource_id         = "${azurerm_storage_account.sa.id}/tableServices/default"
#   log_analytics_workspace_id = azurerm_log_analytics_workspace.law.id

#   enabled_log { category = "StorageWrite" }
#   enabled_log { category = "StorageDelete" }
#   enabled_log { category = "StorageRead" }

#   enabled_metric { category = "Transaction" }
# }

# resource "azurerm_monitor_diagnostic_setting" "diag_pg" {
#   name                       = "${local.prefix}-diag-pg-${random_id.diag.hex}"
#   target_resource_id         = azurerm_postgresql_flexible_server.pg.id
#   log_analytics_workspace_id = azurerm_log_analytics_workspace.law.id

#   enabled_log { category = "PostgreSQLLogs" }
#   enabled_metric { category = "AllMetrics" }
# }

# # Solo métricas del Environment (categorías de Container App por-app dan 400)
# resource "azurerm_monitor_diagnostic_setting" "diag_aca_env" {
#   name                       = "${local.prefix}-diag-aca-env-${random_id.diag.hex}"
#   target_resource_id         = azurerm_container_app_environment.env.id
#   log_analytics_workspace_id = azurerm_log_analytics_workspace.law.id

#   enabled_metric { category = "AllMetrics" }
# }

# ###############################################################################
# # 13. Azure Policy (opcional) + Locks granulares
# ###############################################################################
# resource "azurerm_resource_group_policy_assignment" "allowed_storage_skus_rg" {
#   name                 = "allowed-storage-skus"
#   resource_group_id    = azurerm_resource_group.rg.id
#   policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/7433c107-6db4-4ad1-b57a-a76dce0154a1"

#   parameters = jsonencode({
#     listOfAllowedSKUs = { value = ["Standard_LRS", "Standard_GRS"] }
#     effect            = { value = "Deny" }
#   })
# }

# ###############################################################################
# # 14. Post-procesado: fijar URLs y secretos (sin CORS)
# ###############################################################################
# # NC_PUBLIC_URL (NocoDB)
# resource "azapi_update_resource" "patch_nocodb_env_url" {
#   type      = "Microsoft.App/containerApps@2024-02-02-preview"
#   name      = azurerm_container_app.nocodb.name
#   parent_id = azurerm_resource_group.rg.id

#   body = {
#     properties = {
#       template = {
#         containers = [
#           {
#             name = "nocodb"
#             env = [
#               { name = "NC_PUBLIC_URL", value = "${local.public_base_url_extend}/nocodb" }
#             ]
#           }
#         ]
#       }
#     }
#   }

#   depends_on = [
#     azurerm_api_management.apim,
#     azurerm_container_app.nocodb
#   ]
# }

# # Añadir secretos por referencia de KV y variables a API
# resource "azapi_update_resource" "api_add_kv_secrets_and_env" {
#   type      = "Microsoft.App/containerApps@2024-02-02-preview"
#   name      = azurerm_container_app.api.name
#   parent_id = azurerm_resource_group.rg.id

#   body = {
#     properties = {
#       configuration = {
#         secrets = [
#           { name = "pg-conn", identity = "system", keyVaultUrl = azurerm_key_vault_secret.pg_conn.id }
#         ]
#       }
#       template = {
#         containers = [
#           { name = "go-api", env = [{ name = "PG_CONN", secretRef = "pg-conn" }] }
#         ]
#       }
#     }
#   }

#   depends_on = [
#     azurerm_role_assignment.kv_secrets_user_api,
#     azurerm_key_vault_secret.pg_conn
#   ]
# }

# # Añadir secretos por referencia de KV y variables a NocoDB
# resource "azapi_update_resource" "nocodb_add_kv_secrets_and_env" {
#   type      = "Microsoft.App/containerApps@2024-02-02-preview"
#   name      = azurerm_container_app.nocodb.name
#   parent_id = azurerm_resource_group.rg.id

#   body = {
#     properties = {
#       configuration = {
#         secrets = [
#           { name = "pg-conn", identity = "system", keyVaultUrl = azurerm_key_vault_secret.pg_conn.id },
#           { name = "nocodb-oidc-client-secret", identity = "system", keyVaultUrl = azurerm_key_vault_secret.nocodb_oidc_client_secret.id }
#         ]
#       }
#       template = {
#         containers = [
#           { name = "nocodb",
#             env = [
#               { name = "NC_DB", secretRef = "pg-conn" },
#               { name = "NC_AUTH_OIDC_CLIENT_SECRET", secretRef = "nocodb-oidc-client-secret" }
#             ]
#           }
#         ]
#       }
#     }
#   }

#   depends_on = [
#     azurerm_role_assignment.kv_secrets_user_noco,
#     azurerm_key_vault_secret.pg_conn,
#     azurerm_key_vault_secret.nocodb_oidc_client_secret
#   ]
# }

# # Flag opcional para apagar PNA al final (solo si Terraform corre desde dentro de la VNet)
# variable "kv_disable_pna_at_end" {
#   description = "Apagar PNA al final (solo si Terraform corre dentro de la VNet)"
#   type        = bool
#   default     = false
# }

# resource "azapi_update_resource" "kv_disable_pna" {
#   count     = var.kv_disable_pna_at_end ? 1 : 0
#   type      = "Microsoft.KeyVault/vaults@2023-07-01"
#   name      = azurerm_key_vault.kv.name
#   parent_id = azurerm_resource_group.rg.id

#   body = {
#     properties = {
#       publicNetworkAccess = "Disabled"
#       networkAcls         = { defaultAction = "Deny", bypass = "None" }
#     }
#   }

#   depends_on = [
#     azurerm_key_vault_secret.pg_conn,
#     azurerm_key_vault_secret.nocodb_oidc_client_secret
#   ]
# }

# ###############################################################################
# # 15. Salidas útiles
# ###############################################################################
# output "location" { value = local.location }
# output "mode_use_cloudflare" { value = var.use_cloudflare }
# output "public_base_url" { value = local.public_base_url_extend }
# output "api_fqdn" { value = azurerm_container_app.api.latest_revision_fqdn }
# output "nocodb_fqdn" { value = azurerm_container_app.nocodb.latest_revision_fqdn }
# output "apim_name" { value = azurerm_api_management.apim.name }
# output "apim_gateway_url" { value = azurerm_api_management.apim.gateway_url }
# output "storage_account_id" { value = azurerm_storage_account.sa.id }
# output "key_vault_name" { value = azurerm_key_vault.kv.name }
# output "private_endpoints" {
#   value = {
#     blob = azurerm_private_endpoint.blob_pe.id,
#     kv   = azurerm_private_endpoint.kv_pe.id
#   }
# }
