import type React from "react";

import type { Column } from "@components/ResultsTable/types";

import BaseTable from "@components/ResultsTable/ResultsTable";

// TODO: Importar el icono de racimo
const ClusterIcon = <></>;

const columns: Column[] = [
  { key: "criterio", label: "Criterio" },
  { key: "cantidad", label: "Cantidad de Racimos" },
];

const data = [
  { criterio: 1, cantidad: 20 },
  { criterio: 2, cantidad: 15 },
  // ...
];

export const HarvestCriteriaTable = () => (
  <BaseTable
    title="Resumen Criterios de cosecha"
    columns={columns}
    data={data}
    totalKey="cantidad"
    colors={{ primary: "#227c26", secondary: "#92b516" }}
    IconPlaceholder={ClusterIcon}
  />
);
