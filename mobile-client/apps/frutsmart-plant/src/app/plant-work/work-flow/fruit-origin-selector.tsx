import { StyleSheet, View } from "react-native";

import type { Href } from "expo-router";

import { useResetNavigation } from "@hooks/useResetNavigation";
import { s, vs } from "@utils/responsive";

import AppText from "@components/AppText";
import AppView from "@components/AppView";
import WarningCard from "@components/WarningCard";
import HomeCard from "@components/app/plant-work/index/HomeCard";
import HomeMenuCard from "@components/app/plant-work/index/HomeMenuCard";
import { usePlantWorkActions } from "src/stores/plantWork";

interface ImgSrc {
  uri: string;
  alt: string;
}

interface ProviderOptsCardData {
  title: string;
  type: "own" | "third-party";
  img: ImgSrc;
  Link: Href;
}

const ProviderOptsCardData: ProviderOptsCardData[] = [
  {
    title: "Fruto Propio",
    type: "own",
    img: {
      uri: require("@/assets/images/app/plant-work/index/own-fruit.webp"),
      alt: "Icono Fruto Propio",
    },
    Link: "/plant-work/work-flow/qr-code-option",
  },
  {
    title: "Compra de Terceros",
    type: "third-party",
    img: {
      uri: require("@/assets/images/app/plant-work/index/third-party-purchase.webp"),
      alt: "Icono Compra de Terceros",
    },
    Link: "/plant-work/work-flow/qr-code-option",
  },
];

const SelectProviderScreen = () => {
  const navigate = useResetNavigation();
  const { updateTraceability } = usePlantWorkActions();

  const handleCardPress = (fruitOrigin: "own" | "third-party") => {
    updateTraceability({ provider: fruitOrigin });
    navigate("/plant-work/work-flow/qr-code-option");
  };

  return (
    <AppView legalTextActive={false}>
      <View style={styles.container}>
        <View style={styles.principalcontent}>
          <HomeCard />

          <View style={{ marginTop: vs(20), width: "100%" }}>
            <AppText.BodyM color="primary" style={{ textAlign: "center" }}>
              Escoge por favor la procedencia del fruto y continúa los pasos.
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
                onPress={() => handleCardPress(item.type)}
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

export default SelectProviderScreen;
