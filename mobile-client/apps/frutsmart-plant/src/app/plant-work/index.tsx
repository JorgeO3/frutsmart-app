import { StyleSheet, View } from "react-native";

import type { Href } from "expo-router";

import { s } from "@utils/responsive";

import AppText from "@components/AppText";
import AppView from "@components/AppView";
import HomeCard from "src/components/app/plant-work/index/HomeCard";
import HomeMenuCard from "src/components/app/plant-work/index/HomeMenuCard";
import WarningCard from "src/components/WarningCard";

interface ImgSrc {
  uri: string;
  alt: string;
}

interface HomeMenuCardData {
  title: string;
  img: ImgSrc;
  Link: Href;
}

const HomeMenuCardData: HomeMenuCardData[] = [
  {
    title: "Formulario Calidad",
    img: {
      uri: require("@/assets/images/app/plant-work/index/quality-form-icon.png"),
      alt: "Icono formulario de calidad",
    },
    Link: "/plant-work/work-flow/fruit-origin-selector",
  },
  {
    title: "Resumen Registro",
    img: {
      uri: require("@/assets/images/app/plant-work/index/registration-summary-icon.png"),
      alt: "Icono resumen registro",
    },
    Link: "/plant-work/reports",
  },
  {
    title: "Configuración",
    img: {
      uri: require("@/assets/images/app/plant-work/index/settings-icon.png"),
      alt: "Icono Configuración",
    },
    Link: "/plant-work",
  },
  {
    title: "Subir Archivos",
    img: {
      uri: require("@/assets/images/app/plant-work/index/upload-icon.webp"),
      alt: "Icono subir archivos",
    },
    Link: "/plant-work/uploads",
  },
];

const Home = () => {
  return (
    <AppView legalTextActive={false}>
      <View style={styles.container}>
        <View style={styles.principalcontent}>
          <HomeCard />

          <View style={{ marginTop: s(20), width: "100%" }}>
            <AppText.BodyL>Todos los detalles de tus</AppText.BodyL>
            <AppText.H3 color="primary">Registros y solicitudes</AppText.H3>
          </View>
        </View>

        <View style={styles.menuContainer}>
          {HomeMenuCardData.map((item, index) => (
            <View
              key={`home-menu-card-container-${item.title}-${index}`}
              style={styles.cardWrapper}
            >
              <HomeMenuCard
                title={item.title}
                img={item.img}
                Link={item.Link}
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

export default Home;
