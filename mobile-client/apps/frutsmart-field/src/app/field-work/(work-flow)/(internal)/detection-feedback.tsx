import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";

import { scale } from "@utils/responsive";
import type { DetectionErrorData } from "@utils/detectionErrorHandler";

import AppView from "@components/AppView";
import AppText from "@components/AppText";
import AppImage from "@components/AppImage";
import AppButton from "@components/AppButton";

const fallbackMessages = [
  "El racimo debe estar en un espacio lo más limpio posible.",
  "Recuerde mantener una distancia de al menos 1 metro de distancia y enfocar muy bien la cámara.",
];

const FeedbackScreen = () => {
  const router = useRouter();

  const { data } = useLocalSearchParams<{ data: string }>();
  const dataFallback = JSON.stringify({
    imgSrc: require("@/assets/images/blurred_cluster.webp"),
    feedbackMessages: fallbackMessages,
  });

  console.log("FeedbackScreen data:", data);
  const { imgSrc, feedbackMessages } = JSON.parse(
    data || dataFallback,
  ) as DetectionErrorData;

  const handleRetry = useCallback(() => {
    router.replace("/field-work/(work-flow)/(internal)/picture");
  }, [router]);

  return (
    <AppView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={{ flex: 1, alignItems: "center" }}>
          <AppText.H1 color="warning">¡Ups! Algo salió mal</AppText.H1>
          <AppText.BodyS
            color="secondary"
            style={{
              textAlign: "center",
              maxWidth: scale(350),
              marginTop: scale(10),
            }}
          >
            La fotografía presenta algunos errores, tenga en cuenta estas
            recomendaciones:
          </AppText.BodyS>

          <View
            style={{
              aspectRatio: 1,
              width: "80%",
              marginTop: scale(20),
              backgroundColor: "#000",
              borderRadius: scale(15),
              overflow: "hidden",
            }}
          >
            <AppImage
              source={imgSrc}
              style={{ width: "100%", height: "100%" }}
              alt="Feedback Image"
              contentFit="fill"
            />
          </View>

          <View style={{ width: "100%", marginTop: scale(30), gap: scale(15) }}>
            {feedbackMessages.map((message, index) => (
              <View
                key={`feedback-message-${message}`}
                style={{
                  padding: scale(15),
                  borderRadius: scale(15),
                  backgroundColor: "#E94E1A",
                }}
              >
                <AppText.BodyS color="secondary">
                  {index + 1}. {message}
                </AppText.BodyS>
              </View>
            ))}
          </View>
        </View>

        <AppButton
          color="secondary"
          title="Repetir foto"
          onPress={handleRetry}
        />
      </View>
    </AppView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#227c26",
  },
  container: {
    flex: 1,
    alignItems: "center",
    padding: scale(20),
  },
});

export default FeedbackScreen;
