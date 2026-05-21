import React from "react";
import { View, StyleSheet } from "react-native";

import type { Href } from "expo-router";

import { s, vs } from "@utils/responsiveV2";

import AppText from "@components/AppText";
import AppView from "@components/AppView";
import HomeCard from "@components/HomeCard";
import HomeMenuCard from "@components/HomeMenuCard";
import WarningCard from "@components/WarningCard";

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
      uri: require("@assets/images/field-work/home/quality-form-icon.png"),
      alt: "Icono formulario de calidad",
    },
    Link: "/field-work/(work-flow)",
  },
  {
    title: "Resumen Registro",
    img: {
      uri: require("@assets/images/field-work/home/registration-summary-icon.png"),
      alt: "Icono resumen registro",
    },
    Link: "/field-work/reports",
  },
  {
    title: "Configuración",
    img: {
      uri: require("@assets/images/field-work/home/settings-icon.png"),
      alt: "Icono Configuración",
    },
    Link: "/field-work/home",
  },
  {
    title: "Subir Archivos",
    img: {
      uri: require("@assets/images/field-work/home/upload-icon.webp"),
      alt: "Icono subir archivos",
    },
    Link: "/field-work/uploads",
  },
];

const Home = () => {
  return (
    <AppView legalTextActive={false}>
      <View style={styles.container}>
        <View style={styles.principalcontent}>
          <HomeCard />

          <View style={{ marginTop: vs(20), width: "100%" }}>
            <AppText.BodyM>Todos los detalles de tus</AppText.BodyM>
            <AppText.H4 color="primary">Registros y solicitudes</AppText.H4>
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
