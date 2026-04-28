import { s } from "@utils/responsive";
import { BASE_COLORS, SEMANTIC_COLORS } from "../tokens/colors";

export const AppButton = {
  base: {
    width: "100%",
    borderRadius: 4,
    padding: s(10),
    alignItems: "center",
    justifyContent: "center",
  },
  sizes: {
    sm: { padding: s(8) },
    md: { padding: s(10) },
    lg: { padding: s(12) },
    xl: { padding: s(14) },
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
