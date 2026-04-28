import type { ConfigContext, ExpoConfig } from '@expo/config';

/**
 * Entornos lógicos internos de la app.
 * - 'local'       → móvil contra gateway/emulador en 192.168.1.5
 * - 'dev'         → entorno remoto de desarrollo (Azure dev)
 * - 'staging'     → preproducción
 * - 'prod'        → producción
 */
export type AppEnv = 'local' | 'dev' | 'staging' | 'prod';

interface RawEnvConfig {
  apiBaseUrl: string;
  easyAuthBaseUrl: string;
  issuer: string;
  tokenEndpoint: string;
  openIdConfigUrl: string;
  clientId: string;
  scopes: string[];
  tenantDomain?: string;
  policy?: string;
}

interface OidcExtraConfig {
  issuer: string;
  openIdConfigUrl: string;
  tokenEndpoint: string;
  clientId: string;
  scopes: string[];
  tenantDomain?: string;
  policy?: string;
}

interface ExtraConfig {
  appEnv: AppEnv;
  apiBaseUrl: string;
  easyAuthBaseUrl: string;
  oidc: OidcExtraConfig;
  featureFlags: {
    authEnabled: boolean;
  };
}

/**
 * Lee EXPO_PUBLIC_ENV_NAME y lo normaliza a nuestro AppEnv interno.
 *
 * .env.local       → EXPO_PUBLIC_ENV_NAME=local
 * .env (dev remoto)→ EXPO_PUBLIC_ENV_NAME=development
 * staging          → EXPO_PUBLIC_ENV_NAME=staging
 * prod             → EXPO_PUBLIC_ENV_NAME=production
 */
function getAppEnv(): AppEnv {
  const raw: string | undefined = process.env.EXPO_PUBLIC_ENV_NAME?.toLowerCase();

  switch (raw) {
    case 'local':
      return 'local';
    case 'development':
    case 'dev':
      return 'dev';
    case 'staging':
      return 'staging';
    case 'production':
    case 'prod':
      return 'prod';
    default:
      // Por defecto tratamos como dev remoto
      return 'dev';
  }
}

function buildB2CIssuer(tenantDomain: string, policy: string): string {
  const [tenantName] = tenantDomain.split('.');
  return `https://${tenantName}.b2clogin.com/${tenantDomain}/${policy}/v2.0`;
}

function buildTokenEndpointFromIssuer(issuer: string): string {
  const base: string = issuer.replace(/\/v2\.0$/, '');
  return `${base}/oauth2/v2.0/token`;
}

function buildEnvConfig(env: AppEnv): RawEnvConfig {
  // ==========================
  // URLs base
  // ==========================
  const apiBaseUrl: string =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    (env === 'local' ? 'http://192.168.1.5:3000' : '');

  const easyAuthBaseUrl: string =
    process.env.EXPO_PUBLIC_EASYAUTH_BASE_URL ??
    (env === 'local' ? 'http://192.168.1.5:4100' : '');

  // ==========================
  // Datos B2C / Entra (solo relevantes en dev/staging/prod)
  // ==========================
  const tenantDomain: string | undefined = process.env.EXPO_PUBLIC_TENANT_DOMAIN;
  const policy: string | undefined = process.env.EXPO_PUBLIC_B2C_POLICY;

  // Client ID (móvil) y scopes
  const clientId: string = process.env.EXPO_PUBLIC_CLIENT_ID ?? '';

  const apiScope: string | undefined = process.env.EXPO_PUBLIC_OIDC_API_SCOPE;
  const scopes: string[] =
    apiScope !== undefined && apiScope.trim().length > 0
      ? ['openid', 'offline_access', apiScope]
      : ['openid', 'offline_access'];

  // URL explícita del .well-known si la definimos
  const explicitOpenIdConfigUrl: string | undefined =
    process.env.EXPO_PUBLIC_EASYAUTH_OPENID_CONFIG_URL;

  // ==========================
  // issuer, tokenEndpoint, openIdConfigUrl
  // ==========================
  let issuer: string;
  let tokenEndpoint: string;
  let openIdConfigUrl: string;

  // Caso 1: B2C / EasyAuth real → usamos tenantDomain + policy
  // Solo si NO estamos en 'local'
  if (env !== 'local' && tenantDomain && policy) {
    issuer = buildB2CIssuer(tenantDomain, policy);

    openIdConfigUrl =
      explicitOpenIdConfigUrl && explicitOpenIdConfigUrl.length > 0
        ? explicitOpenIdConfigUrl
        : `${issuer}/.well-known/openid-configuration`;

    tokenEndpoint = buildTokenEndpointFromIssuer(issuer);
  } else {
    // Caso 2: emulador / gateway local (Auth Gateway)
    // Aquí NO queremos que tenantDomain/policy nos lleven a B2C.
    issuer = easyAuthBaseUrl;

    // Discovery del gateway local
    openIdConfigUrl =
      explicitOpenIdConfigUrl && explicitOpenIdConfigUrl.length > 0
        ? explicitOpenIdConfigUrl
        : `${easyAuthBaseUrl}/oidc/.well-known/openid-configuration`;

    // 🔧 IMPORTANTE:
    // Si tenemos un openIdConfigUrl explícito, derivamos el tokenEndpoint de ahí
    if (explicitOpenIdConfigUrl && explicitOpenIdConfigUrl.length > 0) {
      // ej: http://192.168.1.5:4100/oidc/.well-known/openid-configuration
      //  -> http://192.168.1.5:4100/oidc/token
      tokenEndpoint = explicitOpenIdConfigUrl.replace(
        '/.well-known/openid-configuration',
        '/token',
      );
    } else {
      // Fallback si no hay explícito (easyAuthBaseUrl sin /oidc en la URL)
      tokenEndpoint = `${easyAuthBaseUrl}/oidc/token`;
    }
  }

  return {
    apiBaseUrl,
    easyAuthBaseUrl,
    issuer,
    tokenEndpoint,
    openIdConfigUrl,
    clientId,
    scopes,
    tenantDomain,
    policy,
  };
}

const APP_ENV: AppEnv = getAppEnv();
const envConfig: RawEnvConfig = buildEnvConfig(APP_ENV);
const authEnabled = process.env.EXPO_PUBLIC_AUTH_ENABLED !== 'false';

const extra: ExtraConfig = {
  appEnv: APP_ENV,
  apiBaseUrl: envConfig.apiBaseUrl,
  easyAuthBaseUrl: envConfig.easyAuthBaseUrl,
  oidc: {
    issuer: envConfig.issuer,
    openIdConfigUrl: envConfig.openIdConfigUrl,
    tokenEndpoint: envConfig.tokenEndpoint,
    clientId: envConfig.clientId,
    scopes: envConfig.scopes,
    tenantDomain: envConfig.tenantDomain,
    policy: envConfig.policy,
  },
  featureFlags: {
    authEnabled,
  },
};

const expoConfig = ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FrutoSmart',
  slug: 'frutosmart',
  scheme: 'frutsmartp',
  extra,
});

export default expoConfig;
