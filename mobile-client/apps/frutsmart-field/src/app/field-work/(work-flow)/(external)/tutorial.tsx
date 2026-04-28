import React from "react";
import { View, Text, Button } from "react-native";

import { useRouter } from "expo-router";

import AppView from "@components/AppView";

const TutorialScreen = () => {
  const router = useRouter();

  const handleOnPress = () => {
    router.replace("/field-work/(work-flow)/(external)/steps");
  };

  return (
    <AppView>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 24, fontWeight: "bold" }}>Tutorial</Text>
        <Text style={{ fontSize: 16, marginTop: 10, textAlign: "center" }}>
          Aquí va el video o la animación del tutorial.
        </Text>
        <Button title="Go to Steps" onPress={handleOnPress} />
      </View>
    </AppView>
  );
};

export default TutorialScreen;
