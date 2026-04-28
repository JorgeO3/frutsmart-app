import React, { memo, useCallback, useEffect, useState } from "react";
import {
  Modal,
  StyleSheet,
  View,
  Dimensions,
  Pressable,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  interpolate,
  Extrapolation,
  type SharedValue,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import { FlashList } from "@shopify/flash-list";
import type { FlashListProps, ListRenderItem } from "@shopify/flash-list";

import { scale } from "@utils/responsive";

import AppIcon from "@components/AppIcon";
import AppText from "@components/AppText";
import AppImage from "@components/AppImage";

// Types
interface Photo {
  uri: string;
}

interface ImageWithDimensions extends Photo {
  width: number;
  height: number;
}

interface Props {
  visible: boolean;
  photos: Photo[];
  onClose: () => void;
}

const AnimatedFlashList =
  Animated.createAnimatedComponent<FlashListProps<ImageWithDimensions>>(
    FlashList,
  );

// Constants
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ANIMATION_CONFIG = {
  entry: { carousel: 250, uiDelay: 150, ui: 200 },
  exit: { ui: 100, carouselDelay: 100, carousel: 250 },
};

// Memoized to prevent unnecessary re-renders during scroll.
const Pagination = memo(
  ({
    data,
    scrollX,
  }: {
    data: ImageWithDimensions[];
    scrollX: SharedValue<number>;
  }) => {
    return (
      <View style={styles.paginationContainer}>
        {data.map((_, i) => {
          const dotStyle = useAnimatedStyle(() => {
            const opacity = interpolate(
              scrollX.value,
              [
                (i - 1) * SCREEN_WIDTH,
                i * SCREEN_WIDTH,
                (i + 1) * SCREEN_WIDTH,
              ],
              [0.4, 1, 0.4],
              Extrapolation.CLAMP,
            );
            const scale = interpolate(
              scrollX.value,
              [
                (i - 1) * SCREEN_WIDTH,
                i * SCREEN_WIDTH,
                (i + 1) * SCREEN_WIDTH,
              ],
              [0.8, 1.25, 0.8],
              Extrapolation.CLAMP,
            );
            return { opacity, transform: [{ scale }] };
          });
          return (
            <Animated.View
              key={`dot-${data[i].uri}-${i}`}
              style={[styles.dot, dotStyle]}
            />
          );
        })}
      </View>
    );
  },
);

// Memoized to optimize the performance of the image list.
const ImageSlide = memo(
  ({
    item,
    index,
    uiElementsStyle,
  }: { item: ImageWithDimensions; index: number; uiElementsStyle: object }) => {
    const TARGET_W = SCREEN_WIDTH - 40; // padding 20 + 20
    const aspectRatio = item.width / item.height;
    const TARGET_H = TARGET_W / aspectRatio;
    return (
      <View style={styles.slide}>
        <View style={[styles.imageWrapper, { aspectRatio }]}>
          <AppImage
            source={{ uri: item.uri, width: TARGET_W, height: TARGET_H }}
            style={styles.image}
            allowDownscaling
            alt="Imagen del racimo"
          />
          <Animated.View style={[styles.photoLabelContainer, uiElementsStyle]}>
            <View style={styles.photoLabel}>
              <AppText.H4 color="text">Foto N° {index + 1}</AppText.H4>
            </View>
          </Animated.View>
        </View>
      </View>
    );
  },
);

const ImagePreviewModal = ({ visible, photos, onClose }: Props) => {
  const scrollX = useSharedValue(0);
  const uiAnimation = useSharedValue(0);
  const carouselAnimation = useSharedValue(0);

  const [imagesWithDimensions, setImagesWithDimensions] = useState<
    ImageWithDimensions[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible && photos.length) {
      for (const { uri } of photos) AppImage.prefetch(uri); // 🔥 carga en caché
    }
  }, [visible, photos]);

  // Securely fetches image dimensions only when necessary.
  useEffect(() => {
    if (
      visible &&
      photos.length > 0 &&
      imagesWithDimensions.length !== photos.length
    ) {
      const fetchImageDimensions = async () => {
        setIsLoading(true);
        // Using Promise.allSettled to prevent total failure if one image fails to load.
        const results = await Promise.allSettled(
          photos.map(
            (photo) =>
              new Promise<ImageWithDimensions>((resolve, reject) => {
                Image.getSize(
                  photo.uri,
                  (width, height) => resolve({ ...photo, width, height }),
                  reject,
                );
              }),
          ),
        );

        const successfullyLoadedImages = results
          .filter(
            (result): result is PromiseFulfilledResult<ImageWithDimensions> =>
              result.status === "fulfilled",
          )
          .map((result) => result.value);

        if (results.some((r) => r.status === "rejected")) {
          console.warn(
            "ImageCarousel WARNING: One or more images could not be loaded and will not be displayed.",
          );
        }

        setImagesWithDimensions(successfullyLoadedImages);
        setIsLoading(false);
      };
      fetchImageDimensions();
    }
  }, [visible, photos, imagesWithDimensions.length]);

  // Entry animation sequence.
  useEffect(() => {
    if (visible && !isLoading && imagesWithDimensions.length > 0) {
      carouselAnimation.value = withTiming(1, {
        duration: ANIMATION_CONFIG.entry.carousel,
      });
      uiAnimation.value = withDelay(
        ANIMATION_CONFIG.entry.uiDelay,
        withTiming(1, { duration: ANIMATION_CONFIG.entry.ui }),
      );
    }
  }, [
    visible,
    isLoading,
    imagesWithDimensions.length,
    carouselAnimation,
    uiAnimation,
  ]);

  // Exit animation sequence.
  const triggerClose = useCallback(() => {
    "worklet";
    uiAnimation.value = withTiming(0, { duration: ANIMATION_CONFIG.exit.ui });
    carouselAnimation.value = withDelay(
      ANIMATION_CONFIG.exit.carouselDelay,
      withTiming(
        0,
        { duration: ANIMATION_CONFIG.exit.carousel },
        (finished) => {
          if (finished) runOnJS(onClose)();
        },
      ),
    );
  }, [onClose, carouselAnimation, uiAnimation]);

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: carouselAnimation.value,
  }));

  const animatedCarouselStyle = useAnimatedStyle(() => ({
    opacity: carouselAnimation.value,
    transform: [
      {
        scale: interpolate(
          carouselAnimation.value,
          [0, 1],
          [0.9, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const animatedUiElementsStyle = useAnimatedStyle(() => ({
    opacity: uiAnimation.value,
  }));

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x; // worklet
    },
  });

  const renderSlide = useCallback<ListRenderItem<ImageWithDimensions>>(
    ({ item, index }) => (
      <ImageSlide
        item={item}
        index={index}
        uiElementsStyle={animatedUiElementsStyle}
      />
    ),
    [animatedUiElementsStyle],
  ); // ⬅ deps fijas

  const handleRequestClose = useCallback(() => {
    if (carouselAnimation.value === 1) triggerClose();
    return true;
  }, [carouselAnimation, triggerClose]);

  if (!visible) return null;

  return (
    <View>
      <Modal
        transparent
        visible={visible}
        animationType="none"
        onRequestClose={handleRequestClose}
        statusBarTranslucent
      >
        {/* FIX: The Pressable is the tappable area, and the Animated.View inside handles the visual fade. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={triggerClose}>
          <Animated.View style={[styles.backdrop, animatedBackdropStyle]} />
        </Pressable>

        <View style={styles.mainContainer} pointerEvents="box-none">
          {isLoading ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : (
            <>
              <Animated.View
                style={[styles.carouselContainer, animatedCarouselStyle]}
              >
                <AnimatedFlashList
                  data={imagesWithDimensions}
                  horizontal
                  pagingEnabled
                  scrollEventThrottle={48}
                  showsHorizontalScrollIndicator={false}
                  estimatedItemSize={SCREEN_WIDTH} // clave para evitar mediciones costosas
                  keyExtractor={(item) => item.uri}
                  renderItem={renderSlide}
                  onScroll={scrollHandler}
                  viewabilityConfig={{ itemVisiblePercentThreshold: 95 }} // evita callbacks extra
                  removeClippedSubviews
                />
              </Animated.View>

              <Animated.View
                style={[styles.controlsContainer, animatedUiElementsStyle]}
              >
                {imagesWithDimensions.length > 1 && (
                  <Pagination data={imagesWithDimensions} scrollX={scrollX} />
                )}
                <Pressable
                  style={styles.closeButton}
                  onPress={triggerClose}
                  accessibilityLabel="Close image preview"
                >
                  <AppIcon.Close />
                </Pressable>
              </Animated.View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
};

// --- STYLESHEET ---
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
  },
  mainContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  carouselContainer: {
    width: SCREEN_WIDTH,
    height: "100%",
    justifyContent: "center",
  },
  slide: {
    width: SCREEN_WIDTH,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  imageWrapper: {
    width: "100%",
    position: "relative", // Provides the context for the absolutely positioned label.
    justifyContent: "center",
    alignItems: "center",
  },
  image: { width: "100%", height: "100%", borderRadius: 8 },
  photoLabelContainer: { position: "absolute", top: 15, left: 15, zIndex: 1 },
  photoLabel: {
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    paddingVertical: scale(8),
    paddingHorizontal: scale(12),
    borderRadius: 10,
  },
  controlsContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 40 : 30, // Safe area bottom padding
    width: "100%",
    alignItems: "center",
    gap: 20, // Consistent gap between pagination and button
  },
  paginationContainer: { flexDirection: "row" },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFF",
    marginHorizontal: 4,
  },
  closeButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default ImagePreviewModal;
