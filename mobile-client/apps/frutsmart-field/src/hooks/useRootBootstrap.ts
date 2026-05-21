import { useEffect, useRef, useState } from "react";

import { useNanoRTReady } from "nano-rt";
import { useAppLoading } from "@hooks/useAppLoading";
import { initUploadSystem } from "@services/uploads";

export function useRootBootstrap() {
  const { isLoaded } = useAppLoading();
  const { ready: nanoRtReady, error: nanoRtError } = useNanoRTReady();
  const uploadsBootstrappedRef = useRef<boolean>(false);

  console.log("[DIAG] useRootBootstrap — isLoaded:", isLoaded, "nanoRtReady:", nanoRtReady);

  const appIsReady: boolean = isLoaded && nanoRtReady;
  const [showMainApp, setShowMainApp] = useState<boolean>(false);

  const handleSplashComplete = (): void => {
    console.log("[DIAG] useRootBootstrap — handleSplashComplete called, setting showMainApp=true");
    setShowMainApp(true);
  };

  useEffect(() => {
    if (!appIsReady || !showMainApp) return;
    if (uploadsBootstrappedRef.current) return;
    uploadsBootstrappedRef.current = true;

    // No iniciar Skybolt/uploads durante la splash: NativeSkyboltModule.initialize()
    // puede disparar auto-recovery/auto-resume y competir con el warmup de NanoRT.
    initUploadSystem().catch((err) => {
      console.error("[useRootBootstrap] initUploadSystem failed:", err);
      uploadsBootstrappedRef.current = false;
    });
  }, [appIsReady, showMainApp]);

  return {
    appIsReady,
    nanoRtError,
    showMainApp,
    handleSplashComplete,
  };
}
