import { MaterialCommunityIcons } from "@expo/vector-icons";
import { memo, useEffect, useMemo } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Circle, Defs, LinearGradient, Stop, Svg } from "react-native-svg";

type SessionStatus =
  | "preparing"
  | "uploading"
  | "paused"
  | "waiting_network"
  | "auth_required"
  | "retrying"
  | "finalizing"
  | "completed"
  | "failed"
  | "permanently_failed";

type StatusIcon =
  | "check-circle"
  | "close-circle"
  | "cloud-upload"
  | "pause-circle"
  | "clock";

interface UploadSession {
  id: string;
  name: string;
  analysisId: string | null;
  status: SessionStatus;
  statusLabel: string;
  statusMessage: string;
  progress: number;
  filesCount: number;
  filesCompleted: number;
  totalBytes: number;
  uploadedBytes: number;
  estimatedSeconds: number | null;
  speedBytesPerSec: number | null;
  currentItemLabel: string | null;
  retryHint: string | null;
  lastError: string | null;
}

interface StatusConfig {
  color: string;
  icon: StatusIcon;
  backgroundColor: string;
}

interface UploadDetail {
  label: string;
  value: string;
  location: string;
  color: string;
}

interface SessionDetailsModalProps {
  session: UploadSession | null;
  visible: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
  canDelete: boolean;
}

interface RingProgressBarProps {
  progress: number;
  size?: number;
}

interface StatChipProps {
  value: string;
  label: string;
  backgroundColor: string;
  valueColor: string;
  labelColor: string;
}

interface DetailRowProps {
  detail: UploadDetail;
}

interface StatusMessageProps {
  type: "success" | "error";
  message: string;
}

interface ActionButtonsProps {
  status: SessionStatus;
  onAction: (action: string) => void;
  onClose: () => void;
  canDelete: boolean;
}

const COLORS = {
  primary: "#2563eb",
  primaryDark: "#1d4ed8",
  secondary: "#f97316",
  success: "#16a34a",
  error: "#dc2626",
  warning: "#f59e0b",
  neutral: "#94a3b8",
  text: {
    primary: "#1f2937",
    secondary: "#64748b",
    tertiary: "#475569",
  },
  background: {
    primary: "#ffffff",
    secondary: "#f3f4f6",
    disabled: "#e2e8f0",
    overlay: "rgba(0, 0, 0, 0.5)",
  },
  border: "#f3f4f6",
  gradient: {
    blue: "#2373ff",
    orange: "#fd5b00",
    purple: "#00ae74",
  },
  chips: {
    blue: {
      bg: "#dbeafe",
      value: "#2563eb",
      label: "#3b82f6",
    },
    orange: {
      bg: "#ffdeb8ff",
      value: "#f54a00",
      label: "#ff6900",
    },
    purple: {
      bg: "#d7fae8",
      value: "#096",
      label: "#00bc7d",
    },
  },
  status: {
    success: { bg: "#dcfce7", text: "#166534" },
    error: { bg: "#fee2e2", text: "#991b1b" },
  },
} as const;

const SIZES = {
  ring: { default: 220, radius: 54, strokeWidth: 4 },
  icon: { large: 64, medium: 24, small: 20, button: 18 },
  font: {
    title: 18,
    statusTitle: 20,
    ringProgress: 50,
    ringLabel: 15,
    chipValue: 14,
    chipLabel: 12,
    detail: 15,
    detailLocation: 13,
    message: 13,
    button: 15,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 48,
  },
  border: {
    radius: { sm: 8, md: 12, lg: 20, xl: 24 },
    width: 1,
  },
} as const;

const getStatusConfig = (status: SessionStatus): StatusConfig => {
  const configs: Record<SessionStatus, StatusConfig> = {
    preparing: {
      color: COLORS.neutral,
      icon: "clock",
      backgroundColor: "#f1f5f9",
    },
    completed: {
      color: COLORS.success,
      icon: "check-circle",
      backgroundColor: COLORS.status.success.bg,
    },
    failed: {
      color: COLORS.error,
      icon: "close-circle",
      backgroundColor: COLORS.status.error.bg,
    },
    permanently_failed: {
      color: COLORS.error,
      icon: "close-circle",
      backgroundColor: COLORS.status.error.bg,
    },
    uploading: {
      color: COLORS.primary,
      icon: "cloud-upload",
      backgroundColor: COLORS.chips.blue.bg,
    },
    waiting_network: {
      color: COLORS.warning,
      icon: "clock",
      backgroundColor: "#fef3c7",
    },
    auth_required: {
      color: COLORS.warning,
      icon: "clock",
      backgroundColor: "#fef3c7",
    },
    retrying: {
      color: COLORS.primary,
      icon: "clock",
      backgroundColor: COLORS.chips.blue.bg,
    },
    finalizing: {
      color: COLORS.primaryDark,
      icon: "cloud-upload",
      backgroundColor: "#dbeafe",
    },
    paused: {
      color: COLORS.warning,
      icon: "pause-circle",
      backgroundColor: "#fef3c7",
    },
  };
  return configs[status];
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"] as const;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / k ** i;
  return `${Math.round(value * 100) / 100} ${sizes[i]}`;
};

const formatTime = (seconds: number): string => {
  if (seconds <= 0) return "Calculando...";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.ceil((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
};

const formatFailureMessage = (rawError: string | null): string => {
  if (!rawError) return "No se pudo completar la sincronizacion del analisis.";
  const normalized = rawError.toLowerCase();
  if (normalized.includes("cert") || normalized.includes("trust anchor") || normalized.includes("ssl")) {
    return "Error de conexion segura. Verifica que el certificado Azurite este instalado.";
  }
  if (normalized.includes("auth") || normalized.includes("token")) {
    return "Debes iniciar sesion para continuar con la sincronizacion.";
  }
  if (normalized.includes("network") || normalized.includes("timeout")) {
    return "No hay una conexion estable. Revisa tu red y vuelve a intentar.";
  }
  if (normalized.includes("rate") || normalized.includes("429")) {
    return "Servidor ocupado. Espera unos segundos y reintenta.";
  }
  if (normalized.includes("checksum") || normalized.includes("md5")) {
    return "No se pudo validar un archivo. Vuelve a intentar la carga.";
  }
  if (normalized.includes("cancel")) {
    return "La sincronizacion fue cancelada.";
  }
  return "No se pudo completar la sincronizacion del analisis.";
};

const RingProgressBar = memo<RingProgressBarProps>(
  ({ progress, size = SIZES.ring.default }) => {
    const { radius, strokeWidth } = SIZES.ring;
    const circumference = 2 * Math.PI * radius;
    const clampedProgress = Math.min(100, Math.max(0, progress));
    const offset = circumference - (clampedProgress / 100) * circumference;

    return (
      <View style={[styles.ringContainer, { width: size, height: size }]}>
        <Svg width={size} height={size} viewBox="0 0 120 120">
          <Defs>
            <LinearGradient
              id="ringGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <Stop offset="0%" stopColor={COLORS.gradient.blue} />
              <Stop offset="100%" stopColor={COLORS.gradient.orange} />
            </LinearGradient>
          </Defs>
          <Circle
            cx="60"
            cy="60"
            r={radius}
            stroke={COLORS.background.disabled}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx="60"
            cy="60"
            r={radius}
            stroke="url(#ringGradient)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
          />
        </Svg>
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.ringCenter}>
            <Text style={styles.ringProgressText}>{Math.round(progress)}%</Text>
            <Text style={styles.ringLabel}>Progreso</Text>
          </View>
        </View>
      </View>
    );
  },
);

RingProgressBar.displayName = "RingProgressBar";

const StatChip = memo<StatChipProps>(
  ({ value, label, backgroundColor, valueColor, labelColor }) => (
    <View style={[styles.chip, { backgroundColor }]}>
      <Text style={[styles.chipValue, { color: valueColor }]}>{value}</Text>
      <Text style={[styles.chipLabel, { color: labelColor }]}>{label}</Text>
    </View>
  ),
);

StatChip.displayName = "StatChip";

const DetailRow = memo<DetailRowProps>(({ detail }) => (
  <View style={styles.detailRow}>
    <View style={[styles.detailDot, { backgroundColor: detail.color }]} />
    <View style={styles.detailContent}>
      <View style={styles.detailHeader}>
        <Text style={styles.detailLabel}>{detail.label}</Text>
        <Text style={styles.detailValue}>{detail.value}</Text>
      </View>
      <Text style={styles.detailLocation}>{detail.location}</Text>
    </View>
  </View>
));

DetailRow.displayName = "DetailRow";

const StatusMessage = memo<StatusMessageProps>(({ type, message }) => {
  const isError = type === "error";
  const containerStyle: ViewStyle = {
    ...styles.statusMessage,
    backgroundColor: isError
      ? COLORS.status.error.bg
      : COLORS.status.success.bg,
  };
  const textStyle = {
    ...styles.statusMessageText,
    color: isError ? COLORS.status.error.text : COLORS.status.success.text,
  };

  return (
    <View style={containerStyle}>
      <MaterialCommunityIcons
        name={isError ? "alert-circle" : "check-circle"}
        size={SIZES.icon.small}
        color={isError ? COLORS.error : COLORS.success}
      />
      <Text style={textStyle}>{message}</Text>
    </View>
  );
});

StatusMessage.displayName = "StatusMessage";

const ActionButtons = memo<ActionButtonsProps>(
  ({ status, onAction, onClose, canDelete }) => {
    const renderButtons = () => {
      switch (status) {
        case "completed":
          return (
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton]}
              onPress={() => onAction("new")}
            >
              <MaterialCommunityIcons
                name="plus"
                size={SIZES.icon.button}
                color={COLORS.background.primary}
              />
              <Text style={styles.primaryButtonText}>Crear Nueva Carga</Text>
            </TouchableOpacity>
          );

        case "failed":
          return (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.outlineButton]}
                onPress={onClose}
              >
                <Text style={styles.outlineButtonText}>Cerrar</Text>
              </TouchableOpacity>
              {canDelete ? (
                <TouchableOpacity
                  style={[styles.actionButton, styles.redButton]}
                  onPress={() => onAction("delete")}
                >
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={SIZES.icon.button}
                    color={COLORS.error}
                  />
                  <Text style={styles.redButtonText}>Eliminar</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={() => onAction("retry")}
              >
                <MaterialCommunityIcons
                  name="refresh"
                  size={SIZES.icon.button}
                  color={COLORS.background.primary}
                />
                <Text style={styles.primaryButtonText}>Reintentar</Text>
              </TouchableOpacity>
            </>
          );

        case "permanently_failed":
          return (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={onClose}
              >
                <Text style={styles.primaryButtonText}>Entendido</Text>
              </TouchableOpacity>
              {canDelete ? (
                <TouchableOpacity
                  style={[styles.actionButton, styles.redButton]}
                  onPress={() => onAction("delete")}
                >
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={SIZES.icon.button}
                    color={COLORS.error}
                  />
                  <Text style={styles.redButtonText}>Eliminar</Text>
                </TouchableOpacity>
              ) : null}
            </>
          );

        case "uploading":
        case "retrying":
          return (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.outlineButton]}
                onPress={() => onAction("pause")}
              >
                <MaterialCommunityIcons
                  name="pause"
                  size={SIZES.icon.button}
                  color={COLORS.text.tertiary}
                />
                <Text style={styles.outlineButtonText}>Pausar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.redButton]}
                onPress={() => onAction("cancel")}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={SIZES.icon.button}
                  color={COLORS.error}
                />
                <Text style={styles.redButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          );

        case "finalizing":
          return (
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton]}
              onPress={onClose}
            >
              <Text style={styles.primaryButtonText}>Entendido</Text>
            </TouchableOpacity>
          );

        case "paused":
          return (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={() => onAction("resume")}
              >
                <MaterialCommunityIcons
                  name="play"
                  size={SIZES.icon.button}
                  color={COLORS.background.primary}
                />
                <Text style={styles.primaryButtonText}>Reanudar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.redButton]}
                onPress={() => onAction("cancel")}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={SIZES.icon.button}
                  color={COLORS.error}
                />
                <Text style={styles.redButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          );

        case "waiting_network":
        case "auth_required":
          return (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.outlineButton]}
                onPress={() => onAction("cancel")}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={SIZES.icon.button}
                  color={COLORS.text.tertiary}
                />
                <Text style={styles.outlineButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={() => onAction("retry")}
              >
                <MaterialCommunityIcons
                  name="refresh"
                  size={SIZES.icon.button}
                  color={COLORS.background.primary}
                />
                <Text style={styles.primaryButtonText}>Reintentar</Text>
              </TouchableOpacity>
            </>
          );

        case "preparing":
          return (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.outlineButton]}
                onPress={() => onAction("cancel")}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={SIZES.icon.button}
                  color={COLORS.text.tertiary}
                />
                <Text style={styles.outlineButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={() => onAction("start")}
              >
                <MaterialCommunityIcons
                  name="play"
                  size={SIZES.icon.button}
                  color={COLORS.background.primary}
                />
                <Text style={styles.primaryButtonText}>Iniciar</Text>
              </TouchableOpacity>
            </>
          );

        default:
          return null;
      }
    };

    return <View style={styles.modalActions}>{renderButtons()}</View>;
  },
);

ActionButtons.displayName = "ActionButtons";

const SessionDetailsModal = memo<SessionDetailsModalProps>(
  ({ session, visible, onClose, onAction, canDelete }) => {
    const computedData = useMemo(() => {
      if (!session) return null;

      const statusConfig = getStatusConfig(session.status);
      const isProcessing =
        session.status === "preparing" ||
        session.status === "uploading" ||
        session.status === "paused" ||
        session.status === "waiting_network" ||
        session.status === "auth_required" ||
        session.status === "retrying" ||
        session.status === "finalizing";

      const remainingTime = Math.max(0, session.estimatedSeconds ?? 0);
      const uploadSpeed = session.speedBytesPerSec ?? 0;
      const filesUploaded = session.filesCompleted;

      const uploadDetails: UploadDetail[] = [
        {
          label: `${filesUploaded} de ${session.filesCount} imagenes`,
          value: `${Math.round(session.progress)}%`,
          location: session.statusMessage,
          color: COLORS.gradient.blue,
        },
        {
          label: `${formatBytes(session.uploadedBytes)} de ${formatBytes(session.totalBytes)}`,
          value: formatBytes(session.uploadedBytes),
          location: "Datos sincronizados",
          color: COLORS.gradient.orange,
        },
        {
          label: "Tiempo restante estimado",
          value: remainingTime > 0
            ? formatTime(remainingTime)
            : session.progress >= 100
              ? "Completado"
              : isProcessing
                ? "Calculando..."
                : "N/D",
          location:
            remainingTime > 0 && uploadSpeed > 0
              ? `${formatBytes(uploadSpeed)}/s aprox.`
              : remainingTime > 0
                ? "Velocidad aun no disponible"
                : session.progress >= 100
                  ? "Todos los archivos transferidos"
                  : "",
          color: COLORS.gradient.purple,
        },
      ];

      if (session.currentItemLabel) {
        uploadDetails.push({
          label: session.currentItemLabel,
          value: "Activo",
          location: "Seguimiento de archivo actual",
          color: COLORS.primary,
        });
      }

      if (session.retryHint) {
        uploadDetails.push({
          label: "Reintento programado",
          value: session.retryHint,
          location: "Control de reintentos",
          color: COLORS.warning,
        });
      }

      return {
        statusConfig,
        isProcessing,
        remainingTime,
        filesUploaded,
        uploadDetails,
      };
    }, [session]);

    const hasSession = !!session && !!computedData;

    useEffect(() => {
      if (visible && !hasSession) {
        onClose?.();
      }
    }, [visible, hasSession, onClose]);

    if (!hasSession) return null;

    const { statusConfig, isProcessing, filesUploaded, uploadDetails } =
      computedData;

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{session.name}</Text>
              <TouchableOpacity onPress={onClose}>
                <MaterialCommunityIcons
                  name="close"
                  size={SIZES.icon.medium}
                  color={COLORS.text.primary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              {isProcessing && (
                <View style={styles.ringSection}>
                  <RingProgressBar progress={session.progress} />
                </View>
              )}

              {!isProcessing && (
                <View style={styles.statusSection}>
                  <MaterialCommunityIcons
                    name={statusConfig.icon}
                    size={SIZES.icon.large}
                    color={statusConfig.color}
                  />
                  <Text style={styles.statusTitle}>
                    {session.statusLabel}
                  </Text>
                </View>
              )}

              {isProcessing && (
                <View style={styles.chipsContainer}>
                  <StatChip
                    value={filesUploaded.toString()}
                    label="Archivos"
                    backgroundColor={COLORS.chips.blue.bg}
                    valueColor={COLORS.chips.blue.value}
                    labelColor={COLORS.chips.blue.label}
                  />
                  <StatChip
                    value={formatBytes(session.uploadedBytes)}
                    label="Datos"
                    backgroundColor={COLORS.chips.orange.bg}
                    valueColor={COLORS.chips.orange.value}
                    labelColor={COLORS.chips.orange.label}
                  />
                  <StatChip
                    value={formatTime(computedData.remainingTime)}
                    label="Tiempo"
                    backgroundColor={COLORS.chips.purple.bg}
                    valueColor={COLORS.chips.purple.value}
                    labelColor={COLORS.chips.purple.label}
                  />
                </View>
              )}

              {isProcessing && (
                <View style={styles.detailsList}>
                  {uploadDetails.map((detail, idx) => (
                    <DetailRow
                      key={`detail-${idx.toString()}`}
                      detail={detail}
                    />
                  ))}
                </View>
              )}

              {(session.status === "failed" || session.status === "permanently_failed") && (
                <StatusMessage
                  type="error"
                  message={formatFailureMessage(session.lastError)}
                />
              )}

              {session.status === "completed" && (
                <StatusMessage
                  type="success"
                  message="Todas las evidencias del analisis se sincronizaron correctamente."
                />
              )}

              {isProcessing && (
                <StatusMessage
                  type="success"
                  message={session.statusMessage}
                />
              )}
            </ScrollView>

            <ActionButtons
              status={session.status}
              onAction={onAction}
              onClose={onClose}
              canDelete={canDelete}
            />
          </View>
        </SafeAreaView>
      </Modal>
    );
  },
);

SessionDetailsModal.displayName = "SessionDetailsModal";

export default SessionDetailsModal;

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background.overlay,
    padding: SIZES.spacing.xl,
  },
  modalContent: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
    borderRadius: SIZES.border.radius.xl,
    marginTop: 60,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SIZES.spacing.xl,
    paddingVertical: SIZES.spacing.xl,
    borderBottomWidth: SIZES.border.width,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: SIZES.font.title,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: SIZES.spacing.xl,
  },
  ringContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  ringCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  ringProgressText: {
    fontSize: SIZES.font.ringProgress,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  ringLabel: {
    fontSize: SIZES.font.ringLabel,
    color: COLORS.text.secondary,
    marginTop: SIZES.spacing.xs,
  },
  ringSection: {
    alignItems: "center",
    marginTop: SIZES.spacing.xxxl,
    marginBottom: SIZES.spacing.xxxl,
  },
  statusSection: {
    alignItems: "center",
    marginTop: SIZES.spacing.huge,
    marginBottom: SIZES.spacing.xxxl,
  },
  statusTitle: {
    fontSize: SIZES.font.statusTitle,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginTop: SIZES.spacing.lg,
  },
  chipsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SIZES.spacing.md,
    marginBottom: SIZES.spacing.xxl,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: SIZES.spacing.lg,
    paddingVertical: SIZES.spacing.sm,
    borderRadius: SIZES.border.radius.lg,
    alignItems: "center",
  },
  chipValue: {
    fontSize: SIZES.font.chipValue,
    fontWeight: "600",
  },
  chipLabel: {
    fontSize: SIZES.font.chipLabel,
    marginTop: 2,
  },
  detailsList: {
    borderTopWidth: SIZES.border.width,
    borderTopColor: COLORS.background.disabled,
    paddingTop: SIZES.spacing.xxl,
    marginBottom: SIZES.spacing.xxl,
    gap: SIZES.spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SIZES.spacing.md,
  },
  detailDot: {
    width: SIZES.spacing.md,
    height: SIZES.spacing.md,
    borderRadius: SIZES.spacing.md / 2,
    marginTop: 6,
  },
  detailContent: {
    flex: 1,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: SIZES.spacing.sm,
  },
  detailLabel: {
    fontSize: SIZES.font.detail,
    fontWeight: "500",
    color: COLORS.text.primary,
    flex: 1,
  },
  detailValue: {
    fontSize: SIZES.font.detail,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  detailLocation: {
    fontSize: SIZES.font.detailLocation,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  statusMessage: {
    flexDirection: "row",
    borderRadius: SIZES.border.radius.md,
    padding: SIZES.spacing.lg,
    marginBottom: SIZES.spacing.lg,
    alignItems: "flex-start",
    gap: SIZES.spacing.md,
  },
  statusMessageText: {
    fontSize: SIZES.font.message,
    flex: 1,
    fontWeight: "500",
  },
  modalActions: {
    flexDirection: "row",
    paddingHorizontal: SIZES.spacing.xl,
    paddingVertical: SIZES.spacing.lg,
    gap: SIZES.spacing.md,
    borderTopWidth: SIZES.border.width,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flex: 1,
    paddingVertical: SIZES.spacing.md,
    borderRadius: SIZES.border.radius.sm,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  primaryButtonText: {
    color: COLORS.background.primary,
    fontWeight: "600",
    fontSize: SIZES.font.button,
  },
  outlineButton: {
    backgroundColor: COLORS.background.disabled,
  },
  outlineButtonText: {
    color: COLORS.text.tertiary,
    fontWeight: "600",
    fontSize: SIZES.font.button,
  },
  redButton: {
    backgroundColor: COLORS.status.error.bg,
  },
  redButtonText: {
    color: COLORS.error,
    fontWeight: "600",
    fontSize: SIZES.font.button,
  },
});