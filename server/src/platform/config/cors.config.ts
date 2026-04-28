import { registerAs } from "@nestjs/config";

export interface CorsConfig {
	origin: string[] | boolean;
	methods: string[];
	credentials: boolean;
	maxAge: number;
}

export default registerAs(
	"cors",
	(): CorsConfig => ({
		origin: process.env.CORS_ORIGINS?.split(",") || false,
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		credentials: true,
		maxAge: 86400, // 24 hours
	}),
);
