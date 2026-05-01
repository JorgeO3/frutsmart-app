import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Circle, Defs, LinearGradient, Stop, Svg } from "react-native-svg";

import SessionDetailsModal from "@components/app/plant-work/uploads/SessionDetailsModal";
import AppText from "@components/AppText";
import AppView from "@components/AppView";
import { useSkyboltUploadContext } from "@src/providers/SkyboltUploadProvider";
import { THEME } from "@src/theme";
import type {
  UploadJobLiveMetrics,
  UploadJobViewModel,
} from "@src/services/uploads/types";
import { font, s, vs } from "@utils/responsive";

type SessionStatus =
  | "preparing"
  | "uploading"
  | "paused"
  | "waiting_network"
  | "auth_required"
  | "retrying"
  | "finalizing"
  | "completed"
  | "failed";

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
  userFacingError: string | null;
}

type StatusIcon =
  | "check-circle"
  | "close-circle"
  | "cloud-upload"
  | "pause-circle"
  | "clock-outline"
  | "wifi-alert"
  | "account-alert"
  | "refresh";

interface StatusConfig {
  color: string;
  icon: StatusIcon;
  backgroundColor: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
};

const formatDuration = (seconds: number): string => {
  if (seconds <= 0) return "Ahora";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} min`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.ceil((seconds % 3600) / 60);
  return `${hours} h ${mins} min`;
};

const formatSpeed = (speedBytesPerSec: number | null): string => {
  if (!speedBytesPerSec || speedBytesPerSec <= 0) return "--";
  return `${formatBytes(speedBytesPerSec)}/s`;
};

const errorToUserMessage = (lastError: string | null): string | null => {
  if (!lastError) return null;
  const normalized = lastError.toLowerCase();
  if (normalized.includes("auth") || normalized.includes("token")) {
    return "Debes iniciar sesion para continuar la sincronizacion.";
  }
  if (normalized.includes("network") || normalized.includes("timeout")) {
    return "Sin conexion estable. Se reintentara automaticamente.";
  }
  if (normalized.includes("rate") || normalized.includes("429")) {
    return "Servidor ocupado. Espera unos segundos e intenta de nuevo.";
  }
  if (normalized.includes("checksum") || normalized.includes("md5")) {
    return "No pudimos validar la integridad del archivo. Reintenta la carga.";
  }
  if (normalized.includes("cancel")) {
    return "La sincronizacion fue cancelada.";
  }
  return "No se pudo completar la sincronizacion del analisis.";
};

const toAnalysisLabel = (analysisId: string | null, jobId: string): string => {
  const id = analysisId ?? jobId;
  return `Analisis ${id.slice(0, 8)}`;
};

const mapStatus = (
  job: UploadJobViewModel,
  live: UploadJobLiveMetrics,
): { status: SessionStatus; label: string; message: string } => {
  if (job.status === "failed") {
    return {
      status: "failed",
      label: "Error",
      message: "No se pudo completar la carga. Revisa el detalle o reintenta.",
    };
  }

  if (job.pipelineStep === "done" || job.status === "success") {
    return {
      status: "completed",
      label: "Completado",
      message: "Evidencias sincronizadas correctamente.",
    };
  }

  if (job.pipelineStep === "complete_session" || job.pipelineStep === "evaluation") {
    return {
      status: "finalizing",
      label: "Procesando resultado",
      message: "Validando evidencias y preparando la evaluacion.",
    };
  }

  if (job.pipelineStep === "create_session") {
    return {
      status: "preparing",
      label: "Preparando analisis",
      message: "Preparando evidencias para subir.",
    };
  }

  if (job.pipelineStep === "upload" && job.status === "running") {
    return {
      status: "uploading",
      label: "Subiendo evidencias",
      message: "Subiendo evidencias del analisis.",
    };
  }

  if (job.pipelineStep === "upload" && job.status === "pending") {
    if (live.pauseReason === "network") {
      return {
        status: "waiting_network",
        label: "Esperando red",
        message: "Sin conexion. Reanudaremos automaticamente.",
      };
    }

    if (live.pauseReason === "auth") {
      return {
        status: "auth_required",
        label: "Inicio de sesion requerido",
        message: "Debes iniciar sesion para continuar.",
      };
    }

    if (live.pauseReason === "error") {
      return {
        status: "retrying",
        label: "Reintentando envio",
        message: "Ocurrio un error temporal. Reintentaremos automaticamente.",
      };
    }

    if (live.nextRetryAtMs && live.nextRetryAtMs > Date.now()) {
      return {
        status: "retrying",
        label: "Reintentando envio",
        message: "La subida se reintentara automaticamente.",
      };
    }

    return {
      status: "paused",
      label: "En pausa",
      message: "La sincronizacion esta en pausa.",
    };
  }

  return {
    status: "preparing",
    label: "Preparando",
    message: "Sincronizando estado de la carga.",
  };
};

const mapJobToSession = (
  job: UploadJobViewModel,
  liveMetricsByJobId: Record<string, UploadJobLiveMetrics>,
): UploadSession => {
  const live = liveMetricsByJobId[job.id] ?? {
    speedBytesPerSec: null,
    estimatedRemainingSeconds: null,
    pauseReason: null,
    nextRetryAtMs: null,
    retryAfterMs: null,
    currentItemId: null,
    lastProgressAtMs: null,
  };

  const progress =
    job.totalBytes > 0
      ? Math.round((job.uploadedBytes / job.totalBytes) * 100)
      : job.pipelineStep === "done"
        ? 100
        : 0;

  const statusInfo = mapStatus(job, live);

  const retryHint =
    live.nextRetryAtMs && live.nextRetryAtMs > Date.now()
      ? `Reintento en ${formatDuration(Math.max(1, Math.round((live.nextRetryAtMs - Date.now()) / 1000)))}`
      : null;

  const currentItemLabel = live.currentItemId
    ? `Archivo actual: ${live.currentItemId.slice(0, 8)}`
    : null;

  const userFacingError = errorToUserMessage(job.lastError);

  return {
    id: job.id,
    name: toAnalysisLabel(job.qualityAnalysisId, job.id),
    analysisId: job.qualityAnalysisId,
    status: statusInfo.status,
    statusLabel: statusInfo.label,
    statusMessage: statusInfo.message,
    progress,
    filesCount: job.totalFiles,
    filesCompleted: job.completedFiles,
    totalBytes: job.totalBytes,
    uploadedBytes: job.uploadedBytes,
    estimatedSeconds: live.estimatedRemainingSeconds,
    speedBytesPerSec: live.speedBytesPerSec,
    currentItemLabel,
    retryHint,
    lastError: job.lastError,
    userFacingError,
  };
};

const getEtaLabel = (session: UploadSession): string => {
  if (session.status === "waiting_network") return "Esperando conexion";
  if (session.status === "auth_required") return "Esperando inicio de sesion";
  if (session.status === "paused") return "En pausa";
  if (session.retryHint) return session.retryHint;
  if (session.estimatedSeconds && session.estimatedSeconds > 0) {
    return `Faltan ${formatDuration(session.estimatedSeconds)}`;
  }
  if (session.status === "uploading") return "Calculando tiempo";
  return "Sin estimacion";
};

const getStatusConfig = (status: SessionStatus): StatusConfig => {
  switch (status) {
    case "completed":
      return {
        color: THEME.colors.feedback.success,
        icon: "check-circle",
        backgroundColor: "#dcfce7",
      };
    case "failed":
      return {
        color: THEME.colors.feedback.error,
        icon: "close-circle",
        backgroundColor: "#fee2e2",
      };
    case "uploading":
      return {
        color: THEME.colors.feedback.info,
        icon: "cloud-upload",
        backgroundColor: "#dbeafe",
      };
    case "paused":
      return {
        color: THEME.colors.feedback.warning,
        icon: "pause-circle",
        backgroundColor: "#fef3c7",
      };
    case "waiting_network":
      return {
        color: "#ea580c",
        icon: "wifi-alert",
        backgroundColor: "#ffedd5",
      };
    case "auth_required":
      return {
        color: "#b45309",
        icon: "account-alert",
        backgroundColor: "#fef3c7",
      };
    case "retrying":
      return {
        color: "#7c3aed",
        icon: "refresh",
        backgroundColor: "#ede9fe",
      };
    case "finalizing":
      return {
        color: "#0f766e",
        icon: "cloud-upload",
        backgroundColor: "#ccfbf1",
      };
    case "preparing":
    default:
      return {
        color: THEME.colors.neutral.disabled,
        icon: "clock-outline",
        backgroundColor: "#f1f5f9",
      };
  }
};

const RingProgressBarIcon = ({
  progress,
  color,
  size = 84,
}: {
  progress: number;
  color: string;
  size?: number;
}) => {
  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <View
      style={{
        width: size,
        height: size,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#2563eb" />
            <Stop offset="100%" stopColor="#f97316" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e2e8f0"
          strokeWidth="6"
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="6"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
};

const SessionCard = ({
  session,
  onPress,
}: {
  session: UploadSession;
  onPress: (session: UploadSession) => void;
}) => {
  const statusConfig = getStatusConfig(session.status);

  return (
    <TouchableOpacity onPress={() => onPress(session)} style={styles.sessionCard}>
      <View style={styles.cardContent}>
        <AppText.H6 style={styles.sessionName} numberOfLines={1}>
          {session.name}
        </AppText.H6>

        <AppText style={styles.statusMessage} numberOfLines={2}>
          {session.statusMessage}
        </AppText>

        <View style={[styles.statusChip, { backgroundColor: statusConfig.backgroundColor }]}> 
          <MaterialCommunityIcons name={statusConfig.icon} size={14} color={statusConfig.color} />
          <AppText style={[styles.statusChipText, { color: statusConfig.color }]}> 
            {session.statusLabel}
          </AppText>
        </View>

        <AppText style={styles.cardSubline}>
          {session.filesCompleted} de {session.filesCount} imagenes
        </AppText>

        <View style={styles.metricsRow}>
          <AppText style={styles.metricText}>{formatBytes(session.uploadedBytes)}</AppText>
          <AppText style={styles.metricText}>•</AppText>
          <AppText style={styles.metricText}>{formatSpeed(session.speedBytesPerSec)}</AppText>
          <AppText style={styles.metricText}>•</AppText>
          <AppText style={styles.metricText}>{getEtaLabel(session)}</AppText>
        </View>

        {session.userFacingError && session.status === "failed" ? (
          <AppText style={styles.errorHint} numberOfLines={2}>
            {session.userFacingError}
          </AppText>
        ) : null}

        {session.currentItemLabel ? (
          <AppText style={styles.currentItem} numberOfLines={1}>
            {session.currentItemLabel}
          </AppText>
        ) : null}
      </View>

      <View style={styles.statusButtonContainer}>
        <TouchableOpacity style={styles.statusButton} onPress={() => onPress(session)}>
          <View style={StyleSheet.absoluteFill}>
            <RingProgressBarIcon progress={session.progress} color={statusConfig.color} />
          </View>
          <AppText style={styles.progressLabel}>{session.progress}%</AppText>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const UploadsScreen = () => {
  const {
    jobs,
    liveMetricsByJobId,
    isRecovering,
    startJob,
    pauseJob,
    resumeJob,
    forceRetryJob,
    cancelJob,
    removeJob,
    uploadJobDeletionEnabled,
  } = useSkyboltUploadContext();

  const sessions = useMemo(
    () => jobs.map((job) => mapJobToSession(job, liveMetricsByJobId)),
    [jobs, liveMetricsByJobId],
  );

  const [selectedSession, setSelectedSession] = useState<UploadSession | null>(
    null,
  );
  const [modalVisible, setModalVisible] = useState(false);

  const handleSessionPress = (session: UploadSession) => {
    setSelectedSession(session);
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
  };

  const handleAction = (action: string) => {
    void (async () => {
      if (!selectedSession?.id) return;

      const sessionId = selectedSession.id;

      switch (action) {
        case "start":
        case "new":
          await startJob(sessionId);
          break;
        case "pause":
          await pauseJob(sessionId);
          break;
        case "resume":
          await resumeJob(sessionId);
          break;
        case "retry":
          await forceRetryJob(sessionId);
          break;
        case "cancel":
          await cancelJob(sessionId);
          break;
        case "delete":
          await removeJob(sessionId);
          break;
        default:
          break;
      }
    })();
  };

  return (
    <AppView legalTextActive={false} style={styles.container}>
      <AppText style={styles.headerText}>
        Sigue el avance de sincronizacion de tus analisis y toma acciones cuando
        sea necesario.
      </AppText>

      <ScrollView
        style={styles.sessionsList}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {isRecovering ? (
          <AppText style={styles.emptyText}>Recuperando cargas pendientes...</AppText>
        ) : sessions.length === 0 ? (
          <AppText style={styles.emptyText}>No hay analisis pendientes de sincronizar.</AppText>
        ) : (
          sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onPress={handleSessionPress}
            />
          ))
        )}
      </ScrollView>

      <SessionDetailsModal
        session={selectedSession}
        visible={modalVisible}
        onClose={handleModalClose}
        onAction={handleAction}
        canDelete={uploadJobDeletionEnabled}
      />
    </AppView>
  );
};

export default UploadsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
    padding: s(20),
  },
  headerText: {
    marginBottom: vs(20),
    textAlign: "center",
    fontSize: font.scale(16, { min: 14, max: 18 }),
  },
  sessionsList: {
    flex: 1,
    paddingVertical: 8,
  },
  emptyText: {
    textAlign: "center",
    marginTop: vs(20),
  },
  sessionCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    minHeight: 128,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D4D4D4",
  },
  cardContent: {
    flex: 1,
    marginRight: 12,
    gap: 6,
  },
  sessionName: {
    marginBottom: 2,
  },
  statusMessage: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 16,
  },
  statusChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  cardSubline: {
    fontSize: 13,
    color: "#334155",
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  metricText: {
    fontSize: 12,
    color: "#64748b",
  },
  errorHint: {
    fontSize: 12,
    color: "#b91c1c",
    lineHeight: 16,
  },
  currentItem: {
    fontSize: 11,
    color: "#0f766e",
  },
  statusButtonContainer: {
    width: 84,
    height: 84,
    justifyContent: "center",
    alignItems: "center",
  },
  statusButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  progressLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    zIndex: 10,
  },
});
