// Define la estructura de un reporte disponible que se pasará a la UI
export interface AvailableReport {
  id: string; // El UUID del registro del reporte
  reportId: string; // El ID legible por humanos (ej: ID-250701-A4F1C8B2)
  reportDate: string; // La fecha en formato YYYY-MM-DD
  displayName: string; // Un nombre formateado para mostrar en la lista
}
