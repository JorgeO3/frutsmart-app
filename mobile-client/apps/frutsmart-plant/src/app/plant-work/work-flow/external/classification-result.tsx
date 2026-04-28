import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useSharedValue } from "react-native-reanimated";
import Carousel, {
  type ICarouselInstance,
} from "react-native-reanimated-carousel";

import {
  useCurrentExternalPhotoUris,
  useCurrentIteration,
} from "@stores/plantWork";
import { s } from "@utils/responsive";

import AppButton from "@components/AppButton";
import AppImage from "@components/AppImage";
import AppText from "@components/AppText";
import AppView from "@components/AppView";
import ImagePreviewModal from "@components/ImagePreviewModal";

// Constantes fuera del componente para evitar recreación
const H_PAD = s(16);
const CAROUSEL_WIDTH_RATIO = 0.9;
const CAROUSEL_HEIGHT_RATIO = 0.9;
const CAROUSEL_AUTO_PLAY_INTERVAL = 2000;

const ROUTE_KEYS = [
  "INTERNAL_OVERVIEW_SCREEN",
  "HARVEST_CRITERIA_SCREEN",
  "OVERALL_SUMMARY_SCREEN",
] as const;

type RouteKey = (typeof ROUTE_KEYS)[number];
type RoutesMap = Record<RouteKey, Href>;

export const ROUTES = {
  INTERNAL_OVERVIEW_SCREEN: "/plant-work/work-flow/internal/overview",
  HARVEST_CRITERIA_SCREEN: "/plant-work/work-flow/harvest-criteria",
  OVERALL_SUMMARY_SCREEN: "/plant-work/work-flow/overall-summary",
} as RoutesMap;

type Answer = "yes" | "no";

interface CarouselItemProps {
  imgSrc: { uri: string };
  index: number;
  handleZoom: (index: number) => void;
}

const CarouselItem = memo<CarouselItemProps>(
  ({ imgSrc, index, handleZoom }) => {
    const onZoomPress = useCallback(
      () => handleZoom(index),
      [handleZoom, index],
    );

    return (
      <View style={styles.container}>
        <View style={styles.carouselItemTopBar}>
          <View />

          <TouchableOpacity style={styles.zoomButton} onPress={onZoomPress}>
            <AppImage
              style={{ width: s(24), height: s(24) }}
              source={require("@/assets/images/arrows-maximize-black-icon.webp")}
              alt="Zoom In"
            />
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
  parallaxScrollingOffset: s(40),
  parallaxAdjacentItemScale: 0.8,
};

const ClassificationResultScreen = () => {
  const router = useRouter();
  const step = useCurrentIteration();

  // Screen State - usando lazy initial state donde sea posible
  const progress = useSharedValue<number>(0);
  const ref = useRef<ICarouselInstance>(null);
  const [state, setState] = useState(() => ({
    scrollEnabled: true,
    isModalVisible: false,
    selected: null as Answer | null,
    isModalPreviewVisible: false,
  }));

  const rawPhotos = useCurrentExternalPhotoUris();
  const photos = rawPhotos.map((uri) => ({ uri }));

  console.log("Mapped Photos:", photos);

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

  const handleNext = useCallback(() => {
    console.log("Next button pressed. Current step:", step);

    router.replace(
      step <= 2
        ? ROUTES.INTERNAL_OVERVIEW_SCREEN
        : ROUTES.HARVEST_CRITERIA_SCREEN,
    );
  }, [router.replace, step]);

  const handleZoom = useCallback(() => {
    updateState({ isModalPreviewVisible: true });
  }, [updateState]);

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

  // Renderizar item del carousel con key estable
  const renderCarouselItem = useCallback(
    ({ item, index }: { item: { uri: string }; index: number }) => (
      <CarouselItem
        key={`carousel-item-${index}`}
        imgSrc={item}
        index={index}
        handleZoom={handleZoom}
      />
    ),
    [handleZoom],
  );

  // Renderizado del contenido principal memorizado
  const mainContent = useMemo(
    () => (
      <View style={styles.mainContainer}>
        <AppText.H2 color="warning">Respuesta del Modelo IA</AppText.H2>

        <AppText.BodyS style={styles.subtitle}>
          Clasificación definitiva
        </AppText.BodyS>

        <Carousel
          ref={ref}
          loop={true}
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

        <AppText.H4
          style={{ textAlign: "center", width: "80%", marginTop: s(20) }}
        >
          Si desea continuar con el proceso, presione el botón "Siguiente".
        </AppText.H4>
      </View>
    ),
    [
      dimensions,
      photos,
      onProgressChange,
      renderCarouselItem,
      onScrollStart,
      onScrollEnd,
    ],
  );

  return (
    <>
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
            <AppButton color="warning" title="Siguiente" onPress={handleNext} />
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
    padding: s(10),
    zIndex: 1,
  },
  photoLabel: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    padding: s(10),
    borderRadius: 10,
  },
  zoomButton: {
    aspectRatio: 1,
    padding: s(5),
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  // Estilos del ScrollView y contenedores principales
  scrollContent: {
    flexGrow: 1,
    padding: s(20),
  },
  mainContainer: {
    flex: 1,
    alignItems: "center",
    width: "100%",
  },
  subtitle: {
    marginVertical: s(10),
  },

  // Estilos de paginación
  paginationContainer: {
    flexDirection: "row",
    gap: s(5),
    marginTop: s(10),
    alignItems: "center",
    justifyContent: "center",
  },
  paginationDotWrapper: {
    padding: s(5),
  },
  paginationDot: {
    width: s(8),
    height: s(8),
    borderRadius: s(4),
    backgroundColor: "rgba(0,0,0,0.2)",
  },

  // Estilos de la tarjeta de clasificación
  classificationCard: {
    elevation: 1,
    width: "95%",
    marginTop: s(20),
    borderRadius: 10,
    shadowOpacity: 0.35,
    shadowColor: "#171717",
    backgroundColor: "#f6f5f5",
    shadowOffset: { width: 0, height: s(3) },
  },
  classificationHeader: {
    width: "100%",
    borderRadius: 10,
    paddingVertical: s(10),
    alignItems: "center",
    backgroundColor: "#E94F1C",
  },
  classificationContent: {
    paddingVertical: s(10),
    paddingHorizontal: s(10),
  },

  // Estilos de la tarjeta ideal
  idealCard: {
    backgroundColor: "#227C26",
    width: "100%",
    paddingVertical: s(20),
    paddingHorizontal: s(30),
    borderRadius: 10,
  },
  radioContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: s(20),
  },
  idealCardContainer: {
    marginTop: s(20),
    width: "95%",
  },

  // Estilos del botón
  buttonContainer: {
    alignItems: "center",
    paddingTop: s(20),
  },

  // Estilos de texto
  centerText: {
    textAlign: "center",
  },
});

export default ClassificationResultScreen;
