import { useState } from "react";
import {
  TextInput as RNTextInput,
  StyleSheet,
  Text,
  View,
  type TextInputProps as RNTextInputProps,
} from "react-native";

import { useRouter } from "expo-router";

import { usePlantWorkActions } from "@stores/plantWork";
import { font, s, vs } from "@utils/responsive";
import { FONT_FAMILTY } from "src/constants/font";

import AppButton from "@components/AppButton";
import AppText from "@components/AppText";
import AppView from "@components/AppView";
import WarningCard from "@components/WarningCard";

interface LoginTextInputProps extends RNTextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null; // El error es ahora un simple string.
}

const LoginTextInput = (props: LoginTextInputProps) => {
  const { label, value, onChangeText, placeholder, error, ...rest } = props;

  return (
    <View style={styles.inputContainer}>
      <AppText.H3 color="warning" style={styles.inputLabel}>
        {label}
        <AppText style={{ color: "red" }}> *</AppText>
      </AppText.H3>
      <View>
        <View style={styles.inputSubContainer}>
          <RNTextInput
            {...rest}
            value={value}
            style={styles.input}
            placeholder={placeholder}
            onChangeText={onChangeText}
            placeholderTextColor={"#7b7b7b"}
          />
        </View>
        {/* CAMBIO 4: La lógica del error es más simple. */}
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </View>
  );
};

const EntryFormScreen = () => {
  const router = useRouter();
  const { updateTraceability } = usePlantWorkActions();

  const [vehiclePlate, setVehiclePlate] = useState("");
  const [consecutiveNumber, setConsecutiveNumber] = useState("");
  const [vehiclePlateError, setVehiclePlateError] = useState<string | null>(
    null,
  );
  const [consecutiveNumberError, setConsecutiveNumberError] = useState<
    string | null
  >(null);

  // el botón estará deshabilitado si alguno de los campos está vacío
  const isDisabled = !vehiclePlate.trim() || !consecutiveNumber.trim();

  const handleContinue = () => {
    let valid = true;

    if (!vehiclePlate.trim()) {
      setVehiclePlateError("La placa es requerida");
      valid = false;
    }

    if (!consecutiveNumber.trim()) {
      setConsecutiveNumberError("El número de consecutivo es requerido");
      valid = false;
    }

    if (!valid) return;

    updateTraceability({ truckPlate: vehiclePlate, consecutiveNumber });
    router.replace("/plant-work/work-flow/external/overview");
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
            Ingrese la placa del vehículo y el número del consecutivo.
          </AppText>

          <LoginTextInput
            label="Placas"
            value={vehiclePlate}
            onChangeText={(text) => {
              setVehiclePlate(text);
              if (vehiclePlateError) setVehiclePlateError(null);
            }}
            error={vehiclePlateError}
            placeholder="Placas del Camión, vehículo..."
          />

          <LoginTextInput
            label="Número de consecutivo"
            value={consecutiveNumber}
            onChangeText={(text) => {
              setConsecutiveNumber(text);
              if (consecutiveNumberError) setConsecutiveNumberError(null);
            }}
            error={consecutiveNumberError}
            placeholder="Ingrese el consecutivo..."
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

const styles = StyleSheet.create({
  inputContainer: {
    width: "100%",
  },
  inputLabel: {
    marginBottom: 8,
  },
  inputSubContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  input: {
    height: s(50),
    flex: 1,
    borderWidth: 1,
    paddingVertical: s(10),
    paddingLeft: s(15),
    paddingRight: s(40),
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderColor: "#C4C4C4",
    fontSize: font.scale(16),
    fontFamily: FONT_FAMILTY,
    color: "#000000",
  },
  errorText: {
    color: "#E53935",
    fontSize: font.scale(12),
    marginTop: s(5),
    fontFamily: FONT_FAMILTY,
  },
});

export default EntryFormScreen;
