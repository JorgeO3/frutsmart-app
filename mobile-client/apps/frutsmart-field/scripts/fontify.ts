#!/usr/bin/env -S deno run --allow-env --allow-run --allow-read --allow-write

// @ts-nocheck

import { parseArgs } from "jsr:@std/cli/parse-args";
import { encodeBase64 } from "jsr:@std/encoding/base64";

const UNICODES = [
  "U+0020-007E", // Basic ASCII
  "U+00A1,U+00BF", // ¡¿
  "U+00C1,U+00C9,U+00CD,U+00D3,U+00DA,U+00DC", // ÁÉÍÓÚÜ
  "U+00D1", // Ñ
  "U+00E1,U+00E9,U+00ED,U+00F3,U+00FA,U+00FC", // áéíóúüñ
];

const DROP_TABLES = ["BASE", "DSIG", "PCLT", "VDMX", "STAT", "MVAR", "GDEF"];

const FONT_FACE = {
  weights: "100 900",
  style: "normal",
  display: "swap",
} as const;

// --- CONFIGURATION ---
const CONFIG = {
  unicodes: UNICODES.join(","),
  dropTables: DROP_TABLES.join(","),
  fontFace: FONT_FACE,
} as const;

// --- ANSI COLORS ---
const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  white: "\x1b[97m",
} as const;

// --- TYPES ---
interface CliParams {
  input: string;
  base: string;
  fontName?: string;
  autoName: boolean;
  keepIntermediates: boolean;
}

interface ProcessingResult {
  originalSize: number;
  optimizedSize: number;
  reductionPercent: string;
  outputCss: string;
  fontName: string;
}

// --- LOGGER ---
class Logger {
  static info(message: string): void {
    console.log(
      `${COLORS.cyan}${COLORS.bold}[INFO] ${COLORS.reset}: ${message}`,
    );
  }

  static warn(message: string): void {
    console.log(
      `${COLORS.yellow}${COLORS.bold}[WARN] ${COLORS.reset}: ${message}`,
    );
  }

  static error(message: string): void {
    console.error(
      `${COLORS.red}${COLORS.bold}[ERROR]${COLORS.reset}: ${message}`,
    );
  }

  static success(message: string): void {
    console.log(
      `${COLORS.green}${COLORS.bold}[SUCCESS]${COLORS.reset}: ${message}`,
    );
  }
}

// --- UTILITIES ---
async function getFileSize(path: string): Promise<number> {
  const { size } = await Deno.stat(path);
  return size / 1024; // KB
}

function formatFileSize(sizeKb: number): string {
  return `${sizeKb.toFixed(2)} KB`;
}

// --- CLI HANDLING ---
function showUsage(): void {
  const usage = `
${COLORS.bold}${COLORS.cyan}TTF to Inline WOFF2 Converter${COLORS.reset}

${COLORS.bold}Usage:${COLORS.reset} ${COLORS.white}fontify.ts${COLORS.reset} ${COLORS.yellow}[options]${COLORS.reset} ${COLORS.green}<input.ttf>${COLORS.reset} ${COLORS.green}<outputBase>${COLORS.reset}

${COLORS.bold}Arguments:${COLORS.reset}
  ${COLORS.green}${COLORS.bold}input.ttf${COLORS.reset}    Input TTF font file
  ${COLORS.green}${COLORS.bold}outputBase${COLORS.reset}   Base name for output files (without extension)

${COLORS.bold}Options:${COLORS.reset}
  ${COLORS.yellow}${COLORS.bold}-n, --name${COLORS.reset} ${COLORS.gray}<name>${COLORS.reset}        Custom font family name (overrides auto-detection)
  ${COLORS.yellow}${COLORS.bold}-k, --keep${COLORS.reset}                Keep .woff2 and .base64.txt intermediate files
  ${COLORS.yellow}${COLORS.bold}-h, --help${COLORS.reset}                Show this help message

${COLORS.bold}Default Behavior:${COLORS.reset}
  • Font name is ${COLORS.cyan}${COLORS.bold}automatically extracted${COLORS.reset} from TTF metadata
  • Suffix ${COLORS.bold}"-Inline"${COLORS.reset} is added to prevent conflicts
  • Intermediate files are ${COLORS.yellow}${COLORS.bold}cleaned up${COLORS.reset} automatically

${COLORS.bold}Examples:${COLORS.reset}
  ${COLORS.gray}# Auto-detect font name (recommended)${COLORS.reset}
  ${COLORS.white}fontify.ts${COLORS.reset} ${COLORS.green}font.ttf${COLORS.reset} ${COLORS.green}output${COLORS.reset}
  
  ${COLORS.gray}# Custom font name${COLORS.reset}
  ${COLORS.white}fontify.ts${COLORS.reset} ${COLORS.yellow}-n${COLORS.reset} ${COLORS.cyan}"My Custom Font"${COLORS.reset} ${COLORS.green}font.ttf${COLORS.reset} ${COLORS.green}output${COLORS.reset}
  
  ${COLORS.gray}# Keep intermediate files${COLORS.reset}
  ${COLORS.white}fontify.ts${COLORS.reset} ${COLORS.yellow}-k${COLORS.reset} ${COLORS.green}font.ttf${COLORS.reset} ${COLORS.green}output${COLORS.reset}
  
  ${COLORS.gray}# Combined options${COLORS.reset}
  ${COLORS.white}fontify.ts${COLORS.reset} ${COLORS.yellow}-kn${COLORS.reset} ${COLORS.cyan}"Roboto Custom"${COLORS.reset} ${COLORS.green}font.ttf${COLORS.reset} ${COLORS.green}output${COLORS.reset}
`.trim();

  console.log(usage);
}

function parseCliArgs(): CliParams {
  const parsed = parseArgs(Deno.args, {
    boolean: ["keep", "help"],
    string: ["name"],
    alias: {
      h: "help",
      k: "keep",
      n: "name",
    },
  });

  if (parsed.help || parsed._.length < 2) {
    showUsage();
    Deno.exit(0);
  }

  const [input, base] = parsed._ as string[];

  return {
    input,
    base,
    fontName: parsed.name,
    autoName: !parsed.name, // Auto-name is default unless custom name is provided
    keepIntermediates: parsed.keep ?? false,
  };
}

// --- FONT PROCESSING ---
async function extractFontName(fontPath: string): Promise<string> {
  Logger.info("Extracting font family name from TTF metadata");

  const command = new Deno.Command("fc-query", {
    args: ["--format=%{family}", fontPath],
    stdout: "piped",
    stderr: "piped",
  });

  const result = await command.output();

  if (!result.success) {
    Logger.warn(
      "Failed to extract font name with fc-query, trying alternative method",
    );

    // Fallback to otfinfo if fc-query fails
    const otfCommand = new Deno.Command("otfinfo", {
      args: ["--family", fontPath],
      stdout: "piped",
      stderr: "piped",
    });

    const otfResult = await otfCommand.output();

    if (!otfResult.success) {
      Logger.warn("Font name extraction failed, using fallback name");
      return "CustomFont";
    }

    const fontName = new TextDecoder().decode(otfResult.stdout).trim();
    return fontName || "CustomFont";
  }

  const fontName = new TextDecoder().decode(result.stdout).trim();
  const cleanName = fontName.split(",")[0].trim(); // Take first family name if multiple

  Logger.info(`Extracted font name: ${COLORS.bold}${cleanName}${COLORS.reset}`);
  return cleanName || "CustomFont";
}

async function subsetFont(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  Logger.info("Starting font subsetting process");

  const command = new Deno.Command("pyftsubset", {
    args: [
      inputPath,
      `--output-file=${outputPath}`,
      "--flavor=woff2",
      `--unicodes=${CONFIG.unicodes}`,
      "--layout-features=kern",
      "--no-hinting",
      `--drop-tables=${CONFIG.dropTables}`,
      "--no-recommended-glyphs",
      "--no-notdef-outline",
      "--desubroutinize",
      "--recalc-bounds",
      "--prune-unicode-ranges",
    ],
    stdout: "piped",
    stderr: "piped",
  });

  const result = await command.output();

  if (!result.success) {
    const errorText = new TextDecoder().decode(result.stderr);
    throw new Error(`Font subsetting failed: ${errorText}`);
  }

  Logger.info("Font subsetting completed successfully");
}

async function encodeToBase64(
  inputPath: string,
  outputPath?: string,
): Promise<string> {
  Logger.info("Reading font file for Base64 encoding");

  const fontData = await Deno.readFile(inputPath);
  const base64String = encodeBase64(fontData);

  if (outputPath) {
    Logger.info(
      `Writing Base64 data to ${COLORS.bold}${outputPath}${COLORS.reset}`,
    );
    await Deno.writeTextFile(outputPath, base64String);
  }

  Logger.info("Base64 encoding completed");
  return base64String;
}

async function generateCssFile(
  outputPath: string,
  base64Data: string,
  fontName: string,
): Promise<void> {
  Logger.info(
    `Generating CSS file: ${COLORS.bold}${outputPath}${COLORS.reset}`,
  );

  const css = `@font-face {
  font-family: '${fontName}';
  src: url("data:font/woff2;base64,${base64Data}") format('woff2-variations');
  font-weight: ${CONFIG.fontFace.weights};
  font-style: ${CONFIG.fontFace.style};
  font-display: ${CONFIG.fontFace.display};
}`;

  await Deno.writeTextFile(outputPath, css);
  Logger.info(
    `CSS file generated with font family: ${COLORS.bold}${fontName}${COLORS.reset}`,
  );
}

// --- MAIN PROCESSING ---
async function processFont(params: CliParams): Promise<ProcessingResult> {
  // Determine font name
  let finalFontName: string;
  if (params.autoName) {
    const extractedName = await extractFontName(params.input);
    finalFontName = `${extractedName}-Inline`;
    Logger.info(
      `Using auto-generated font name: ${COLORS.bold}${finalFontName}${COLORS.reset}`,
    );
  } else {
    finalFontName = params.fontName || "CustomFont";
    Logger.info(
      `Using custom font name: ${COLORS.bold}${finalFontName}${COLORS.reset}`,
    );
  }

  // Determine file paths
  const woff2Path = params.keepIntermediates
    ? `${params.base}.woff2`
    : await Deno.makeTempFile({ suffix: ".woff2" });

  const base64Path = params.keepIntermediates
    ? `${params.base}.base64.txt`
    : await Deno.makeTempFile({ suffix: ".base64.txt" });

  const cssPath = `${params.base}.css`;

  try {
    // Step 1: Measure original file
    Logger.info(
      `${COLORS.bold}Step 1:${COLORS.reset} Analyzing original font file`,
    );
    const originalSize = await getFileSize(params.input);
    Logger.info(
      `Original TTF size: ${COLORS.bold}${formatFileSize(
        originalSize,
      )}${COLORS.reset}`,
    );

    // Step 2: Generate subset WOFF2
    Logger.info(
      `${COLORS.bold}Step 2:${COLORS.reset} Creating optimized WOFF2 subset`,
    );
    await subsetFont(params.input, woff2Path);

    const optimizedSize = await getFileSize(woff2Path);
    Logger.info(
      `Optimized WOFF2 size: ${COLORS.bold}${formatFileSize(
        optimizedSize,
      )}${COLORS.reset}`,
    );

    // Step 3: Encode to Base64
    Logger.info(`${COLORS.bold}Step 3:${COLORS.reset} Encoding font to Base64`);
    const base64Data = await encodeToBase64(
      woff2Path,
      params.keepIntermediates ? base64Path : undefined,
    );

    // Step 4: Generate CSS
    Logger.info(
      `${COLORS.bold}Step 4:${COLORS.reset} Generating CSS with embedded font`,
    );
    await generateCssFile(cssPath, base64Data, finalFontName);

    // Calculate reduction
    const reductionPercent = (
      ((originalSize - optimizedSize) / originalSize) *
      100
    ).toFixed(1);

    // Cleanup warning for temp files
    if (!params.keepIntermediates) {
      Logger.warn("Intermediate files will remain in system temp directory");
    }

    return {
      originalSize,
      optimizedSize,
      reductionPercent,
      outputCss: cssPath,
      fontName: finalFontName,
    };
  } catch (error) {
    // Clean up temp files on error
    if (!params.keepIntermediates) {
      try {
        Deno.removeSync(woff2Path);
        Deno.removeSync(base64Path);
      } catch {
        Logger.warn("Failed to clean up temporary files");
      }
    }
    throw error;
  }
}

function displayResults(result: ProcessingResult): void {
  Logger.success("Font conversion process completed successfully");
  Logger.info(
    `Generated CSS file: ${COLORS.bold}${result.outputCss}${COLORS.reset}`,
  );
  Logger.info(
    `Font family name: ${COLORS.bold}${result.fontName}${COLORS.reset}`,
  );
  Logger.info(
    `File size reduction: ${COLORS.bold}${result.reductionPercent}%${COLORS.reset}`,
  );
  Logger.info(
    `${COLORS.bold}Original:${COLORS.reset} ${formatFileSize(
      result.originalSize,
    )} → ${COLORS.bold}Optimized:${COLORS.reset} ${formatFileSize(
      result.optimizedSize,
    )}`,
  );

  // CSS Usage instruction
  console.log();
  Logger.info(
    `${COLORS.bold}To use this font in CSS, reference it like this:${COLORS.reset}`,
  );
  console.log(
    `   ${COLORS.gray}font-family: ${COLORS.cyan}${COLORS.bold}'${result.fontName}'${COLORS.reset}${COLORS.gray}, sans-serif;${COLORS.reset}`,
  );
}

// --- MAIN EXECUTION ---
if (import.meta.main) {
  try {
    const params = parseCliArgs();

    // Validate input file exists
    try {
      await Deno.stat(params.input);
      Logger.info(
        `Input file found: ${COLORS.bold}${params.input}${COLORS.reset}`,
      );
    } catch {
      throw new Error(`Input file not found: ${params.input}`);
    }

    Logger.info(
      `Starting ${COLORS.bold}Fontify${COLORS.reset} conversion process`,
    );

    const result = await processFont(params);
    displayResults(result);
  } catch (error) {
    Logger.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}
