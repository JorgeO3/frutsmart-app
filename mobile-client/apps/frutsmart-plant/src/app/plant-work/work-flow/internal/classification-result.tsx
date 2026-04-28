import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { useRouter } from "expo-router";
import { useSharedValue } from "react-native-reanimated";
import Carousel, {
  Pagination,
  type ICarouselInstance,
} from "react-native-reanimated-carousel";

import {
  useCurrentInternalClassification,
  useCurrentInternalPhotoUri,
  usePlantWorkActions,
} from "@stores/plantWork";
import { s } from "@utils/responsive";

import AppButton from "@components/AppButton";
import AppCircleRadioButton from "@components/AppCircleRadioButton";
import AppImage from "@components/AppImage";
import AppModal from "@components/AppModal";
import AppText from "@components/AppText";
import AppView from "@components/AppView";

import ImagePreviewModal from "src/components/ImagePreviewModal";

interface ClassificationCardProps {
  label: string;
  confidence: number;
}

const ClassificationCard = (props: ClassificationCardProps) => {
  return (
    <View
      style={{
        elevation: 1,
        width: "95%",
        marginTop: s(20),
        borderRadius: s(10),
        shadowOpacity: 0.35,
        shadowColor: "#171717",
        backgroundColor: "#f6f5f5",
        shadowOffset: { width: 0, height: s(3) },
      }}
    >
      <View
        style={{
          width: "100%",
          borderRadius: s(10),
          paddingVertical: s(10),
          alignItems: "center",
          backgroundColor: "#E94F1C",
        }}
      >
        <AppText.H4 color="secondary" style={{ textAlign: "center" }}>
          Clasificación
        </AppText.H4>
      </View>
      <View style={{ padding: s(10) }}>
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
        paddingVertical: s(20),
        paddingHorizontal: s(30),
        borderRadius: s(10),
      }}
    >
      <AppText.H3 color="secondary" style={{ textAlign: "center" }}>
        ¿La clasificación anterior fue la ideal?
      </AppText.H3>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-around",
          marginTop: s(20),
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
  imgSrc: { uri: string }; // Changed from string to any to accept require statements
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
          padding: s(10),
          zIndex: 1, // Ensure the buttons are above the image
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(255, 255, 255, 0.85)",
            padding: s(10),
            borderRadius: 10,
          }}
        >
          <AppText.H4 color="text">Foto N° {index + 1}</AppText.H4>
        </View>

        <TouchableOpacity
          style={{
            padding: s(5),
            backgroundColor: "rgba(255, 255, 255, 0.85)",
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            aspectRatio: 1,
          }}
          onPress={() => handleZoom()} // Call the zoom handler if provided
        >
          <View style={{ width: s(25), height: s(25) }}>
            <AppImage
              source={require("@/assets/images/arrows-maximize-black-icon.webp")}
              style={{ width: "100%", height: "100%" }}
              alt="Zoom Icon"
            />
          </View>
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
  const { width: screenWidth } = useWindowDimensions();

  const { nextIteration, updateInternalFeedback } = usePlantWorkActions();

  const progress = useSharedValue<number>(0);
  const ref = useRef<ICarouselInstance>(null);
  const [isDisabled, setIsDisabled] = useState(true);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selected, setSelected] = useState<Answer | null>(null);
  const [isModalPreviewVisible, setIsModalPreviewVisible] = useState(false);

  const internalPhoto = useCurrentInternalPhotoUri();
  const internalClassification = useCurrentInternalClassification();

  const handleToggle = useCallback((answer: Answer) => {
    setSelected((prev) => (prev === answer ? null : answer));
  }, []);

  const handleZoom = useCallback(() => {
    setIsModalPreviewVisible(true);
  }, []);

  const handleNext = useCallback(() => {
    if (isDisabled) return;
    setIsModalVisible(true);
  }, [isDisabled]);

  const handleModalAccept = useCallback(() => {
    setIsModalVisible(false);

    if (selected === "yes") {
      updateInternalFeedback({
        isCorrect: true,
        correctedClassName: null,
        observation: "",
      });
      router.replace("/plant-work/work-flow/external/steps");
      nextIteration();
    } else if (selected === "no") {
      router.replace("/plant-work/work-flow/internal/classification-review");
    }
  }, [selected, updateInternalFeedback, router, nextIteration]);

  const handleModalClose = useCallback(() => {
    setIsModalVisible(false);
  }, []);

  useEffect(() => {
    setIsDisabled(selected === null);
  }, [selected]);

  // Early return con loader si no hay datos disponibles
  if (!internalPhoto || !internalClassification) {
    return (
      <AppView legalTextColor="#000">
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color="#227C26" />
          <AppText.BodyM style={{ marginTop: s(16), textAlign: "center" }}>
            Cargando datos de clasificación...
          </AppText.BodyM>
        </View>
      </AppView>
    );
  }

  const carouselPhotos = [{ uri: internalPhoto }];

  console.log("Internal Photos URIs:", internalPhoto);

  const { aiPrediction } = internalClassification;
  if (!aiPrediction) {
    return (
      <AppView legalTextColor="#000">
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <AppText.BodyM style={{ textAlign: "center" }}>
            Error: El resultado de la clasificación no está disponible.
          </AppText.BodyM>
        </View>
      </AppView>
    );
  }
  const { className: label, confidence } = aiPrediction;

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
        contentContainerStyle={{ flexGrow: 1, padding: s(16) }}
      >
        <AppView legalTextColor="#000">
          <View style={{ flex: 1, alignItems: "center", width: "100%" }}>
            <AppText.H2 color="primary">Respuesta del Modelo IA</AppText.H2>

            <AppText style={{ marginVertical: s(10) }}>
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
                  imgSrc={item}
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
              data={carouselPhotos}
              progress={progress}
              onPress={onPressPagination}
              containerStyle={{ gap: s(5), marginTop: s(10) }}
              dotStyle={{
                backgroundColor: "rgba(0,0,0,0.2)",
                borderRadius: 50,
              }}
            />

            <ClassificationCard label={label} confidence={confidence} />

            <View style={{ marginTop: s(20), width: "95%" }}>
              <IsClassificationIdealCard
                onToggle={handleToggle}
                selected={selected}
              />
            </View>
          </View>

          <View
            style={{
              alignItems: "center",
              paddingTop: s(20),
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
