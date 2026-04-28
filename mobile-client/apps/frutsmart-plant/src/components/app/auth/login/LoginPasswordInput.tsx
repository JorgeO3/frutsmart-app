import { useState } from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import AppImage from "@components/AppImage";
import AppText from "@components/AppText";
import { FormStyles } from "./FormStyles";

interface LoginPasswordInputProps extends TextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
  errorStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

// CAMBIO 1: Definimos las fuentes de las imágenes como constantes fuera del componente.
// Esto es más eficiente, ya que solo se "requieren" una vez cuando el módulo se carga.
// Asegúrate de que las rutas y extensiones sean correctas.
const EyeIcon = require("@/assets/images/app/auth/login/eye-icon.webp");
const EyeOffIcon = require("@/assets/images/app/auth/login/eye-off-icon.webp");

const LoginPasswordInput = (props: LoginPasswordInputProps) => {
  const { label, value, onChangeText, placeholder, error, ...restOfProps } =
    props;

  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible((prev) => !prev);
  };

  return (
    <View style={[styles.container, props.containerStyle]}>
      <AppText style={[styles.label, props.labelStyle]}>{label}</AppText>
      <View>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            onChangeText={onChangeText}
            value={value}
            secureTextEntry={!isPasswordVisible}
            placeholderTextColor={FormStyles.PLACEHOLDER_COLOR}
            {...restOfProps}
          />
          <TouchableOpacity
            onPress={togglePasswordVisibility}
            style={styles.iconContainer}
            // Hacemos el área de toque más grande para mejor usabilidad
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {/* CAMBIO 2: Usamos un operador ternario para cambiar entre los dos iconos */}
            {isPasswordVisible ? (
              <AppImage
                alt="ocultar-contraseña"
                source={EyeOffIcon}
                style={styles.iconImage}
              />
            ) : (
              <AppImage
                alt="mostrar-contraseña"
                source={EyeIcon}
                style={styles.iconImage}
              />
            )}
          </TouchableOpacity>
        </View>
        {error && (
          <AppText style={[styles.errorText, props.errorStyle]}>
            {error}
          </AppText>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: "100%" },
  label: { fontSize: 16, marginBottom: 8, color: "#333" },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  input: {
    height: FormStyles.INPUT_HEIGHT,
    flex: 1,
    borderWidth: FormStyles.BORDER_WIDTH,
    paddingVertical: FormStyles.PADDING_VERTICAL,
    paddingLeft: FormStyles.PADDING_HORIZONTAL,
    paddingRight: FormStyles.PADDING_RIGHT_WITH_ICON,
    borderRadius: FormStyles.BORDER_RADIUS,
    backgroundColor: FormStyles.BACKGROUND_COLOR,
    borderColor: FormStyles.BORDER_COLOR,
    fontSize: FormStyles.INPUT_FONT_SIZE,
    fontFamily: FormStyles.INPUT_FONT_FAMILY,
    color: FormStyles.TEXT_COLOR,
  },
  iconContainer: {
    position: "absolute",
    right: 15,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  // CAMBIO 3: Un estilo dedicado para la imagen del icono
  iconImage: {
    width: FormStyles.ICON_SIZE,
    height: FormStyles.ICON_SIZE,
  },
  errorText: {
    color: FormStyles.ERROR_COLOR,
    fontSize: FormStyles.ERROR_FONT_SIZE,
    marginTop: FormStyles.ERROR_MARGIN_TOP,
    fontFamily: FormStyles.ERROR_FONT_FAMILY,
  },
});

export default LoginPasswordInput;
