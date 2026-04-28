import { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useRouter } from "expo-router";

import {
  useCurrentInternalClassification,
  usePlantWorkActions,
} from "src/stores/plantWork";

import { font, s } from "@utils/responsive";
import { FONT_FAMILTY } from "src/constants/font";

import AppButton from "@components/AppButton";
import AppCircleRadioButton from "@components/AppCircleRadioButton";
import AppImage from "@components/AppImage";
import AppModal from "@components/AppModal";
import AppText from "@components/AppText";
import AppView from "@components/AppView";

const IMAGE_SIZE = s(100);

const CLASSIFICATION_CATEGORIES = [
  { label: "Tipo A", value: "TipoA" },
  { label: "Tipo B", value: "TipoB" },
  { label: "Tipo C", value: "TipoC" },
  { label: "Tipo D", value: "TipoD" },
];

// Componentes
const ExternalCriteriaButton = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} style={styles.criteriaButtonTouchable}>
    <View style={styles.criteriaButtonRow}>
      <View style={styles.criteriaButtonContainer}>
        <AppText.H6 color="secondary">
          ¿Cuáles son los tipos de racimo?
        </AppText.H6>
      </View>
      <View style={styles.criteriaImageWrapper}>
        <AppImage
          alt="harvest-criteria"
          source={require("@/assets/images/app/onboard/harvest-criteria/non_mature_cluster.webp")}
          style={styles.criteriaImage}
        />
      </View>
    </View>
  </TouchableOpacity>
);

interface CriteriaListProps {
  onPress: (value: string) => void;
  data: { label: string; value: string }[];
  selectedValue: string | null;
}

const CriteriaList = ({ onPress, data, selectedValue }: CriteriaListProps) => {
  return (
    <View style={styles.criteriaListContainer}>
      {data.map((item, index) => (
        <View
          key={item.value} // Se usa el 'value' único como key
          style={[
            styles.criteriaItemRow,
            {
              backgroundColor: index % 2 === 0 ? "#ffffff" : "#eeeeee",
              borderTopLeftRadius: index === 0 ? s(8) : 0,
              borderTopRightRadius: index === 0 ? s(8) : 0,
              borderBottomLeftRadius: index === data.length - 1 ? s(8) : 0,
              borderBottomRightRadius: index === data.length - 1 ? s(8) : 0,
              borderTopWidth: index === 0 ? 1 : 0,
            },
          ]}
        >
          <AppText.H4 color="primary">{item.label}</AppText.H4>
          <AppCircleRadioButton
            selected={selectedValue === item.value}
            onPress={() => onPress(item.value)}
            outerCircleStyle={styles.criteriaRadioButton}
          />
        </View>
      ))}
    </View>
  );
};

const ReviewExternalClassificationScreen = () => {
  const router = useRouter();

  const { updateInternalFeedback, nextIteration } = usePlantWorkActions();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [justification, setJustification] = useState<string>("");
  const [isButtonActive, setIsButtonActive] = useState<boolean>(false);
  const [selectedCriteria, setSelectedCriteria] = useState<string | null>(null);
  const [isInputTouched, setIsInputTouched] = useState<boolean>(false);

  const internalClassification = useCurrentInternalClassification();
  if (!internalClassification) {
    throw new Error("No classification data available for the current step.");
  }

  const { aiPrediction } = internalClassification;
  if (!aiPrediction) {
    throw new Error("El resultado de la clasificación no está disponible.");
  }
  const { className } = aiPrediction;

  const remainingCategories = CLASSIFICATION_CATEGORIES.filter(
    (category) => category.value !== className,
  );

  const handleModalAccept = () => {
    setIsModalVisible(false);

    updateInternalFeedback({
      isCorrect: false,
      correctedClassName: selectedCriteria,
      observation: justification.trim(),
    });

    nextIteration();

    router.replace("/plant-work/work-flow/external/steps");
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
  };

  const handleFinish = useCallback(() => {
    setIsModalVisible(true);
  }, []);

  const handleCriteriaPress = useCallback((value: string) => {
    setSelectedCriteria(value);
  }, []);

  const handleCriteriaButtonPress = useCallback(() => {
    router.push("/plant-work/work-flow/internal/classification-tutorial");
  }, [router]);

  useEffect(() => {
    const isCriteriaSelected = selectedCriteria !== null;
    const isJustificationValid = justification.trim().length >= 10;
    setIsButtonActive(isJustificationValid && isCriteriaSelected);
  }, [justification, selectedCriteria]);

  return (
    <AppView legalTextColor="#000">
      <AppModal
        acceptText="Aceptar"
        cancelText="Cancelar"
        visible={isModalVisible}
        onClose={handleModalClose}
        onAccept={handleModalAccept}
        description={"¿Está seguro de continuar el proceso de clasificación?"}
      />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={styles.container}>
          <View>
            <AppText style={styles.headerText}>
              Seleccione la clasificación interna.
            </AppText>

            <CriteriaList
              data={remainingCategories}
              onPress={handleCriteriaPress}
              selectedValue={selectedCriteria}
            />

            <View style={{ marginTop: s(20), justifyContent: "space-around" }}>
              <AppText>
                Justifique su respuesta
                <AppText.BodyL color="error">*</AppText.BodyL>
              </AppText>

              <TextInput
                multiline
                numberOfLines={5}
                value={justification}
                onChangeText={setJustification}
                maxLength={200}
                placeholderTextColor="#7b7b7b"
                onTouchStart={() => setIsInputTouched(true)}
                style={{
                  borderWidth: s(1),
                  borderColor: "#C4C4C4",
                  borderRadius: s(8),
                  padding: s(10),
                  marginTop: s(10),
                  height: s(120), // Set a fixed height
                  textAlignVertical: "top", // Align text to top
                  fontSize: font.scale(16),
                  fontFamily: FONT_FAMILTY,
                }}
                placeholder="La clasificación externa es correcta ya que es compatible el resultado del análisis de la inteligencia artificial."
              />

              {isInputTouched &&
                justification.trim().length >= 1 &&
                justification.trim().length < 10 && (
                  <AppText.BodyXS
                    color="error"
                    style={{ marginTop: s(5), marginLeft: s(5) }}
                  >
                    La justificación debe tener al menos 10 caracteres.
                  </AppText.BodyXS>
                )}
            </View>
          </View>

          <View>
            {/* <HarvestCriteriaButton /> */}
            <ExternalCriteriaButton onPress={handleCriteriaButtonPress} />

            <AppButton
              title="Continuar"
              color="primary"
              onPress={handleFinish}
              disabled={!isButtonActive}
              style={styles.continueButton}
            />
          </View>
        </View>
      </ScrollView>
    </AppView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: s(20),
    backgroundColor: "#fff",
    justifyContent: "space-between",
  },
  headerText: {
    textAlign: "center",
    marginHorizontal: s(20),
    marginBottom: s(15),
  },
  criteriaButtonTouchable: {
    overflow: "visible",
    marginVertical: s(15),
  },
  criteriaButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    overflow: "visible",
  },
  criteriaButtonContainer: {
    backgroundColor: "#92B516",
    padding: s(20),
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
    width: "80%",
    height: "80%",
  },
  criteriaListContainer: {
    marginTop: s(20),
  },
  criteriaItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: s(15),
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#ccc",
  },
  criteriaRadioButton: {
    borderColor: "#ccc",
  },
  continueButton: {
    marginTop: 20,
  },
});

export default ReviewExternalClassificationScreen;
