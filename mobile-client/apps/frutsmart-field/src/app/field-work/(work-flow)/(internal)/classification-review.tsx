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
  useFieldWorkActions,
  useInternalClassification,
} from "@/src/stores/fieldWork";
import { FONT_FAMILTY } from "@src/constants/Font";
import { normalizeFont, scale } from "@utils/responsive";

import AppText from "@components/AppText";
import AppView from "@components/AppView";
import AppModal from "@components/AppModal";
import AppImage from "@components/AppImage";
import AppButton from "@components/AppButton";
import AppCircleRadioButton from "@components/AppCircleRadioButton";

const IMAGE_SIZE = scale(100);

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
          source={require("@assets/images/harvest-criteria/non_mature_cluster_sm.webp")}
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

  const { result } = useInternalClassification();
  const { updateInternalResult } = useFieldWorkActions();

  if (!result?.aiPrediction) {
    throw new Error("No hay resultados de clasificación interna disponibles.");
  }

  const { className } = result.aiPrediction;
  const remainingCategories = CLASSIFICATION_CATEGORIES.filter(
    (category) => category.value !== className,
  );

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [justification, setJustification] = useState<string>("");
  const [isButtonActive, setIsButtonActive] = useState<boolean>(false);
  const [selectedCriteria, setSelectedCriteria] = useState<string | null>(null);
  const [isInputTouched, setIsInputTouched] = useState<boolean>(false);

  const handleModalAccept = () => {
    setIsModalVisible(false);

    updateInternalResult({
      humanFeedback: {
        isCorrect: false,
        correctedClassName: selectedCriteria,
        observation: justification.trim(),
      },
    });

    router.replace("/field-work/(work-flow)/saving-classification");
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
    router.push("/field-work/(work-flow)/(internal)/classification-tutorial");
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

            <View
              style={{ marginTop: scale(20), justifyContent: "space-around" }}
            >
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
                  borderWidth: scale(1),
                  borderColor: "#C4C4C4",
                  borderRadius: scale(8),
                  padding: scale(10),
                  marginTop: scale(10),
                  height: scale(120), // Set a fixed height
                  textAlignVertical: "top", // Align text to top
                  fontSize: normalizeFont(16),
                  fontFamily: FONT_FAMILTY,
                }}
                placeholder="La clasificación interna es incorrecta porque..."
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
    borderRadius: scale(8),
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
    marginTop: 20,
  },
});

export default ReviewExternalClassificationScreen;
