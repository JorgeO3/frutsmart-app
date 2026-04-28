export const BASE_COLORS = {
  // Reds: error states
  red: {
    500: "hsl(0, 82%, 51%)", // error
    600: "hsl(0, 65%, 75%)", // errorLight
    700: "hsl(0, 45%, 86%)", // errorLighter
  },
  // Greens: success states
  green: {
    500: "hsl(73, 78%, 40%)", // success
    600: "hsl(73, 60%, 70%)", // successLight
    700: "hsl(73, 40%, 86%)", // successLighter
  },
  darkGreen: {
    500: "hsl(135, 60%, 21%)", // darkGreen
    600: "hsl(135, 60%, 31%)", // darkGreenLight
    700: "hsl(135, 60%, 41%)", // darkGreenLighter
  },
  // Blues: informational states
  blue: {
    500: "hsl(210, 75%, 55%)", // info
    600: "hsl(210, 60%, 70%)", // infoLight
    700: "hsl(210, 40%, 86%)", // infoLighter
  },
  // Yellows: warning states
  yellow: {
    500: "hsl(31, 100%, 47%)", // warning
    600: "hsl(31, 80%, 70%)", // warningLight
    700: "hsl(31, 60%, 86%)", // warningLighter
  },
  // Oranges: accent & primary buttons
  orange: {
    500: "hsl(15, 82%, 51%)", // tint / btnPrimary / title / icon
  },
  // Neutrals / Grays
  gray: {
    50: "hsl(0, 0%, 100%)", // background, textSecondary, tabIconDefault
    100: "hsl(0, 0%, 82%)", // border
    200: "hsl(210, 1%, 69%)", // disabled, btnTertiary
    900: "hsl(0, 0%, 0%)", // text
  },
} as const;

export const SEMANTIC_COLORS = {
  feedback: {
    success: BASE_COLORS.green[500],
    successLight: BASE_COLORS.green[600],
    successLighter: BASE_COLORS.green[700],

    error: BASE_COLORS.red[500],
    errorLight: BASE_COLORS.red[600],
    errorLighter: BASE_COLORS.red[700],

    warning: BASE_COLORS.yellow[500],
    warningLight: BASE_COLORS.yellow[600],
    warningLighter: BASE_COLORS.yellow[700],

    info: BASE_COLORS.blue[500],
    infoLight: BASE_COLORS.blue[600],
    infoLighter: BASE_COLORS.blue[700],
  },

  neutral: {
    black: BASE_COLORS.gray[900], // Para texto principal
    white: BASE_COLORS.gray[50], // Fondos y texto secundario
    border: BASE_COLORS.gray[100], // Bordes
    disabled: BASE_COLORS.gray[200], // Elementos deshabilitados
  },

  action: {
    primary: BASE_COLORS.orange[500], // Botones y acentos
    navigation: BASE_COLORS.darkGreen[500], // Navegación
  },

  surface: {
    background: BASE_COLORS.gray[50], // Fondo general
    backgroundSecondary: BASE_COLORS.darkGreen[600],
  },
} as const;
