import type React from "react";

import { Stack } from "expo-router";

import { HeaderRight } from "./HeaderRight";

interface AuthStackNavigatorProps {
  children?: React.ReactNode;
}

type StackOptions = React.ComponentProps<typeof Stack>["screenOptions"];

const options: StackOptions = {
  header: () => null, // Oculta el header por defecto
  // headerTitle: "",
  // headerStyle: { backgroundColor: "#155425" },
  // headerTintColor: "white",
  // headerRight: HeaderRight,
  // headerShadowVisible: false,
  // headerTransparent: false, // ← asegura que NO sea overlay
  // statusBarTranslucent: false, // ← idem barra de estado
  // headerShown: false, // ← oculta el header por defecto
};

const AuthStackNavigator = ({ children }: AuthStackNavigatorProps) => {
  return <Stack screenOptions={options}>{children}</Stack>;
};

export { AuthStackNavigator };
