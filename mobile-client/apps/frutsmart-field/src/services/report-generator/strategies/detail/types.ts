// Tipos compartidos que podrían importarse desde la raíz
export interface Photo {
  uri: string;
  type: "external" | "internal";
  photoType: "cropped" | "segmented" | "raw";
}

export interface DetailRow {
  concept: string;
  value: string;
  observations: string;
}

// Estructura de datos específica para un solo racimo
export interface BunchDetail {
  bunchNumber: number; // O podrías usar un ID real
  qualityClassificationId: string;
  externalPhotos: Photo[];
  internalPhotos: Photo[];
  details: DetailRow[];
}

// El objeto principal que se le pasa al generador de componentes HTML de detalle
export interface DetailReportData {
  reportDate: string;
  reportTime: string;
  location: string;
  bunchDetail: BunchDetail;
}
