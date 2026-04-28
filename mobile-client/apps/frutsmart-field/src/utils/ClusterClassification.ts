export type EvaluationPoint = string;

export interface ClassificationCriteria {
  id: string;
  title: string;
  imgSrc: string; // Using 'any' for image require statement, could be more specific
  evaluationPoints: EvaluationPoint[];
}

// Array containing the harvest criteria information
export const ExternalClassificationListData: ClassificationCriteria[] = [
  {
    id: "C1",
    title: "Clase 1",
    imgSrc: require("@/assets/images/onboard/cluster-classification/clase1.webp"),
    evaluationPoints: [
      "Es un racimo que presenta un porcentaje de formación entre el 90% y el 100%, como resultado de una adecuada aplicación de ANA.",
    ],
  },
  {
    id: "C2",
    title: "Clase 2",
    imgSrc: require("@/assets/images/onboard/cluster-classification/clase2.webp"),
    evaluationPoints: [
      "Es un racimo que presenta un porcentaje de formación entre el 70% y el 89%, generalmente asociado a una aplicación aceptable de ANA.",
    ],
  },
  {
    id: "C3",
    title: "Clase 3",
    imgSrc: require("@/assets/images/onboard/cluster-classification/clase3.webp"),
    evaluationPoints: [
      "Es un racimo que presenta un porcentaje de formación entre el 50% y el 69%, usualmente relacionado con una aplicación deficiente de ANA.",
    ],
  },
  {
    id: "C4",
    title: "Clase 4",
    imgSrc: require("@/assets/images/onboard/cluster-classification/clase4.webp"),
    evaluationPoints: [
      "Es un racimo que presenta un porcentaje de formación inferior al 50%, habitualmente asociado a una aplicación muy deficiente o ausencia de ANA.",
    ],
  },
];

export const InternalClassificationListData: ClassificationCriteria[] = [
  {
    id: "TA",
    title: "Tipo A",
    imgSrc: require("@/assets/images/onboard/cluster-classification/tipoa.webp"),
    evaluationPoints: [
      "Al espigar hasta un 10% desde la base, se observa el inicio del efecto del ANA: transición de frutos abortados a partenocárpicos. Tiene entre 90% y 100% de formación interna.",
    ],
  },
  {
    id: "TB",
    title: "Tipo B",
    imgSrc: require("@/assets/images/onboard/cluster-classification/tipob.webp"),
    evaluationPoints: [
      "Al espigar entre el 11% y 30% desde la base, se observa el efecto del ANA con transición de frutos abortados a partenocárpicos. Tiene entre 70% y 89% de formación interna.",
    ],
  },
  {
    id: "TC",
    title: "Tipo C",
    imgSrc: require("@/assets/images/onboard/cluster-classification/tipoc.webp"),
    evaluationPoints: [
      "Al espigar entre el 31% y 50% desde la base, se evidencia el inicio del efecto del ANA, con transición de frutos abortados a partenocárpicos. Tiene entre 50% y 69% de formación interna.",
    ],
  },
  {
    id: "TD",
    title: "Tipo D",
    imgSrc: require("@/assets/images/onboard/cluster-classification/tipod.webp"),
    evaluationPoints: [
      "Al espigar desde la base a una profundidad mayor al 51%, se observa el inicio del efecto del ANA con transformación de frutos abortados a partenocárpicos. Tiene menos del 50% de formación interna.",
    ],
  },
];
