import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";

import { useRouter } from "expo-router";

import { useFieldWorkActions } from "@stores/fieldWork";
import { font, s, vs } from "@/src/utils/responsiveV2";

import AppView from "@components/AppView";
import AppText from "@components/AppText";
import AppModal from "@components/AppModal";
import AppImage from "@components/AppImage";
import AppButton from "@components/AppButton";
import AppCircleRadioButton from "@components/AppCircleRadioButton";

// Constantes
const HARVEST_CRITERIA = ["RB", "RV", "RSM", "RMF", "RPL", "PAS", "VAC", "RS"];
const IMAGE_SIZE = s(100);
const MAX_APPLICATIONS = 99;

// Componente: Botón de criterios de cosecha
const HarvestCriteriaButton = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
    <View style={styles.criteriaButtonRow}>
      <View style={styles.criteriaButtonContainer}>
        <AppText.H5 color="secondary">¿Cuáles son los criterios?</AppText.H5>
      </View>
      <View style={styles.criteriaImageWrapper}>
        <AppImage
          alt="harvest-criteria"
          source={require("@assets/images/harvest-criteria/non_mature_cluster_sm.webp")}
          style={styles.criteriaImage}
        />
      </View>
    </View>
  </TouchableOpacity>
);

interface AppInputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: "default" | "numeric" | "email-address" | "phone-pad";
  maxLength?: number;
}

const AppInputField = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  maxLength,
}: AppInputFieldProps) => (
  <View>
    <AppText.H5 color="primary" style={styles.inputLabel}>
      {label}
    </AppText.H5>
    <TextInput
      style={styles.textInput}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      placeholder={placeholder}
      placeholderTextColor="#999"
      maxLength={maxLength}
    />
  </View>
);

// Componente: Lista de criterios de cosecha
interface HarvestCriteriaListProps {
  criteria: string[];
  selectedValue: string | null;
  onCriteriaSelect: (value: string) => void;
}

const HarvestCriteriaList = ({
  criteria,
  selectedValue,
  onCriteriaSelect,
}: HarvestCriteriaListProps) => (
  <View style={styles.criteriaListContainer}>
    {criteria.map((item, index) => (
      <View
        key={item}
        style={[
          styles.criteriaItemRow,
          {
            backgroundColor: index % 2 === 0 ? "#ffffff" : "#f8f8f8",
            borderTopLeftRadius: index === 0 ? s(8) : 0,
            borderTopRightRadius: index === 0 ? s(8) : 0,
            borderBottomLeftRadius: index === criteria.length - 1 ? s(8) : 0,
            borderBottomRightRadius: index === criteria.length - 1 ? s(8) : 0,
            borderTopWidth: index === 0 ? 1 : 0,
          },
        ]}
      >
        <AppText.H5 color="primary">{item}</AppText.H5>
        <AppCircleRadioButton
          selected={selectedValue === item}
          onPress={() => onCriteriaSelect(item)}
          outerCircleStyle={styles.criteriaRadioButton}
        />
      </View>
    ))}
  </View>
);

// Componente: Modal de confirmación
interface ConfirmationModalProps {
  visible: boolean;
  criteriaName: string | null;
  onAccept: () => void;
  onClose: () => void;
}

const ConfirmationModal = ({
  visible,
  criteriaName,
  onAccept,
  onClose,
}: ConfirmationModalProps) => (
  <AppModal
    visible={visible}
    acceptText="Aceptar"
    cancelText="Cancelar"
    onAccept={onAccept}
    onClose={onClose}
    description={`¿Está seguro de que la clasificación ${criteriaName || ""} es acertada?`}
  />
);

// Componente principal
const HarvestCriteriaScreen = () => {
  const router = useRouter();
  const { setHarvestCriteria } = useFieldWorkActions();

  const [applications, setApplications] = useState("");
  const [clusterWeight, setClusterWeight] = useState("");
  const [selectedCriteria, setSelectedCriteria] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleApplicationsChange = useCallback((text: string) => {
    const isValid = /^\d*$/.test(text);
    if (isValid && Number.parseInt(text || "0") <= MAX_APPLICATIONS) {
      setApplications(text);
    }
  }, []);

  const handleClusterWeightChange = useCallback((text: string) => {
    const isValid = /^\d*\.?\d{0,2}$/.test(text); // "25", "25.5", "0.5"
    if (isValid) setClusterWeight(text);
  }, []);

  const handleModalAccept = useCallback(() => {
    if (!selectedCriteria || !applications || !clusterWeight) return;

    // Se guardan los datos en el store de Zustand.
    setHarvestCriteria({
      assignedCriterion: selectedCriteria,
      applicationCount: Number.parseInt(applications, 10),
      clusterWeight: Number.parseFloat(clusterWeight),
      observation: "", // No hay campo de observación en esta UI
    });

    setIsModalVisible(false);
    router.replace("/field-work/(work-flow)/(internal)/overview");
  }, [
    router,
    applications,
    selectedCriteria,
    setHarvestCriteria,
    clusterWeight,
  ]);

  const handleModalClose = useCallback(() => {
    setIsModalVisible(false);
  }, []);

  const handleCriteriaButtonPress = useCallback(() => {
    router.push("/onboard/harvest-criteria?valid=true");
  }, [router]);

  const handleFinish = useCallback(() => {
    setIsModalVisible(true);
  }, []);

  // --- Lógica de Validación ---
  const isFormValid = useMemo(
    () =>
      applications.trim().length > 0 &&
      clusterWeight.trim().length > 0 &&
      selectedCriteria !== null,
    [applications, clusterWeight, selectedCriteria],
  );

  return (
    <>
      <ConfirmationModal
        visible={isModalVisible}
        criteriaName={selectedCriteria}
        onAccept={handleModalAccept}
        onClose={handleModalClose}
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        <AppView legalTextColor="#000">
          <View style={styles.container}>
            <AppText.BodyS style={styles.headerText}>
              Registre cuál es el criterio de cosecha para el racimo.
            </AppText.BodyS>

            <HarvestCriteriaButton onPress={handleCriteriaButtonPress} />

            <View style={styles.formContainer}>
              <AppInputField
                label="Número de aplicaciones (ANA)"
                value={applications}
                onChangeText={handleApplicationsChange}
                placeholder="Ingrese el valor"
                keyboardType="numeric"
                maxLength={2}
              />

              <AppInputField
                label="Peso (Kg)"
                value={clusterWeight}
                onChangeText={handleClusterWeightChange}
                placeholder="Kg"
                keyboardType="numeric"
              />

              <HarvestCriteriaList
                criteria={HARVEST_CRITERIA}
                selectedValue={selectedCriteria}
                onCriteriaSelect={setSelectedCriteria}
              />
            </View>

            <AppButton
              title="Continuar"
              color="primary"
              onPress={handleFinish}
              disabled={!isFormValid}
              style={styles.continueButton}
            />
          </View>
        </AppView>
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    padding: s(20),
    backgroundColor: "#fff",
  },
  headerText: {
    textAlign: "center",
    marginHorizontal: s(20),
  },
  criteriaButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    overflow: "visible",
    marginVertical: s(15),
  },
  criteriaButtonContainer: {
    backgroundColor: "#92B516",
    padding: s(15),
    borderRadius: s(8),
    width: "85%",
  },
  criteriaImageWrapper: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: IMAGE_SIZE / 2,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -IMAGE_SIZE / 2,
    overflow: "hidden",
    borderWidth: s(3),
    borderColor: "#92B516",
  },
  criteriaImage: {
    aspectRatio: 1,
    width: s(70),
  },
  formContainer: {
    flex: 1,
    gap: vs(10),
  },
  inputLabel: {
    marginBottom: s(10),
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingVertical: s(5),
    paddingHorizontal: s(15),
    height: vs(40),
    color: "#000",
    fontSize: font.scale(16, { max: 16, min: 14 }),
  },
  criteriaListContainer: {
    marginTop: s(10),
  },
  criteriaItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: s(10),
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#ccc",
    minHeight: s(30),
  },
  criteriaRadioButton: {
    borderColor: "#ccc",
  },
  continueButton: {
    marginTop: s(20),
  },
});

export default HarvestCriteriaScreen;
