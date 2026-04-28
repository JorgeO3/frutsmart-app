import { StyleSheet, View, Pressable, Text } from "react-native";

// Componente para los botones de acción
interface ActionButtonsProps {
  onCancel: () => void;
  onAccept: () => void;
}

function ActionButtons({ onCancel, onAccept }: ActionButtonsProps) {
  return (
    <View style={styles.buttonContainer}>
      <Pressable onPress={onCancel} style={styles.cancelButton}>
        <Text style={styles.cancelButtonText}>Cancelar</Text>
      </Pressable>
      <Pressable onPress={onAccept} style={styles.acceptButton}>
        <Text style={styles.acceptButtonText}>Aceptar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 20,
  },
  cancelButton: {
    borderRadius: 5,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#E5E5E5",
  },
  cancelButtonText: {
    color: "#155425",
    fontSize: 16,
    fontWeight: "500",
  },
  acceptButton: {
    borderRadius: 5,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#155425",
  },
  acceptButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
});

export default ActionButtons;
