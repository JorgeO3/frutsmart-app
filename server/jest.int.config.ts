import type { Config } from "jest";

const config: Config = {
	rootDir: ".",
	testEnvironment: "node",
	testRegex: ".*\\.int\\.spec\\.ts$",
	moduleFileExtensions: ["ts", "js", "json"],
	cache: true,
	cacheDirectory: "<rootDir>/.jest-cache-int",
	transform: {
		"^.+\\.(t|j)sx?$": [
			"@swc/jest",
			{
				sourceMaps: false,
				module: { type: "commonjs" },
				jsc: {
					target: "es2022",
					parser: { syntax: "typescript", decorators: true },
					transform: { legacyDecorator: true, decoratorMetadata: true },
					externalHelpers: true,
					keepClassNames: true,
				},
			},
		],
	},
	transformIgnorePatterns: ["/node_modules/"],
	setupFilesAfterEnv: ["<rootDir>/test/jest/jest-setup.int.ts"],
	// Ajusta si usas paths de TS
	moduleNameMapper: {
		"^src/(.*)$": "<rootDir>/src/$1",
	},
	verbose: false,
	maxWorkers: "50%",
	collectCoverageFrom: [
		"src/**/*.ts",
		"!src/main.ts",
		"!src/**/*.spec.ts",
		"!src/**/*.module.ts",
	],
	coverageDirectory: "<rootDir>/coverage/integration",
};

export default config;
