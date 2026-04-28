import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";

import { useRouter } from "expo-router";

import {
  useExternalClassification,
  useFieldWorkActions,
} from "@stores/fieldWork";
import { FONT_FAMILTY } from "@src/constants/Font";
import { normalizeFont, scale } from "@utils/responsive";

import AppText from "@components/AppText";
import AppView from "@components/AppView";
import AppModal from "@components/AppModal";
import AppImage from "@components/AppImage";
import AppButton from "@components/AppButton";
import AppCircleRadioButton from "@components/AppCircleRadioButton";

const IMAGE_SIZE = scale(120);

const CLASSIFICATION_CATEGORIES = [
  { label: "Clase 1", value: "Clase1" },
  { label: "Clase 2", value: "Clase2" },
  { label: "Clase 3", value: "Clase3" },
  { label: "Clase 4", value: "Clase4" },
];

interface CategoryItem {
  id: string;
  name: string;
  value: boolean;
}

interface ExternalCriteriaButtonProps {
  onPress: () => void;
}

// Componentes
const ExternalCriteriaButton = ({ onPress }: ExternalCriteriaButtonProps) => (
  <TouchableOpacity onPress={onPress} style={styles.criteriaButtonTouchable}>
    <View style={styles.criteriaButtonRow}>
      <View style={styles.criteriaButtonContainer}>
        <AppText.H5 color="secondary">¿Cuáles son las clases?</AppText.H5>
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

interface ExternalCriteriaListProps {
  onPress: (value: string) => void;
  data: { label: string; value: string }[];
  selectedValue: string | null;
}

const ExternalCriteriaList = ({
  onPress,
  data,
  selectedValue,
}: ExternalCriteriaListProps) => {
  return (
    <View style={styles.criteriaListContainer}>
      {data.map((item, index) => (
        <View
          key={item.value} // Se usa el 'value' único como key
          style={[
            styles.criteriaItemRow,
            {
              backgroundColor: index % 2 === 0 ? "#ffffff" : "#eeeeee",
              borderTopLeftRadius: index === 0 ? scale(8) : 0,
              borderTopRightRadius: index === 0 ? scale(8) : 0,
              borderBottomLeftRadius: index === data.length - 1 ? scale(8) : 0,
              borderBottomRightRadius: index === data.length - 1 ? scale(8) : 0,
              borderTopWidth: index === 0 ? 1 : 0,
            },
          ]}
        >
          <AppText.H4 color="primary">{item.label}</AppText.H4>
          <AppCircleRadioButton
            selected={selectedValue === item.value} // La selección se controla desde el padre
            onPress={() => onPress(item.value)} // Se pasa el 'value' al padre
            outerCircleStyle={styles.criteriaRadioButton}
          />
        </View>
      ))}
    </View>
  );
};

const ReviewExternalClassificationScreen = () => {
  const router = useRouter();
  const { result } = useExternalClassification();
  const { updateExternalResult } = useFieldWorkActions();

  if (!result) {
    throw new Error("No hay resultados de clasificación externa disponibles.");
  }

  const { className } = result.aiPrediction; // This Ai model is wrong
  const remainingCategories = CLASSIFICATION_CATEGORIES.filter(
    (category) => category.value !== className,
  );

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [justification, setJustification] = useState<string>("");
  const [isButtonActive, setIsButtonActive] = useState<boolean>(false);
  const [isInputTouched, setIsInputTouched] = useState<boolean>(false);
  const [selectedCriteria, setSelectedCriteria] = useState<string | null>(null);

  const handleModalAccept = () => {
    setIsModalVisible(false);

    updateExternalResult({
      humanFeedback: {
        isCorrect: false,
        correctedClassName: selectedCriteria || "",
        observation: justification.trim(),
      },
    });

    return router.replace("/field-work/(work-flow)/harvest-criteria");
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
  };

  const handleFinish = useCallback(() => {
    setIsModalVisible(true);
  }, []);

  const handleCriteriaPress = useCallback((id: string) => {
    setSelectedCriteria(id);
  }, []);

  const handleCriteriaButtonPress = useCallback(() => {
    router.push("/field-work/(work-flow)/(external)/classification-tutorial");
  }, [router]);

  useEffect(() => {
    const isJustificationValid = justification.trim().length >= 10;
    const isCriteriaSelected = selectedCriteria !== null;
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
        description={"¿Está seguro de continuar el proceso?"}
      />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={styles.container}>
          <View>
            <AppText.BodyM style={styles.headerText}>
              Seleccione la clasificación externa correcta
            </AppText.BodyM>

            <ExternalCriteriaList
              onPress={handleCriteriaPress}
              data={remainingCategories}
              selectedValue={selectedCriteria}
            />

            <View
              style={{ marginTop: scale(20), justifyContent: "space-around" }}
            >
              <AppText.BodyM>
                Justifique su respuesta
                <AppText.BodyL color="error">*</AppText.BodyL>
              </AppText.BodyM>

              <TextInput
                multiline
                numberOfLines={5}
                value={justification}
                onChangeText={setJustification}
                maxLength={200}
                placeholderTextColor="#7b7b7b"
                onTouchStart={() => setIsInputTouched(true)}
                style={{
                  borderWidth: 1,
                  borderColor: "#C4C4C4",
                  borderRadius: scale(8),
                  padding: scale(10),
                  marginTop: scale(10),
                  height: scale(120), // Set a fixed height
                  textAlignVertical: "top", // Align text to top
                  fontSize: normalizeFont(16),
                  fontFamily: FONT_FAMILTY,
                }}
                placeholder="La clasificación externa es correcta ya que es compatible el resultado del análisis de la inteligencia artificial."
              />

              {isInputTouched &&
                justification.trim().length >= 1 &&
                justification.trim().length < 10 && (
                  <AppText.BodyXS
                    color="error"
                    style={{ marginTop: scale(5), marginLeft: scale(5) }}
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
    padding: scale(20),
    backgroundColor: "#fff",
    justifyContent: "space-between",
  },
  headerText: {
    textAlign: "center",
    marginHorizontal: scale(20),
    marginBottom: scale(15),
  },
  criteriaButtonTouchable: {
    overflow: "visible",
    marginVertical: scale(15),
  },
  criteriaButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    overflow: "visible",
  },
  criteriaButtonContainer: {
    backgroundColor: "#92B516",
    padding: scale(20),
    borderRadius: 8,
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
    borderWidth: scale(3),
    borderColor: "#92B516",
  },
  criteriaImage: {
    width: "80%",
    height: "80%",
  },
  criteriaListContainer: {
    marginTop: scale(20),
  },
  criteriaItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: scale(15),
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#ccc",
  },
  criteriaRadioButton: {
    borderColor: "#ccc",
  },
  continueButton: {
    marginTop: scale(20),
  },
});

export default ReviewExternalClassificationScreen;
