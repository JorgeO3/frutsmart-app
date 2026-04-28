import type { JSX } from "react";
import {
  TextInput as RNTextInput,
  StyleSheet,
  Text,
  View,
  type TextInputProps as RNTextInputProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { FONT_FAMILTY } from "src/constants/font";
import { FormStyles } from "./FormStyles";

// CAMBIO 1: La interfaz de props es ahora mucho más simple.
// No más genéricos ni tipos de react-hook-form.
interface LoginTextInputProps extends RNTextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null; // El error es ahora un simple string.
  icon?: JSX.Element;
  containerStyle?: StyleProp<ViewStyle>;
  errorStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

// CAMBIO 2: Renombramos el componente y eliminamos la lógica de 'Controller'.
const LoginTextInput = (props: LoginTextInputProps) => {
  const {
    label,
    value,
    onChangeText,
    placeholder,
    icon,
    error,
    secureTextEntry = false,
    ...restOfProps // Pasamos el resto de los props al TextInput
  } = props;

  return (
    <View style={[styles.container, props.containerStyle]}>
      <Text style={[styles.label, props.labelStyle]}>{label}</Text>
      <View>
        <View style={styles.inputContainer}>
          <RNTextInput
            value={value}
            {...restOfProps}
            style={styles.input}
            placeholder={placeholder}
            onChangeText={onChangeText}
            secureTextEntry={secureTextEntry}
            placeholderTextColor={FormStyles.PLACEHOLDER_COLOR}
          />
          {icon && <View style={styles.iconContainer}>{icon}</View>}
        </View>
        {/* CAMBIO 4: La lógica del error es más simple. */}
        {error && (
          <Text style={[styles.errorText, props.errorStyle]}>{error}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  label: {
    fontSize: 16,
    fontFamily: FONT_FAMILTY,
    marginBottom: 8,
    color: "#333",
  },
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
    justifyContent: "center",
    alignItems: "center",
    padding: 5,
  },
  errorText: {
    color: FormStyles.ERROR_COLOR,
    fontSize: FormStyles.ERROR_FONT_SIZE,
    marginTop: FormStyles.ERROR_MARGIN_TOP,
    fontFamily: FormStyles.ERROR_FONT_FAMILY,
  },
});

export default LoginTextInput;
