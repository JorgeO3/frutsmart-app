import { useCallback, useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useRouter } from "expo-router";

import { font, s, vs } from "@/src/utils/responsive";
import {
  useHarvestCriteria,
  usePlantWorkActions,
  type HarvestCriteria,
} from "src/stores/plantWork";

import AppButton from "@components/AppButton";
import AppImage from "@components/AppImage";
import AppModal from "@components/AppModal";
import AppText from "@components/AppText";
import AppView from "@components/AppView";

// --- Constantes ---
const HARVEST_CRITERIA = [
  "rb",
  "rv",
  "rsm",
  "rmf",
  "rpl",
  "pas",
  "vac",
] as const;
type HarvestCriteriaKeys = (typeof HARVEST_CRITERIA)[number];

const REQUIRED_TOTAL = 100;
const IMAGE_SIZE = s(100);

// assets/images/app/plant-work/work-flow/harvest-criteria/empty_cluster_sm_orig.png
// --- Componentes Hijos (Modificados y Nuevos) ---

// (Este componente no cambia)
const HarvestCriteriaButton = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
    <View style={styles.criteriaButtonRow}>
      <View style={styles.criteriaButtonContainer}>
        <AppText.H5 color="secondary">¿Cuáles son los criterios?</AppText.H5>
      </View>
      <View style={styles.criteriaImageWrapper}>
        <AppImage
          alt="harvest-criteria"
          source={require("@/assets/images/app/plant-work/work-flow/harvest-criteria/non_mature_cluster_sm.webp")}
          style={styles.criteriaImage}
        />
      </View>
    </View>
  </TouchableOpacity>
);

// CAMBIO 1: Nuevo componente para la lista de inputs numéricos
interface CriteriaInputListProps {
  criteria: readonly string[];
  counts: Record<string, string>;
  onCountChange: (criterion: string, value: string) => void;
  total: number;
}

const CriteriaInputList = ({
  criteria,
  counts,
  onCountChange,
  total,
}: CriteriaInputListProps) => (
  <View style={styles.criteriaListContainer}>
    {/* Filas de Criterios con Inputs */}
    {criteria.map((item, index) => (
      <View
        key={item}
        style={[
          styles.criteriaItemRow,
          { backgroundColor: index % 2 === 0 ? "#ffffff" : "#f8f8f8" },
        ]}
      >
        <AppText.H5 color="primary" style={styles.criteriaLabel}>
          {item}
        </AppText.H5>
        <TextInput
          style={styles.criteriaInput}
          value={counts[item]}
          onChangeText={(value) => onCountChange(item, value)}
          keyboardType="numeric"
          maxLength={3} // Máximo 100 por campo
          textAlign="center"
        />
      </View>
    ))}
    {/* Fila del Total */}
    <View style={styles.totalRow}>
      <AppText.H5 style={styles.totalLabel}>Total</AppText.H5>
      <AppText.H5 style={styles.totalValue}>{total}</AppText.H5>
    </View>
  </View>
);

// (Modal no necesita grandes cambios, solo el texto)
const ConfirmationModal = ({
  visible,
  onAccept,
  onClose,
}: ConfirmationModalProps) => (
  <AppModal
    visible={visible}
    acceptText="Aceptar"
    cancelText="Cancelar"
    onAccept={onAccept}
    onClose={onClose}
    description="¿Está seguro de que desea guardar esta muestra de racimos?"
  />
);
interface ConfirmationModalProps {
  visible: boolean;
  onAccept: () => void;
  onClose: () => void;
}

// --- Componente Principal (Modificado) ---
const HarvestCriteriaScreen = () => {
  const router = useRouter();
  const { setHarvestCriteria } = usePlantWorkActions();
  const existingCriteria = useHarvestCriteria();

  // CAMBIO 2: El estado ahora es un objeto para guardar los conteos de cada criterio
  const [criteriaCounts, setCriteriaCounts] = useState<
    Record<HarvestCriteriaKeys, string>
  >(
    HARVEST_CRITERIA.reduce(
      (acc, criterion) => {
        acc[criterion] = "0";
        return acc;
      },
      {} as Record<string, string>,
    ),
  );
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Cargar criterios existentes del store si están disponibles
  useEffect(() => {
    if (existingCriteria) {
      const existingCounts = HARVEST_CRITERIA.reduce(
        (acc, criterion) => {
          acc[criterion] = String(existingCriteria[criterion] || 0);
          return acc;
        },
        {} as Record<HarvestCriteriaKeys, string>,
      );
      setCriteriaCounts(existingCounts);
    }
  }, [existingCriteria]);

  // CAMBIO 3: Lógica para calcular el total de racimos usando useMemo
  const totalRacimos = useMemo(() => {
    return Object.values(criteriaCounts).reduce((sum, current) => {
      // Suma el valor actual solo si es un número válido
      return sum + (Number(current) || 0);
    }, 0);
  }, [criteriaCounts]);

  // CAMBIO 4: Lógica de validación para el botón "Continuar"
  const isFormValid = useMemo(
    () => totalRacimos === REQUIRED_TOTAL,
    [totalRacimos],
  );

  // Handler para actualizar el estado de los conteos
  const handleCountChange = useCallback((criterion: string, value: string) => {
    // Permite solo números y previene valores mayores a 100
    if (/^\d*$/.test(value) && Number(value) <= REQUIRED_TOTAL) {
      setCriteriaCounts((prevCounts) => ({
        ...prevCounts,
        [criterion]: value,
      }));
    }
  }, []);

  const handleModalAccept = useCallback(() => {
    if (!isFormValid) return;

    const countsAsNumbers = {} as HarvestCriteria;
    for (const key of HARVEST_CRITERIA) {
      countsAsNumbers[key] = Number(criteriaCounts[key]) || 0;
    }

    setHarvestCriteria(countsAsNumbers);
    setIsModalVisible(false);
    router.replace("/plant-work/work-flow/overall-summary");
  }, [isFormValid, criteriaCounts, router, setHarvestCriteria]);

  const handleModalClose = useCallback(() => setIsModalVisible(false), []);
  const handleFinish = useCallback(() => setIsModalVisible(true), []);
  const handleCriteriaButtonPress = useCallback(() => {
    router.push({
      pathname: "/onboard/harvest-criteria",
      params: { valid: "true" },
    });
    1;
  }, [router]);

  return (
    <>
      <ConfirmationModal
        visible={isModalVisible}
        onAccept={handleModalAccept}
        onClose={handleModalClose}
      />

      <AppView legalTextColor="#000">
        <View style={styles.container}>
          <AppText.BodyS style={styles.headerText}>
            Registre el número de racimos para cada criterio de cosecha.
          </AppText.BodyS>

          <View style={styles.formContainer}>
            {/* CAMBIO 5: Usamos el nuevo componente de lista */}
            <CriteriaInputList
              criteria={HARVEST_CRITERIA}
              counts={criteriaCounts}
              onCountChange={handleCountChange}
              total={totalRacimos}
            />
            {/* CAMBIO 6: Mensaje de error condicional */}
            {totalRacimos > 0 && totalRacimos !== REQUIRED_TOTAL && (
              <Text style={styles.errorText}>
                *⚠ La muestra de racimos analizada debe dar {REQUIRED_TOTAL}.
              </Text>
            )}
          </View>

          <HarvestCriteriaButton onPress={handleCriteriaButtonPress} />

          <AppButton
            title="Continuar"
            color="primary"
            onPress={handleFinish}
            disabled={!isFormValid} // El botón se deshabilita según la nueva lógica
            style={styles.continueButton}
          />
        </View>
      </AppView>
    </>
  );
};

// --- Estilos (Modificados y Nuevos) ---
const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollViewContent: { flexGrow: 1 },
  container: {
    flex: 1,
    padding: s(20),
    backgroundColor: "#fff",
    justifyContent: "space-between",
  },
  headerText: {
    textAlign: "center",
    marginHorizontal: s(20),
  },
  criteriaButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    overflow: "visible",
    marginVertical: s(10),
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
  formContainer: {},
  criteriaListContainer: {
    marginTop: s(10),
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: s(8),
    overflow: "hidden", // Para que los bordes redondeados se apliquen a los hijos
  },
  criteriaItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: s(15),
    minHeight: vs(40),
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  criteriaLabel: {
    fontWeight: "500",
  },
  criteriaInput: {
    borderLeftWidth: 1,
    borderLeftColor: "#ccc",
    height: "100%",
    width: "30%",
    fontSize: font.scale(18),
    fontWeight: "bold",
    color: "#000",
    paddingHorizontal: s(10),
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: s(15),
    minHeight: vs(50),
    backgroundColor: "#f27c00", // Color naranja como en la imagen
  },
  totalLabel: {
    color: "#fff",
    fontWeight: "bold",
  },
  totalValue: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: font.scale(20),
  },
  errorText: {
    color: "#E53935",
    marginTop: s(10),
    textAlign: "center",
    fontSize: font.scale(14),
  },
  continueButton: {
    marginTop: s(20),
  },
});

export default HarvestCriteriaScreen;
