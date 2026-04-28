import { View } from "react-native";

import PhotoPreviewScreen from "@components/PhotoPreviewScreen";

const TITLE = "Resultado de la captura";
const DESCRIPTION =
  'Presione en el botón "Continuar" si la captura fue correcta, de lo contrario, puede repetirla.';

const PreviewScreen = () => {
  return (
    <View style={{ flex: 1, backgroundColor: "#227c26" }}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <PhotoPreviewScreen
          title={TITLE}
          description={DESCRIPTION}
          onRepeat={() => console.log("Repeat pressed")}
          onContinue={() => console.log("Continue pressed")}
          photoData={{ uri: require("@/assets/images/imagen_de_prueba.jpg") }}
        />
      </View>
    </View>
  );
};

export default PreviewScreen;
