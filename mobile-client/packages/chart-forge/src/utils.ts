import type {
  NativeChartConfig,
  NativeChartDataPoint,
} from './NativeChartForge';

/**
 * Public chart data point used by ChartForge consumers.
 */
export type ChartDataPoint = NativeChartDataPoint;

/**
 * Public image formats supported by ChartForge.
 *
 * The native TurboModule spec uses `string` for Codegen compatibility, but the
 * public JavaScript API exposes a stricter union type.
 */
export type ImageFormat = 'PNG' | 'WEBP' | 'JPEG';

/**
 * Public URI output modes supported by ChartForge.
 *
 * - `content`: recommended for safe file sharing through Android FileProvider.
 * - `file`: useful for internal app-only usage.
 */
export type UriType = 'content' | 'file';

/**
 * Public chart generation config.
 *
 * This type intentionally wraps the native Codegen config so the public API can
 * stay stricter than the raw TurboModule boundary.
 */
export type ChartConfig = Omit<NativeChartConfig, 'format' | 'uriType'> & {
  /**
   * Output image format.
   *
   * @default 'WEBP'
   */
  format?: ImageFormat;

  /**
   * Output URI type.
   *
   * @default 'content'
   */
  uriType?: UriType;
};

const DEFAULT_IMAGE_FORMAT: ImageFormat = 'WEBP';
const DEFAULT_IMAGE_QUALITY = 100;
const DEFAULT_URI_TYPE: UriType = 'content';

const SUPPORTED_IMAGE_FORMATS: ReadonlyArray<ImageFormat> = [
  'WEBP',
  'PNG',
  'JPEG',
];

const SUPPORTED_URI_TYPES: ReadonlyArray<UriType> = ['content', 'file'];

/**
 * Keep this aligned with the native layer.
 *
 * Android's Color parser safely supports:
 * - #RRGGBB
 * - #AARRGGBB
 */
const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * File-safe identifier.
 *
 * The native side should still sanitize the final file name, but rejecting
 * unsafe IDs here gives consumers faster and clearer feedback.
 */
const SAFE_FILE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

function isImageFormat(value: string): value is ImageFormat {
  return SUPPORTED_IMAGE_FORMATS.includes(value as ImageFormat);
}

function isUriType(value: string): value is UriType {
  return SUPPORTED_URI_TYPES.includes(value as UriType);
}

function normalizeImageFormat(format?: ImageFormat): ImageFormat {
  const rawFormat = format ?? DEFAULT_IMAGE_FORMAT;

  if (typeof rawFormat !== 'string') {
    throw new TypeError('format must be a string.');
  }

  const normalizedFormat = rawFormat.toUpperCase();

  if (!isImageFormat(normalizedFormat)) {
    throw new TypeError(
      `Unsupported image format "${rawFormat}". Expected one of: ${SUPPORTED_IMAGE_FORMATS.join(
        ', '
      )}.`
    );
  }

  return normalizedFormat;
}

function normalizeUriType(uriType?: UriType): UriType {
  const rawUriType = uriType ?? DEFAULT_URI_TYPE;

  if (typeof rawUriType !== 'string') {
    throw new TypeError('uriType must be a string.');
  }

  const normalizedUriType = rawUriType.toLowerCase();

  if (!isUriType(normalizedUriType)) {
    throw new TypeError(
      `Unsupported URI type "${rawUriType}". Expected one of: ${SUPPORTED_URI_TYPES.join(
        ', '
      )}.`
    );
  }

  return normalizedUriType;
}

function assertPositiveInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${fieldName} must be a positive integer.`);
  }
}

function assertValidQuality(quality: number): void {
  if (!Number.isInteger(quality) || quality < 0 || quality > 100) {
    throw new TypeError('quality must be an integer between 0 and 100.');
  }
}

function assertValidDataPoint(point: ChartDataPoint, index: number): void {
  if (point == null || typeof point !== 'object') {
    throw new TypeError(`data[${index}] must be an object.`);
  }

  if (!Number.isFinite(point.value) || point.value <= 0) {
    throw new TypeError(
      `data[${index}].value must be a positive finite number.`
    );
  }

  if (typeof point.label !== 'string' || point.label.trim().length === 0) {
    throw new TypeError(`data[${index}].label must be a non-empty string.`);
  }

  if (typeof point.color !== 'string' || !HEX_COLOR_REGEX.test(point.color)) {
    throw new TypeError(
      `data[${index}].color must be a valid hex color in #RRGGBB or #AARRGGBB format.`
    );
  }
}

/**
 * Validates and normalizes public chart config before crossing the native
 * TurboModule boundary.
 *
 * This keeps runtime errors closer to JavaScript consumers and avoids sending
 * malformed payloads to the native layer.
 */
export function normalizeChartConfig(config: ChartConfig): NativeChartConfig {
  if (config == null || typeof config !== 'object') {
    throw new TypeError('config must be an object.');
  }

  if (typeof config.id !== 'string' || config.id.trim().length === 0) {
    throw new TypeError('id must be a non-empty string.');
  }

  if (!SAFE_FILE_ID_REGEX.test(config.id)) {
    throw new TypeError(
      'id may only contain letters, numbers, hyphens, and underscores.'
    );
  }

  assertPositiveInteger(config.width, 'width');
  assertPositiveInteger(config.height, 'height');

  if (!Array.isArray(config.data) || config.data.length === 0) {
    throw new TypeError('data must contain at least one data point.');
  }

  config.data.forEach(assertValidDataPoint);

  const quality = config.quality ?? DEFAULT_IMAGE_QUALITY;
  assertValidQuality(quality);

  return {
    id: config.id,
    width: config.width,
    height: config.height,
    data: config.data,
    format: normalizeImageFormat(config.format),
    quality,
    uriType: normalizeUriType(config.uriType),
  };
}
