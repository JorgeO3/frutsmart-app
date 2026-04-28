import { memo, useCallback, useRef } from "react";
import { Keyboard, StyleSheet, TextInput, View } from "react-native";

import isEqual from "react-fast-compare";

import { font, s } from "@utils/responsive";
import AppImage from "src/components/AppImage";

interface Props {
  value: string;
  maxLength?: number;
  placeholder: string;
  autoFocus?: boolean;
  onSubmit?: () => void;
  showClearButton?: boolean;
  onChange(text: string): void;
}

export const SearchInputFilter = ({
  value,
  placeholder,
  onChange,
  autoFocus = false,
  maxLength,
  onSubmit,
  showClearButton = true,
}: Props) => {
  const inputRef = useRef<TextInput>(null);

  const handleClear = useCallback(() => {
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

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
          <AppImage
            alt="Close Icon"
            style={{ width: s(22), height: s(22) }}
            source={require("@/assets/images/x-icon.webp")}
          />
        </View>
      ) : (
        <View style={[styles.iconContainer, styles.nonPressableIcon]}>
          <AppImage
            alt="Search Icon"
            style={{ width: s(22), height: s(22) }}
            source={require("@/assets/images/app/plant-work/work-flow/harvest-origin/search-icon.webp")}
          />
        </View>
      )}
    </View>
  );
};

const ICON_AREA_WIDTH = s(45);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    marginVertical: s(15),
  },
  input: {
    flex: 1,
    height: s(50),
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: s(8),
    paddingVertical: s(15),
    paddingLeft: s(15),
    paddingRight: s(90),
    backgroundColor: "#fff",
    color: "#000",
    fontSize: font.scale(16),
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

export default memo(SearchInputFilter, isEqual);
