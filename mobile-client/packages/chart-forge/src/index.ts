import NativeChartForge from './NativeChartForge';

export type {
  ChartConfig,
  ChartDataPoint,
  ImageFormat,
  UriType,
} from './utils';

import { normalizeChartConfig, type ChartConfig } from './utils';

/**
 * Generates a native pie chart image.
 *
 * The native implementation is responsible for:
 * - rendering the chart;
 * - writing the image to cache storage;
 * - returning either a `content://` or `file://` URI based on `uriType`.
 *
 * @param config Chart generation configuration.
 * @returns The generated image URI.
 */
export async function generatePieChart(config: ChartConfig): Promise<string> {
  return NativeChartForge.generatePieChart(normalizeChartConfig(config));
}

/**
 * Main public API.
 */
const ChartForge = {
  generatePieChart,
};

export default ChartForge;
