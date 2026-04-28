import { TouchableOpacity } from "react-native";

import * as Haptics from "expo-haptics";
import { IconHelp } from "@tabler/icons-react-native";
import AppIcon from "../AppIcon";

const HeaderRight = () => {
  const handlePress = () => {
    console.log("Help icon pressed");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  return (
    <TouchableOpacity
      hitSlop={30}
      onPress={handlePress}
      style={{ marginRight: 10 }}
    >
      <AppIcon.DotsVertical />
    </TouchableOpacity>
  );
};

export { HeaderRight };
