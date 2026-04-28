import { ScrollView, StyleSheet, View } from "react-native";

import { useResetNavigation } from "@hooks/useResetNavigation";
import { useIntroStepProgressActions } from "@stores/introStepProgress";
import { s } from "@utils/responsive";
import {
  type HarvestCriteria,
  HarvestCriteriaListData,
} from "src/utils/harvestCriteriaList";

import AppButton from "@components/AppButton";
import AppImage from "@components/AppImage";
import AppText from "@components/AppText";
import AppView from "@components/AppView";
import { useLocalSearchParams } from "expo-router";

interface HarvestCriteriaPointProps {
  text: string;
}

const HarvestCriteriaPoint = ({ text }: HarvestCriteriaPointProps) => {
  return (
    <View style={styles.pointContainer}>
      <View style={styles.pointDot} />
      <AppText.BodyXS style={styles.pointText}>{text}</AppText.BodyXS>
    </View>
  );
};

interface HarvestCriteriaItemProps {
  item: HarvestCriteria;
  index: number;
}

const HarvestCriteriaItem = ({ item, index }: HarvestCriteriaItemProps) => {
  const { title, imgSrc, evaluationPoints } = item;
  const backgroundColor = index % 2 === 0 ? "#F3F3F3" : "#FFFFFF";

  return (
    <View
      style={[
        styles.criteriaItemContainer,
        { backgroundColor, minHeight: s(150) },
      ]}
    >
      <AppImage
        source={imgSrc}
        alt="harvest-criteria"
        style={styles.criteriaImage}
      />

      <View style={styles.criteriaContent}>
        <AppText.H5 color="primary">{title}</AppText.H5>

        {evaluationPoints.map((point) => (
          <HarvestCriteriaPoint text={point} key={`${title}-${point}`} />
        ))}
      </View>
    </View>
  );
};

interface HarvestCriteriaListProps {
  data: HarvestCriteria[];
}

const HarvestCriteriaList = ({ data }: HarvestCriteriaListProps) => {
  return (
    <View style={styles.listContainer}>
      {data.map((criteria, index) => (
        <HarvestCriteriaItem
          index={index}
          item={criteria}
          key={criteria.title}
        />
      ))}
    </View>
  );
};

const HarvestCriteriaScreen = () => {
  const navigate = useResetNavigation();
  const { activeButton } = useLocalSearchParams<{ activeButton: string }>();
  const { advanceStep } = useIntroStepProgressActions();

  const handleFinish = () => {
    advanceStep();
    navigate("/onboard/introduction");
  };

  return (
    <ScrollView
      scrollEventThrottle={16}
      style={{ flex: 1, width: "100%" }}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      <AppView legalTextColor="#000">
        <View style={styles.contentContainer}>
          <AppText.BodyS style={styles.descriptionText}>
            Conozca la definición de cada criterio de cosecha, para su adecuada
            clasificación.
          </AppText.BodyS>
          <HarvestCriteriaList data={HarvestCriteriaListData} />

          {activeButton && (
            <View
              style={{ width: "100%", alignItems: "center", padding: s(20) }}
            >
              <AppButton title="Continuar" onPress={handleFinish} />
            </View>
          )}
        </View>
      </AppView>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    // padding: s(20),
    width: "100%",
    alignItems: "center",
  },
  descriptionText: {
    padding: s(20),
    textAlign: "center",
  },
  listContainer: {
    width: "100%",
    marginBottom: s(20),
  },
  criteriaItemContainer: {
    flexDirection: "row",
    paddingVertical: s(10),
    paddingHorizontal: s(20),
    alignItems: "center",
    width: "100%",
  },
  criteriaImage: {
    width: s(110),
    height: s(110),
    marginRight: s(10),
  },
  criteriaContent: {
    marginLeft: s(10),
    flex: 1,
  },
  pointContainer: {
    flexDirection: "row",
    marginTop: s(5),
    alignItems: "flex-start",
  },
  pointDot: {
    width: s(15),
    height: s(15),
    borderRadius: 7.5,
    backgroundColor: "#92b516",
    marginTop: s(5),
  },
  pointText: {
    marginLeft: s(10),
    flexShrink: 1,
  },
});

export default HarvestCriteriaScreen;
