// src/services/auth/authClient.ts
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import {
  exchangeCodeForTokens,
  type TokenResponse,
} from '../../api/authApi';
import { authEnabled, oidcConfig } from '../../config/authConfig';

// Métodos de Skybolt (nativo)
import {
  clearAuthTokens as skyboltClearAuthTokens,
  getValidAccessToken as skyboltGetValidAccessToken,
  notifyAuthRefreshed as skyboltNotifyAuthRefreshed,
  setAuthTokens as skyboltSetAuthTokens,
} from 'skybolt';
import type { AuthTokens } from 'skybolt';

WebBrowser.maybeCompleteAuthSession();

// ============================================================================
// Tipos auxiliares
// ============================================================================

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

// `AuthSessionResult` es un type (unión), así que lo extendemos con &
type AuthSessionResultWithParams = AuthSession.AuthSessionResult & {
  params?: Record<string, string>;
};

// ============================================================================
// Constantes
// ============================================================================

// 6 meses de validez para el refresh token (180 días)
const REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 180;

// Scheme registrado en app.config.ts (ej: "frutosmart")
const REDIRECT_SCHEME = 'frutsmartp';

// ============================================================================
// Helpers internos
// ============================================================================

function computeAccessExpiresAtMs(expiresInSeconds: number): number {
  return Date.now() + expiresInSeconds * 1000;
}

function computeRefreshExpiresAtMs(): number {
  return Date.now() + REFRESH_TOKEN_TTL_MS;
}

function buildBypassTokens(): AuthTokens {
  const now = Date.now();
  return {
    accessToken: `auth-bypass-${now}`,
    refreshToken: `auth-bypass-refresh-${now}`,
    idToken: `auth-bypass-id-${now}`,
    accessExpiresAtMs: now + 1000 * 60 * 60,
    refreshExpiresAtMs: now + REFRESH_TOKEN_TTL_MS,
  };
}

/**
 * Descarga el documento de discovery OIDC desde tu emulador / B2C real.
 */
async function getDiscovery(): Promise<AuthSession.DiscoveryDocument> {
  const issuer = oidcConfig.issuer;
  const openIdConfigUrl = oidcConfig.openIdConfigUrl;

  console.log('[Auth] getDiscovery() issuer =', issuer);
  if (openIdConfigUrl) {
    console.log('[Auth] getDiscovery() openIdConfigUrl =', openIdConfigUrl);
  }

  const discovery: AuthSession.DiscoveryDocument =
    await AuthSession.fetchDiscoveryAsync(issuer);

  const discoveryForLog: JsonValue = {
    authorizationEndpoint: discovery.authorizationEndpoint ?? 'n/a',
    tokenEndpoint: discovery.tokenEndpoint ?? 'n/a',
    issuer: (discovery as { issuer?: string }).issuer ?? 'n/a',
    endSessionEndpoint: discovery.endSessionEndpoint ?? 'n/a',
  };

  console.log(
    '[Auth] Discovery loaded:',
    JSON.stringify(discoveryForLog),
  );

  return discovery;
}

// ============================================================================
// API pública de autenticación
// ============================================================================

/**
 * Flujo interactivo de login:
 *  - Authorization Code + PKCE con expo-auth-session.
 *  - Intercambia code -> tokens con tu API (emulador / B2C real).
 *  - Construye AuthTokens y los guarda en el store nativo de Skybolt.
 */
export async function signInInteractive(): Promise<AuthTokens> {
  if (!authEnabled) {
    console.warn('[Auth] Auth desactivada por feature flag; login OIDC omitido');
    const bypassTokens = buildBypassTokens();
    await skyboltSetAuthTokens(bypassTokens);
    await skyboltNotifyAuthRefreshed();
    return bypassTokens;
  }

  console.log('[Auth] signInInteractive() → inicio');

  const discovery: AuthSession.DiscoveryDocument = await getDiscovery();

  // ✅ En dev: deja que Expo genere el redirectUri correcto para el dev build
  const redirectUri: string = AuthSession.makeRedirectUri({ scheme: REDIRECT_SCHEME });
  console.log('[Auth] Redirect URI generado:', redirectUri);

  console.log('[Auth] Creando AuthRequest…');

  const authRequest = new AuthSession.AuthRequest({
    clientId: oidcConfig.clientId,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: oidcConfig.scopes,
    usePKCE: true,
  });

  console.log(
    '[Auth] AuthRequest creada:',
    JSON.stringify(
      {
        clientId: oidcConfig.clientId,
        redirectUri,
        scopes: oidcConfig.scopes,
        usePKCE: true,
      },
      null,
      2,
    ),
  );

  // ✅ Forzamos a que expo-auth-session inicialice PKCE (codeVerifier / codeChallenge)
  await authRequest.getAuthRequestConfigAsync();

  if (!authRequest.codeVerifier) {
    console.error(
      '[Auth] codeVerifier es undefined después de getAuthRequestConfigAsync',
    );
    throw new Error('PKCE no está configurado correctamente');
  }

  const codeVerifier: string = authRequest.codeVerifier;

  console.log(
    '[Auth] PKCE cargado, codeVerifier presente:',
    codeVerifier.length > 0,
  );

  const promptOptions: AuthSession.AuthRequestPromptOptions = {
    showInRecents: true,
  };

  console.log('[Auth] Lanzando promptAsync…');

  const rawResult: AuthSession.AuthSessionResult =
    await authRequest.promptAsync(discovery, promptOptions);

  const result: AuthSessionResultWithParams =
    rawResult as AuthSessionResultWithParams;

  console.log(
    '[Auth] Resultado promptAsync:',
    JSON.stringify(result as JsonValue),
  );

  if (result.type !== 'success') {
    console.error('[Auth] Login cancelado o fallido, type =', result.type);
    throw new Error('Login cancelado o fallido (sin authorization code)');
  }

  const params: Record<string, string> | undefined = result.params;

  if (!params?.code) {
    console.error('[Auth] params inválidos o sin code:', params);
    throw new Error('El proveedor no devolvió un authorization code válido');
  }

  const code: string = params.code;

  console.log('[Auth] Authorization code recibido:', code);

  // Intercambio code -> tokens usando tu API (emulador / B2C real)
  console.log('[Auth] Intercambiando code por tokens en tokenEndpoint…');
  const tokenResponse: TokenResponse = await exchangeCodeForTokens({
    code,
    codeVerifier, // ← aquí ya es string, sin error TS
    redirectUri,
  });

  console.log(
    '[Auth] TokenResponse recibido:',
    JSON.stringify(
      {
        hasAccessToken: tokenResponse.access_token !== undefined,
        hasRefreshToken: tokenResponse.refresh_token !== undefined,
        hasIdToken: tokenResponse.id_token !== undefined,
        expiresIn: tokenResponse.expires_in,
        scope: tokenResponse.scope,
        tokenType: tokenResponse.token_type,
      },
      null,
      2,
    ),
  );

  if (tokenResponse.access_token === undefined) {
    throw new Error('Respuesta de token inválida: falta access_token');
  }
  if (tokenResponse.expires_in === undefined) {
    throw new Error('Respuesta de token inválida: falta expires_in');
  }
  if (tokenResponse.refresh_token === undefined) {
    throw new Error('Respuesta de token inválida: falta refresh_token');
  }
  if (tokenResponse.id_token === undefined) {
    throw new Error('Respuesta de token inválida: falta id_token');
  }

  const accessExpiresAtMs: number = computeAccessExpiresAtMs(
    tokenResponse.expires_in,
  );
  const refreshExpiresAtMs: number = computeRefreshExpiresAtMs();

  const authTokens: AuthTokens = {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    idToken: tokenResponse.id_token,
    accessExpiresAtMs,
    refreshExpiresAtMs,
  };

  console.log(
    '[Auth] AuthTokens construidos:',
    JSON.stringify(
      {
        accessExpiresAtMs,
        refreshExpiresAtMs,
      },
      null,
      2,
    ),
  );

  // Persistimos en el store nativo de Skybolt (Kotlin también los ve)
  console.log('[Auth] Guardando tokens en Skybolt…');
  await skyboltSetAuthTokens(authTokens);
  await skyboltNotifyAuthRefreshed();
  console.log('[Auth] Tokens guardados y notifyAuthRefreshed enviado');

  return authTokens;
}

/**
 * Devuelve un access token válido:
 *  - Primero pregunta a Skybolt (Kotlin puede refrescar internamente).
 *  - Si no hay token válido, fuerza login interactivo.
 */
export async function getValidAccessToken(): Promise<string> {
  if (!authEnabled) {
    const fromNative = await skyboltGetValidAccessToken();
    if (fromNative !== null && fromNative.length > 0) {
      return fromNative;
    }

    const bypassTokens = buildBypassTokens();
    await skyboltSetAuthTokens(bypassTokens);
    await skyboltNotifyAuthRefreshed();
    return bypassTokens.accessToken;
  }

  console.log('[Auth] getValidAccessToken() → inicio');

  const fromNative: string | null = await skyboltGetValidAccessToken();

  console.log(
    '[Auth] getValidAccessToken() desde Skybolt:',
    fromNative !== null
      ? `token (length=${fromNative.length})`
      : 'null / no token',
  );

  if (fromNative !== null && fromNative.length > 0) {
    return fromNative;
  }

  console.log('[Auth] No hay token válido en Skybolt, forzando login…');

  await signInInteractive();

  const afterLogin: string | null = await skyboltGetValidAccessToken();

  console.log(
    '[Auth] getValidAccessToken() después de login:',
    afterLogin !== null
      ? `token (length=${afterLogin.length})`
      : 'null / no token',
  );

  if (afterLogin !== null && afterLogin.length > 0) {
    return afterLogin;
  }

  throw new Error(
    'No se pudo obtener un access token válido ni después de login interactivo',
  );
}

/**
 * Logout local:
 *  - Limpia tokens en el store nativo de Skybolt.
 *  - (Opcional) puedes añadir logout global en B2C abriendo end_session_endpoint.
 */
export async function signOut(): Promise<void> {
  console.log('[Auth] signOut() → limpiando tokens en Skybolt');
  await skyboltClearAuthTokens();

  // Logout global opcional:
  // const discovery = await getDiscovery();
  // if (discovery.endSessionEndpoint) {
  //   const redirectUri = AuthSession.makeRedirectUri({ scheme: REDIRECT_SCHEME });
  //   const url = `${discovery.endSessionEndpoint}?post_logout_redirect_uri=${encodeURIComponent(
  //     redirectUri,
  //   )}`;
  //   await WebBrowser.openBrowserAsync(url);
  // }
}
