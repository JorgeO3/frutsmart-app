import { ImageBackground, View } from "react-native";

import { s, vs } from "@utils/responsive";

import AppImage from "./AppImage";
import AppText from "./AppText";

interface PaymentCriteriaCardProps {
  criteria: string;
  explanation: string;
}

const PaymentCriteriaCard = ({
  criteria,
  explanation,
}: PaymentCriteriaCardProps) => {
  return (
    <ImageBackground
      source={require("@/assets/images/payment-criteria-pattern.webp")}
      resizeMode="cover"
      style={{
        width: "100%",
        backgroundColor: "#227C26",
        paddingHorizontal: s(20),
        paddingTop: s(20),
        paddingBottom: s(40),
        borderRadius: s(15),
        marginVertical: vs(20),
      }}
      imageStyle={{
        borderRadius: s(15),
        width: "100%",
        height: "100%",
      }}
    >
      <AppText.H2
        color="secondary"
        style={{ textAlign: "center", marginBottom: vs(20) }}
      >
        Criterio de pago
      </AppText.H2>
      <AppText.H1 color="secondary"> {criteria}: </AppText.H1>
      <AppText.BodyS color="secondary" style={{ marginBottom: vs(10) }}>
        {explanation}
      </AppText.BodyS>
      <View style={{ position: "relative" }}>
        <AppImage
          source={require("@/assets/images/palm-oil-fruit.webp")}
          alt="Palm Oil Fruit"
          style={{
            width: "100%",
            height: s(70),
            position: "absolute",
          }}
        />
      </View>
    </ImageBackground>
  );
};

export default PaymentCriteriaCard;
