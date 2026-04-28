import { font, s } from "@utils/responsive";
import { FONT_FAMILTY } from "src/constants/font";

// Archivo de configuración central para estilos consistentes
export const FormStyles = {
  // Dimensiones
  INPUT_HEIGHT: s(50),
  ICON_SIZE: s(28),
  BORDER_RADIUS: 8,
  BORDER_WIDTH: 1,

  // Padding y márgenes
  PADDING_VERTICAL: s(10),
  PADDING_HORIZONTAL: s(15),
  PADDING_RIGHT_WITH_ICON: s(40),
  MARGIN_BOTTOM: s(16),
  LABEL_MARGIN_BOTTOM: s(5),
  ERROR_MARGIN_TOP: s(5),

  // Tamaños de fuente
  LABEL_FONT_SIZE: font.scale(16),
  INPUT_FONT_SIZE: font.scale(16),
  ERROR_FONT_SIZE: font.scale(12),

  // Colores
  BORDER_COLOR: "#C4C4C4",
  ERROR_COLOR: "#E53935",
  PLACEHOLDER_COLOR: "#7b7b7b",
  TEXT_COLOR: "#000000",
  ICON_COLOR: "#777777",
  BACKGROUND_COLOR: "#FFFFFF",
  LABEL_COLOR: "#000000",

  // Familias de fuentes
  INPUT_FONT_FAMILY: FONT_FAMILTY,
  ERROR_FONT_FAMILY: FONT_FAMILTY,
  LABEL_FONT_FAMILY: FONT_FAMILTY,
} as const;
