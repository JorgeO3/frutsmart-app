import { oidcConfig } from '../config/authConfig';

export interface TokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

export type AuthorizationCodeRequestBody = {
  grant_type: 'authorization_code';
  client_id: string;
  code: string;
  redirect_uri: string;
  code_verifier: string;
  scope: string;
};

export type RefreshTokenRequestBody = {
  grant_type: 'refresh_token';
  client_id: string;
  refresh_token: string;
  scope?: string;
};

export type TokenEndpointBody =
  | AuthorizationCodeRequestBody
  | RefreshTokenRequestBody;

function buildFormUrlEncodedBody(body: TokenEndpointBody): string {
  const params = new URLSearchParams();

  params.append('grant_type', body.grant_type);
  params.append('client_id', body.client_id);

  if (body.grant_type === 'authorization_code') {
    params.append('code', body.code);
    params.append('redirect_uri', body.redirect_uri);
    params.append('code_verifier', body.code_verifier);
    params.append('scope', body.scope);
  } else {
    params.append('refresh_token', body.refresh_token);
    if (body.scope !== undefined) {
      params.append('scope', body.scope);
    }
  }

  return params.toString();
}

async function requestToken(body: TokenEndpointBody): Promise<TokenResponse> {
  const url: string = oidcConfig.tokenEndpoint;
  if (url.length === 0) {
    throw new Error('OIDC tokenEndpoint is not configured');
  }

  const response: Response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: buildFormUrlEncodedBody(body),
  });

  if (!response.ok) {
    const text: string = await response.text();
    const truncated: string = text.length > 500 ? text.slice(0, 500) : text;
    throw new Error(
      `Token endpoint error (${response.status}): ${truncated}`,
    );
  }

  const json = (await response.json()) as TokenResponse;
  return json;
}

export async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<TokenResponse> {
  const body: AuthorizationCodeRequestBody = {
    grant_type: 'authorization_code',
    client_id: oidcConfig.clientId,
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
    scope: oidcConfig.scopes.join(' '),
  };
  return requestToken(body);
}

export async function refreshTokensWithApi(params: {
  refreshToken: string;
}): Promise<TokenResponse> {
  const body: RefreshTokenRequestBody = {
    grant_type: 'refresh_token',
    client_id: oidcConfig.clientId,
    refresh_token: params.refreshToken,
    scope: oidcConfig.scopes.join(' '),
  };
  return requestToken(body);
}
