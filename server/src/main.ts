import "dotenv/config";

import { Logger, RequestMethod, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import {
	FastifyAdapter,
	type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { useContainer } from "class-validator";
import { Logger as PinoLogger } from "nestjs-pino";

import fastifyHelmet from "@fastify/helmet";
import fastifyCompress from "@fastify/compress";
import fastifyRateLimit from "@fastify/rate-limit";

import { AppModule } from "./app.module";
import { AllConfigType } from "./platform/config/config.type";

class AppBootstrap {
	private readonly logger = new Logger("Bootstrap");
	private app: NestFastifyApplication;
	private configService: ConfigService<AllConfigType>;

	async start(): Promise<void> {
		try {
			await this.createApp();
			await this.setupMiddleware();
			this.setupGlobalFeatures();
			this.setupSwaggerDocs();
			await this.startServer();
			this.setupGracefulShutdown();
		} catch (e: unknown) {
			this.logger.error("❌ Error starting server:", e);
			throw e;
		}
	}

	private async createApp(): Promise<void> {
		const isProd = process.env.NODE_ENV === "production";

		const fastifyAdapter = new FastifyAdapter({
			logger: false,
			trustProxy: isProd,
			bodyLimit: 5 * 1024 * 1024, // 5MB
		});

		this.app = await NestFactory.create<NestFastifyApplication>(
			AppModule,
			fastifyAdapter,
			{ cors: this.getCorsConfig(), bufferLogs: true, abortOnError: false },
		);

		this.app.useLogger(this.app.get(PinoLogger));

		this.configService = this.app.get(ConfigService<AllConfigType>);
		this.app.enableShutdownHooks();
	}

	private parseOrigins(env?: string): string[] | false {
		if (!env) return false;
		const origins = env
			.split(",")
			.map((origin) => origin.trim())
			.filter(Boolean);
		return origins.length ? origins : false;
	}

	private getCorsConfig(): Record<string, unknown> {
		const configCors = this.configService?.get("cors", { infer: true });
		const allowedOrigins = this.parseOrigins(process.env.CORS_ORIGINS);

		const origin = (
			origin: string,
			callback: (err: Error | null, allow?: boolean) => void,
		) => {
			if (!origin) return callback(null, true);
			if (Array.isArray(allowedOrigins) && allowedOrigins.includes(origin)) {
				return callback(null, true);
			}
			return callback(new Error("CORS: Origin not allowed"));
		};

		return {
			origin,
			methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
			credentials: true,
			maxAge: 86400,
			exposedHeaders: [
				"Content-Disposition",
				"x-request-id",
				"x-response-time",
			],
			...configCors,
		};
	}

	private async setupMiddleware(): Promise<void> {
		const isProd =
			this.configService.getOrThrow("app.nodeEnv", { infer: true }) ===
			"production";

		await this.app.register(fastifyHelmet, {
			contentSecurityPolicy: false,
			hsts: isProd
				? { maxAge: 15552000, includeSubDomains: true, preload: false }
				: false,
			crossOriginResourcePolicy: { policy: "cross-origin" },
		});

		await this.app.register(fastifyCompress, {
			encodings: ["br", "gzip", "deflate"],
			global: true,
			threshold: 1024,
		});

		const rlEnabled =
			(this.configService.getOrThrow("app.rateLimitEnabled", { infer: true }) ??
				isProd) === true;
		const rlMax =
			this.configService.get("app.rateLimitMax", { infer: true }) ?? 100;
		const rlTimeWindow =
			this.configService.get("app.rateLimitTimeWindowMs", { infer: true }) ??
			60_000;

		if (rlEnabled) {
			await this.app.register(fastifyRateLimit, {
				max: rlMax,
				timeWindow: rlTimeWindow,
				keyGenerator: (req) =>
					(req.ip || req.headers["x-forwarded-for"] || "local") as string,
				skipOnError: true,
				allowList: isProd ? [] : ["127.0.0.1", "::1"],
				errorResponseBuilder: (_req, ctx) => ({
					status: 429,
					code: "RATE_LIMIT_EXCEEDED",
					message: "Too many requests, please try again later.",
					retryAfter: ctx.after,
					timestamp: new Date().toISOString(),
				}),
			});
		}
	}

	private setupGlobalFeatures(): void {
		// API prefix
		this.app.setGlobalPrefix(
			this.configService.getOrThrow("app.apiPrefix", { infer: true }),
			{
				exclude: [
					{ path: "health", method: RequestMethod.ALL },
					{ path: "health/(.*)", method: RequestMethod.ALL }, // wildcard para subrutas
				],
			},
		);

		// Class validator container
		useContainer(this.app.select(AppModule), { fallbackOnErrors: true });

		this.app.useGlobalPipes(
			new ValidationPipe({
				transform: true,
				whitelist: true,
				forbidNonWhitelisted: true,
				forbidUnknownValues: true,
				stopAtFirstError: false,
				transformOptions: {
					enableImplicitConversion: false,
					exposeDefaultValues: true,
				},
				validateCustomDecorators: true,
				enableDebugMessages: process.env.NODE_ENV !== "production",
				validationError: {
					target: false,
					value: process.env.NODE_ENV !== "production",
				},
			}),
		);
	}

	private setupSwaggerDocs(): void {
		const isProd =
			this.configService.getOrThrow("app.nodeEnv", { infer: true }) ===
			"production";
		if (isProd) return;

		const appName = this.configService.getOrThrow("app.name", { infer: true });
		const appVersion = this.configService.getOrThrow("app.version", {
			infer: true,
		});
		const appUrl =
			this.configService.get("app.url", { infer: true }) ??
			"http://localhost:3000";

		const config = new DocumentBuilder()
			.setTitle(`${appName} - Staging API`)
			.setDescription(
				"Staging endpoints for Plant and Field (catalog + batch ingest)",
			)
			.setVersion(appVersion)
			.addServer(appUrl)
			.addBearerAuth(undefined, "bearer")
			.addApiKey(
				{ type: "apiKey", name: "x-dev-auth", in: "header" },
				"devAuth",
			)
			.build();

		const document = SwaggerModule.createDocument(this.app, config);
		SwaggerModule.setup("docs", this.app, document, {
			jsonDocumentUrl: "docs-json",
			yamlDocumentUrl: "docs-yaml",
			swaggerOptions: { persistAuthorization: true },
			useGlobalPrefix: false,
		});

		this.logger.log("Swagger documentation available at /docs");
	}

	private async startServer(): Promise<void> {
		const port = this.configService.getOrThrow("app.port", { infer: true });
		const host =
			this.configService.get("app.host", { infer: true }) ?? "0.0.0.0";

		await this.app.listen(port, host);
		this.logStartupInfo(host, port);
	}

	private logStartupInfo(host: string, port: number): void {
		const appUrl = `http://${host}:${port}`;
		const nodeEnv = this.configService.getOrThrow("app.nodeEnv", {
			infer: true,
		});
		const apiPrefix = this.configService.getOrThrow("app.apiPrefix", {
			infer: true,
		});

		this.logger.log(`Application is running on: ${appUrl}`);
		this.logger.log(`Environment: ${nodeEnv}`);
		this.logger.log(`API Prefix: ${apiPrefix}`);
		this.logger.log(`Server: Fastify (with Pino)`);
	}

	private setupGracefulShutdown(): void {
		const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];

		signals.forEach((signal) => {
			process.on(signal, async () => {
				this.logger.log(`${signal} received, shutting down gracefully`);
				try {
					await this.app.close();
					this.logger.log("Application closed successfully");
				} catch (error: unknown) {
					this.logger.error("❌ Error during shutdown:", error);
				}
			});
		});
	}
}

function setupGlobalErrorHandlers(): void {
	process.on("uncaughtException", (error: Error) => {
		const logger = new Logger("UncaughtException");
		logger.error("Uncaught Exception:", error);
	});

	process.on(
		"unhandledRejection",
		(reason: unknown, promise: Promise<unknown>) => {
			const logger = new Logger("UnhandledRejection");
			logger.error("Unhandled Rejection at:", promise, "reason:", reason);
		},
	);
}

async function bootstrap(): Promise<void> {
	setupGlobalErrorHandlers();
	const app = new AppBootstrap();
	await app.start();
}

bootstrap().catch((error) => {
	console.error("Failed to start application:", error);
});
