import { useState } from "react";

import { useNanoRTReady } from "nano-rt";
import { useAppLoading } from "@hooks/useAppLoading";

export function useRootBootstrap() {
  const { isLoaded } = useAppLoading();
  const { ready: nanoRtReady, error: nanoRtError } = useNanoRTReady();

  const appIsReady: boolean = isLoaded && nanoRtReady;
  const [showMainApp, setShowMainApp] = useState<boolean>(false);

  const handleSplashComplete = (): void => {
    setShowMainApp(true);
  };

  return {
    appIsReady,
    nanoRtError,
    showMainApp,
    handleSplashComplete,
  };
}
