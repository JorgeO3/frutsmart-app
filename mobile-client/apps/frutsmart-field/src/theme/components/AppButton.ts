import { scale } from "@utils/responsive";
import { SEMANTIC_COLORS, BASE_COLORS } from "../tokens/colors";

export const AppButton = {
  base: {
    width: "100%",
    borderRadius: 4,
    padding: scale(10),
    alignItems: "center",
    justifyContent: "center",
  },
  sizes: {
    sm: { padding: scale(8) },
    md: { padding: scale(10) },
    lg: { padding: scale(12) },
    xl: { padding: scale(14) },
  },
  colors: {
    primary: { backgroundColor: SEMANTIC_COLORS.action.primary },
    secondary: { backgroundColor: SEMANTIC_COLORS.neutral.black },
    tertiary: { backgroundColor: SEMANTIC_COLORS.neutral.disabled },
    danger: { backgroundColor: SEMANTIC_COLORS.feedback.error },
    warning: { backgroundColor: SEMANTIC_COLORS.feedback.warning },
    success: { backgroundColor: SEMANTIC_COLORS.feedback.success },
    info: { backgroundColor: SEMANTIC_COLORS.feedback.info },
    green: { backgroundColor: BASE_COLORS.darkGreen[600] },
  },
  variants: {},
} as const;
