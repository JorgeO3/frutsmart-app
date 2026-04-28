import { useState, useEffect } from "react";
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
    // Definimos una función asíncrona para encapsular la lógica.
    const prepareApp = async () => {
      try {
        // Ejecutamos todas las tareas de preparación en paralelo para una carga más rápida.
        await Promise.all([
          initialAssetsManager.setup(),
          tempFileManager.cleanup(), // <-- Aquí se integra la limpieza
        ]);
      } catch (e) {
        // Es buena práctica capturar cualquier error que pueda ocurrir.
        console.warn("Ocurrió un error durante la preparación de la app:", e);
      } finally {
        // `finally` se asegura de que siempre notifiquemos que la carga terminó,
        // incluso si hubo un error, para no dejar la app congelada en el splash.
        setIsLoaded(true);
      }
    };

    prepareApp();
  }, []); // El array vacío asegura que este efecto se ejecute solo una vez al montar el componente.

  // Devolvemos el estado para que los componentes puedan reaccionar a él.
  return { isLoaded };
};