export type EvaluationPoint = string;

export interface HarvestCriteria {
  id: string;
  title: string;
  imgSrc: string; // Using 'any' for image require statement, could be more specific
  evaluationPoints: EvaluationPoint[];
}

// Array containing the harvest criteria information
export const HarvestCriteriaListData: HarvestCriteria[] = [
  {
    id: "rb",
    title: "RB: Racimo Bueno",
    imgSrc: require("@/assets/images/onboard/harvest-criteria/mature_cluster.webp"),
    evaluationPoints: [
      "Racimo en su punto ideal de cosecha. Su color va del rojizo al naranja, con pulpa naranja intenso y jugosa. Presenta frutos cuarteados y algunos se desprenden naturalmente.",
    ],
  },
  {
    id: "rv",
    title: "RV: Racimo Verde",
    imgSrc: require("@/assets/images/onboard/harvest-criteria/non_mature_cluster.webp"),
    evaluationPoints: [
      "Racimo en etapa inicial de maduración. Su color va del rojizo al naranja brillante, con pulpa naranja pálido. No tiene frutos sueltos ni cuarteados.",
    ],
  },
  {
    id: "rsm",
    title: "RSM: Racimo Sobre Maduro",
    imgSrc: require("@/assets/images/onboard/harvest-criteria/over_mature_cluster.webp"),
    evaluationPoints: [
      "Ha pasado su punto óptimo de madurez. Más del 50% de sus frutos se han desprendido naturalmente. Su color es rojo oscuro o naranja intenso.",
    ],
  },
  {
    id: "rpl",
    title: "RPL: Racimo Pedúnculo Largo",
    imgSrc: require("@/assets/images/onboard/harvest-criteria/long_peduncle_cluster.webp"),
    evaluationPoints: [
      "Son aquellos racimos cuyo pedúnculo sobresale por el cuello del racimo más de 5 centímetros.",
    ],
  },
  {
    id: "rmf",
    title: "RMF: Racimo Mal Formado",
    imgSrc: require("@/assets/images/onboard/harvest-criteria/mal_formed_cluster.webp"),
    evaluationPoints: [
      "Tiene más del 50% de frutos y raquilas secas, desde el ápice o la base. Sin brillo, con frutos inmaduros que tienden a desprenderse.",
    ],
  },
  {
    id: "rp",
    title: "RP: Racimo Pasado",
    imgSrc: require("@/assets/images/onboard/harvest-criteria/rotting_cluster.webp"),
    evaluationPoints: [
      "Racimo en descomposición por no ser cosechado a tiempo. Tiene color café oscuro, olor fétido y ha perdido más del 90% de sus frutos. No está ligado a enfermedades específicas.",
    ],
  },
  {
    id: "bp",
    title: "VAC: Racimo Vacío",
    imgSrc: require("@/assets/images/onboard/harvest-criteria/empty_cluster.webp"),
    evaluationPoints: [
      "Es aquel racimo que ha perdido la totalidad de sus frutos debido a que no fue cortado en su estado óptimo de madurez.",
    ],
  },
];
