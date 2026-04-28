import type React from "react";
import type { StyleProp, ViewStyle } from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import AppText from "./AppText";
import { font, vs } from "../utils/responsiveV2";

interface AppViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  legalTextColor?: string;
  legalTextActive?: boolean;
}

const AppView = ({
  children,
  style,
  legalTextColor = "#fff",
  legalTextActive = true,
}: AppViewProps) => {
  return (
    <SafeAreaView
      style={[{ flex: 1 }, style]}
      edges={["bottom", "left", "right"]}
    >
      {children}
      {legalTextActive && (
        <AppText.BodyXS
          style={{
            fontSize: font.scale(11, { min: 11, max: 16 }),
            textAlign: "center",
            color: legalTextColor,
            paddingTop: vs(10),
          }}
        >
          FrutSmart® S.A.S. Todos los derechos reservados 2025
        </AppText.BodyXS>
      )}
    </SafeAreaView>
  );
};

export default AppView;
