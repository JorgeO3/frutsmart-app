import { TouchableOpacity, View } from "react-native";

import { s } from "@utils/responsiveV2";

import AppImage from "@components/AppImage";

interface HeaderIconsProps {
  onUploadPress: () => void;
  onMenuPress: () => void;
}

const HeaderIcons = ({ onUploadPress, onMenuPress }: HeaderIconsProps) => {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <TouchableOpacity hitSlop={50} onPress={onMenuPress}>
        <View
          style={{
            marginRight: 20,
            width: s(24),
            height: s(24),
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <AppImage
            source={require("@/assets/images/dots-vertical-icon.webp")}
            style={{ width: "100%", height: "100%" }}
            alt="Menu Icon"
          />
        </View>
      </TouchableOpacity>

      <TouchableOpacity hitSlop={10} onPress={onUploadPress}>
        <View
          style={{
            width: s(24),
            height: s(24),
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <AppImage
            source={require("@/assets/images/upload-icon.webp")}
            style={{ width: "100%", height: "100%" }}
            alt="Upload Icon"
          />
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default HeaderIcons;
