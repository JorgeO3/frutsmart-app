import { NativeModule, requireNativeModule } from 'expo';

// ============================================================================
// SECTION 1: TIPOS PÚBLICOS DEL MÓDULO
// Estos son los únicos tipos que un consumidor de este módulo necesita conocer.
// ============================================================================

/**
 * Describe un único punto de datos para el gráfico (e.g., una rebanada).
 */
export interface ChartDataPoint {
  value: number;
  label: string;
  color: string; // Formato de color hexadecimal, ej: "#E84C16"
}

/**
 * Define los formatos de imagen de salida soportados.
 */
export type ImageFormat = 'PNG' | 'WEBP' | 'JPEG';

/**
 * Define los tipos de URI de salida soportados.
 */
export type UriType = 'content' | 'file';

/**
 * Define el objeto de configuración completo para la generación de un gráfico.
 * Esta es la configuración que se pasa a la función nativa.
 */
export interface ChartConfig {
  /** Identificador único para el nombre del fichero de salida. */
  id: string;
  /** Ancho en píxeles de la imagen a generar. */
  width: number;
  /** Altura en píxeles de la imagen a generar. */
  height: number;
  /** Array de datos que conforman el gráfico. */
  data: ChartDataPoint[];
  /**
   * El formato de la imagen de salida. 'WEBP' es recomendado por su eficiencia.
   * @default 'WEBP'
   */
  format?: ImageFormat;
  /**
   * La calidad de compresión (1-100) para formatos con pérdida.
   * @default 100
   */
  quality?: number;
  /**
   * El tipo de URI a devolver. 'content' es el método seguro y moderno.
   * @default 'content'
   */
  uriType?: UriType;
}

// ============================================================================
// SECTION 2: DECLARACIÓN Y EXPORTACIÓN DEL MÓDULO NATIVO
// ============================================================================

/**
 * Declara la interfaz nativa para que TypeScript la reconozca.
 */
declare class ChartGeneratorModule extends NativeModule {
  /**
   * Genera un gráfico de torta de forma asíncrona usando código nativo.
   * @param config La configuración del gráfico a generar.
   * @returns Una promesa que se resuelve con la URI de la imagen.
   */
  generatePieChart(config: ChartConfig): Promise<string>;
}

/**
 * Exporta el módulo nativo. El string 'ExpoChartGenerator' debe coincidir
 * con el Name() definido en la ModuleDefinition de Kotlin.
 */
export default requireNativeModule<ChartGeneratorModule>('ChartGenerator');
