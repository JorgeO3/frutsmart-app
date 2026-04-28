import { RADII } from "./tokens/radii";
import { MOTION } from "./tokens/motion";
import { Z_INDEX } from "./tokens/zIndex";
import { SHADOWS } from "./tokens/shadows";
import { SPACING } from "./tokens/spacing";
import { TYPOGRAPHY } from "./tokens/typography";
import { SEMANTIC_COLORS } from "./tokens/colors";

import { AppText } from "./components/AppText";
import { AppButton } from "./components/AppButton";
import { AppAlert } from "./components/AppAlert";

const COMPONENTS = {
  AppText: AppText,
  AppButton: AppButton,
  AppAlert: AppAlert,
};

export const THEME = {
  radii: RADII,
  zIndex: Z_INDEX,
  motion: MOTION,
  spacing: SPACING,
  shadows: SHADOWS,
  components: COMPONENTS,
  typography: TYPOGRAPHY,
  colors: SEMANTIC_COLORS,
};
