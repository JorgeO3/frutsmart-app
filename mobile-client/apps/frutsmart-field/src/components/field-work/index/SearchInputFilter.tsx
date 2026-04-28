import React, { memo, useCallback, useRef } from "react";
import { View, Keyboard, TextInput, Pressable, StyleSheet } from "react-native";

import { scale, normalizeFont } from "@utils/responsive";

import AppIcon from "@components/AppIcon";

interface Props {
  value: string;
  maxLength?: number;
  placeholder: string;
  autoFocus?: boolean;
  onSubmit?: () => void;
  showClearButton?: boolean;
  onChange(text: string): void;
}

export const SearchInputFilter = memo(
  ({
    value,
    placeholder,
    onChange,
    autoFocus = false,
    maxLength,
    onSubmit,
    showClearButton = true,
  }: Props) => {
    const inputRef = useRef<TextInput>(null);

    // OPTIMIZACIÓN: Clear button handler
    const handleClear = useCallback(() => {
      onChange("");
      inputRef.current?.focus();
    }, [onChange]);

    // OPTIMIZACIÓN: Submit handler
    const handleSubmitEditing = useCallback(() => {
      Keyboard.dismiss();
      onSubmit?.();
    }, [onSubmit]);

    return (
      <View style={styles.container}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          placeholder={placeholder}
          placeholderTextColor="#7b7b7b"
          onChangeText={onChange}
          onSubmitEditing={handleSubmitEditing}
          autoFocus={autoFocus}
          maxLength={maxLength}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="never"
          underlineColorAndroid="transparent"
          accessibilityRole="search"
          accessibilityLabel={placeholder}
        />

        {showClearButton && value.length > 0 ? (
          <View
            onTouchEnd={handleClear}
            hitSlop={10}
            style={styles.iconContainer}
          >
            <AppIcon.Close size={scale(22)} strokeWidth={2.5} color="#777" />
          </View>
        ) : (
          <View style={[styles.iconContainer, styles.nonPressableIcon]}>
            <AppIcon.Search size={scale(22)} strokeWidth={2.5} color="#777" />
          </View>
        )}
      </View>
    );
  },
);

SearchInputFilter.displayName = "SearchInputFilter";

const ICON_AREA_WIDTH = scale(45);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    marginVertical: scale(15),
  },
  input: {
    flex: 1,
    height: scale(50),
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: scale(8),
    paddingVertical: scale(15),
    paddingLeft: scale(15),
    paddingRight: scale(90),
    backgroundColor: "#fff",
    color: "#000",
    fontSize: normalizeFont(16),
    fontFamily: "Montserrat",
  },
  iconContainer: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: ICON_AREA_WIDTH,
    justifyContent: "center",
    alignItems: "center",
  },
  nonPressableIcon: {
    pointerEvents: "none",
  },
});
