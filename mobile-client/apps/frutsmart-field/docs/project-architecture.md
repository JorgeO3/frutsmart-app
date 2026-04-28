## 1. Diagrama de arquitectura
```mermaid
flowchart TD
  mobile[React Native App] -->|HTTPS + Bearer| FD[Front Door Std WAF]
  admins[Browser (NocoDB)] -->|HTTPS + OIDC| FD
  FD --> CAAPI[Container App – Backend]
  FD --> CANoco[Container App – NocoDB]
  subgraph VNet
    CAAPI -->|5432 (TCP)| PG[(PostgreSQL B1ms Private EP)]
    CANoco -->|5432| PG
    CAAPI -->|HTTPS| Blob[(Blob Storage Hot Private EP)]
  end
  CAAPI -- MSI --> KV[Key Vault]
```

## 2. Recursos de Azure y costos estimados
| Componente                         | SKU / métrica clave                                        | Precio público      | Sub-total   |
|------------------------------------|------------------------------------------------------------|---------------------|-------------|
| Container Apps (backend + NocoDB)  | Consumption; primeros 180 000 vCPU-s + 360 000 GiB-s + 2 M req gratis | ≈ 0 US$             | 0           |
| PostgreSQL Flexible Server         | B1ms 1 vCPU 2 GiB RAM                                       | 12.41 US$/mes       | 12.41       |
| Blob Storage                       | Hot LRS 200 GB × 0.018 US$                                  | 3.60 US$            | 3.60        |
| Private Endpoint (Storage)         | 0.01 US$/h ≈ 7.30 US$/mes                                   | 7.30 US$            | 7.30        |
| Private Endpoint (PostgreSQL)      | 0.01 US$/h                                                 | 7.30 US$            | 7.30        |
| Private DNS Zones                  | 0.50 US$/zona (<25)                                        | 1.00 US$            | 1.00        |
| Front Door Standard                | Tarifa base 35 US$                                         | 35.00 US$           | 35.00       |
| WAF (Front Door)                   | Política 5 US$ + rule-set 20 US$                           | 25.00 US$           | 25.00       |
| Key Vault (Standard)               | 0.03 US$/10 000 ops → ≈ 0.01 US$                           | 0.01 US$            | 0.01        |
| Log Analytics                      | 1 GB ingesta × 0.10 US$                                    | 0.10 US$            | 0.10        |
| **Total base**                     |                                                            |                     | **≈ 95 US$/mes** |

## 3. Flujo de autenticación end-to-end
### 3.1 Pasos de la app React Native
1. MSAL genera code_verifier y lanza el navegador con PKCE (S256).  
2. Entra ID solicita usuario + contraseña + PIN MFA y devuelve un authorization code.  
3. MSAL canjea el code (+ verifier) por Access Token (1 h) + Refresh Token (90 d) sobre TLS.  
4. Tokens se guardan cifrados en Keychain/Keystore.  
5. Cuando vuelve la red, acquireTokenSilent usa el RT sin mostrar UI.  
6. La app llama al backend con Authorization: Bearer <AT>.

### 3.2 Validación en Easy Auth (Container Apps)
* Easy Auth redirige a /.auth/login/aad, valida firma + issuer + audience y solo admite HTTPS.  
* Inyecta X-MS-CLIENT-PRINCIPAL (Base64-JSON con claims) y X-MS-CLIENT-PRINCIPAL-NAME.  
* El contenedor Go no implementa OAuth; decodifica la cabecera y mapea sub/oid.

### 3.3 Extracto de código Go
```go
b64 := r.Header.Get("X-MS-CLIENT-PRINCIPAL")
if b64 == "" {
    http.Error(w, "401", 401)
    return
}
raw, _ := base64.StdEncoding.DecodeString(b64)
var p struct {
    Sub  string `json:"sub"`
    Name string `json:"name"`
}
json.Unmarshal(raw, &p) // p.Sub → PK usuario interno
```

### 3.4 Qué impide la ingeniería inversa
- Robar client_id: dato público; no concede privilegios.  
- Interceptar code: falta code_verifier (PKCE).  
- Forjar JWT: requiere clave privada de Microsoft; se verifica en Easy Auth.  
- Reusar RT: cifrado en Keystore/Keychain; fuera de la app no funciona.

## 4. Bicep mínimo para el backend
```bicep
resource backend 'Microsoft.App/containerApps@2023-05-01' = {
  name: 'data-backend'
  location: resourceGroup().location
  identity: { type: 'SystemAssigned' }
  properties: {
    environmentId: containerenv.id
    configuration: {
      ingress: { external: true; targetPort: 8080 }
      auth: {
        platformEnabled: true
        globalValidation: { unauthenticatedClientAction: 'RedirectToLogin' }
        identityProviders: {
          azureActiveDirectory: {
            registration: { appRegistrationType: 'SystemAssigned' }
          }
        }
      }
    }
    template: {
      containers: [{
        name: 'api'
        image: 'ghcr.io/org/backend:1.0.0'
        env: [{
          name: 'PG_CONN'
          value: '@Microsoft.KeyVault(SecretUri=https://kv.vault.azure.net/secrets/pg)'
        }]
      }]
    }
  }
}
```

## 5. Pasos de despliegue (GitHub Actions)
1. Configurar OIDC + Federated Credentials: evita secretos en el workflow.  
2. az containerapp up -f bicep.json despliega backend y NocoDB.  
3. az keyvault secret set sube cadenas de conexión.  
4. az frontdoor afd-endpoint purge tras actualizar rutas.

## 6. Operación offline-first
| Escenario          | Comportamiento                                                                 |
|--------------------|---------------------------------------------------------------------------------|
| Sin red (campo)    | App almacena fotos en SQLite; getToken() falla en silent, no lanza UI → cola local. |
| Red vuelve         | MSAL renueva AT con RT; se sube el lote a /api/sync.                            |
| AT caducó + RT exp | acquireTokenInteractive pide login + MFA; renueva caché.                       |

## 7. Optimización de costos
- Mantén datos fríos en Cool o Archive para bajar Blob a 0.01 US$/GB.  
- Programa Stop/Start de PostgreSQL en horas valle.  
- Revisa consumo de PE y Front Door; si solo usas red corporativa, podrías eliminar Front Door y ahorrar ~60 US$.

## 8. Checklist de seguridad
- MFA obligatorio en Entra ID; CA bloquea peticiones sin token.  
- WAF rule: X-API-Key missing → Block (coste 1 US$/mes).  
- Rate-limit en WAF: 100 req/IP/min.  
- Private Endpoints con Public network access = Disabled.  
- Alerts: 401/403 > 50/min y CPU > 70 % en Container Apps.