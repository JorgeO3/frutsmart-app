import type React from "react";

import type { Column } from "@components/ResultsTable/types";

import BaseTable from "@components/ResultsTable/ResultsTable";

// TODO: Importar el icono de uvas rojas
const RedGrapesIcon = <></>;

const columns: Column[] = [
  { key: "clase", label: "Clase" },
  { key: "cantidad", label: "Cantidad de Racimos" },
];

const data = [
  { clase: 1, cantidad: 50 },
  { clase: 2, cantidad: 30 },
  // ...
];

export const ExternalClassificationTable: React.FC = () => (
  <BaseTable
    title="Resumen clasificación externa"
    columns={columns}
    data={data}
    totalKey="cantidad"
    colors={{ primary: "#227c26", secondary: "#92b516" }}
    IconPlaceholder={RedGrapesIcon}
  />
);
