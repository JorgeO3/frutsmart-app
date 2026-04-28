import type React from "react";
import { View, TouchableOpacity } from "react-native";

import { Stack, useRouter } from "expo-router";

import AppIcon from "@components/AppIcon";
import AppImage from "@components/AppImage";
import AppText from "@components/AppText";

interface HeaderProps {
  children?: React.ReactNode;
  tintColor?: string;
}

const HeaderTitle = ({ children, tintColor }: HeaderProps) => {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        height: 60,
      }}
    >
      <AppImage
        alt="Logo"
        style={{ width: 40.833, height: 50 }}
        source={require("@/assets/images/white-icon.png")}
      />

      <AppText.BodyL style={{ paddingLeft: 10, color: tintColor }}>
        {children}
      </AppText.BodyL>
    </View>
  );
};

interface HeaderRightProps {
  tintColor?: string | undefined;
  canGoBack?: boolean | undefined;
}

const HeaderRight = ({ tintColor }: HeaderRightProps) => {
  return (
    <TouchableOpacity onPress={() => {}} hitSlop={20}>
      <AppIcon.DotsVertical color={tintColor} size={24} />
    </TouchableOpacity>
  );
};

interface HeaderLeftProps {
  tintColor?: string | undefined;
  canGoBack?: boolean | undefined;
  href?: string | undefined;
}

const HeaderLeft = ({ tintColor, canGoBack }: HeaderLeftProps) => {
  if (!canGoBack) return null;

  const router = useRouter();
  const handlePress = () => router.back();

  return (
    <TouchableOpacity
      hitSlop={20}
      onPress={handlePress}
      style={{ paddingRight: 30 }}
    >
      <AppIcon.ArrowLeft color={tintColor} size={24} />
    </TouchableOpacity>
  );
};

type StackScreenOptions = React.ComponentProps<typeof Stack>["screenOptions"];

const options: StackScreenOptions = {
  header: () => null, // Oculta el header por defecto
  // headerTintColor: "#fff",
  // headerTitle: HeaderTitle,
  // headerShadowVisible: false,
  // headerStyle: { backgroundColor: "#155425" },
  // headerRight: (props) => <HeaderRight {...props} />,
  // headerLeft: (props) => <HeaderLeft {...props} />,
  // headerTransparent: false, // ← asegura que NO sea overlay
  // statusBarTranslucent: false, // ← idem barra de estado
  // headerShown: false, // ← oculta el header por defecto
};

interface NavigatorProps {
  children?: React.ReactNode;
}

const OnboardStackNavigator = ({ children }: NavigatorProps) => {
  if (!children) {
    return <Stack />;
  }

  return <Stack screenOptions={options}>{children}</Stack>;
};

export default OnboardStackNavigator;
