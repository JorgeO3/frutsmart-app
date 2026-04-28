import { Dimensions, PixelRatio } from "react-native";

const { width, height } = Dimensions.get("window");
const BASE_W = 432;
const BASE_H = 893.6;
const refDiag = Math.hypot(BASE_W, BASE_H);
const diag = Math.hypot(width, height);

export const scale = (size: number) => (diag / refDiag) * size;

/**
 * Ajusta fuentes:
 *  - Escalado moderado (factor 0.5)
 *  - Respeta ajustes de accesibilidad
 *  - Redondea al pixel más cercano
 */
export function normalizeFont(size: number, factor = 0.5): number {
  const scaled = size + (scale(size) - size) * factor; // moderateScale
  const fontScale = PixelRatio.getFontScale(); // accesibilidad
  return PixelRatio.roundToNearestPixel(scaled) / fontScale; // redondeo
}
