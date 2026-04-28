import { Config } from "jest";

const config: Config = {
	rootDir: "..",
	testEnvironment: "node",
	testRegex: ".*\\.e2e-spec\\.ts$",
	moduleFileExtensions: ["ts", "js", "json"],
	cache: true,
	cacheDirectory: "<rootDir>/.jest-cache-e2e",
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
	setupFilesAfterEnv: ["<rootDir>/test/jest/jest-setup.e2e.ts"],
	moduleNameMapper: {
		"^src/(.*)$": "<rootDir>/src/$1",
	},
	verbose: false,
	// E2E suele necesitar single-process
	maxWorkers: 1,
	collectCoverageFrom: [
		"src/**/*.ts",
		"!src/main.ts",
		"!src/**/*.spec.ts",
		"!src/**/*.module.ts",
	],
	coverageDirectory: "<rootDir>/coverage/e2e",
};

export default config;
