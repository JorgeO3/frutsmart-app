import { StyleSheet, useWindowDimensions, View } from "react-native";

import { useDate } from "@stores/appStore";
import { s } from "@utils/responsive";

import AppCard from "@components/AppCard";
import AppImage from "@components/AppImage";
import AppText from "@components/AppText";

const SCREEN_PADDING = s(20);
// Ratio de tu diseño original: ancho 375 / alto 160 ≈ 2.34375
const DESIGN_RATIO = 375 / 160;

const HomeCard = () => {
  const currentDate = useDate();
  const { width: screenWidth } = useWindowDimensions();

  // 1) ancho disponible para la card
  const cardWidth = screenWidth - SCREEN_PADDING * 2;
  // 2) altura calculada según ratio
  const cardHeight = cardWidth / DESIGN_RATIO;
  // 3) header ocupa 30% de la altura total
  const headerHeight = cardHeight * 0.3;
  // 4) imagen ocupa 75% de la altura de la card
  const imageSize = cardHeight * 0.6;

  return (
    <View style={{ width: "100%" }}>
      <AppCard style={[styles.card, { width: "100%", height: cardHeight }]}>
        {/* Header */}
        <View style={[styles.header, { height: headerHeight }]}>
          <AppText.BodyS color="secondary" style={{ marginRight: s(15) }}>
            Tumaco {currentDate}
          </AppText.BodyS>
        </View>

        {/* Body */}
        <View style={styles.body}>
          {/* Imagen absoluta */}

          <AppImage
            alt="profile"
            source={require("@/assets/images/app/plant-work/index/profile.webp")}
            style={{
              width: imageSize,
              height: imageSize,
              borderRadius: imageSize / 2,
              position: "absolute",
              top: headerHeight - imageSize / 2 - s(20),
              left: s(20),
            }}
          />

          {/* Texto, desplazado a la derecha de la imagen */}
          <View
            style={[styles.textContainer, { marginLeft: imageSize + s(20) }]}
          >
            <AppText.H4 color="secondary" style={{ textAlign: "right" }}>
              Hola, Yeni Camacho
            </AppText.H4>
            <AppText.BodyS color="secondary">
              Bienvenidos a FrutSmart
            </AppText.BodyS>
          </View>
        </View>
      </AppCard>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "column",
    borderRadius: s(16),
    borderWidth: 0,
    overflow: "hidden",
    elevation: 2,
  },
  header: {
    justifyContent: "center",
    alignItems: "flex-end",
    backgroundColor: "#227c26",
    paddingHorizontal: s(10),
  },
  body: {
    flex: 1,
    backgroundColor: "#e94e1a",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  textContainer: {
    // flex: 1,
    height: "100%",
    justifyContent: "flex-start",
    alignContent: "flex-end",
  },
});

export default HomeCard;
