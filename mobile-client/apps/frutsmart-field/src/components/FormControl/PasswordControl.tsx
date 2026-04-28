import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type TextStyle,
} from "react-native";

import { Controller } from "react-hook-form";
import { IconEye, IconEyeOff } from "@tabler/icons-react-native";
import type { Control, FieldValues, Path } from "react-hook-form";

import { FormStyles } from "./FormStyles";

interface PasswordControlProps<T extends FieldValues> {
  label: string;
  name: Path<T>;
  control: Control<T>;
  placeholder: string;
  // biome-ignore lint/suspicious/noExplicitAny: this is required by react-hook-form
  rules?: Record<string, any>;
  errorStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

function PasswordControl<T extends FieldValues>(
  props: PasswordControlProps<T>,
) {
  const {
    control,
    name,
    label,
    placeholder,
    rules = { required: true },
  } = props;

  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, props.labelStyle]}>{label}</Text>
      <Controller
        name={name}
        rules={rules}
        control={control}
        render={({
          field: { onChange, onBlur, value },
          fieldState: { error },
        }) => (
          <>
            <View style={styles.inputContainer}>
              <TextInput
                value={value}
                onBlur={onBlur}
                style={styles.input}
                onChangeText={onChange}
                placeholder={placeholder}
                secureTextEntry={!showPassword}
                placeholderTextColor={FormStyles.PLACEHOLDER_COLOR}
              />
              <TouchableOpacity
                style={styles.iconContainer}
                onPress={togglePasswordVisibility}
              >
                {showPassword ? (
                  <IconEyeOff
                    size={FormStyles.ICON_SIZE}
                    color={FormStyles.ICON_COLOR}
                  />
                ) : (
                  <IconEye
                    size={FormStyles.ICON_SIZE}
                    color={FormStyles.ICON_COLOR}
                  />
                )}
              </TouchableOpacity>
            </View>
            {error && (
              <Text style={[styles.errorText, props.errorStyle]}>
                {error.message || "Este campo es requerido"}
              </Text>
            )}
          </>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: FormStyles.MARGIN_BOTTOM,
  },
  label: {
    fontSize: FormStyles.LABEL_FONT_SIZE,
    fontFamily: FormStyles.LABEL_FONT_FAMILY,
    marginBottom: FormStyles.LABEL_MARGIN_BOTTOM,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  input: {
    flex: 1,
    height: FormStyles.INPUT_HEIGHT,
    borderColor: FormStyles.BORDER_COLOR,
    borderWidth: FormStyles.BORDER_WIDTH,
    fontSize: FormStyles.INPUT_FONT_SIZE,
    borderRadius: FormStyles.BORDER_RADIUS,
    fontFamily: FormStyles.INPUT_FONT_FAMILY,
    paddingLeft: FormStyles.PADDING_HORIZONTAL,
    backgroundColor: FormStyles.BACKGROUND_COLOR,
    paddingVertical: FormStyles.PADDING_VERTICAL,
    paddingRight: FormStyles.PADDING_RIGHT_WITH_ICON,
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

export { PasswordControl };
