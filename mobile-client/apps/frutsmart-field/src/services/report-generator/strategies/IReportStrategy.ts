export interface ReportParams {
  reportDate?: string;
  bunchId?: string;
  // Otros parámetros que puedan necesitar los reportes futuros.
}

export interface IReportStrategy {
  /**
   * Ejecuta la generación completa de un tipo de reporte.
   * @param params - Los parámetros necesarios para este reporte específico.
   * @returns Una promesa que resuelve con el string HTML final del reporte.
   */
  execute(params: ReportParams): Promise<string>;
}
