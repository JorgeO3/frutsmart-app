import React, {
  memo,
  useRef,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import Carousel, {
  type ICarouselInstance,
} from "react-native-reanimated-carousel";

import { scale } from "@utils/responsive";
import {
  useFieldWorkActions,
  useExternalSegments,
  useExternalClassification,
  useFieldWorkStoreBase,
} from "@stores/fieldWork";

import AppText from "@components/AppText";
import AppView from "@components/AppView";
import AppIcon from "@components/AppIcon";
import AppImage from "@components/AppImage";
import AppModal from "@components/AppModal";
import AppButton from "@components/AppButton";
import ImagePreviewModal from "@components/ImagePreviewModal";
import AppCircleRadioButton from "@components/AppCircleRadioButton";

// Constantes fuera del componente para evitar recreación
const H_PAD = 16;
const CAROUSEL_WIDTH_RATIO = 0.9;
const CAROUSEL_HEIGHT_RATIO = 0.9;
const CAROUSEL_AUTO_PLAY_INTERVAL = 2000;

// Interfaces
interface ClassificationCardProps {
  label: string;
}

type Answer = "yes" | "no";

interface IsClassificationIdealCardProps {
  selected: Answer | null;
  onToggle: (answer: Answer) => void;
}

interface CarouselItemProps {
  imgSrc: string;
  index: number;
  handleZoom: (index: number) => void;
}

// Componentes memorizados
const ClassificationCard = memo<ClassificationCardProps>(({ label }) => {
  return (
    <View style={styles.classificationCard}>
      <View style={styles.classificationHeader}>
        <AppText.H5 color="secondary" style={styles.centerText}>
          Clasificación
        </AppText.H5>
      </View>
      <View style={styles.classificationContent}>
        <AppText.BodyS>
          La clasificación generada por el modelo de IA es:{" "}
          <AppText.H4>{label}</AppText.H4>
        </AppText.BodyS>
      </View>
    </View>
  );
});

const IsClassificationIdealCard = memo<IsClassificationIdealCardProps>(
  ({ selected, onToggle }) => {
    const handleToggleYes = useCallback(() => onToggle("yes"), [onToggle]);
    const handleToggleNo = useCallback(() => onToggle("no"), [onToggle]);

    return (
      <View style={styles.idealCard}>
        <AppText.H4 color="secondary" style={styles.centerText}>
          ¿La clasificación anterior fue la ideal?
        </AppText.H4>

        <View style={styles.radioContainer}>
          <AppCircleRadioButton
            label="Sí"
            selected={selected === "yes"}
            onPress={handleToggleYes}
          />

          <AppCircleRadioButton
            label="No"
            selected={selected === "no"}
            onPress={handleToggleNo}
          />
        </View>
      </View>
    );
  },
);

const CarouselItem = memo<CarouselItemProps>(
  ({ imgSrc, index, handleZoom }) => {
    const onZoomPress = useCallback(
      () => handleZoom(index),
      [handleZoom, index],
    );

    return (
      <View style={styles.container}>
        <View style={styles.carouselItemTopBar}>
          <View style={styles.photoLabel}>
            <AppText.H5 color="text">Foto N° {index + 1}</AppText.H5>
          </View>

          <TouchableOpacity style={styles.zoomButton} onPress={onZoomPress}>
            <AppIcon.ZoomOutMap size={28} />
          </TouchableOpacity>
        </View>

        <View style={styles.background}>
          <AppImage
            source={imgSrc}
            style={styles.foreground}
            alt="Imagen de prueba"
          />
        </View>
      </View>
    );
  },
);

// Configuración del carousel memorizada
const carouselModeConfig = {
  parallaxScrollingScale: 0.9,
  parallaxScrollingOffset: 40,
  parallaxAdjacentItemScale: 0.8,
};

// Antes del componente o afuera del useAnimatedStyle
const DOT_SIZE_ACTIVE = scale(10);
const DOT_SIZE_INACTIVE = scale(8);
const RADIUS_ACTIVE = scale(5);
const RADIUS_INACTIVE = scale(4);

interface PaginationDotProps {
  index: number;
  progress: SharedValue<number>;
}

// Componente individual para cada dot de paginación
const PaginationDot = memo(({ index, progress }: PaginationDotProps) => {
  const animatedStyle = useAnimatedStyle(() => {
    "worklet";
    const isActive = progress.value === index;
    return {
      width: isActive ? DOT_SIZE_ACTIVE : DOT_SIZE_INACTIVE,
      height: isActive ? DOT_SIZE_ACTIVE : DOT_SIZE_INACTIVE,
      borderRadius: isActive ? RADIUS_ACTIVE : RADIUS_INACTIVE,
      backgroundColor: isActive ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.2)",
    };
  });

  return (
    <View style={styles.paginationDotWrapper}>
      <Animated.View style={[styles.paginationDot, animatedStyle]} />
    </View>
  );
});

interface OptimizedPaginationProps {
  data: { uri: string }[];
  progress: SharedValue<number>;
}

// Componente de paginación personalizado optimizado
const OptimizedPagination = memo(
  ({ data, progress }: OptimizedPaginationProps) => {
    const dots = useMemo(
      () =>
        data.map((item, index) => (
          <PaginationDot
            key={`pagination-dot-${item.uri}-${index}`}
            index={index}
            progress={progress}
          />
        )),
      [data, progress], // progress es estable como SharedValue
    );

    return <View style={styles.paginationContainer}>{dots}</View>;
  },
);

const ClassificationIntroScreen = () => {
  const router = useRouter();

  // Screen State - usando lazy initial state donde sea posible
  const progress = useSharedValue<number>(0);
  const ref = useRef<ICarouselInstance>(null);
  const [state, setState] = useState(() => ({
    isDisabled: true,
    scrollEnabled: true,
    isModalVisible: false,
    selected: null as Answer | null,
    isModalPreviewVisible: false,
  }));

  const allRawUris = useExternalSegments();
  const { updateExternalResult } = useFieldWorkActions();
  const { result: finalResult } = useExternalClassification();

  if (!finalResult) {
    throw new Error("Classification result is not available.");
  }
  const { className, confidence } = finalResult.aiPrediction;

  // Memorizar el array de fotos
  const photos = useMemo(
    () => allRawUris.map((uri) => ({ uri: uri.rawUri })),
    [allRawUris],
  );

  // Cálculos de dimensiones memorizados
  const { width: screenWidth } = useWindowDimensions();
  const dimensions = useMemo(() => {
    const contentWidth = screenWidth - H_PAD * 2;
    const carouselWidth = contentWidth * CAROUSEL_WIDTH_RATIO;
    const carouselHeight = carouselWidth * CAROUSEL_HEIGHT_RATIO;
    return { carouselWidth, carouselHeight };
  }, [screenWidth]);

  // Callbacks optimizados usando el estado combinado
  const updateState = useCallback((updates: Partial<typeof state>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleToggle = useCallback(
    (answer: Answer) => {
      updateState({
        selected: state.selected === answer ? null : answer,
      });
    },
    [state.selected, updateState],
  );

  const handleNext = useCallback(() => {
    if (!state.isDisabled) {
      updateState({ isModalVisible: true });
    }
  }, [state.isDisabled, updateState]);

  const handleModalAccept = useCallback(() => {
    updateState({ isModalVisible: false });

    const isCorrect = state.selected === "yes";
    updateExternalResult({
      humanFeedback: {
        isCorrect,
        correctedClassName: null, // Esto se establecería en la pantalla de revisión
        observation: "", // Esto se establecería en la pantalla de revisión
      },
    });

    const currentStoreState = useFieldWorkStoreBase.getState();
    const currentStoreStateJSON = JSON.stringify(currentStoreState);
    console.log("Current FieldWork Store State:", currentStoreStateJSON);

    requestAnimationFrame(() => {
      if (isCorrect) {
        router.replace("/field-work/(work-flow)/harvest-criteria");
      } else {
        router.replace(
          "/field-work/(work-flow)/(external)/classification-review",
        );
      }
    });
  }, [state.selected, router, updateState, updateExternalResult]);

  const handleModalClose = useCallback(() => {
    updateState({ isModalVisible: false });
  }, [updateState]);

  const handleZoom = useCallback(
    (index: number) => {
      updateState({ isModalPreviewVisible: true });
    },
    [updateState],
  );

  const handleClosePreview = useCallback(() => {
    updateState({ isModalPreviewVisible: false });
  }, [updateState]);

  const onScrollStart = useCallback(() => {
    updateState({ scrollEnabled: false });
  }, [updateState]);

  const onScrollEnd = useCallback(() => {
    updateState({ scrollEnabled: true });
  }, [updateState]);

  const onProgressChange = useCallback(
    (_: number, p: number) => {
      progress.value = p;
    },
    [progress],
  );

  // Renderizado condicional del texto del modal
  const modalDescription = useMemo(
    () =>
      `¿Está seguro de que la clasificación ${state.selected === "yes" ? "si" : "no"} se realizó bien?`,
    [state.selected],
  );

  // Renderizar item del carousel con key estable
  const renderCarouselItem = useCallback(
    ({ item, index }: { item: { uri: string }; index: number }) => (
      <CarouselItem
        key={`carousel-item-${index}`}
        imgSrc={item.uri}
        index={index}
        handleZoom={handleZoom}
      />
    ),
    [handleZoom],
  );

  // Efecto optimizado con comparación específica
  useEffect(() => {
    const shouldDisable = state.selected === null;
    if (state.isDisabled !== shouldDisable) {
      updateState({ isDisabled: shouldDisable });
    }
  }, [state.selected, state.isDisabled, updateState]);

  // Renderizado del contenido principal memorizado
  const mainContent = useMemo(
    () => (
      <View style={styles.mainContainer}>
        <AppText.H3 color="primary">Respuesta del Modelo IA</AppText.H3>

        <AppText.BodyS style={styles.subtitle}>
          Clasificación definitiva
        </AppText.BodyS>

        <Carousel
          ref={ref}
          loop={false}
          width={dimensions.carouselWidth}
          height={dimensions.carouselHeight}
          data={photos}
          mode="parallax"
          snapEnabled={true}
          pagingEnabled={true}
          autoPlayInterval={CAROUSEL_AUTO_PLAY_INTERVAL}
          modeConfig={carouselModeConfig}
          onProgressChange={onProgressChange}
          renderItem={renderCarouselItem}
          onScrollStart={onScrollStart}
          onScrollEnd={onScrollEnd}
          windowSize={3}
        />

        <OptimizedPagination data={photos} progress={progress} />

        <ClassificationCard label={className} />

        <View style={styles.idealCardContainer}>
          <IsClassificationIdealCard
            onToggle={handleToggle}
            selected={state.selected}
          />
        </View>
      </View>
    ),
    [
      dimensions,
      photos,
      onProgressChange,
      renderCarouselItem,
      onScrollStart,
      onScrollEnd,
      progress,
      className,
      handleToggle,
      state.selected,
    ],
  );

  return (
    <>
      {state.isModalVisible && (
        <AppModal
          acceptText="Aceptar"
          cancelText="Cancelar"
          visible={state.isModalVisible}
          onClose={handleModalClose}
          onAccept={handleModalAccept}
          description={modalDescription}
        />
      )}

      {state.isModalPreviewVisible && (
        <ImagePreviewModal
          visible={state.isModalPreviewVisible}
          onClose={handleClosePreview}
          photos={photos}
        />
      )}

      <ScrollView
        scrollEnabled={state.scrollEnabled}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        removeClippedSubviews={true}
      >
        <AppView legalTextColor="#000">
          {mainContent}

          <View style={styles.buttonContainer}>
            <AppButton
              color="primary"
              title="Continuar"
              onPress={handleNext}
              disabled={state.isDisabled}
            />
          </View>
        </AppView>
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  // Estilos del Carousel Item
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
  foreground: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    borderRadius: 10,
    resizeMode: "cover",
    position: "absolute",
  },
  carouselItemTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    padding: scale(10),
    zIndex: 1,
  },
  photoLabel: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    padding: scale(10),
    borderRadius: 10,
  },
  zoomButton: {
    padding: scale(5),
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  // Estilos del ScrollView y contenedores principales
  scrollContent: {
    flexGrow: 1,
    padding: scale(20),
  },
  mainContainer: {
    flex: 1,
    alignItems: "center",
    width: "100%",
  },
  subtitle: {
    marginVertical: scale(10),
  },

  // Estilos de paginación
  paginationContainer: {
    flexDirection: "row",
    gap: scale(5),
    marginTop: scale(10),
    alignItems: "center",
    justifyContent: "center",
  },
  paginationDotWrapper: {
    padding: scale(5),
  },
  paginationDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: "rgba(0,0,0,0.2)",
  },

  // Estilos de la tarjeta de clasificación
  classificationCard: {
    elevation: 1,
    width: "95%",
    marginTop: scale(20),
    borderRadius: 10,
    shadowOpacity: 0.35,
    shadowColor: "#171717",
    backgroundColor: "#f6f5f5",
    shadowOffset: { width: 0, height: scale(3) },
  },
  classificationHeader: {
    width: "100%",
    borderRadius: 10,
    paddingVertical: scale(10),
    alignItems: "center",
    backgroundColor: "#E94F1C",
  },
  classificationContent: {
    paddingVertical: scale(10),
    paddingHorizontal: scale(10),
  },

  // Estilos de la tarjeta ideal
  idealCard: {
    backgroundColor: "#227C26",
    width: "100%",
    paddingVertical: scale(20),
    paddingHorizontal: scale(30),
    borderRadius: 10,
  },
  radioContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: scale(20),
  },
  idealCardContainer: {
    marginTop: scale(20),
    width: "95%",
  },

  // Estilos del botón
  buttonContainer: {
    alignItems: "center",
    paddingTop: scale(20),
  },

  // Estilos de texto
  centerText: {
    textAlign: "center",
  },
});

export default ClassificationIntroScreen;
