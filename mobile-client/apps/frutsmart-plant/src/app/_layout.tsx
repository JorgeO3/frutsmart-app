import { useState } from "react";
import { View } from "react-native";

import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { useRootBootstrap } from "@hooks/useRootBootstrap";
import { useScreenConfiguration } from "@hooks/useScreenConfiguration";
import { SkyboltUploadProvider } from "@src/providers/SkyboltUploadProvider";
import { StorageProvider } from "@src/providers/StorageProvider";

import AppSplash from "@components/AppSplash";
import AppText from "@components/AppText";
import MenuModal from "@components/MenuModal";
import { StorageGuard } from "@components/StorageGuard";
import { useMenuHandlers } from "@hooks/useMenuHandlers";

export default function RootLayout() {
  const { appIsReady, nanoRtError, showMainApp, handleSplashComplete } =
    useRootBootstrap();

  const [isMenuVisible, setMenuVisible] = useState<boolean>(false);

  const { handleUpload, handleOpenMenu, handleMenuNavigate } = useMenuHandlers({
    setMenuVisible,
  });

  const { allScreens, headerBaseStyle } = useScreenConfiguration({
    handleUpload,
    handleOpenMenu,
  });

  if (nanoRtError) {
    console.error("NanoRT initialization error:", nanoRtError);
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <AppText>
          Error al inicializar la aplicación: {nanoRtError.message}
        </AppText>
        <AppText>Por favor, intenta reiniciar la aplicación.</AppText>
        <AppText>
          En caso de que el problema persista, contacta con soporte.
        </AppText>
      </View>
    );
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
