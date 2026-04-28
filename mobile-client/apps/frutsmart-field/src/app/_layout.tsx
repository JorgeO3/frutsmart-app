import { useState } from "react";
import "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";

import { useNanoRTReady } from "@/modules/nano-rt";
import { useAppLoading } from "@hooks/useAppLoading";
import { useScreenConfiguration } from "@hooks/useScreenConfiguration";
import { useMenuHandlers } from "@hooks/useMenuHandlers";

import AppSplash from "@components/AppSplash";
import MenuModal from "@components/MenuModal";

export default function RootLayout() {
  const { isLoaded } = useAppLoading();
  const { ready: nanoRtReady } = useNanoRTReady();
  const appIsReady = isLoaded && nanoRtReady;

  const [isMenuVisible, setMenuVisible] = useState(false);
  const [showMainApp, setShowMainApp] = useState(false);

  const { handleUpload, handleOpenMenu, handleMenuNavigate } = useMenuHandlers({
    setMenuVisible,
  });

  const { allScreens, headerBaseStyle } = useScreenConfiguration({
    handleUpload,
    handleOpenMenu,
  });

  const handleSplashComplete = () => {
    setShowMainApp(true);
  };

  return (
    <ThemeProvider value={DefaultTheme}>
      <StatusBar style="light" />

      {showMainApp ? (
        <Stack screenOptions={headerBaseStyle}>{allScreens}</Stack>
      ) : (
        <AppSplash onComplete={handleSplashComplete} isAppReady={appIsReady} />
      )}

      <MenuModal
        visible={isMenuVisible}
        onClose={() => setMenuVisible(false)}
        onNavigate={handleMenuNavigate}
      />
    </ThemeProvider>
  );
}
