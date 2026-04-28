// =================================================================
// SECTION 1: DATA TRANSFER OBJECTS (DTOs)
// Tipos que representan la forma "plana" de los datos desde la BD.
// =================================================================

export interface ClassificationSummaryData {
  class_name: string;
  count: number;
}

type ClassificationSummaryDataByLot = ClassificationSummaryData & {
  lot_id: string;
  lot_name: string;
};

interface HarvestCriteriaSummaryData {
  criterion: string;
  count: number;
}

type HarvestCriteriaSummaryDataByLot = HarvestCriteriaSummaryData & {
  lot_id: string;
  lot_name: string;
};

export interface ReportSummaryData {
  externalTotal: ClassificationSummaryData[];
  externalByLot: ClassificationSummaryDataByLot[];
  harvestTotal: HarvestCriteriaSummaryData[];
  harvestByLot: HarvestCriteriaSummaryDataByLot[];
  internalTotal: ClassificationSummaryData[];
  internalByLot: ClassificationSummaryDataByLot[];
}

// =================================================================
// SECTION 2: UI MODEL TYPES
// Tipos que representan la estructura jerárquica para construir el reporte.
// =================================================================

export interface DetailRow {
  concept: string;
  value: string;
  observations: string;
}

export interface Photo {
  uri: string;
  type: "external" | "internal";
  photoType: "cropped" | "segmented" | "raw";
}

export interface BunchDetail {
  bunchNumber: number;
  qualityClassificationId: string;
  externalPhotos: Photo[];
  internalPhotos: Photo[];
  details: DetailRow[];
}

export interface ClassificationSummary {
  className: string;
  count: number;
}

export interface HarvestCriteriaSummary {
  criterion: string;
  count: number;
}

interface LotSummaryBase<T> {
  lotId: string;
  lotName: string;
  summary: T[];
  chartImageUri?: string; // URI de la imagen generada por el módulo nativo.
}

interface ReportSectionBase<TotalSummaryType, LotSummaryType> {
  title: string;
  totalSummary: TotalSummaryType[];
  lotSummaries: LotSummaryType[];
}

export type LotClassificationSummary = LotSummaryBase<ClassificationSummary>;
export type LotHarvestSummary = LotSummaryBase<HarvestCriteriaSummary>;
export type ClassificationSection = ReportSectionBase<
  ClassificationSummary,
  LotClassificationSummary
>;
export type HarvestCriteriaSection = ReportSectionBase<HarvestCriteriaSummary, LotHarvestSummary>;

export interface ReportData {
  reportDate: string;
  reportTime: string;
  location: string;
  externalClassification: ClassificationSection;
  harvestCriteria: HarvestCriteriaSection;
  internalClassification: ClassificationSection;
  detailedBunches: BunchDetail[];
}

// =================================================================
// SECTION 3: UTILITY & ASSET TYPES
// =================================================================

export type TableVariant =
  | "primary"
  | "details"
  | "tertiary"
  | "secondary"
  | "quaternary";

export interface ReportAssets {
  logo: string;
  styles: string;
  principalFont: string;
  logoFont: string;
}

export interface SummaryReportData {
  externalClassification: ClassificationSection;
  harvestCriteria: HarvestCriteriaSection;
  internalClassification: ClassificationSection;
  detailedBunches: BunchDetail[];
}
