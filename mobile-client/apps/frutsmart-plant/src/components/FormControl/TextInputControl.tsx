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
import { variants, type VariantName } from "./variants";

interface TextInputProps extends RNTextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  variant?: VariantName;
  error?: string | null;
  icon?: JSX.Element;
  containerStyle?: StyleProp<ViewStyle>;
  errorStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
  inputStyleProp?: StyleProp<TextStyle>;
}

const TextInput = (props: TextInputProps) => {
  const {
    label,
    value,
    onChangeText,
    placeholder,
    icon,
    error,
    secureTextEntry = false,
    variant = "default",
    containerStyle,
    labelStyle,
    errorStyle,
    inputStyleProp,
    ...restOfProps
  } = props;

  // Obtenemos los valores de la variante actual para usarlos en estilos dinámicos
  const currentVariant = variants[variant];

  return (
    <View style={[styles.container, containerStyle]}>
      {/* CAMBIO 3: Accedemos a los estilos con bracket notation */}
      <Text style={[styles[`${variant}_label`], labelStyle]}>{label}</Text>
      <View style={styles.inputContainer}>
        <RNTextInput
          value={value}
          {...restOfProps}
          // Aplicamos estilos dinámicos para el borde y el padding
          style={[
            styles[`${variant}_input`],
            // Si hay un error, cambiamos el color del borde
            error && { borderColor: currentVariant.errorColor },
            // Si hay un icono, aplicamos un padding derecho diferente
            icon && { paddingRight: currentVariant.paddingRightWithIcon },
            inputStyleProp,
          ]}
          placeholder={placeholder}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          placeholderTextColor={currentVariant.placeholderColor}
        />
        {icon && <View style={styles.iconContainer}>{icon}</View>}
      </View>
      {error && (
        <Text style={[styles[`${variant}_errorText`], errorStyle]}>
          {error}
        </Text>
      )}
    </View>
  );
};

// CAMBIO 1: Creamos una función para generar todos los estilos de las variantes
// de forma programática, evitando la duplicación.
const generateVariantStyles = () => {
  const generatedStyles: any = {};
  // Iteramos sobre cada variante ('login', 'default', etc.)
  (Object.keys(variants) as VariantName[]).forEach((variantName) => {
    const variant = variants[variantName];
    // Creamos los estilos para cada parte del componente (label, input, error)
    generatedStyles[`${variantName}_label`] = {
      fontSize: variant.labelFontSize,
      fontFamily: variant.fontFamily,
      color: variant.labelColor,
      marginBottom: 8,
    };
    generatedStyles[`${variantName}_input`] = {
      height: variant.inputHeight,
      flex: 1,
      borderWidth: variant.borderWidth,
      paddingVertical: variant.paddingVertical,
      paddingHorizontal: variant.paddingHorizontal,
      borderRadius: variant.borderRadius,
      backgroundColor: variant.backgroundColor,
      borderColor: variant.borderColor,
      fontSize: variant.inputFontSize,
      fontFamily: variant.fontFamily,
      color: variant.textColor,
    };
    generatedStyles[`${variantName}_errorText`] = {
      color: variant.errorColor,
      fontSize: variant.errorFontSize,
      fontFamily: variant.fontFamily,
      marginTop: 5,
    };
  });
  return generatedStyles;
};

// CAMBIO 2: El StyleSheet.create ahora está fuera del componente,
// combinando estilos comunes con los generados dinámicamente.
const styles = StyleSheet.create({
  // Estilos que no dependen de la variante
  container: {
    width: "100%",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  iconContainer: {
    position: "absolute",
    right: 15,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  // Usamos el spread operator para incluir todos los estilos de las variantes
  ...generateVariantStyles(),
});

export default TextInput;
