import { useCallback, useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useRouter } from "expo-router";

import { font, s, vs } from "@utils/responsive";

import AppButton from "@components/AppButton";
import AppImage from "@components/AppImage";
import AppModal from "@components/AppModal";
import AppText from "@components/AppText";
import AppView from "@components/AppView";
import { useExternalSummary, usePlantWorkActions } from "src/stores/plantWork";

// --- Constantes ---
const REQUIRED_TOTAL = 100;
const IMAGE_SIZE = s(100);

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
  criteria: string[];
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
    {/* Header */}
    <View style={styles.headerRow}>
      <AppText.H5 color="secondary">Resumen clasificación externa</AppText.H5>

      <View style={{ width: s(40), height: s(40) }}>
        <AppImage
          alt="Ícono de clasificación externa"
          style={{ width: "100%", height: "100%", aspectRatio: 1 }}
          source={require("@/assets/images/app/plant-work/work-flow/overall-summary/external-cluster-icon.webp")}
        />
      </View>
    </View>
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
const OverallSummaryReviewScreen = () => {
  const router = useRouter();
  // CAMBIO: Obtenemos la acción y los datos correctos del store
  const { setExternalSummary } = usePlantWorkActions();
  const externalSummaryFromStore = useExternalSummary();

  // El estado local para los inputs de texto
  const [criteriaCounts, setCriteriaCounts] = useState<Record<string, string>>(
    {},
  );
  const [isModalVisible, setIsModalVisible] = useState(false);

  // CAMBIO: useEffect para inicializar el estado del formulario con los datos del store
  useEffect(() => {
    if (externalSummaryFromStore?.aiSummary) {
      // Convertimos los números del store a strings para los TextInputs
      const initialCounts = Object.entries(
        externalSummaryFromStore.aiSummary,
      ).reduce(
        (acc, [key, value]) => {
          acc[key] = String(value);
          return acc;
        },
        {} as Record<string, string>,
      );
      setCriteriaCounts(initialCounts);
    }
  }, [externalSummaryFromStore]);

  // CAMBIO: La lista de criterios se deriva de los datos del store, no de una constante
  const classificationCriteria = useMemo(() => {
    if (!externalSummaryFromStore?.aiSummary) return [];

    return Object.keys(externalSummaryFromStore.aiSummary).sort((a, b) => {
      // Orden personalizado para clases: Clase 1, Clase 2, Clase 3, Clase 4, etc.
      const getClassNumber = (className: string) => {
        const match = className.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 999;
      };

      const numA = getClassNumber(a);
      const numB = getClassNumber(b);

      // Si ambos tienen números, ordenar por número
      if (numA !== 999 && numB !== 999) {
        return numA - numB;
      }

      // Si uno tiene número y otro no, el que tiene número va primero
      if (numA !== 999) return -1;
      if (numB !== 999) return 1;

      // Si ninguno tiene número, orden alfabético
      return a.localeCompare(b);
    });
  }, [externalSummaryFromStore]);

  const totalRacimos = useMemo(() => {
    return Object.values(criteriaCounts).reduce((sum, current) => {
      return sum + (Number(current) || 0);
    }, 0);
  }, [criteriaCounts]);

  const isFormValid = useMemo(
    () => totalRacimos === REQUIRED_TOTAL,
    [totalRacimos],
  );

  const handleCountChange = useCallback((criterion: string, value: string) => {
    if (/^\d*$/.test(value) && Number(value) <= REQUIRED_TOTAL) {
      setCriteriaCounts((prevCounts) => ({
        ...prevCounts,
        [criterion]: value,
      }));
    }
  }, []);

  // CAMBIO: La función de guardado ahora es 100% type-safe y usa la acción correcta
  const handleModalAccept = useCallback(() => {
    if (!isFormValid) return;

    const countsAsNumbers = Object.entries(criteriaCounts).reduce(
      (acc, [key, value]) => {
        acc[key] = Number(value) || 0;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Llama a la acción correcta con el payload correcto
    setExternalSummary({ humanSummary: countsAsNumbers });

    setIsModalVisible(false);
    // Vuelve a la pantalla de resumen para ver los cambios
    router.replace("/plant-work/work-flow/overall-summary");
  }, [isFormValid, criteriaCounts, router, setExternalSummary]);

  const handleModalClose = useCallback(() => setIsModalVisible(false), []);
  const handleFinish = useCallback(() => setIsModalVisible(true), []);
  const handleCriteriaButtonPress = useCallback(() => {
    router.push({
      pathname: "/onboard/harvest-criteria",
      params: { valid: "true" },
    });
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
          <AppText style={styles.headerText}>
            Por favor diligenciar la siguiente información de cantidad de
            racimos que corresponden a cada clase.
          </AppText>

          <HarvestCriteriaButton onPress={handleCriteriaButtonPress} />

          <AppText.H2
            color="primary"
            style={{ textAlign: "center", marginVertical: s(10) }}
          >
            Racimos clasificados
          </AppText.H2>

          <View style={styles.formContainer}>
            <CriteriaInputList
              criteria={classificationCriteria}
              counts={criteriaCounts}
              onCountChange={handleCountChange}
              total={totalRacimos}
            />
            {totalRacimos > 0 && totalRacimos !== REQUIRED_TOTAL && (
              <Text style={styles.errorText}>
                *⚠ La muestra de racimos analizada debe dar {REQUIRED_TOTAL}.
              </Text>
            )}
          </View>

          <AppButton
            title="Guardar Corrección"
            color="primary"
            onPress={handleFinish}
            disabled={!isFormValid}
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
  formContainer: {
    flex: 1,
  },
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#227c26",
    paddingHorizontal: s(15),
    minHeight: vs(50),
    justifyContent: "space-around",
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

export default OverallSummaryReviewScreen;
