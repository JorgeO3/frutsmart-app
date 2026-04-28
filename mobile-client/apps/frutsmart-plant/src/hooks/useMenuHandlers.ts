import { useCallback } from "react";

import * as Haptics from "expo-haptics";

interface UseMenuHandlersProps {
  setMenuVisible: (visible: boolean) => void;
}

export const useMenuHandlers = ({ setMenuVisible }: UseMenuHandlersProps) => {
  const handleUpload = useCallback(() => {
    console.log("Ejecutando servicio para subir datos a la nube...");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleOpenMenu = useCallback(() => {
    console.log("Abriendo menú global...");
    setMenuVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [setMenuVisible]);

  const handleMenuNavigate = useCallback((screen: string) => {
    console.log(`Navegando a: ${screen}`);
    // Aquí puedes añadir la lógica de navegación real
    if (screen === "/") {
      // Lógica de logout
    }
  }, []);

  return {
    handleUpload,
    handleOpenMenu,
    handleMenuNavigate,
  };
};