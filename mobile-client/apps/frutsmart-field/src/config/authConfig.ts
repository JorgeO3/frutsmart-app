import Constants from 'expo-constants';
import type { AppEnv } from '../../app.config';

export interface OidcConfig {
  issuer: string;
  openIdConfigUrl: string;
  tokenEndpoint: string;
  clientId: string;
  scopes: string[];
  tenantDomain?: string;
  policy?: string;
}

export interface AppExtraConfig {
  appEnv: AppEnv;
  apiBaseUrl: string;
  easyAuthBaseUrl: string;
  oidc: OidcConfig;
  featureFlags: {
    authEnabled: boolean;
    uploadJobDeletionEnabled: boolean;
  };
}

const extraConfig: AppExtraConfig | undefined = Constants.expoConfig
  ?.extra as AppExtraConfig | undefined;

if (extraConfig === undefined) {
  throw new Error('Expo extra config is missing. Check app.config.ts.');
}

export const appEnv: AppEnv = extraConfig.appEnv;
export const apiBaseUrl: string = extraConfig.apiBaseUrl;
export const easyAuthBaseUrl: string = extraConfig.easyAuthBaseUrl;
export const oidcConfig: OidcConfig = extraConfig.oidc;
export const authEnabled: boolean = extraConfig.featureFlags?.authEnabled ?? true;
const uploadJobDeletionEnabledEnv =
  process.env.EXPO_PUBLIC_UPLOAD_JOB_DELETE_ENABLED?.toLowerCase();

export const uploadJobDeletionEnabled: boolean =
  appEnv === 'local' &&
  (uploadJobDeletionEnabledEnv === 'true' ||
    extraConfig.featureFlags?.uploadJobDeletionEnabled === true);
