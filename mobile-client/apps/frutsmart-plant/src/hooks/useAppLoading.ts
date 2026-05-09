import { useEffect, useState } from "react";

import { initialAssetsManager } from "@services/asset-manager/assetManager";
import { tempFileManager } from "@services/temp-file-manager/TempFileManager";

/**
 * Hook para gestionar las tareas de inicialización asíncronas de la aplicación.
 * Se encarga de preparar los assets y limpiar directorios temporales.
 * @returns Un objeto con el estado `isLoaded`, que es `true` cuando todas las tareas han finalizado.
 */
export const useAppLoading = () => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const prepareApp = async () => {
      console.log("[DIAG] useAppLoading — start loading");
      try {
        await Promise.all([
          initialAssetsManager.setup(),
          tempFileManager.cleanup(),
        ]);
        console.log("[DIAG] useAppLoading — all tasks done");
      } catch (e) {
        console.warn("[DIAG] useAppLoading — error:", e);
      } finally {
        setIsLoaded(true);
        console.log("[DIAG] useAppLoading — isLoaded=true");
      }
    };

    prepareApp();
  }, []);

  // Devolvemos el estado para que los componentes puedan reaccionar a él.
  return { isLoaded };
};
