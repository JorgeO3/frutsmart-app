export interface ReportParams {
  analysisId: string;
  reportDate: string;
}

export interface IReportStrategy {
  /**
   * Ejecuta la generación completa de un tipo de reporte.
   * @param params - Los parámetros necesarios para este reporte específico.
   * @returns Una promesa que resuelve con el string HTML final del reporte.
   */
  execute<T extends ReportParams>(params: T): Promise<string>;
}
