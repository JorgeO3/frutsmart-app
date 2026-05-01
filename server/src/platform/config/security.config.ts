import { registerAs } from "@nestjs/config";
import { SecurityConfig } from "./config.type";

export default registerAs<SecurityConfig>(
  "security",
  (): SecurityConfig => ({
    apiKeyHeader: process.env.BACKEND_API_KEY_HEADER || "x-internal-secret",
    internalApiSecret: process.env.BACKEND_INTERNAL_API_SECRET || "",
  }),
);
