import type { ImageStyle, StyleProp } from "react-native";

import { Image, type ImageProps } from "expo-image";

type ImageContentFit = "contain" | "cover" | "fill" | "none" | "scale-down";

interface AppImageProps extends ImageProps {
  source: ImageProps["source"];
  alt: string;
  contentFit?: ImageContentFit;
  style?: StyleProp<ImageStyle>;
}

const AppImage = ({ style, ...props }: AppImageProps) => {
  const defaultStyle = {
    width: undefined,
    height: undefined,
  };

  const defaultProps = {
    contentFit: "contain" as ImageContentFit,
    transition: 1000,
    allowDownscaling: true,
  };

  return <Image {...defaultProps} {...props} style={[defaultStyle, style]} />;
};

// Agregar el método estático prefetch
AppImage.prefetch = Image.prefetch;

export default AppImage;
