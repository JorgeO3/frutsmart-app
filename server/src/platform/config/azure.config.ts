import { registerAs } from "@nestjs/config";
import { AzureConfig } from "./config.type";

export default registerAs<AzureConfig>(
  "azure",
  (): AzureConfig => ({
    accountUrl: process.env.AZURE_STORAGE_ACCOUNT_URL,
    publicBaseUrl: process.env.AZURE_STORAGE_PUBLIC_BASE_URL,
    containerPlant: process.env.AZURE_STORAGE_CONTAINER_PLANT || "plant",
    containerField: process.env.AZURE_STORAGE_CONTAINER_FIELD || "field",
    defaultContainer: process.env.AZURE_DEFAULT_CONTAINER,
    sasTtlMinutes: process.env.AZURE_STORAGE_SAS_TTL_MINUTES
      ? parseInt(process.env.AZURE_STORAGE_SAS_TTL_MINUTES, 10)
      : undefined,
    sasVersion: process.env.AZURE_SAS_VERSION,
  }),
);
