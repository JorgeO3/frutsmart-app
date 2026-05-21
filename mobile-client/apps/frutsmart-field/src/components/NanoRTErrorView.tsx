import { View, StyleSheet } from "react-native";

import AppText from "@components/AppText";

interface Props {
  error: string;
}

const NanoRTErrorView = ({ error }: Props) => {
  return (
    <View style={styles.container}>
      <AppText>
        Error al inicializar la aplicación: {error}
      </AppText>
      <AppText>Por favor, intenta reiniciar la aplicación.</AppText>
      <AppText>
        En caso de que el problema persista, contacta con soporte.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
});

export default NanoRTErrorView;