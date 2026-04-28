import { StyleSheet, Text, View } from "react-native";

import { Image } from "expo-image";
import { Link } from "expo-router";

import AppBanner from "@components/AppBanner";
import { FONT_FAMILTY } from "src/constants/font";

const ProfileSelectionScreen = () => {
  return (
    <AppBanner>
      <View style={styles.content}>
        <Link href={"/auth/login"}>
          <View style={styles.profileOption}>
            <Text style={styles.profileTitle}>Labores de campo</Text>
            <View
              style={[styles.profileImageContainer, styles.fieldWorkBorder]}
            >
              <Image
                source={require("@/assets/images/app/auth/profile-selection/field-work.png")}
                style={{ height: 120, width: 105.0556 }}
              />
            </View>
          </View>
        </Link>

        <Link href="/auth/login">
          <View style={styles.profileOption}>
            <Text style={styles.profileTitle}>Labores de planta</Text>
            <View
              style={[styles.profileImageContainer, styles.plantWorkBorder]}
            >
              <Image
                source={require("@/assets/images/app/auth/profile-selection/plant-work.png")}
                style={{ height: 120, width: 106.2164 }}
              />
            </View>
          </View>
        </Link>
      </View>
    </AppBanner>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "space-evenly", // Centrar los elementos
    alignItems: "center",
  },
  profileOption: {
    alignItems: "center",
  },
  profileTitle: {
    fontFamily: FONT_FAMILTY,
    color: "white",
    fontSize: 30,
    marginBottom: 15,
  },
  profileImageContainer: {
    display: "flex",
    flexDirection: "row",
    height: 200,
    width: 200,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 100,
    borderWidth: 4,
  },
  fieldWorkBorder: {
    borderColor: "#e94e1a",
  },
  plantWorkBorder: {
    borderColor: "#92b516",
  },
});

export default ProfileSelectionScreen;
