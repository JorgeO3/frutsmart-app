import type { Config } from "jest";

const config: Config = {
	displayName: "unit",
	testEnvironment: "node",
	rootDir: ".",
	// Solo ejecutar tests unitarios del directorio modules por defecto
	testMatch: ["<rootDir>/src/modules/**/*.spec.ts"],
	transform: {
		"^.+\\.(t|j)s$": [
			"@swc/jest",
			{
				jsc: {
					parser: {
						syntax: "typescript",
						decorators: true,
					},
					transform: {
						legacyDecorator: true,
						decoratorMetadata: true,
					},
					target: "es2021",
				},
				module: {
					type: "commonjs",
				},
			},
		],
	},
	moduleFileExtensions: ["js", "json", "ts"],
	collectCoverageFrom: [
		// Solo coverage del directorio modules
		"src/modules/**/*.ts",
		"!src/modules/**/*.spec.ts",
		"!src/modules/**/*.int.spec.ts",
		"!src/modules/**/*.e2e-spec.ts",
		"!src/modules/**/*.module.ts",
		"!src/modules/**/index.ts",
	],
	coverageDirectory: "coverage/unit",
	coverageReporters: ["text", "lcov", "html"],
	setupFilesAfterEnv: ["<rootDir>/test/jest/jest-setup.unit.ts"],
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/src/$1",
		"^@common/(.*)$": "<rootDir>/src/common/$1",
		"^@config/(.*)$": "<rootDir>/src/config/$1",
		"^@modules/(.*)$": "<rootDir>/src/modules/$1",
		"^@shared/(.*)$": "<rootDir>/src/shared/$1",
	},
	testPathIgnorePatterns: [
		"/node_modules/",
		"/dist/",
		"/trash/",
		"\\.int\\.spec\\.ts$",
		"\\.e2e-spec\\.ts$",
	],
	// Performance optimizations
	maxWorkers: "50%",
	cache: true,
	cacheDirectory: "<rootDir>/.jest-cache/unit",
	// Better error output
	verbose: true,
	bail: false,
	errorOnDeprecated: true,
};

export default config;
