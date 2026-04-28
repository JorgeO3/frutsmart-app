import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

// Importante en mobile: cierra la sesión si la app fue relanzada por el redirect.
WebBrowser.maybeCompleteAuthSession();

// ============ Config básica (reemplaza con tu config real) ============
// External ID / B2C usa un "user flow" (policy). Ej: B2C_1_signin_signup
const TENANT_DOMAIN = '<your-tenant>.onmicrosoft.com';
const POLICY = 'B2C_1_signin_signup';
const CLIENT_ID = '<mobile-app-client-id>';

// En producción NO uses proxy: define tu scheme y agrégalo en app.json/app.config.ts
// ej. "scheme": "myapp"
const REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: 'myapp',
  // useProxy: false // implícito en builds nativas
});

// Scopes: openid + offline_access para refresh token + tu API (.default o scopes específicos)
const SCOPE = [
  'openid',
  'offline_access',
  'https://<your_api_app_id_uri>/.default',
];

// Margen para evitar expiración al límite (30s)
const CLOCK_SKEW_MS = 30_000;

// Clave para SecureStore (v2 por si migras desde una versión previa)
const KEY = 'authTokens_v2';

// ============ Tipos ============
type StoredTokens = {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number; // epoch ms
};

// ============ Discovery dinámico (B2C/External ID) ============
// Importante: issuer incluye policy y v2.0
// https://{tenant}.b2clogin.com/{tenant}.onmicrosoft.com/{policy}/v2.0
const ISSUER = `https://${TENANT_DOMAIN.split('.')[0]}.b2clogin.com/${TENANT_DOMAIN}/${POLICY}/v2.0`;

async function getDiscovery(): Promise<AuthSession.DiscoveryDocument> {
  // Construye la URL .well-known/openid-configuration y la descarga
  return await AuthSession.fetchDiscoveryAsync(ISSUER);
}

// ============ SecureStore helpers ============
async function getTokens(): Promise<StoredTokens | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  return raw ? (JSON.parse(raw) as StoredTokens) : null;
}

async function setTokens(t: StoredTokens): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(t), {
    // iOS: accesible tras primer desbloqueo, no migra a otros dispositivos
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}

// ============ Sign-in interactivo (Authorization Code + PKCE) ============
export async function signInInteractive(): Promise<StoredTokens> {
  const discovery = await getDiscovery();

  const req = new AuthSession.AuthRequest({
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    responseType: AuthSession.ResponseType.Code,
    scopes: SCOPE,
    usePKCE: true,
    // Si tu policy requiere response_mode=form_post, ajusta así:
    // extraParams: { response_mode: 'query' } // o 'form_post' según tu configuración
  });

  if (!req.codeVerifier) {
    throw new Error('PKCE no está configurado correctamente');
  }

  // Opciones VÁLIDAS para promptAsync (no mezclar con WebBrowserOpenOptions)
  const promptOptions: AuthSession.AuthRequestPromptOptions = {
    // Normalmente en producción NO usas el proxy
    // useProxy: false, // por defecto false al usar deep links
    // iOS: si quieres evitar SSO vía cookies de Safari, usa sesión efímera
    // preferEphemeralSession: true,
    // Web-only (si compilas web): windowFeatures: 'toolbar=no,location=no'
  };

  // Abre el navegador nativo y espera el authorization code
  const result = await req.promptAsync(discovery, promptOptions);

  if (result.type !== 'success' || !result.params?.code) {
    throw new Error('Login cancelado o sin authorization code');
  }

  // Intercambio code -> tokens
  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId: CLIENT_ID,
      code: result.params.code,
      redirectUri: REDIRECT_URI,
      extraParams: { code_verifier: req.codeVerifier },
    },
    discovery
  );

  if (!tokenResult.accessToken || !tokenResult.expiresIn) {
    throw new Error('Respuesta de token inválida');
  }

  const tokens: StoredTokens = {
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken ?? undefined,
    idToken: tokenResult.idToken ?? undefined,
    expiresAt: Date.now() + tokenResult.expiresIn * 1000 - CLOCK_SKEW_MS,
  };

  await setTokens(tokens);
  return tokens;
}

// ============ Refresh token (offline_access) ============
async function refreshTokens(current: StoredTokens): Promise<StoredTokens> {
  const discovery = await getDiscovery();

  if (!current.refreshToken) {
    // Sin refresh -> forzar login interactivo
    return await signInInteractive();
  }

  const refreshed = await AuthSession.refreshAsync(
    {
      clientId: CLIENT_ID,
      refreshToken: current.refreshToken,
      // Algunas configuraciones de B2C requieren repetir scopes aquí:
      // scopes: SCOPE,
    },
    discovery
  );

  if (!refreshed.accessToken || !refreshed.expiresIn) {
    throw new Error('Refresh inválido');
  }

  const updated: StoredTokens = {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? current.refreshToken, // rolling refresh
    idToken: refreshed.idToken ?? current.idToken,
    expiresAt: Date.now() + refreshed.expiresIn * 1000 - CLOCK_SKEW_MS,
  };

  await setTokens(updated);
  return updated;
}

// ============ Helper principal: Access Token válido ============
export async function getValidAccessToken(): Promise<string> {
  let tokens = await getTokens();

  if (!tokens) {
    tokens = await signInInteractive();
    return tokens.accessToken;
  }

  // ¿Sigue vigente?
  if (Date.now() < tokens.expiresAt && tokens.accessToken) {
    return tokens.accessToken;
  }

  // Intentar refresh
  tokens = await refreshTokens(tokens);
  return tokens.accessToken;
}

// ============ Sign-out ============
export async function signOut(): Promise<void> {
  // Limpia el almacenamiento local.
  await clearTokens();

  // Opcional: sign-out global abriendo end_session_endpoint (si tu policy lo define)
  // const discovery = await getDiscovery();
  // if (discovery.endSessionEndpoint) {
  //   const url = `${discovery.endSessionEndpoint}?post_logout_redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  //   await WebBrowser.openBrowserAsync(url);
  // }
}
