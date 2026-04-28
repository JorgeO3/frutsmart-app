import React from "react";
import { View, Text, StyleSheet } from "react-native";

import { Controller } from "react-hook-form";
import type { Control, FieldValues, Path } from "react-hook-form";

import { FONT_FAMILTY } from "@src/constants/Font";
import { AppPiker } from "@src/components/AppPiker";
import { normalizeFont, scale } from "@/src/utils/responsive";

interface Option {
  label: string;
  value: string | number;
}

interface SelectControlProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  options: Option[];
  rules?: Record<string, string>;
}

function SelectControl<T extends FieldValues>(props: SelectControlProps<T>) {
  const {
    control,
    name,
    label,
    placeholder = "Seleccione una opción",
    options,
    rules = { required: true },
  } = props;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Controller
        name={name}
        rules={rules}
        control={control}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <View>
            <AppPiker
              options={options}
              onSelect={(option) => onChange(option.value)}
              placeholder={placeholder}
              defaultValue={
                value
                  ? options.find((option) => option.value === value)
                  : undefined
              }
            />
            {error && (
              <Text style={styles.errorText}>
                {error.message || "Este campo es requerido"}
              </Text>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: scale(16),
    zIndex: 10,
  },
  label: {
    fontSize: normalizeFont(16),
    fontFamily: FONT_FAMILTY,
    marginBottom: 5,
  },
  errorText: {
    color: "red",
    fontSize: normalizeFont(12),
    fontFamily: FONT_FAMILTY,
    marginTop: 5,
  },
});

export default SelectControl;
