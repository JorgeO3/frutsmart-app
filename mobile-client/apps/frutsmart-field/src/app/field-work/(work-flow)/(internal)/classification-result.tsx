import React, { use, useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";

import { useRouter } from "expo-router";
import Carousel, {
  Pagination,
  type ICarouselInstance,
} from "react-native-reanimated-carousel";
import { useSharedValue } from "react-native-reanimated";

import {
  useFieldWorkActions,
  useInternalClassification,
  useInternalSegmentedUris,
  useFieldWorkStoreBase,
} from "@stores/fieldWork";
import { scale } from "@utils/responsive";

import AppText from "@components/AppText";
import AppView from "@components/AppView";
import AppIcon from "@components/AppIcon";
import AppImage from "@components/AppImage";
import AppModal from "@components/AppModal";
import AppButton from "@components/AppButton";
import ImagePreviewModal from "@components/ImagePreviewModal";
import AppCircleRadioButton from "@components/AppCircleRadioButton";

interface ClassificationCardProps {
  label: string;
}

const ClassificationCard = (props: ClassificationCardProps) => {
  return (
    <View
      style={{
        elevation: 1,
        width: "95%",
        marginTop: scale(20),
        borderRadius: scale(10),
        shadowOpacity: 0.35,
        shadowColor: "#171717",
        backgroundColor: "#f6f5f5",
        shadowOffset: { width: 0, height: scale(3) },
      }}
    >
      <View
        style={{
          width: "100%",
          borderRadius: scale(10),
          paddingVertical: scale(10),
          alignItems: "center",
          backgroundColor: "#E94F1C",
        }}
      >
        <AppText.H4 color="secondary" style={{ textAlign: "center" }}>
          Clasificación
        </AppText.H4>
      </View>
      <View style={{ padding: scale(10) }}>
        <AppText.BodyM>
          La clasificación generada por el modelo de IA es:{" "}
          <AppText.H3>{props.label}</AppText.H3>
        </AppText.BodyM>
      </View>
    </View>
  );
};

type Answer = "yes" | "no";

interface IsClassificationIdealCardProps {
  selected: Answer | null;
  onToggle: (answer: Answer) => void;
}

const IsClassificationIdealCard = ({
  selected,
  onToggle,
}: IsClassificationIdealCardProps) => {
  const handleToggle = useCallback(
    (answer: Answer) => {
      onToggle(answer);
    },
    [onToggle],
  );

  return (
    <View
      style={{
        backgroundColor: "#227C26",
        width: "100%",
        paddingVertical: scale(20),
        paddingHorizontal: scale(30),
        borderRadius: scale(10),
      }}
    >
      <AppText.H3 color="secondary" style={{ textAlign: "center" }}>
        ¿La clasificación anterior fue la ideal?
      </AppText.H3>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-around",
          marginTop: scale(20),
        }}
      >
        <AppCircleRadioButton
          label="Sí"
          selected={selected === "yes"}
          onPress={() => handleToggle("yes")}
        />

        <AppCircleRadioButton
          label="No"
          selected={selected === "no"}
          onPress={() => handleToggle("no")}
        />
      </View>
    </View>
  );
};

interface CarouselItemProps {
  imgSrc: string; // Changed from string to any to accept require statements
  index: number; // Added index prop for better key management
  handleZoom: () => void; // Optional zoom handler
}

const CarouselItem = ({ imgSrc, index, handleZoom }: CarouselItemProps) => {
  return (
    <View style={styles.container}>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          flexDirection: "row",
          justifyContent: "space-between",
          width: "100%",
          padding: scale(10),
          zIndex: 1, // Ensure the buttons are above the image
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(255, 255, 255, 0.85)",
            padding: scale(10),
            borderRadius: 10,
          }}
        >
          <AppText.H4 color="text">Foto N° {index + 1}</AppText.H4>
        </View>

        <TouchableOpacity
          style={{
            padding: scale(5),
            backgroundColor: "rgba(255, 255, 255, 0.85)",
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={() => handleZoom()} // Call the zoom handler if provided
        >
          <AppIcon.ZoomOutMap size={28} />
        </TouchableOpacity>
      </View>

      <View style={styles.background}>
        {/* Imagen principal nítida */}
        <AppImage
          source={imgSrc}
          style={styles.foreground}
          alt="Imagen de prueba"
        />
      </View>
    </View>
  );
};

const ClassificationIntroScreen = () => {
  const router = useRouter();

  const allSegmentedUris = useInternalSegmentedUris();
  const rawPhoto = allSegmentedUris[0];

  const { updateInternalResult } = useFieldWorkActions();
  const { result: finalResult } = useInternalClassification();
  if (!finalResult) {
    throw new Error("El resultado de la clasificación no está disponible.");
  }

  const { aiPrediction } = finalResult;
  const { className } = aiPrediction;

  console.log({ finalResult });

  const progress = useSharedValue<number>(0);
  const ref = useRef<ICarouselInstance>(null);
  const [isDisabled, setIsDisabled] = useState(true);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selected, setSelected] = useState<Answer | null>(null);
  const [isModalPreviewVisible, setIsModalPreviewVisible] = useState(false);

  if (!rawPhoto) {
    throw new Error("No photo data available for the current step.");
  }

  if (!aiPrediction) {
    throw new Error("El resultado de la clasificación no está disponible.");
  }

  // Se prioriza mostrar la foto segmentada, que fue la que se clasificó.
  const carouselPhotos = [{ uri: rawPhoto }];

  const { width: screenWidth } = useWindowDimensions();
  const H_PAD = 16;
  const contentWidth = screenWidth - H_PAD * 2;
  const carouselWidth = contentWidth * 0.9;
  const carouselHeight = carouselWidth * 0.9;

  const onPressPagination = (index: number) => {
    ref.current?.scrollTo({
      count: index - progress.value,
      animated: true,
    });
  };

  const handleToggle = (answer: Answer) => {
    setSelected((prev) => (prev === answer ? null : answer));
  };

  const handleNext = () => {
    if (isDisabled) return;
    setIsModalVisible(true);
  };

  const handleModalAccept = () => {
    setIsModalVisible(false);

    if (selected === "yes") {
      // Si el usuario está de acuerdo, se guarda el feedback como correcto.
      updateInternalResult({
        humanFeedback: {
          isCorrect: true,
          correctedClassName: null,
          observation: "",
        },
      });

      const currentStoreState = useFieldWorkStoreBase.getState();
      const currentStoreStateJSON = JSON.stringify(currentStoreState);
      console.log("Current FieldWork Store State:", currentStoreStateJSON);

      // Y se navega a la pantalla final de resumen.
      router.replace("/field-work/(work-flow)/saving-classification");

      console.log(
        "Feedback guardado como correcto. Navegando a la pantalla de resumen.",
      );
    } else if (selected === "no") {
      // Si no está de acuerdo, se navega a la pantalla de revisión.
      // Esa pantalla será la responsable de guardar el feedback corregido.
      router.replace(
        "/field-work/(work-flow)/(internal)/classification-review",
      );
    }
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
  };

  const handleZoom = useCallback(() => {
    setIsModalPreviewVisible(true);
  }, []);

  useEffect(() => {
    setIsDisabled(selected === null);
  }, [selected]);

  return (
    <>
      <AppModal
        acceptText="Aceptar"
        cancelText="Cancelar"
        visible={isModalVisible}
        onClose={handleModalClose}
        onAccept={handleModalAccept}
        description={`¿Está seguro de que la clasificación ${selected === "yes" ? "si" : "no"} se realizó bien?`}
      />

      <ImagePreviewModal
        visible={isModalPreviewVisible}
        onClose={() => setIsModalPreviewVisible(false)}
        photos={carouselPhotos}
      />

      <ScrollView
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, padding: scale(16) }}
      >
        <AppView>
          <View style={{ flex: 1, alignItems: "center", width: "100%" }}>
            <AppText.H2 color="primary">Respuesta del Modelo IA</AppText.H2>

            <AppText style={{ marginVertical: scale(10) }}>
              Clasificación definitiva
            </AppText>

            <Carousel
              ref={ref}
              loop={false}
              mode="parallax"
              width={carouselWidth}
              height={carouselHeight}
              data={carouselPhotos}
              snapEnabled={true}
              pagingEnabled={true}
              autoPlayInterval={2000}
              modeConfig={{
                parallaxScrollingScale: 0.9,
                parallaxScrollingOffset: 40,
                parallaxAdjacentItemScale: 0.8,
              }}
              onProgressChange={(_, p) => {
                progress.value = p;
              }}
              renderItem={({ item, index }) => (
                <CarouselItem
                  imgSrc={item.uri}
                  index={index}
                  handleZoom={handleZoom}
                />
              )}
              onScrollStart={() => setScrollEnabled(false)}
              onScrollEnd={() => setScrollEnabled(true)}
              containerStyle={{
                width: "100%",
                alignItems: "center",
                height: carouselHeight,
              }}
              style={{ height: "100%" }}
            />

            <Pagination.Basic
              data={allSegmentedUris}
              progress={progress}
              onPress={onPressPagination}
              containerStyle={{ gap: scale(5), marginTop: scale(10) }}
              dotStyle={{
                backgroundColor: "rgba(0,0,0,0.2)",
                borderRadius: 50,
              }}
            />

            <ClassificationCard label={className} />

            <View style={{ marginTop: scale(20), width: "95%" }}>
              <IsClassificationIdealCard
                onToggle={handleToggle}
                selected={selected}
              />
            </View>
          </View>

          <View
            style={{
              alignItems: "center",
              paddingTop: scale(20),
            }}
          >
            <AppButton
              color="primary"
              title="Continuar"
              onPress={handleNext}
              disabled={isDisabled}
            />
          </View>
        </AppView>
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: scale(15),
  },
  container: {
    flex: 1,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  background: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
  },
  backgroundImage: {
    alignSelf: "center",
  },
  foreground: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    borderRadius: 10,
    resizeMode: "cover",
    position: "absolute",
  },
});

export default ClassificationIntroScreen;
