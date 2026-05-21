import { useState } from "react";
import "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";

import { useMenuHandlers } from "@hooks/useMenuHandlers";
import { useRootBootstrap } from "@hooks/useRootBootstrap";
import { useScreenConfiguration } from "@hooks/useScreenConfiguration";
import { SkyboltUploadProvider } from "@src/providers/SkyboltUploadProvider";
import { StorageProvider } from "@src/providers/StorageProvider";

import AppSplash from "@components/AppSplash";
import MenuModal from "@components/MenuModal";
import NanoRTErrorView from "@components/NanoRTErrorView";
import { StorageGuard } from "@components/StorageGuard";

export default function RootLayout() {
  const [isMenuVisible, setMenuVisible] = useState(false);
  
  const { appIsReady, nanoRtError, showMainApp, handleSplashComplete } = useRootBootstrap();
  const { handleUpload, handleOpenMenu, handleMenuNavigate } = useMenuHandlers({ setMenuVisible });
  const { allScreens, headerBaseStyle } = useScreenConfiguration({ handleUpload, handleOpenMenu });

  if (nanoRtError) {
    console.error("NanoRT initialization error:", nanoRtError);
    return <NanoRTErrorView error={nanoRtError.message} />;
  }

  return (
    <ThemeProvider value={DefaultTheme}>
      <StatusBar style="light" />

      <SkyboltUploadProvider>
        <StorageProvider>
          <StorageGuard enabled={showMainApp} />
          {showMainApp ? (
            <Stack screenOptions={headerBaseStyle}>{allScreens}</Stack>
          ) : (
            <AppSplash
              onComplete={handleSplashComplete}
              isAppReady={appIsReady}
            />
          )}

          <MenuModal
            visible={isMenuVisible}
            onClose={() => setMenuVisible(false)}
            onNavigate={handleMenuNavigate}
          />
        </StorageProvider>
      </SkyboltUploadProvider>
    </ThemeProvider>
  );
}
