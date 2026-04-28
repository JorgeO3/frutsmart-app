import React, { useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";

import LottieView, { type AnimationObject } from "lottie-react-native";

import { FONT_FAMILTY, FONT_WEIGHT } from "@src/constants/Font";
import { normalizeFont, scale } from "@/src/utils/responsive";
import { font, s, vs } from "@utils/responsiveV2";
import AppText from "../AppText";

interface Props {
  source: AnimationObject;
  message?: string;
  onComplete?: () => void;
  duration?: number; // Este temporizador ahora será un respaldo para onComplete
  shouldComplete?: boolean; // Indica cuándo la animación debe detenerse suavemente
}

const AsyncProcessingPresentation = React.memo(
  ({
    source,
    message = "Revisión de la fotografía",
    onComplete,
    duration = 2100,
    shouldComplete = false,
  }: Props) => {
    // Referencias
    const hasCompletedRef = useRef(false);
    const lottieRef = useRef<LottieView>(null);
    const timerRef = useRef<number | null>(null);

    // --- NUEVO ---
    // Bandera para señalar que la animación debe detenerse después del ciclo actual
    const shouldStopGracefullyRef = useRef(false);
    // -------------

    // Manejar la finalización (llama a onComplete una sola vez)
    const handleCompletion = useCallback(() => {
      if (!hasCompletedRef.current && onComplete) {
        hasCompletedRef.current = true;
        onComplete();
        // Limpiar el temporizador si se completó por animación
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }
    }, [onComplete]);

    // Efecto para manejar la señal de "debería completarse"
    useEffect(() => {
      if (shouldComplete && !hasCompletedRef.current) {
        console.log("Should complete signal received.");
        // --- NUEVO ---
        // Señalamos que debe detenerse suavemente en el próximo onAnimationFinish
        shouldStopGracefullyRef.current = true;

        // Configurar un temporizador de respaldo para handleCompletion
        // (Esto asegura que onComplete se llame incluso si onAnimationFinish
        // no se dispara por alguna razón, pero no controla la pausa de la animación visual)
        timerRef.current = setTimeout(() => {
          console.log("Completion timer fired.");
          handleCompletion();
          // Opcional: Asegurarse de pausar la animación si el temporizador la activó
          if (lottieRef.current) {
            lottieRef.current.pause();
          }
        }, duration);
        // -------------
      } else if (!shouldComplete && lottieRef.current) {
        // Si shouldComplete vuelve a false y la animación existe,
        // asegúrate de que la bandera de detención esté en false y la animación no esté pausada.
        shouldStopGracefullyRef.current = false;
        // Opcional: Si alguna lógica externa pudiera pausarla, aquí podrías play()
        // lottieRef.current.play(); // Descomentar si necesitas reanudar cuando shouldComplete es false
      }

      return () => {
        // Limpiar el temporizador al desmontar
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
      // Dependencias: shouldComplete y handleCompletion (porque el timer lo usa)
    }, [shouldComplete, duration, handleCompletion]);

    // Manejar el evento de finalización de la animación (clave para la pausa suave)
    const handleAnimationFinish = useCallback(
      (isCancelled: boolean) => {
        console.log("Animation cycle finished. Cancelled:", isCancelled);
        // Si el ciclo no fue cancelado (es decir, llegó al final de un loop)
        if (!isCancelled) {
          // --- NUEVO ---
          // Si hemos recibido la señal para detener suavemente...
          if (shouldStopGracefullyRef.current && lottieRef.current) {
            console.log("Stopping gracefully after loop.");
            lottieRef.current.pause(); // Llama al comando nativo para pausar la animación
            // Una vez pausada, llamamos a la función de completado
            handleCompletion();
            shouldStopGracefullyRef.current = false; // Resetea la bandera
          } else if (
            !shouldStopGracefullyRef.current &&
            !hasCompletedRef.current &&
            shouldComplete
          ) {
            // Este caso podría ocurrir si la animación termina *antes* de que shouldComplete se active,
            // pero shouldComplete es true en el momento del finish. Es menos común con loop=true,
            // pero es bueno considerarlo. Podríamos llamar handleCompletion aquí también.
            console.log(
              "Animation finished, shouldComplete is true, but graceful stop was not flagged. Calling completion.",
            );
            handleCompletion();
          }
          // Si no deberíamos completar, simplemente dejamos que siga el loop (si loop=true)
          // Si shouldComplete es false, la lógica de loop={true} se encarga.
        } else {
          // La animación fue cancelada. Esto podría ocurrir si la vista se desmonta
          // o si se llama a play/reset de forma abrupta.
          console.log("Animation was cancelled.");
          // Si fue cancelada y deberíamos haber completado, aún llamamos a handleCompletion
          if (shouldComplete && !hasCompletedRef.current) {
            console.log(
              "Animation cancelled but should have completed. Calling completion.",
            );
            handleCompletion();
          }
        }
      },
      [shouldComplete, handleCompletion],
    ); // Dependencias: shouldComplete, handleCompletion

    return (
      <View style={styles.container}>
        <View />

        <LottieView
          ref={lottieRef}
          source={source}
          style={styles.animation}
          autoPlay={true}
          loop={true}
          speed={1.0}
          onAnimationFinish={handleAnimationFinish}
          resizeMode="cover"
        />
        <View style={{ width: "100%" }}>
          <AppText.BodyXS style={styles.legalInfoText}>
            FrutSmart® S.A.S. Todos los derechos reservados 2025
          </AppText.BodyXS>
          <View style={styles.messageContainer}>
            <AppText.BodyXS color="secondary">{message}</AppText.BodyXS>
          </View>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
    width: "100%",
  },
  animation: {
    width: s(240),
    height: s(240),
    marginTop: vs(150),
  },
  legalInfoText: {
    fontSize: font.scale(11, { min: 12, max: 14 }),
    paddingVertical: vs(16),
    textAlign: "center",
  },
  messageContainer: {
    backgroundColor: "#000000DE",
    width: "100%",
    height: vs(45),
    borderTopRightRadius: s(3),
    borderTopLeftRadius: s(3),
    justifyContent: "center",
    paddingLeft: s(16),
  },
  text: {
    fontSize: font.scale(11, { min: 12, max: 14 }),
    paddingLeft: s(16),
    paddingVertical: vs(16),
    textAlign: "center",
  },
});

export default AsyncProcessingPresentation;
