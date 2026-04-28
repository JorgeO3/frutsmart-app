import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  View,
  type SectionListData,
} from "react-native";

import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { DateType } from "react-native-ui-datepicker";

import { usePDFGenerator } from "@hooks/usePDFGenerator";
import { useResetNavigation } from "@hooks/useResetNavigation";
import { reportAvailabilityService } from "@services/report-availability/ReportAvailabilityService";
import type { AvailableReport } from "@services/report-availability/types";

import AppButton from "@components/AppButton";
import AppDatePiker from "@components/AppDatePicker/AppDatePicker";
import AppImage from "@components/AppImage";
import AppText from "@components/AppText";
import AppView from "@components/AppView";

import { s } from "@utils/responsive";

// ==================== TYPES ====================
interface ReportSection {
  title: string;
  data: AvailableReport[];
}

// ==================== CONSTANTS ====================

const ANIMATION_CONFIG = {
  damping: 15,
  stiffness: 120,
} as const;

const COLORS = {
  primary: "#F27C00",
  border: "#D4D4D4",
  borderLight: "#DDD",
  white: "#FFFFFF",
  gray: "#888",
  text: "#333",
} as const;

const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
} as const;

// ==================== UTILITIES ====================

/**
 * Normalizes various date types from the datepicker into a standard Date object.
 */
const normalizeDate = (date: DateType): Date => {
  if (typeof date === "object" && date !== null && "toDate" in date) {
    return date.toDate();
  }
  return new Date(date as string | number);
};

/**
 * Formats a Date object into a readable string (e.g., "June 12, 2025").
 */
const formatDateForDisplay = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const areAllReportsSelected = (
  reports: AvailableReport[],
  selectedReports: Set<string>,
): boolean => {
  return reports.every((report) => selectedReports.has(report.id));
};

// ==================== CUSTOM HOOK ====================
const useReportSelection = (_reports: AvailableReport[]) => {
  const [selectedReports, setSelectedReports] = useState(new Set<string>());

  const handleToggleReport = useCallback((reportId: string) => {
    setSelectedReports((current) => {
      const newSelection = new Set(current);
      if (newSelection.has(reportId)) newSelection.delete(reportId);
      else newSelection.add(reportId);
      return newSelection;
    });
  }, []);

  const handleToggleSection = useCallback(
    (sectionReports: AvailableReport[]) => {
      setSelectedReports((current) => {
        const newSelection = new Set(current);
        const sectionIds = sectionReports.map((report) => report.id);
        const allSelected = areAllReportsSelected(sectionReports, current);

        if (allSelected) for (const id of sectionIds) newSelection.delete(id);
        else for (const id of sectionIds) newSelection.add(id);

        return newSelection;
      });
    },
    [],
  );

  return { selectedReports, handleToggleReport, handleToggleSection };
};
// ==================== COMPONENTS ====================

interface AnimatedCheckboxProps {
  isSelected: boolean;
  onPress: () => void;
  testID?: string;
}

const AnimatedCheckbox = memo<AnimatedCheckboxProps>(
  ({ isSelected, onPress, testID }) => {
    const progress = useSharedValue(0);

    useEffect(() => {
      progress.value = withSpring(isSelected ? 1 : 0, ANIMATION_CONFIG);
    }, [isSelected, progress]);

    const animatedCheckmarkStyle = useAnimatedStyle(() => ({
      opacity: progress.value,
      transform: [{ scale: progress.value }],
    }));

    return (
      <Pressable onPress={onPress} style={styles.checkboxBase} testID={testID}>
        {isSelected && <View style={styles.checkboxBackground} />}
        <Animated.View
          style={[styles.checkmarkContainer, animatedCheckmarkStyle]}
        >
          <ReportIcon
            source={require("@/assets/images/app/plant-work/reports/check-icon.webp")}
            alt="Check Icon"
          />
        </Animated.View>
      </Pressable>
    );
  },
);

interface DateFilterInputProps {
  onPress: () => void;
  onClear: () => void;
  displayDate?: string;
  testID?: string;
}

const DateFilterInput = memo<DateFilterInputProps>(
  ({ onPress, onClear, displayDate, testID }) => (
    <TouchableOpacity
      style={styles.dateFilterContainer}
      onPress={onPress}
      testID={testID}
    >
      <AppText color={displayDate ? "text" : "disabled"}>
        {displayDate || "Filtrar reportes por fecha"}
      </AppText>
      {displayDate ? (
        <TouchableOpacity onPress={onClear} hitSlop={10}>
          <ReportIcon
            source={require("@/assets/images/x-icon.webp")}
            alt="Close Icon"
          />
        </TouchableOpacity>
      ) : (
        <ReportIcon
          source={require("@/assets/images/app/plant-work/reports/calendar-icon.webp")}
          alt="Calendar Icon"
        />
      )}
    </TouchableOpacity>
  ),
);

interface SectionHeaderProps {
  title: string;
  areAllSelected: boolean;
  onToggleAll: () => void;
}

const SectionHeader = memo<SectionHeaderProps>(
  ({ title, areAllSelected, onToggleAll }) => (
    <Animated.View
      style={styles.sectionHeaderContainer}
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.springify()}
    >
      <AnimatedCheckbox
        isSelected={areAllSelected}
        onPress={onToggleAll}
        testID={`section-checkbox-${title}`}
      />
      <AppText.H4>{title}</AppText.H4>
    </Animated.View>
  ),
);

interface ReportItemProps {
  item: AvailableReport;
  isSelected: boolean;
  isGenerating: boolean;
  onToggle: () => void;
  onGenerate: () => void;
}

const ReportItem = memo<ReportItemProps>(
  ({ item, isSelected, onToggle, isGenerating, onGenerate }) => (
    <Animated.View
      style={styles.itemContainer}
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.springify()}
    >
      <View style={styles.itemLeft}>
        <AnimatedCheckbox
          isSelected={isSelected}
          onPress={onToggle}
          testID={`report-checkbox-${item.id}`}
        />
        <ReportIcon
          source={require("@/assets/images/app/plant-work/reports/pdf-icon.webp")}
          alt="PDF Icon"
        />

        <AppText.BodyM style={styles.itemId}>{item.reportId}</AppText.BodyM>
      </View>
      {isGenerating ? (
        <ActivityIndicator color={COLORS.primary} />
      ) : (
        <Pressable onPress={onGenerate}>
          <ReportIcon
            source={require("@/assets/images/app/plant-work/reports/download-icon.webp")}
            alt="Download Icon"
          />
        </Pressable>
      )}
    </Animated.View>
  ),
);

interface ListHeaderProps {
  onDateFilterPress: () => void;
  onClearDateFilter: () => void;
  displayDate?: string;
}

const ListHeader = memo<ListHeaderProps>(
  ({ onDateFilterPress, onClearDateFilter, displayDate }) => (
    <>
      <View style={styles.headerTextContainer}>
        <AppText.H3>Resumen reportes</AppText.H3>
        <AppText.BodyS color="primary" style={styles.subtitle}>
          Puedes exportar un resumen de todo el proceso, con un solo botón.
        </AppText.BodyS>
      </View>
      <DateFilterInput
        onPress={onDateFilterPress}
        onClear={onClearDateFilter}
        displayDate={displayDate}
        testID="date-filter-input"
      />
    </>
  ),
);

interface ReportIconProps {
  size?: number;
  source: string;
  alt: string;
}

const ReportIcon = ({ source, size = 28, alt }: ReportIconProps) => {
  return (
    <View style={{ width: s(size), height: s(size) }}>
      <AppImage
        alt={alt}
        source={source}
        style={{ width: "100%", height: "100%" }}
      />
    </View>
  );
};

// ==================== MAIN COMPONENT ====================

/**
 * Main screen that displays a sectioned list of reports,
 * allowing for multi-selection and filtering by date.
 */
const ReportsScreen = () => {
  const navigate = useResetNavigation();

  const [isLoading, setIsLoading] = useState(true);
  const [availableReports, setAvailableReports] = useState<AvailableReport[]>(
    [],
  );
  const { isGenerating, generateAndDownloadPlantReport } = usePDFGenerator();

  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [activeFilterDate, setActiveFilterDate] = useState<Date | undefined>();
  const [datePickerSelection, setDatePickerSelection] = useState<DateType>(
    new Date(),
  );

  const { selectedReports, handleToggleReport, handleToggleSection } =
    useReportSelection(availableReports);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const reports =
        await reportAvailabilityService.getAvailableReports(activeFilterDate);
      console.log("Available reports fetched:", reports);
      setAvailableReports(reports);
    } catch (error) {
      console.error("Failed to fetch available reports:", error);
      Alert.alert("Error", "No se pudieron cargar los reportes disponibles.");
    } finally {
      setIsLoading(false);
    }
  }, [activeFilterDate]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const groupedReports = useMemo<ReportSection[]>(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const todayGroup: AvailableReport[] = [];
    const olderGroup: AvailableReport[] = [];

    for (const report of availableReports) {
      if (report.reportDate === todayStr) {
        todayGroup.push(report);
      } else {
        olderGroup.push(report);
      }
    }

    const sections: ReportSection[] = [];
    if (todayGroup.length > 0)
      sections.push({ title: "Generados hoy", data: todayGroup });
    if (olderGroup.length > 0)
      sections.push({ title: "Reportes anteriores", data: olderGroup });

    return sections;
  }, [availableReports]);

  // ==================== HANDLERS ====================

  const handleDatePickerToggle = useCallback(
    () => setDatePickerVisible((p) => !p),
    [],
  );
  const handleDatePickerAccept = useCallback(() => {
    setActiveFilterDate(normalizeDate(datePickerSelection));
    setDatePickerVisible(false);
  }, [datePickerSelection]);
  const handleClearDateFilter = useCallback(
    () => setActiveFilterDate(undefined),
    [],
  );

  const handleDownloadSummary = useCallback(async () => {
    // If nothing selected, early guard (UI also disables the button)
    if (selectedReports.size === 0) {
      Alert.alert(
        "Selecciona reportes",
        "Debes seleccionar al menos un reporte para descargar.",
      );
      return;
    }

    // Build a list of the selected report objects
    const selectedList = availableReports.filter((r) =>
      selectedReports.has(r.id),
    );

    // Download sequentially to respect internal isGenerating gating
    for (const report of selectedList) {
      // Each report provides its own reportDate and quality_analysis_id
      await generateAndDownloadPlantReport(
        report.reportDate,
        report.quality_analysis_id,
        "plant",
      );
    }
  }, [availableReports, selectedReports, generateAndDownloadPlantReport]);

  const handleContinue = useCallback(() => {
    navigate("/plant-work");
  }, [navigate]);

  // ==================== RENDERING ====================

  const renderItem = useCallback(
    ({ item }: { item: AvailableReport }) => (
      <ReportItem
        item={item}
        isSelected={selectedReports.has(item.id)}
        isGenerating={isGenerating === item.id}
        onToggle={() => handleToggleReport(item.id)}
        onGenerate={() =>
          generateAndDownloadPlantReport(
            item.reportDate,
            item.quality_analysis_id,
            "plant",
          )
        }
      />
    ),
    [
      selectedReports,
      isGenerating,
      handleToggleReport,
      generateAndDownloadPlantReport,
    ],
  );

  const renderSectionHeader = useCallback(
    ({
      section,
    }: {
      section: SectionListData<AvailableReport, ReportSection>;
    }) => (
      <SectionHeader
        title={section.title}
        areAllSelected={areAllReportsSelected(section.data, selectedReports)}
        onToggleAll={() => handleToggleSection(section.data)}
      />
    ),
    [selectedReports, handleToggleSection],
  );

  const listHeaderComponent = useCallback(
    () => (
      <ListHeader
        onDateFilterPress={handleDatePickerToggle}
        onClearDateFilter={handleClearDateFilter}
        displayDate={
          activeFilterDate ? formatDateForDisplay(activeFilterDate) : undefined
        }
      />
    ),
    [activeFilterDate, handleDatePickerToggle, handleClearDateFilter],
  );

  if (isLoading) {
    return (
      <View style={styles.centeredView}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <>
      <AppDatePiker
        headerText="Selecciona una fecha"
        visible={isDatePickerVisible}
        selected={datePickerSelection}
        onDateChange={({ date }) => setDatePickerSelection(date)}
        onClose={handleDatePickerToggle}
        onAccept={handleDatePickerAccept}
      />
      <AppView style={{ backgroundColor: "white" }} legalTextColor="#000">
        <View style={styles.mainContainer}>
          <SectionList
            sections={groupedReports}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            ListHeaderComponent={listHeaderComponent}
            ListEmptyComponent={
              <AppText.BodyS style={styles.emptyText}>
                No se encontraron reportes para el periodo seleccionado.
              </AppText.BodyS>
            }
            contentContainerStyle={styles.listContentContainer}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
          />
          <View style={styles.footerButtons}>
            <View style={styles.buttonContainer}>
              <AppButton
                title="Descargar"
                color="secondary"
                onPress={handleDownloadSummary}
                disabled={selectedReports.size === 0 || isGenerating !== null}
              />
            </View>
            <View style={styles.buttonContainer}>
              <AppButton
                title="Inicio"
                color="primary"
                onPress={handleContinue}
              />
            </View>
          </View>
        </View>
      </AppView>
    </>
  );
};

// ==================== STYLES ====================

const styles = StyleSheet.create({
  mainContainer: { flex: 1, paddingHorizontal: SPACING.xl },
  centeredView: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContentContainer: { paddingBottom: SPACING.xl, flexGrow: 1 },
  headerTextContainer: {
    alignItems: "center",
    paddingTop: SPACING.xl,
    paddingBottom: 10,
  },
  subtitle: { marginTop: 10, textAlign: "center", maxWidth: "85%" },
  footerButtons: {
    flexDirection: "row",
    paddingTop: 15,
    paddingBottom: SPACING.xl,
    gap: SPACING.lg,
  },
  buttonContainer: { flex: 1 },
  dateFilterContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: 10,
  },
  sectionHeaderContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.xl,
    marginBottom: 10,
    marginLeft: SPACING.md,
    backgroundColor: COLORS.white,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    marginBottom: 10,
  },
  itemLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  itemId: { marginLeft: SPACING.md, flexShrink: 1, color: COLORS.text },
  checkboxBase: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    marginRight: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  checkmarkContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: { textAlign: "center", marginTop: 50, color: COLORS.gray },
});
export default ReportsScreen;
