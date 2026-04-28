import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import AppIcon from "@components/AppIcon"; // Asegúrate de que la ruta sea correcta
import { s } from "@utils/responsiveV2"; // O tu utilidad de estilos responsivos

// Definimos las props que recibirá el componente
interface MenuModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: (screen: string) => void;
}

// Array con las opciones del menú para que sea fácil de mantener
const MENU_ITEMS = [
  {
    id: "profile",
    label: "Perfil",
    icon: AppIcon.User,
    screen: "Profile",
  },
  {
    id: "manual_report",
    label: "Reporte manual",
    icon: AppIcon.ChartPie,
    screen: "ManualReport",
  },
  {
    id: "logout",
    label: "Salida Segura",
    icon: AppIcon.Logout,
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
    // Componente Modal para asegurar que se muestre sobre todo
    <Modal transparent visible={visible} onRequestClose={onClose}>
      {/* Overlay que permite cerrar el menú al tocar fuera de él */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          {/* Contenedor del menú, posicionado absolutamente */}
          <View style={styles.menuContainer}>
            {MENU_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                onPress={() => handleItemPress(item.screen)}
              >
                <item.icon size={s(20)} color="#fff" />
                <Text style={styles.menuText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
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
