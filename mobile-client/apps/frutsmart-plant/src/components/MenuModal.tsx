import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { s } from "@utils/responsive";

import AppImage from "./AppImage";

interface MenuModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: (screen: string) => void;
}

const MENU_ITEMS = [
  {
    id: "profile",
    label: "Perfil",
    icon: require("@/assets/images/user-icon.webp"),
    screen: "Profile",
  },
  {
    id: "manual_report",
    label: "Reporte manual",
    icon: require("@/assets/images/chart-pie-icon.webp"),
    screen: "ManualReport",
  },
  {
    id: "logout",
    label: "Salida Segura",
    icon: require("@/assets/images/logout-icon.webp"),
    screen: "Logout",
  },
];

const MenuModal = ({ visible, onClose, onNavigate }: MenuModalProps) => {
  if (!visible) {
    return null;
  }

  const handleItemPress = (screen: string) => {
    onNavigate(screen);
    onClose(); // Cierra el menú después de la selección
  };

  return (
    <Modal transparent visible={visible} onRequestClose={onClose}>
      {/* 1. Capa táctil para cerrar. Ahora es un elemento separado. */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      {/* 2. El contenedor del menú es HERMANO del overlay, no hijo. */}
      <View style={styles.menuContainer}>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuItem}
            onPress={() => handleItemPress(item.screen)}
          >
            <View style={{ width: s(20), height: s(20) }}>
              <AppImage
                source={item.icon}
                style={{ width: "100%", height: "100%" }}
                alt={`${item.label} Icon`}
              />
            </View>
            <Text style={styles.menuText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject, // Ocupa toda la pantalla
    backgroundColor: "rgba(0, 0, 0, 0.0)", // Fondo transparente
  },
  menuContainer: {
    position: "absolute",
    top: s(50), // Ajusta esta posición para que quede debajo del header
    right: s(15),
    backgroundColor: "#155425", // Color de fondo del menú
    borderRadius: 8,
    paddingVertical: s(8),
    paddingHorizontal: s(12),
    elevation: 5, // Sombra para Android
    shadowColor: "#000", // Sombra para iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: s(12),
  },
  menuText: {
    color: "#fff",
    fontSize: s(16),
    marginLeft: s(15),
    fontWeight: "500",
  },
});

export default MenuModal;
