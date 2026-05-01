import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { AzureBlobService } from "./azure-blob.client";
import {
  createBlobServiceClient,
  type AzureBlobClientBundle,
} from "./azure-blob.client";

import azureConfig from "../../config/azure.config";
import appConfig from "../../config/app.config";
import { ConfigFacade } from "../../config/config.facade";

export const AZURE_BLOB_SERVICE_CLIENT = "AZURE_BLOB_SERVICE_CLIENT";

type AzureConfig = ConfigType<typeof azureConfig>;
type AppConfig = ConfigType<typeof appConfig>;

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: AZURE_BLOB_SERVICE_CLIENT,
      inject: [azureConfig.KEY, appConfig.KEY],
      useFactory: (azure: AzureConfig, app: AppConfig) =>
        createBlobServiceClient({
          accountUrl: azure.accountUrl,
          userAgent: app.name ?? "frutsmart-api",
          retry: { maxTries: 4, tryTimeoutInMs: 30_000 },
        }),
    },
    {
      provide: AzureBlobService,
      inject: [AZURE_BLOB_SERVICE_CLIENT, ConfigFacade],
      useFactory: (bundle: AzureBlobClientBundle, facade: ConfigFacade) =>
        new AzureBlobService(bundle.serviceClient, facade),
    },
  ],
  exports: [AzureBlobService, AZURE_BLOB_SERVICE_CLIENT],
})
export class AzureBlobModule {}
