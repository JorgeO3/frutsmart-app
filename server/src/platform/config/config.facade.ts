import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
	AllConfigType,
	AppConfig,
	AzureConfig,
	SecurityConfig,
} from "./config.type";

// Centralized, strongly-typed facade to access configuration slices without scattering string keys.
// - Enforces compile-time safety on section names.
// - Provides helper methods (require*, isProd, etc.).
// - Keeps services slimmer: inject ConfigFacade instead of raw ConfigService.
@Injectable()
export class ConfigFacade {
	constructor(
		@Inject(ConfigService)
		private readonly cfg: ConfigService<AllConfigType, true>,
	) {}

	// Section getters -----------------------------------------------------------------
	get app(): AppConfig {
		return this.cfg.get("app");
	}
	get azure(): AzureConfig {
		return this.cfg.get("azure");
	}
	get security(): SecurityConfig {
		return this.cfg.get("security");
	}

	// Generic section getter (rarely needed directly)
	getSection<K extends keyof AllConfigType>(k: K): AllConfigType[K] {
		return this.cfg.get(k);
	}

	// Required accessors (fail fast) ---------------------------------------------------
	requireApp<K extends keyof AppConfig>(k: K): NonNullable<AppConfig[K]> {
		const v = this.app[k];
		if (v == null) throw new Error(`Missing required app.${String(k)}`);
		return v;
	}

	requireAzure<K extends keyof AzureConfig>(k: K): NonNullable<AzureConfig[K]> {
		const v = this.azure[k];
		if (v == null) throw new Error(`Missing required azure.${String(k)}`);
		return v;
	}

	requireSecurity<K extends keyof SecurityConfig>(
		k: K,
	): NonNullable<SecurityConfig[K]> {
		const v = this.security[k];
		if (v == null) throw new Error(`Missing required security.${String(k)}`);
		return v;
	}

	// Environment helpers --------------------------------------------------------------
	isProd(): boolean {
		return this.app.nodeEnv === "production";
	}
	isDev(): boolean {
		return this.app.nodeEnv === "development" || this.app.nodeEnv === "local";
	}
	isTest(): boolean {
		return this.app.nodeEnv === "test";
	}
}
