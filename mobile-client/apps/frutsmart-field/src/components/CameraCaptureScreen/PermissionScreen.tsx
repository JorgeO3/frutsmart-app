import type React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

type PermissionScreenProps = {
  requestPermission: () => void;
};

const PermissionScreen: React.FC<PermissionScreenProps> = ({
  requestPermission,
}) => {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>Permisos necesarios para cámara</Text>
      <TouchableOpacity
        onPress={requestPermission}
        style={styles.permissionBtn}
      >
        <Text style={styles.permissionText}>Conceder permisos</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "red",
    textAlign: "center",
  },
  permissionBtn: {
    backgroundColor: "#2E86C1",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  permissionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default PermissionScreen;
