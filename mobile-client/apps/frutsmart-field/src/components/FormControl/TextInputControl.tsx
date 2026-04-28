import React from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  type StyleProp,
  type TextStyle,
} from "react-native";

import { Controller } from "react-hook-form";
import type { Control, FieldValues, Path } from "react-hook-form";

import { FONT_FAMILTY } from "@src/constants/Font";
import { FormStyles } from "@components/FormControl/FormStyles";

interface TextInputControlProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder: string;
  icon?: JSX.Element;
  secureTextEntry?: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: any is required by react-hook-form
  rules?: Record<string, any>;
  errorStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

function TextInputControl<T extends FieldValues>(
  props: TextInputControlProps<T>,
) {
  const {
    control,
    name,
    label,
    placeholder,
    icon,
    secureTextEntry = false,
    rules = { required: true },
  } = props;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, props.labelStyle]}>{label}</Text>
      <Controller
        control={control}
        rules={rules}
        render={({
          field: { onChange, onBlur, value },
          fieldState: { error },
        }) => (
          <View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder={placeholder}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                numberOfLines={1}
                multiline={false}
                secureTextEntry={secureTextEntry}
                placeholderTextColor={FormStyles.PLACEHOLDER_COLOR}
              />
              {icon && <View style={styles.iconContainer}>{icon}</View>}
            </View>
            {error && (
              <Text style={[styles.errorText, props.errorStyle]}>
                {error.message || "Este campo es requerido"}
              </Text>
            )}
          </View>
        )}
        name={name}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontFamily: FONT_FAMILTY,
    marginBottom: 5,
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

export { TextInputControl };
