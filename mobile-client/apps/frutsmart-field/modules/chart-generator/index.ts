// Reexport the native module. On web, it will be resolved to ChartGeneratorModule.web.ts
// and on native platforms to ChartGeneratorModule.ts
export * from './src/ChartGeneratorModule';

import * as FileSystem from 'expo-file-system/legacy';
import ChartGeneratorModule, { type ChartConfig } from './src/ChartGeneratorModule';

/**
 * Genera asíncronamente una imagen de un gráfico de torta.
 * Esta función orquesta la llamada nativa y la conversión de URI.
 * @param config El objeto de configuración para el gráfico.
 * @returns Una promesa que se resuelve con la URI de la imagen generada.
 */
export async function generatePieChart(config: ChartConfig): Promise<string> {
  // 2. Llama a nuestro módulo nativo para generar el archivo.
  // Siempre recibiremos una URI de tipo `file://`
  const fileUri = await ChartGeneratorModule.generatePieChart(config);

  // 3. Revisa la configuración del usuario. Si pidieron "file", ya terminamos.
  if (config.uriType === 'file') {
    return fileUri;
  }

  // 4. Por defecto, o si se pide "content", usamos FileSystem para la conversión.
  try {
    return await FileSystem.getContentUriAsync(fileUri);
  } catch (error) {
    // Si la conversión falla por algún motivo, registramos el error
    // y devolvemos la URI de archivo como fallback.
    console.warn(`Could not convert '${fileUri}' to a content URI. Falling back to file URI. Error: ${error}`);
    return fileUri;
  }
}
