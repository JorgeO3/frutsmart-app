import { SEMANTIC_COLORS } from "../tokens/colors";
import { FONT_FAMILY, FONT_WEIGHT, FONT_SIZE } from "../tokens/typography";

export const AppText = {
  base: {
    fontFamily: FONT_FAMILY,
  },
  variants: {
    H1: {
      fontSize: FONT_SIZE.xxl,
      fontWeight: FONT_WEIGHT.extraBold,
    },
    H2: {
      fontSize: FONT_SIZE.xl,
      fontWeight: FONT_WEIGHT.extraBold,
    },
    H3: {
      fontSize: FONT_SIZE.lg,
      fontWeight: FONT_WEIGHT.extraBold,
    },
    H4: {
      fontSize: FONT_SIZE.md,
      fontWeight: FONT_WEIGHT.bold,
    },
    H5: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.bold,
    },
    H6: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.semiBold,
    },

    // Text body
    BodyXL: {
      fontSize: FONT_SIZE.xl,
      fontWeight: FONT_WEIGHT.regular,
    },
    BodyL: {
      fontSize: FONT_SIZE.lg,
      fontWeight: FONT_WEIGHT.regular,
    },
    BodyM: {
      fontSize: FONT_SIZE.md,
      fontWeight: FONT_WEIGHT.regular,
    },
    BodyS: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.regular,
    },
    BodyXS: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.regular,
    },

    // Subtitle
    SubtitleM: {
      fontSize: FONT_SIZE.md,
      fontWeight: FONT_WEIGHT.medium,
    },
    SubtitleS: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.medium,
    },

    // UI Controls (buttons, links, inputs, tags, etc.)
    ControlXL: {
      fontSize: FONT_SIZE.xl,
      fontWeight: FONT_WEIGHT.extraBold,
    },
    ControlL: {
      fontSize: FONT_SIZE.lg,
      fontWeight: FONT_WEIGHT.extraBold,
    },
    ControlM: {
      fontSize: FONT_SIZE.md,
      fontWeight: FONT_WEIGHT.extraBold,
    },
    ControlS: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.extraBold,
    },
    ControlXS: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.extraBold,
    },

    // Label
    LabelM: {
      fontSize: FONT_SIZE.md,
      fontWeight: FONT_WEIGHT.medium,
    },
    LabelS: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.medium,
    },

    // Captions
    CaptionM: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.medium,
    },
    CaptionS: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.medium,
    },
    CaptionXS: {
      fontSize: FONT_SIZE.xxs,
      fontWeight: FONT_WEIGHT.medium,
    },
  },
  colors: {
    text: { color: SEMANTIC_COLORS.neutral.black },
    primary: { color: SEMANTIC_COLORS.action.primary },
    secondary: { color: SEMANTIC_COLORS.neutral.white },
    title: { color: SEMANTIC_COLORS.action.primary },
    error: { color: SEMANTIC_COLORS.feedback.error },
    warning: { color: SEMANTIC_COLORS.feedback.warning },
    success: { color: SEMANTIC_COLORS.feedback.success },
    info: { color: SEMANTIC_COLORS.feedback.info },
    disabled: { color: SEMANTIC_COLORS.neutral.disabled },
  },
  defaultVariants: {
    variant: "BodyM",
    color: "text",
  },
};

export const VARIANTS = Object.keys(AppText.variants) as Array<
  keyof typeof AppText.variants
>;
