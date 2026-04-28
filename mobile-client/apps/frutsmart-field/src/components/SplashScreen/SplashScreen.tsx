import React, { useEffect, useState } from "react";

import { SplashScreenContent } from "./SplashScreenContent";

interface SplashScreenProps {
  onReady?: () => void;
  isLoading?: boolean;
}

const SplashScreen = ({ onReady, isLoading }: SplashScreenProps) => {
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);

  useEffect(() => {
    console.log("[SplashScreen]", { isLoading });
    // Una vez que la data se ha cargado (isLoading es false) y la animación ha finalizado,
    // se invoca el callback para pasar a la siguiente pantalla.
    if (!isLoading && isAnimationComplete && onReady) {
      console.log("[SplashScreen] triggering onReady()");

      onReady();
    }
  }, [isLoading, isAnimationComplete, onReady]);

  // Este callback se ejecuta al finalizar la animación de salida
  const handleAnimationComplete = () => {
    setIsAnimationComplete(true);
  };

  console.log("Loading splash screen...");
  return (
    <>
      {/* Se pasa dataLoaded como el estado inverso de isLoading */}
      <SplashScreenContent
        dataLoaded={!isLoading}
        onAnimationComplete={handleAnimationComplete}
      />
    </>
  );
};

export default SplashScreen;
