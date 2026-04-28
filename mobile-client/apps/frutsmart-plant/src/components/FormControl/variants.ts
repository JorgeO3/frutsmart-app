import { font, s } from "@utils/responsive";
import { FONT_FAMILTY } from "src/constants/font";

// Define una estructura base para los estilos de una variante.
// Esto asegura que todas las variantes tengan las mismas propiedades de estilo.

// Objeto que contiene todas las variantes de estilo para los componentes de formulario.
export const variants = {
  // Variante 'login', basada en tus estilos originales.
  login: {
    // Dimensiones
    inputHeight: s(50),
    borderRadius: 8,
    borderWidth: 1,

    // Padding
    paddingVertical: s(10),
    paddingHorizontal: s(15),
    paddingRightWithIcon: s(40),

    // Tamaños de fuente
    labelFontSize: font.scale(16),
    inputFontSize: font.scale(16),
    errorFontSize: font.scale(12),

    // Colores
    borderColor: "#C4C4C4",
    errorColor: "#E53935",
    placeholderColor: "#7b7b7b",
    textColor: "#000000",
    backgroundColor: "#FFFFFF",
    labelColor: "#333",

    // Familias de fuentes
    fontFamily: FONT_FAMILTY,
  },

  // Nueva variante 'default'.
  // Puedes personalizar estos valores como prefieras para un input estándar.
  default: {
    // Dimensiones
    inputHeight: s(48),
    borderRadius: 6,
    borderWidth: 1,

    // Padding
    paddingVertical: s(8),
    paddingHorizontal: s(12),
    paddingRightWithIcon: s(35),

    // Tamaños de fuente
    labelFontSize: font.scale(14),
    inputFontSize: font.scale(14),
    errorFontSize: font.scale(10),

    // Colores
    borderColor: "#A0A0A0",
    errorColor: "#D32F2F",
    placeholderColor: "#9E9E9E",
    textColor: "#212121",
    backgroundColor: "#F5F5F5",
    labelColor: "#616161",

    // Familias de fuentes
    fontFamily: FONT_FAMILTY,
  },
} as const;

// Exportamos los tipos para usarlos en las props del componente.
export type VariantName = keyof typeof variants;
