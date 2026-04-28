import { font } from "@utils/responsive";
import { SEMANTIC_COLORS } from "../tokens/colors";
import { SPACING } from "../tokens/spacing";

const AppAlertContainer = {
  base: {
    padding: SPACING.md,
    borderRadius: 6,
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  variants: {
    info: { backgroundColor: SEMANTIC_COLORS.feedback.infoLighter },
    error: { backgroundColor: SEMANTIC_COLORS.feedback.errorLighter },
    success: { backgroundColor: SEMANTIC_COLORS.feedback.successLighter },
    warning: { backgroundColor: SEMANTIC_COLORS.feedback.warningLighter },
  },
} as const;

const AppAlertIcon = {
  variants: {
    info: { color: SEMANTIC_COLORS.feedback.info },
    error: { color: SEMANTIC_COLORS.feedback.error },
    success: { color: SEMANTIC_COLORS.feedback.success },
    warning: { color: SEMANTIC_COLORS.feedback.warning },
  },
} as const;

const AppAlertTitle = {
  base: { marginBottom: SPACING.xxs },
  colors: {
    info: { color: SEMANTIC_COLORS.feedback.info },
    error: { color: SEMANTIC_COLORS.feedback.error },
    success: { color: SEMANTIC_COLORS.feedback.success },
    warning: { color: SEMANTIC_COLORS.feedback.warning },
  },
} as const;

export const AppAlert = {
  icon: AppAlertIcon,
  title: AppAlertTitle,
  container: AppAlertContainer,

  textContainer: { flex: 1 },
  message: { lineHeight: font.scale(20) },
  iconContainer: { marginRight: SPACING.lg },
} as const;
