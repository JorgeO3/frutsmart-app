import { useCallback, useMemo } from "react";

import type { ParamListBase, RouteProp } from "@react-navigation/native";
import { Stack } from "expo-router";

import { SCREEN_CONFIGURATIONS } from "@utils/screenConfigurations";
import { THEME_STYLES } from "@utils/themeStyles";

import HeaderIcons from "@components/HeaderIcons";

interface UseScreenConfigurationProps {
  handleUpload: () => void;
  handleOpenMenu: () => void;
}

export const useScreenConfiguration = ({
  handleUpload,
  handleOpenMenu,
}: UseScreenConfigurationProps) => {
  const createScreenOptions = useCallback(
    ({
      route,
      title,
    }: {
      route: RouteProp<ParamListBase, string>;
      title?: string;
    }) => {
      if (!title) {
        return THEME_STYLES.noHeaderOptions;
      }
      const isHomePage = route.name === "plant-work/index";
      return {
        ...THEME_STYLES.headerBaseStyle,
        title,
        headerRight: () =>
          isHomePage && (
            <HeaderIcons
              onUploadPress={handleUpload}
              onMenuPress={handleOpenMenu}
            />
          ),
      };
    },
    [handleUpload, handleOpenMenu],
  );

  type ScreenProps = { name: string; title?: string };

  const allScreens = useMemo(() => {
    const mapScreens = (screenList: ScreenProps[]) =>
      screenList.map(({ name, title }) => (
        <Stack.Screen
          key={name}
          name={name}
          options={({ route }) => createScreenOptions({ route, title })}
        />
      ));

    return [
      ...mapScreens(SCREEN_CONFIGURATIONS.main),
      ...mapScreens(SCREEN_CONFIGURATIONS.onboarding),
      ...mapScreens(SCREEN_CONFIGURATIONS.auth),
      ...mapScreens(SCREEN_CONFIGURATIONS.plantWork),
      ...mapScreens(SCREEN_CONFIGURATIONS.externalClassification),
      ...mapScreens(SCREEN_CONFIGURATIONS.internalClassification),
    ];
  }, [createScreenOptions]);

  return {
    allScreens,
    headerBaseStyle: THEME_STYLES.headerBaseStyle,
  };
};
