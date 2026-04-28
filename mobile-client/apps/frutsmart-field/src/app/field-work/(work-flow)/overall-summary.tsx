import type React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  type StyleProp,
  type ViewStyle,
  ActivityIndicator,
} from "react-native";

import LottieView from "lottie-react-native";
import { type Href, usePathname, useRouter } from "expo-router";

import { normalizeFont, scale } from "@utils/responsive";

import AppText from "@components/AppText";
import AppIcon from "@components/AppIcon";
import AppView from "@components/AppView";
import AppImage from "@components/AppImage";
import AppButton from "@components/AppButton";
import {
  type DailySummary,
  summaryService,
} from "@services/summary/SummaryService";
import { useCallback, useEffect, useState } from "react";
import { usePDFGenerator } from "@/src/hooks/usePDFGenerator";

// Constantes
const BORDER_WIDTH = scale(1);
const BORDER_RADIUS = scale(8);
const CELL_PADDING = {
  vertical: scale(6),
  horizontal: scale(12),
};

// Colores
const COLORS = {
  green: { primary: "#227c26", secondary: "#92b516" },
  orange: { primary: "#F27B00", secondary: "#E94C14" },
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
    // Estilos del título
    titleBarStyle: {
      backgroundColor: colors.primary,
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingVertical: scale(10),
      paddingHorizontal: scale(14),
      borderTopLeftRadius: BORDER_RADIUS,
      borderTopRightRadius: BORDER_RADIUS,
    },

    // Estilos de cabecera
    headerRowStyle: {
      backgroundColor: colors.secondary,
      flexDirection: "row" as const,
    },

    headerLabelCellStyle: {
      width: scale(100),
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

    // Estilos de filas de datos
    dataRowStyle: {
      flexDirection: "row" as const,
    },

    // biome-ignore lint/suspicious/noExplicitAny: this is a generic type
    dataLabelCellStyle: (borderProps?: any): StyleProp<ViewStyle> => ({
      width: scale(100),
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
      borderLeftWidth: scale(1),
      borderLeftColor: colors.primary,
      borderBottomColor: colors.primary,
      borderBottomWidth: isLast ? 0 : BORDER_WIDTH,
    }),

    // Estilos de celda para total
    totalLabelCellStyle: {
      width: scale(100),
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

    // Estilos de texto
    centerTextStyle: {
      textAlign: "center" as const,
    },

    rightTextStyle: {
      textAlign: "right" as const,
    },

    labelTextStyle: {
      textAlign: "center" as const,
      color: colors.primary,
    },

    valueTextStyle: {
      textAlign: "right" as const,
      color: colors.primary,
    },

    totalLabelTextStyle: {
      color: colors.primary,
    },
  };
};

// Componentes
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
  const styles = getStyleConstants(colors);

  return (
    <View style={sharedStyles.row}>
      <View style={styles.totalLabelCellStyle}>
        <AppText.H5 style={styles.totalLabelTextStyle}>Total</AppText.H5>
      </View>
      <View style={styles.totalValueCellStyle}>
        <AppText.H5 color="secondary" style={styles.rightTextStyle}>
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
    <View style={sharedStyles.card}>
      {/* Barra de título */}
      <View style={compStyles.titleBarStyle}>
        <AppText.H5 color="secondary">{title}</AppText.H5>
        <View style={{ height: scale(40), width: scale(40) }}>
          <AppImage
            source={icon}
            alt="Icono de clasificación"
            style={{ width: "100%", height: "100%" }}
          />
        </View>
      </View>

      {/* Encabezados */}
      <TableHeader columns={columns} colors={colors} />

      {/* Filas de datos */}
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

      {/* Fila Total */}
      <TableFooter total={total} colors={colors} />
    </View>
  );
};

const SummaryRecordsScreen = () => {
  const router = useRouter();
  const pathname = usePathname() as Href;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<DailySummary | null>(null);
  const { isGenerating, generateAndDownloadSummaryReport } = usePDFGenerator();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const today = new Date().toISOString().split("T")[0];
        const data = await summaryService.getDailySummary(today);
        setSummaryData(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error desconocido.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDownload = useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    generateAndDownloadSummaryReport(today, "summary");
  }, [generateAndDownloadSummaryReport]);

  const handleIndex = () => {
    router.replace("/field-work/home");
  };

  if (loading) {
    return (
      <AppView style={sharedStyles.center}>
        <ActivityIndicator size="large" />
        <AppText.BodyL>Cargando resumen...</AppText.BodyL>
      </AppView>
    );
  }

  if (error || !summaryData) {
    return (
      <AppView style={sharedStyles.center}>
        <AppText.H4 color="error">Error al Cargar</AppText.H4>
        <AppText.BodyM style={{ textAlign: "center", marginVertical: 10 }}>
          {error || "No se encontraron datos para el día de hoy."}
        </AppText.BodyM>
        <AppButton
          title="Reintentar"
          onPress={() => router.replace(pathname)}
        />
      </AppView>
    );
  }

  const tableConfigs = [
    {
      title: "Resumen clasificación externa",
      columns: [
        { key: "class_name", label: "Clase" },
        { key: "count", label: "Cantidad de Racimos" },
      ],
      data: summaryData.externalClassification,
      totalKey: "count",
      colors: COLORS.green,
      icon: require("@/assets/images/field-work/(work-flow)/overall-summary/external-cluster-icon.webp"),
    },
    {
      title: "Resumen criterios de cosecha",
      columns: [
        { key: "criterion", label: "Criterio" },
        { key: "count", label: "Cantidad de Racimos" },
      ],
      data: summaryData.harvestCriteria,
      totalKey: "count",
      colors: COLORS.green,
      icon: require("@/assets/images/field-work/(work-flow)/overall-summary/external-cluster-icon.webp"), // Reusar ícono o cambiar
    },
    {
      title: "Resumen clasificación interna",
      columns: [
        { key: "class_name", label: "Clase" },
        { key: "count", label: "Cantidad de Racimos" },
      ],
      data: summaryData.internalClassification,
      totalKey: "count",
      colors: COLORS.orange,
      icon: require("@/assets/images/field-work/(work-flow)/overall-summary/internal-cluster-icon.webp"),
    },
  ];

  return (
    <AppView>
      <ScrollView
        style={sharedStyles.container}
        contentContainerStyle={sharedStyles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <AppText.BodyL style={sharedStyles.description}>
          Visualice todos los resultados de la clasificación del racimo.
        </AppText.BodyL>

        <LottieView
          loop
          autoPlay
          style={sharedStyles.lottieAnimation}
          source={require("@/assets/animations/award-animation.json")}
        />

        <AppText.H1 style={sharedStyles.totalNumber}>
          {summaryData.totalBunches}
        </AppText.H1>
        <AppText.H1 color="primary">Racimos clasificados</AppText.H1>

        {tableConfigs.map((config) => (
          <ResultsTable key={config.title} {...config} />
        ))}

        <AppButton
          color="green"
          title="Descargar registros"
          style={{
            marginTop: scale(20),
            justifyContent: "center",
            flexDirection: "row",
            gap: scale(10),
          }}
          onPress={handleDownload}
          disabled={isGenerating !== null}
        >
          <AppText.H5 color="secondary">Descargar registros</AppText.H5>

          <AppIcon.Download size={scale(30)} color="white" />
        </AppButton>
        <AppButton
          title="Terminar sesión"
          color="primary"
          onPress={handleIndex}
        />
      </ScrollView>
    </AppView>
  );
};

// Estilos compartidos que no dependen de props dinámicas
const sharedStyles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: scale(20),
    gap: scale(15),
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    alignItems: "center",
    padding: scale(20),
    width: "100%",
    gap: scale(20),
  },
  description: {
    textAlign: "center",
  },
  lottieAnimation: {
    width: scale(150),
    height: scale(150),
    marginVertical: scale(20),
  },
  totalNumber: {
    fontSize: normalizeFont(60),
  },
  row: {
    flexDirection: "row",
  },
  card: {
    width: "100%",
    borderRadius: BORDER_RADIUS,
    elevation: 2,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
  },
});

export default SummaryRecordsScreen;
