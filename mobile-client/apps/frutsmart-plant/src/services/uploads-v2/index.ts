/**
 * Upload System v2
 *
 * Exporta todo lo necesario para usar el nuevo sistema de uploads.
 *
 * Uso:
 *   import { initUploadSystem, createUploadJob, useAllUploadJobs } from "@services/uploads-v2";
 *
 * En el root layout:
 *   useEffect(() => { initUploadSystem(); }, []);
 */

// Tipos
export type {
  UploadJobContext,
  UploadJobSnapshot,
  UploadMachineEvent,
  UploadStateValue,
  UploadJobViewModel,
  Effect,
  MachineConfig,
  NativeMetricsSnapshot,
  UploadApiError,
} from "./types";

// Store
export { useUploadStore } from "./store/uploadStore";

// Servicios (fachada UI)
export {
  initUploadSystem,
  createUploadJob,
  retryUploadJob,
  cancelUploadJob,
  pauseUploadJob,
  resumeUploadJob,
  startUploadJob,
  removeUploadJob,
  useUploadJob,
  useAllUploadJobs,
  getAllJobsView,
} from "./services/UploadServiceV2";

// Orquestador (para casos avanzados)
export { uploadOrchestrator } from "./services/UploadOrchestrator";

// Machine (para testing / debugging)
export { transition } from "./machine/interpreter";
export { uploadMachine } from "./machine/config";
export { guards } from "./machine/guards";
export { contextMutators } from "./machine/actions";
