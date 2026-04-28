import { registerAs } from "@nestjs/config";
import { SecurityConfig } from "./config.type";

export default registerAs<SecurityConfig>(
	"security",
	(): SecurityConfig => ({
		apiKeyHeader: process.env.API_KEY_HEADER || "x-internal-secret",
		internalApiSecret: process.env.INTERNAL_API_SECRET || "",
	}),
);
