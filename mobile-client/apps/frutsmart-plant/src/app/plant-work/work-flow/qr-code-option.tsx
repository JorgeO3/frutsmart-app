import { StyleSheet, View } from "react-native";

import { useRouter, type Href } from "expo-router";

import { s, vs } from "@utils/responsive";
import { useTraceabilityProvider } from "src/stores/plantWork";

import AppText from "@components/AppText";
import AppView from "@components/AppView";
import WarningCard from "@components/WarningCard";
import HomeCard from "@components/app/plant-work/index/HomeCard";
import HomeMenuCard from "@components/app/plant-work/index/HomeMenuCard";

interface ImgSrc {
  uri: string;
  alt: string;
}

interface ProviderOptsCardData {
  title: string;
  nextScreen: "qr-code-scanner" | "entry-form";
  img: ImgSrc;
  Link: Href;
}

const ProviderOptsCardData: ProviderOptsCardData[] = [
  {
    title: "Escanear QR",
    nextScreen: "qr-code-scanner",
    img: {
      uri: require("@/assets/images/app/plant-work/work-flow/qr-code-option/qr-code.webp"),
      alt: "Icono Escanear QR",
    },
    Link: "/plant-work/work-flow/entry-form",
    // Link: "/plant-work/work-flow/qr-code-scanner",
  },
  {
    title: "Registro Datos de Entrada",
    nextScreen: "entry-form",
    img: {
      uri: require("@/assets/images/app/plant-work/work-flow/qr-code-option/input-data.webp"),
      alt: "Icono Registro Datos de Entrada",
    },
    Link: "/plant-work/work-flow/entry-form",
  },
];

const QRCodeOptionScreen = () => {
  const router = useRouter();
  const provider = useTraceabilityProvider();

  if (!provider) {
    throw new Error("Provider not found");
  }

  const handleCardPress = (_nextScreen: "qr-code-scanner" | "entry-form") => {
    // if (nextScreen === "qr-code-scanner") {
    //   router.replace("/plant-work/work-flow/qr-code-scanner");
    //   return;
    // }

    const entryFormRoute =
      provider === "own"
        ? "/plant-work/work-flow/harvest-origin"
        : "/plant-work/work-flow/provider-selector";

    router.replace(entryFormRoute);
  };

  return (
    <AppView legalTextActive={false}>
      <View style={styles.container}>
        <View style={styles.principalcontent}>
          <HomeCard />

          <View style={{ marginTop: vs(20), width: "100%" }}>
            <AppText.BodyM color="primary" style={{ textAlign: "center" }}>
              Para continuar, escoja la opción de "Escanear QR" o "Registro
              Datos de Entrada".
            </AppText.BodyM>
          </View>
        </View>

        <View style={styles.menuContainer}>
          {ProviderOptsCardData.map((item, index) => (
            <View
              key={`home-menu-card-container-${item.title}-${index}`}
              style={styles.cardWrapper}
            >
              <HomeMenuCard
                title={item.title}
                img={item.img}
                Link={item.Link}
                onPress={() => handleCardPress(item.nextScreen)}
              />
            </View>
          ))}
        </View>
      </View>

      <WarningCard />
    </AppView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: s(20),
  },
  principalcontent: {
    width: "100%",
    alignSelf: "center",
  },
  menuContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-evenly",
    paddingVertical: s(20),
  },
  cardWrapper: {
    width: "40%",
    aspectRatio: 0.9,
    marginBottom: s(16),
  },
});

export default QRCodeOptionScreen;
