#!/usr/bin/env -S deno run --allow-read --allow-write

// @ts-nocheck

import { parseArgs } from "jsr:@std/cli/parse-args";
import { encodeBase64 } from "jsr:@std/encoding/base64";
import { basename, dirname, extname, join } from "jsr:@std/path";

// --- CONFIGURATION ---
const SUPPORTED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

// --- ANSI COLORS ---
const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  white: "\x1b[97m",
  gray: "\x1b[90m",
} as const;

// --- LOGGER ---
class Logger {
  static info(message: string): void {
    console.log(
      `${COLORS.cyan}${COLORS.bold}[INFO]${COLORS.reset}    : ${message}`,
    );
  }

  static error(message: string): void {
    console.error(
      `${COLORS.red}${COLORS.bold}[ERROR]${COLORS.reset}   : ${message}`,
    );
  }

  static success(message: string): void {
    console.log(
      `${COLORS.green}${COLORS.bold}[SUCCESS]${COLORS.reset} : ${message}`,
    );
  }

  static warn(message: string): void {
    console.log(
      `${COLORS.yellow}${COLORS.bold}[WARN]${COLORS.reset}    : ${message}`,
    );
  }
}

// --- CLI HANDLING ---
function showUsage(): void {
  const usage = `
${COLORS.bold}${COLORS.cyan}Image to Base64 Encoder${COLORS.reset}

A Deno utility to concurrently encode multiple image files or entire directories into Base64 format.

${COLORS.bold}Usage:${COLORS.reset} ${COLORS.white}b64.ts${COLORS.reset} ${COLORS.yellow}[options]${COLORS.reset} ${COLORS.green}<path_1> <path_2> ...${COLORS.reset}

${COLORS.bold}Arguments:${COLORS.reset}
  ${COLORS.green}${COLORS.bold}path...${COLORS.reset}        One or more paths to input files or directories.

${COLORS.bold}Options:${COLORS.reset}
  ${COLORS.yellow}${COLORS.bold}-o, --output <dir>${COLORS.reset}  Optional output directory. If not provided, files are
                       saved next to their original source.
  ${COLORS.yellow}${COLORS.bold}-h, --help${COLORS.reset}           Show this help message.

${COLORS.bold}Examples:${COLORS.reset}
  ${COLORS.gray}# Convert a single image (saves as my_logo.b64 in the same folder)${COLORS.reset}
  ${COLORS.white}./b64.ts${COLORS.reset} ${COLORS.green}./my_logo.png${COLORS.reset}

  ${COLORS.gray}# Convert multiple images concurrently and save to a specific output folder${COLORS.reset}
  ${COLORS.white}./b64.ts${COLORS.reset} ${COLORS.yellow}-o ./output_folder${COLORS.reset} ${COLORS.green}img1.jpg img2.webp${COLORS.reset}

  ${COLORS.gray}# Concurrently convert all valid images inside a directory recursively${COLORS.reset}
  ${COLORS.white}./b64.ts${COLORS.reset} ${COLORS.green}./assets/images${COLORS.reset}
`.trim();

  console.log(usage);
}

function parseCliArgs(): { inputPaths: string[]; outputPath?: string } {
  const parsed = parseArgs(Deno.args, {
    boolean: ["help"],
    string: ["output"],
    alias: { h: "help", o: "output" },
  });

  const inputPaths = parsed._ as string[];

  if (parsed.help || inputPaths.length === 0) {
    showUsage();
    Deno.exit(0);
  }

  return { inputPaths, outputPath: parsed.output };
}

// --- FILE & DIRECTORY DISCOVERY ---

/**
 * Recursively finds all file paths within a directory.
 * @param dirPath The path to the directory.
 * @returns A promise that resolves to an array of file paths.
 */
async function collectFilesFromDir(dirPath: string): Promise<string[]> {
  let files: string[] = [];
  for await (const entry of Deno.readDir(dirPath)) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory) {
      files = files.concat(await collectFilesFromDir(fullPath));
    } else if (entry.isFile) {
      files.push(fullPath);
    }
  }
  return files;
}

// --- IMAGE PROCESSING ---

/**
 * Encodes a single image file to Base64 and saves it.
 * @param inputFilePath The path to the input image.
 * @param outputDir Optional directory to save the output file.
 */
async function processImage(
  inputFilePath: string,
  outputDir?: string,
): Promise<void> {
  // This function is now focused solely on processing one file.
  // The filtering logic is handled before calling this function.
  Logger.info(`Processing file: ${COLORS.bold}${inputFilePath}${COLORS.reset}`);

  const imageData = await Deno.readFile(inputFilePath);
  const base64String = encodeBase64(imageData);

  const fileExtension = extname(inputFilePath);
  const baseName = basename(inputFilePath, fileExtension);
  const newName = `${baseName}.b64`;
  const finalOutputDir = outputDir ?? dirname(inputFilePath);

  await Deno.mkdir(finalOutputDir, { recursive: true });

  const outputFilePath = join(finalOutputDir, newName);

  await Deno.writeTextFile(outputFilePath, base64String);

  const originalSize = (imageData.length / 1024).toFixed(2);
  const newSize = (base64String.length / 1024).toFixed(2);

  Logger.success(
    `Saved to ${COLORS.bold}${outputFilePath}${COLORS.reset} | ${originalSize} KB -> ${newSize} KB`,
  );
}

// --- MAIN EXECUTION ---
if (import.meta.main) {
  try {
    const { inputPaths, outputPath } = parseCliArgs();

    Logger.info("Discovering files to process...");

    // 1. Collect all potential file paths from arguments
    const allFilePaths: string[] = [];
    for (const path of inputPaths) {
      try {
        const fileInfo = await Deno.stat(path);
        if (fileInfo.isDirectory) {
          Logger.info(
            `Scanning directory: ${COLORS.bold}${path}${COLORS.reset}`,
          );
          allFilePaths.push(...(await collectFilesFromDir(path)));
        } else if (fileInfo.isFile) {
          allFilePaths.push(path);
        }
      } catch (e) {
        if (e instanceof Deno.errors.NotFound) {
          Logger.error(`Input path not found: ${path}`);
        } else {
          const err = e instanceof Error ? e : new Error(String(e));
          Logger.error(`An error occurred with path ${path}: ${err.message}`);
        }
      }
    }

    // 2. Filter for supported image types
    const validImagePaths = allFilePaths.filter((path) =>
      SUPPORTED_EXTENSIONS.includes(extname(path).toLowerCase()),
    );

    if (validImagePaths.length === 0) {
      Logger.warn("No supported image files found to process.");
      Deno.exit(0);
    }

    Logger.info(
      `Found ${COLORS.bold}${validImagePaths.length}${COLORS.reset} image(s). Starting concurrent processing...`,
    );

    // 3. Create a promise for each file processing task
    const processingPromises = validImagePaths.map((path) =>
      processImage(path, outputPath),
    );

    // 4. Execute all promises concurrently and wait for all to finish
    const results = await Promise.allSettled(processingPromises);

    // 5. Tally the results
    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failedCount = results.length - successCount;

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        Logger.error(
          `Failed to process ${validImagePaths[index]}: ${
            result.reason?.message ?? result.reason
          }`,
        );
      }
    });

    // Final Report
    console.log("\n----------------------------------------");
    Logger.success("Processing complete!");
    Logger.info(`Successfully converted: ${successCount} files`);
    if (failedCount > 0) {
      Logger.error(`Failed to convert: ${failedCount} files`);
    }
    console.log("----------------------------------------");
  } catch (error) {
    Logger.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}
