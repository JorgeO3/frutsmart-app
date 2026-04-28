import { useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useRouter } from "expo-router";

import { font, s, vs } from "@utils/responsive";
import { FONT_FAMILTY } from "src/constants/font";
import { usePlantWorkActions } from "src/stores/plantWork";

import AppButton from "@components/AppButton";
import AppImage from "@components/AppImage";
import AppText from "@components/AppText";
import AppView from "@components/AppView";
import WarningCard from "@components/WarningCard";

// --- Datos de ejemplo ---
const PROVIDER_OPTIONS = [
  { id: "1", label: "Proveedor A" },
  { id: "2", label: "Proveedor B" },
  { id: "3", label: "Proveedor C" },
  { id: "4", label: "Proveedor D" },
  { id: "5", label: "Proveedor E" },
  { id: "6", label: "Proveedor F" },
];

const SUBPROVIDER_OPTIONS = [
  { id: "s1", label: "Subproveedor 1" },
  { id: "s2", label: "Subproveedor 2" },
  { id: "s3", label: "Subproveedor 3" },
];

// --- Componente Selector Reutilizable ---
interface Option {
  id: string;
  label: string;
}

interface CustomSelectorProps {
  label: string;
  options: Option[];
  selectedValue: Option | null;
  onSelect: (option: Option) => void;
  placeholder: string;
  error?: string | null;
  disabled?: boolean;
}

const CustomSelector = (props: CustomSelectorProps) => {
  const {
    label,
    options,
    selectedValue,
    onSelect,
    placeholder,
    error,
    disabled = false,
  } = props;
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (option: Option) => {
    onSelect(option);
    setIsOpen(false);
  };

  // URL de placeholder para la flecha (una sola imagen)

  // Estilo dinámico para rotar la flecha
  const arrowRotationStyle = {
    transform: [{ rotate: isOpen ? "180deg" : "0deg" }],
  };

  return (
    <View style={styles.inputContainer}>
      <AppText.H3 color="warning" style={styles.inputLabel}>
        {label}
        <AppText style={{ color: "red" }}> *</AppText>
      </AppText.H3>
      <TouchableOpacity
        style={[styles.selectorButton, disabled && styles.disabledButton]}
        onPress={() => !disabled && setIsOpen(true)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.selectorButtonText,
            !selectedValue && styles.placeholderText,
          ]}
        >
          {selectedValue ? selectedValue.label : placeholder}
        </Text>
        <AppImage
          alt="Flecha hacia abajo"
          source={require("@/assets/images/chevron-down-icon.webp")}
          style={[styles.arrowIcon, arrowRotationStyle]} // Aplicamos la rotación aquí
        />
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        transparent
        visible={isOpen}
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.optionsContainer}>
            <FlatList
              data={options}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={styles.optionText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// --- Pantalla Principal ---
const ProviderSelectorScreen = () => {
  const router = useRouter();
  const { updateTraceability } = usePlantWorkActions();

  const [selectedProvider, setSelectedProvider] = useState<Option | null>(null);
  const [selectedSubprovider, setSelectedSubprovider] = useState<Option | null>(
    null,
  );

  const [providerError, setProviderError] = useState<string | null>(null);
  const [subproviderError, setSubproviderError] = useState<string | null>(null);

  const isDisabled = !selectedProvider || !selectedSubprovider;

  const handleContinue = () => {
    if (!selectedProvider) {
      setProviderError("El proveedor es requerido");
      return;
    }

    if (!selectedSubprovider) {
      setSubproviderError("El subproveedor es requerido");
      return;
    }

    updateTraceability({
      thirdPartyData: {
        vendor: selectedProvider.id,
        subVendor: selectedSubprovider.id,
      },
    });

    router.replace("/plant-work/work-flow/entry-form");
  };

  return (
    <AppView legalTextActive={false}>
      <View style={{ flex: 1, padding: s(16) }}>
        <View style={{ flex: 1, gap: s(30), alignItems: "center" }}>
          <AppText
            style={{
              textAlign: "center",
              width: "80%",
              paddingVertical: vs(16),
            }}
          >
            En el siguiente listado, seleccione el proveedor que corresponda.
          </AppText>

          <CustomSelector
            label="Proveedor"
            options={PROVIDER_OPTIONS}
            selectedValue={selectedProvider}
            onSelect={(option) => {
              setSelectedProvider(option);
              if (providerError) setProviderError(null);
            }}
            placeholder="Seleccione el proveedor..."
            error={providerError}
          />

          <CustomSelector
            label="Subproveedor"
            options={SUBPROVIDER_OPTIONS}
            selectedValue={selectedSubprovider}
            onSelect={(option) => {
              setSelectedSubprovider(option);
              if (subproviderError) setSubproviderError(null);
            }}
            placeholder="Seleccione el subproveedor..."
            error={subproviderError}
            disabled={!selectedProvider} // Ejemplo: deshabilitar hasta que se elija proveedor
          />
        </View>
        <AppButton
          title="Continuar"
          onPress={handleContinue}
          disabled={isDisabled}
        />
      </View>
      <WarningCard />
    </AppView>
  );
};

// --- Estilos ---
const styles = StyleSheet.create({
  inputContainer: {
    width: "100%",
  },
  inputLabel: {
    marginBottom: 8,
  },
  selectorButton: {
    height: s(50),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    paddingHorizontal: s(15),
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderColor: "#C4C4C4",
  },
  disabledButton: {
    backgroundColor: "#F0F0F0",
  },
  selectorButtonText: {
    fontSize: font.scale(16),
    fontFamily: FONT_FAMILTY,
    color: "#000000",
  },
  placeholderText: {
    color: "#7b7b7b",
  },
  arrowIcon: {
    width: s(22),
    height: s(22),
    // La transición no es soportada por defecto en 'transform' en React Native,
    // pero la rotación será instantánea y se verá bien.
  },
  errorText: {
    color: "#E53935",
    fontSize: font.scale(12),
    marginTop: s(5),
    fontFamily: FONT_FAMILTY,
  },
  // Estilos del Modal y las Opciones
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: s(20),
  },
  optionsContainer: {
    width: "90%",
    backgroundColor: "white",
    borderRadius: 8,
    padding: s(10),
    // Limita la altura a 4.5 items aproximadamente para mostrar que es escrolleable
    maxHeight: vs(220),
  },
  optionItem: {
    paddingVertical: vs(12),
    paddingHorizontal: s(10),
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  optionText: {
    fontSize: font.scale(16),
    fontFamily: FONT_FAMILTY,
    color: "#333",
  },
});

export default ProviderSelectorScreen;
