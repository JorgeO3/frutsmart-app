import type React from "react";

import { Stack } from "expo-router";

type StackScreenOptions = React.ComponentProps<typeof Stack>["screenOptions"];

const options: StackScreenOptions = {
  headerStyle: { backgroundColor: "#155425" },
  headerTintColor: "white",
  headerShadowVisible: false,
  headerTransparent: false, // ← asegura que NO sea overlay
  statusBarTranslucent: false, // ← idem barra de estado
  headerShown: false, // ← oculta el header por defecto
};

interface FieldWorkNavigator {
  children?: React.ReactNode;
}

const FieldWorkNavigator = ({ children }: FieldWorkNavigator) => {
  if (!children) {
    return <Stack screenOptions={options} />;
  }

  return <Stack screenOptions={options}>{children}</Stack>;
};

export default FieldWorkNavigator;
