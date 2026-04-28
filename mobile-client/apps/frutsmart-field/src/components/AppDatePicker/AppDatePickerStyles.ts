import type { ViewStyle, TextStyle, ImageStyle } from "react-native";

interface DateTimePickerStyles {
  today?: ViewStyle;
  today_label?: TextStyle;
  selected?: ViewStyle;
  selected_label?: TextStyle;
  day_label?: TextStyle;
  header?: ViewStyle;
  button_next_image?: ImageStyle;
  button_prev_image?: ImageStyle;
  month_selector_label?: TextStyle;
  selected_year_label?: TextStyle;
  year_label?: TextStyle;
  month_label?: TextStyle;
  year_selector_label?: TextStyle;
  button_next?: ViewStyle;
  button_prev?: ViewStyle;
}

// Objeto con las props personalizadas para DateTimePicker
export const datePickerStyles: DateTimePickerStyles = {
  today: { borderColor: "#155425", borderWidth: 2 },
  today_label: { color: "#155425" },
  selected: { backgroundColor: "#155425" },
  selected_label: { color: "white" },
  day_label: { color: "black", fontSize: 16 },
  header: { backgroundColor: "white" },
  button_next_image: { tintColor: "white", width: 18, height: 18 },
  button_prev_image: { tintColor: "white", width: 18, height: 18 },
  month_selector_label: { color: "black", fontWeight: "bold", fontSize: 20 },
  selected_year_label: { color: "black" },
  year_label: { color: "black" },
  month_label: { color: "black" },
  year_selector_label: { color: "black", fontWeight: "bold", fontSize: 20 },
  button_next: {
    backgroundColor: "#155425",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  button_prev: {
    backgroundColor: "#155425",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
};
