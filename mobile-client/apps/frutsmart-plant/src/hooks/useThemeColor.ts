/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { useColorScheme } from "@src/hooks/useColorScheme";
import { Colors } from "src/constants/colors";

type Props = { light?: string; dark?: string };
type ColorName = keyof typeof Colors.light & keyof typeof Colors.dark;

export function useThemeColor(props: Props, colorName: ColorName): string {
  const theme = useColorScheme() ?? "light";
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  }

  return Colors[theme][colorName];
}
