import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  type StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";

import { useRouter } from "expo-router";

import {
  type HarvestCriteria,
  useEntirePlantWorkState,
  useExternalSummary,
  useInternalSummary,
  usePlantWorkActions,
} from "@stores/plantWork";
import { font, s } from "@utils/responsive";

import AppButton from "@components/AppButton";
import AppImage from "@components/AppImage";
import AppModal from "@components/AppModal";
import AppText from "@components/AppText";
import AppView from "@components/AppView";
import PaymentCriteriaCard from "@components/PaymentCriteriaCard";

// Constantes
const BORDER_WIDTH = s(1);
const BORDER_RADIUS = s(8);
const CELL_PADDING = {
  vertical: s(6),
  horizontal: s(12),
};

// Colores
const COLORS = {
  green: { primary: "#227c26", secondary: "#92b516" },
  orange: { primary: "#F27B00", secondary: "#E94C14" },
};

// Tipos y constantes para el cálculo de categoría
type PaymentCategory =
  | "ANA"
  | "ANA INTERMEDIO"
  | "ANA MAL APLICADO"
  | "HÍBRIDO";

interface ClassificationSummary {
  "Clase 1": number;
  "Clase 2": number;
  "Clase 3": number;
  "Clase 4": number;
}

interface CategoryThresholds {
  excellent: number; // >= 60%
  intermediate: number; // >= 50%
  poor: number; // >= 40%
  // < 40% = HÍBRIDO
}

interface CategoryDowngrade {
  from: PaymentCategory;
  to: PaymentCategory;
}

const CATEGORY_THRESHOLDS: CategoryThresholds = {
  excellent: 0.6,
  intermediate: 0.5,
  poor: 0.4,
} as const;

const GREEN_CLUSTER_THRESHOLD = 0.03; // 3%

const CATEGORY_DOWNGRADES: readonly CategoryDowngrade[] = [
  { from: "ANA", to: "ANA INTERMEDIO" },
  { from: "ANA INTERMEDIO", to: "ANA MAL APLICADO" },
  { from: "ANA MAL APLICADO", to: "HÍBRIDO" },
] as const;

// Función mejorada para calcular la categoría de pago
const calcularCategoria = (
  classificationSummary: ClassificationSummary,
  harvestCriteria: HarvestCriteria,
): PaymentCategory => {
  // Calcular totales
  const totalClasificacion = Object.values(classificationSummary).reduce(
    (sum, count) => sum + count,
    0,
  );
  const totalCosecha = Object.values(harvestCriteria).reduce(
    (sum, count) => sum + count,
    0,
  );

  // Evitar división por cero
  if (totalClasificacion === 0 || totalCosecha === 0) {
    return "HÍBRIDO";
  }

  // Calcular porcentajes
  const goodQualityRatio =
    (classificationSummary["Clase 1"] + classificationSummary["Clase 2"]) /
    totalClasificacion;
  const greenClusterRatio = harvestCriteria.rv / totalCosecha;

  // Determinar categoría base según calidad
  const getBaseCategory = (ratio: number): PaymentCategory => {
    if (ratio >= CATEGORY_THRESHOLDS.excellent) return "ANA";
    if (ratio >= CATEGORY_THRESHOLDS.intermediate) return "ANA INTERMEDIO";
    if (ratio >= CATEGORY_THRESHOLDS.poor) return "ANA MAL APLICADO";
    return "HÍBRIDO";
  };

  let categoria = getBaseCategory(goodQualityRatio);

  // Aplicar degradación por racimos verdes excesivos
  if (greenClusterRatio >= GREEN_CLUSTER_THRESHOLD) {
    const downgrade = CATEGORY_DOWNGRADES.find(
      ({ from }) => from === categoria,
    );
    if (downgrade) {
      categoria = downgrade.to;
    }
  }

  return categoria;
};

// Lookup table para textos explicativos de categorías
const CATEGORY_EXPLANATIONS: Record<PaymentCategory, string> = {
  ANA: "Indica que al menos el 60% de los racimos están en clases de buena calidad (1 y 2) y que hay menos del 3% de racimos verdes, reflejando una cosecha bien aplicada y oportuna.",
  "ANA INTERMEDIO":
    "Representa una calidad intermedia donde entre el 50% y 59% de los racimos están en clases de buena calidad (1 y 2), o una cosecha con más del 3% de racimos verdes, sugiriendo mejoras en la aplicación de la cosecha.",
  "ANA MAL APLICADO":
    "Señala que entre el 40% y 49% de los racimos están en clases de buena calidad (1 y 2), o una combinación de baja calidad y racimos verdes, indicando necesidad de ajustes significativos en el proceso de cosecha.",
  HÍBRIDO:
    "Indica que menos del 40% de los racimos están en clases de buena calidad (1 y 2), reflejando una cosecha ineficiente o mal aplicada, con posibles problemas en la maduración o selección.",
};

// Interfaces
interface Column {
  key: string;
  label: string;
}

interface ResultsTableProps {
  title: string;
  columns: Column[];
  // biome-ignore lint/suspicious/noExplicitAny: this is a generic type
  data: Array<Record<string, any>>;
  totalKey: string;
  colors: { primary: string; secondary: string };
  icon: string;
}

interface TableHeaderProps {
  columns: Column[];
  colors: { primary: string; secondary: string };
}

interface TableRowProps {
  // biome-ignore lint/suspicious/noExplicitAny: this is a generic type
  row: Record<string, any>;
  labelKey: string;
  valueKey: string;
  colors: { primary: string; secondary: string };
  isLast: boolean;
}

interface TableFooterProps {
  total: number;
  colors: { primary: string; secondary: string };
}

// Estilos pre-calculados
const getStyleConstants = (colors: { primary: string; secondary: string }) => {
  return {
    titleBarStyle: {
      backgroundColor: colors.primary,
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingVertical: s(4),
      paddingHorizontal: s(10),
      borderTopLeftRadius: BORDER_RADIUS,
      borderTopRightRadius: BORDER_RADIUS,
    },
    headerRowStyle: {
      backgroundColor: colors.secondary,
      flexDirection: "row" as const,
    },
    headerLabelCellStyle: {
      width: s(100),
      justifyContent: "center" as const,
      alignItems: "center" as const,
      paddingVertical: CELL_PADDING.vertical,
      paddingHorizontal: CELL_PADDING.horizontal,
    },
    headerValueCellStyle: {
      flex: 1,
      justifyContent: "center" as const,
      paddingVertical: CELL_PADDING.vertical,
      paddingHorizontal: CELL_PADDING.horizontal,
      borderLeftWidth: 0,
    },
    dataRowStyle: {
      flexDirection: "row" as const,
    },
    // biome-ignore lint/suspicious/noExplicitAny: this is a generic type
    dataLabelCellStyle: (borderProps?: any): StyleProp<ViewStyle> => ({
      width: s(100),
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: CELL_PADDING.vertical,
      paddingHorizontal: CELL_PADDING.horizontal,
      borderBottomWidth: BORDER_WIDTH,
      borderColor: colors.primary,
      ...borderProps,
    }),
    dataValueCellStyle: (isLast: boolean): StyleProp<ViewStyle> => ({
      flex: 1,
      justifyContent: "center",
      paddingVertical: CELL_PADDING.vertical,
      paddingHorizontal: CELL_PADDING.horizontal,
      borderLeftWidth: s(1),
      borderLeftColor: colors.primary,
      borderBottomColor: colors.primary,
      borderBottomWidth: isLast ? 0 : BORDER_WIDTH,
    }),
    totalLabelCellStyle: {
      width: s(100),
      justifyContent: "center" as const,
      alignItems: "center" as const,
      paddingVertical: CELL_PADDING.vertical,
      paddingHorizontal: CELL_PADDING.horizontal,
    },
    totalValueCellStyle: {
      flex: 1,
      justifyContent: "center" as const,
      paddingVertical: CELL_PADDING.vertical,
      paddingHorizontal: CELL_PADDING.horizontal,
      backgroundColor: colors.primary,
      borderLeftColor: colors.primary,
      borderBottomColor: colors.primary,
      borderBottomRightRadius: BORDER_RADIUS,
    },
    centerTextStyle: { textAlign: "center" as const },
    rightTextStyle: { textAlign: "right" as const },
    labelTextStyle: { textAlign: "center" as const, color: colors.primary },
    valueTextStyle: { textAlign: "right" as const, color: colors.primary },
    totalLabelTextStyle: { color: colors.primary },
  };
};

// Componentes de la tabla (sin cambios)
const TableHeader = ({ columns, colors }: TableHeaderProps) => {
  const [labelCol, valueCol] = columns;
  const styles = getStyleConstants(colors);
  return (
    <View style={styles.headerRowStyle}>
      <View style={styles.headerLabelCellStyle}>
        <AppText.H5 color="secondary">{labelCol.label}</AppText.H5>
      </View>
      <View style={styles.headerValueCellStyle}>
        <AppText.H5 color="secondary" style={styles.centerTextStyle}>
          {valueCol.label}
        </AppText.H5>
      </View>
    </View>
  );
};
const TableRow = (props: TableRowProps) => {
  const { row, labelKey, valueKey, colors, isLast } = props;
  const styles = getStyleConstants(colors);
  return (
    <View style={styles.dataRowStyle}>
      <View style={styles.dataLabelCellStyle()}>
        <AppText.BodyM style={styles.labelTextStyle}>
          {String(row[labelKey]).replace(/^(Clase|Tipo)\s*/i, "")}
        </AppText.BodyM>
      </View>
      <View style={styles.dataValueCellStyle(isLast)}>
        <AppText.BodyM style={styles.valueTextStyle}>
          {row[valueKey]}
        </AppText.BodyM>
      </View>
    </View>
  );
};
const TableFooter = ({ total, colors }: TableFooterProps) => {
  const footerStyles = getStyleConstants(colors);
  return (
    <View style={styles.row}>
      <View style={footerStyles.totalLabelCellStyle}>
        <AppText.H5 style={footerStyles.totalLabelTextStyle}>Total</AppText.H5>
      </View>
      <View style={footerStyles.totalValueCellStyle}>
        <AppText.H5 color="secondary" style={footerStyles.rightTextStyle}>
          {total}
        </AppText.H5>
      </View>
    </View>
  );
};
const ResultsTable = (props: ResultsTableProps) => {
  const { columns, data, totalKey, colors, title, icon } = props;
  const [labelCol, valueCol] = columns;
  const total: number = data.reduce(
    (sum, row) => sum + (Number(row[totalKey]) || 0),
    0,
  );
  const compStyles = getStyleConstants(colors);
  return (
    <View style={styles.card}>
      <View style={compStyles.titleBarStyle}>
        <AppText.H4 color="secondary">{title}</AppText.H4>
        <View style={{ height: s(40), width: s(40) }}>
          <AppImage
            source={icon}
            alt="Icono de clasificación"
            style={{ width: "100%", height: "100%" }}
          />
        </View>
      </View>
      <TableHeader columns={columns} colors={colors} />
      {data.map((row, idx) => (
        <TableRow
          key={`${row[labelCol.key]}-${idx}`}
          row={row}
          labelKey={labelCol.key}
          valueKey={valueCol.key}
          colors={colors}
          isLast={idx === data.length - 1}
        />
      ))}
      <TableFooter total={total} colors={colors} />
    </View>
  );
};

// --- Componente de Checkbox estilizado (Stateless) ---
interface StyledCheckboxButtonProps {
  label: string;
  onPress: () => void;
  isSelected: boolean;
}
const StyledCheckboxButton = ({
  label,
  onPress,
  isSelected,
}: StyledCheckboxButtonProps) => (
  <TouchableOpacity
    style={styles.checkboxButtonContainer}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.circle, isSelected && styles.selectedCircle]}>
      {isSelected && <View style={styles.innerCircle} />}
    </View>
    <AppText.BodyL
      style={[
        styles.checkboxLabel,
        !isSelected && styles.selectedCheckboxLabel,
      ]}
    >
      {label}
    </AppText.BodyL>
  </TouchableOpacity>
);

// --- Componente de Tarjeta de Clasificación (Stateless) ---
interface IsClassificationValidCardProps {
  selection: "yes" | "no" | null; // CAMBIO: Recibe la selección actual
  onSelectYes: () => void; // CAMBIO: Renombrado para claridad
  onSelectNo: () => void; // CAMBIO: Renombrado para claridad
}
const IsClassificationValidCard = ({
  selection,
  onSelectYes,
  onSelectNo,
}: IsClassificationValidCardProps) => {
  return (
    <View style={styles.cardContainer}>
      <AppText.BodyL style={styles.titleText}>
        ¿Está seguro de que la clasificación externa se realizó bien?
      </AppText.BodyL>
      <View style={styles.optionsContainer}>
        <StyledCheckboxButton
          label="Si"
          onPress={onSelectYes}
          isSelected={selection === "yes"}
        />
        <StyledCheckboxButton
          label="No"
          onPress={onSelectNo}
          isSelected={selection === "no"}
        />
      </View>
    </View>
  );
};

// --- Componente Principal de la Pantalla ---
const OverallSummaryScreen = () => {
  const router = useRouter();

  const { qualityClassifications, harvestCriteria, traceability } =
    useEntirePlantWorkState();
  const { setExternalSummary, setInternalSummary, complete } =
    usePlantWorkActions();

  const externalSummary = useExternalSummary();
  const internalSummary = useInternalSummary();

  const [isCalculated, setIsCalculated] = useState(false);
  const [classificationSelection, setClassificationSelection] = useState<
    "yes" | "no" | null
  >(null);
  const [isConfirmationModalVisible, setIsConfirmationModalVisible] =
    useState(false);
  const [pendingSelection, setPendingSelection] = useState<"yes" | "no" | null>(
    null,
  );
  const [isActionModalVisible, setIsActionModalVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "download" | "finish" | null
  >(null);

  useEffect(() => {
    // Lógica de cálculo (sin cambios)
    let totalSegments = 0;
    const externalCounts: Record<string, number> = {};
    qualityClassifications.forEach((classification) => {
      classification.external?.classifiedSegments.forEach((segment) => {
        externalCounts[segment.bestClassName] =
          (externalCounts[segment.bestClassName] || 0) + 1;
        totalSegments++;
      });
    });

    const extrapolatedExternal: Record<string, number> = {};
    if (totalSegments > 0) {
      Object.entries(externalCounts).forEach(([className, count]) => {
        extrapolatedExternal[className] = Math.round(
          (count / totalSegments) * 100,
        );
      });
      const roundedTotal = Object.values(extrapolatedExternal).reduce(
        (sum, val) => sum + val,
        0,
      );
      const difference = 100 - roundedTotal;
      if (extrapolatedExternal["Clase 1"]) {
        extrapolatedExternal["Clase 1"] += difference;
      } else if (Object.keys(extrapolatedExternal).length > 0) {
        const firstClass = Object.keys(extrapolatedExternal)[0];
        extrapolatedExternal[firstClass] += difference;
      }
    }

    // Completar clases faltantes con 0 para la clasificación externa
    const allExternalClasses = ["Clase 1", "Clase 2", "Clase 3", "Clase 4"];
    const completeExternalSummary: Record<string, number> = {};
    allExternalClasses.forEach((className) => {
      completeExternalSummary[className] = extrapolatedExternal[className] ?? 0;
    });
    // Agregar cualquier clase adicional que no esté en la lista estándar
    Object.keys(extrapolatedExternal).forEach((className) => {
      if (!allExternalClasses.includes(className)) {
        completeExternalSummary[className] = extrapolatedExternal[className];
      }
    });

    setExternalSummary({ aiSummary: completeExternalSummary });

    const internalCounts: Record<string, number> = {};
    qualityClassifications.forEach((classification) => {
      if (classification.internal?.aiPrediction?.className) {
        let effectiveClass = classification.internal.aiPrediction.className;
        const feedback = classification.internal.humanFeedback;
        if (feedback && !feedback.isCorrect && feedback.correctedClassName) {
          effectiveClass = feedback.correctedClassName;
        }
        internalCounts[effectiveClass] =
          (internalCounts[effectiveClass] || 0) + 1;
      }
    });

    // Completar tipos faltantes con 0 para la clasificación interna
    const allInternalTypes = ["Tipo A", "Tipo B", "Tipo C", "Tipo D"];
    const completeInternalSummary: Record<string, number> = {};
    allInternalTypes.forEach((typeName) => {
      completeInternalSummary[typeName] = internalCounts[typeName] ?? 0;
    });
    // Agregar cualquier tipo adicional que no esté en la lista estándar
    Object.keys(internalCounts).forEach((typeName) => {
      if (!allInternalTypes.includes(typeName)) {
        completeInternalSummary[typeName] = internalCounts[typeName];
      }
    });

    setInternalSummary(completeInternalSummary);

    setIsCalculated(true);
  }, [qualityClassifications, setExternalSummary, setInternalSummary]);

  const tableConfigs = useMemo(() => {
    // CORREGIDO: Ambas funciones de formato ahora están DENTRO del useMemo
    const formatSummaryForTable = (
      summary: Record<string, number> | null,
      keyName: string,
    ) => {
      if (!summary) return [];
      return Object.entries(summary)
        .sort(([a], [b]) => {
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
        })
        .map(([key, value]) => ({
          [keyName]: key,
          count: value,
        }));
    };

    // Nueva función específica para la tabla interna que incluye todas las clases
    const formatInternalSummaryForTable = (
      internalData: Record<string, number> | null,
      keyName: string,
    ) => {
      // Ya no necesitamos completar con 0 aquí porque el store ya tiene todas las clases
      if (!internalData) return [];

      return Object.entries(internalData)
        .sort((a, b) => {
          // Ordenamiento específico para tipos: A, B, C, D
          const getTypeOrder = (typeName: string) => {
            const match = typeName.match(/Tipo\s+([A-D])/i);
            if (match) {
              return match[1].toUpperCase().charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
            }
            return 999; // Otros tipos van al final
          };

          const orderA = getTypeOrder(a[0]);
          const orderB = getTypeOrder(b[0]);

          // Si ambos son tipos estándar (A, B, C, D), ordenar por letra
          if (orderA !== 999 && orderB !== 999) {
            return orderA - orderB;
          }

          // Si uno es tipo estándar y otro no, el estándar va primero
          if (orderA !== 999) return -1;
          if (orderB !== 999) return 1;

          // Si ninguno es tipo estándar, orden alfabético
          return a[0].localeCompare(b[0]);
        })
        .map(([typeName, count]) => ({
          [keyName]: typeName,
          count: count,
        }));
    };

    // CORREGIDO: Nueva función específica para HarvestCriteria
    const formatHarvestCriteriaForTable = (
      criteria: HarvestCriteria | null,
    ) => {
      if (!criteria) return [];

      // Orden específico para los criterios de cosecha
      const criteriaOrder = [
        "rb",
        "rv",
        "rsm",
        "rmf",
        "rpl",
        "pas",
        "vac",
        "rs",
      ];

      return criteriaOrder
        .filter((key) => key in criteria) // Solo incluir criterios que existen
        .map((key) => ({
          criterion: key.toUpperCase(), // ej: 'rb' -> 'RB'
          count: criteria[key as keyof HarvestCriteria],
        }));
    };

    return [
      {
        title: "Resumen clasificación externa",
        columns: [
          { key: "class_name", label: "Clase" },
          { key: "count", label: "Cantidad" },
        ],
        data: formatSummaryForTable(
          (externalSummary?.humanSummary || externalSummary?.aiSummary) ?? null,
          "class_name",
        ),
        totalKey: "count",
        colors: COLORS.green, // Ahora se usarán
        icon: require("@/assets/images/app/plant-work/work-flow/overall-summary/external-cluster-icon.webp"),
      },
      {
        title: "Resumen criterios de cosecha",
        columns: [
          { key: "criterion", label: "Criterio" },
          { key: "count", label: "Cantidad" },
        ],
        data: formatHarvestCriteriaForTable(harvestCriteria), // Usamos la nueva función
        totalKey: "count",
        colors: COLORS.green,
        icon: require("@/assets/images/app/plant-work/work-flow/overall-summary/external-cluster-icon.webp"),
      },
      {
        title: "Resumen clasificación interna",
        columns: [
          { key: "class_name", label: "Clase" },
          { key: "count", label: "Cantidad" },
        ],
        data: formatInternalSummaryForTable(
          internalSummary ?? null,
          "class_name",
        ),
        totalKey: "count",
        colors: COLORS.orange,
        icon: require("@/assets/images/app/plant-work/work-flow/overall-summary/internal-cluster-icon.webp"),
      },
    ];
  }, [externalSummary, harvestCriteria, internalSummary]);

  const paymentCategory = useMemo(() => {
    if (!externalSummary || !harvestCriteria) return null;

    // Preferir humanSummary si existe, sino usar aiSummary
    const summaryData =
      externalSummary.humanSummary || externalSummary.aiSummary;
    if (!summaryData) return null;

    const classificationSummary: ClassificationSummary = {
      "Clase 1": summaryData["Clase 1"] || 0,
      "Clase 2": summaryData["Clase 2"] || 0,
      "Clase 3": summaryData["Clase 3"] || 0,
      "Clase 4": summaryData["Clase 4"] || 0,
    };

    return calcularCategoria(classificationSummary, harvestCriteria);
  }, [externalSummary, harvestCriteria]);

  const handleSelectYes = useCallback(() => {
    setPendingSelection("yes");
    setIsConfirmationModalVisible(true);
  }, []);

  const handleSelectNo = useCallback(() => {
    setPendingSelection("no");
    setIsConfirmationModalVisible(true);
  }, []);

  const handleConfirmSelection = useCallback(() => {
    setClassificationSelection(pendingSelection);
    setIsConfirmationModalVisible(false);

    if (pendingSelection === "no") {
      router.replace("/plant-work/work-flow/overall-summary-review");
    } else if (pendingSelection === "yes") {
      // Si el usuario confirma que todo está bien, llamamos a la acción 'complete'
      complete();
    }
    setPendingSelection(null);
  }, [pendingSelection, router, complete]);

  const handleCancelSelection = useCallback(() => {
    setIsConfirmationModalVisible(false);
    setPendingSelection(null);
  }, []);

  const handleDownloadRequest = useCallback(() => {
    setPendingAction("download");
    setIsActionModalVisible(true);
  }, []);

  const handleFinishRequest = useCallback(() => {
    setPendingAction("finish");
    setIsActionModalVisible(true);
  }, []);

  const handleActionConfirm = useCallback(() => {
    router.replace({
      pathname: "/plant-work/work-flow/saving-classification",
      params: { download: pendingAction === "download" ? "true" : "false" },
    });

    setIsActionModalVisible(false);
    setPendingAction(null);
  }, [pendingAction, router.replace]);

  const handleActionCancel = useCallback(() => {
    setIsActionModalVisible(false);
    setPendingAction(null);
  }, []);

  if (!isCalculated) {
    return (
      <AppView style={styles.center}>
        <ActivityIndicator size="large" />
        <AppText.BodyL>Procesando resultados...</AppText.BodyL>
      </AppView>
    );
  }

  return (
    <>
      <AppModal
        acceptText="Confirmar"
        cancelText="Cancelar"
        visible={isConfirmationModalVisible}
        onClose={handleCancelSelection}
        onAccept={handleConfirmSelection}
        description={`¿Está seguro de su selección?`}
      />

      <AppModal
        acceptText="Confirmar"
        cancelText="Cancelar"
        visible={isActionModalVisible}
        onClose={handleActionCancel}
        onAccept={handleActionConfirm}
        description={
          pendingAction === "download"
            ? "¿Está seguro de que desea descargar el registro?"
            : "¿Está seguro de que desea terminar la sesión?"
        }
      />

      <AppView legalTextColor="#000">
        <ScrollView contentContainerStyle={styles.contentContainer}>
          <AppText.H2>Resumen de Clasificación</AppText.H2>
          <AppText.BodyL style={styles.description}>
            Visualice los resultados finales del proceso.
          </AppText.BodyL>

          <ResultsTable {...tableConfigs[0]} />

          {classificationSelection === null && (
            <IsClassificationValidCard
              selection={classificationSelection}
              onSelectYes={handleSelectYes}
              onSelectNo={handleSelectNo}
            />
          )}

          {classificationSelection === "yes" && (
            <>
              <ResultsTable {...tableConfigs[1]} />
              <ResultsTable {...tableConfigs[2]} />

              {traceability.provider === "third-party" && paymentCategory && (
                <PaymentCriteriaCard
                  criteria={paymentCategory}
                  explanation={CATEGORY_EXPLANATIONS[paymentCategory]}
                />
              )}

              <AppButton
                title="Descargar registro"
                color="green"
                style={{ marginTop: s(20) }}
                onPress={handleDownloadRequest}
              />

              <AppButton
                title="Terminar sesión"
                color="primary"
                style={{ marginTop: s(20) }}
                onPress={handleFinishRequest}
              />
            </>
          )}
        </ScrollView>
      </AppView>
    </>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: s(20),
    gap: s(15),
  },
  container: { flex: 1 },
  contentContainer: {
    flexGrow: 1,
    alignItems: "center",
    padding: s(20),
    width: "100%",
  },
  description: { textAlign: "center" },
  lottieAnimation: { width: s(150), height: s(150) },
  totalNumber: { fontSize: font.scale(60) },
  row: { flexDirection: "row" },
  card: {
    width: "100%",
    borderRadius: BORDER_RADIUS,
    elevation: 2,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
    marginTop: s(20),
  },
  cardContainer: {
    backgroundColor: "#f6f5f5",
    padding: s(20),
    borderRadius: s(16),
    marginTop: s(20),
    alignItems: "center",
    width: "100%",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  titleText: {
    textAlign: "center",
    color: "#333",
    fontWeight: "500",
    marginBottom: s(10),
    fontSize: s(18),
  },
  optionsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "80%",
  },
  checkboxButtonContainer: { flexDirection: "row", alignItems: "center" },
  circle: {
    width: s(30),
    height: s(30),
    borderRadius: s(15),
    borderWidth: 2,
    borderColor: "#BDBDBD",
    marginRight: s(10),
    justifyContent: "center",
    alignItems: "center",
  },
  selectedCircle: { borderColor: "#FF6F00" },
  innerCircle: {
    width: s(18),
    height: s(18),
    borderRadius: s(9),
    backgroundColor: "#FF6F00",
  },
  checkboxLabel: { fontSize: s(18), color: "#BDBDBD" },
  selectedCheckboxLabel: { color: "#FF6F00" },
});

export default OverallSummaryScreen;
