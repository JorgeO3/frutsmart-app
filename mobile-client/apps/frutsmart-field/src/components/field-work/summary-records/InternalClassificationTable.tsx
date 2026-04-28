import type React from "react";

import type { Column } from "@components/ResultsTable/types";

import BaseTable from "@components/ResultsTable/ResultsTable";

// TODO: Importar el icono de racimo blanco
const WhiteClusterIcon = <></>;

const columns: Column[] = [
  { key: "tipo", label: "Tipo" },
  { key: "cantidad", label: "Cantidad de Racimos" },
];

const data = [
  { tipo: 1, cantidad: 40 },
  { tipo: 2, cantidad: 25 },
  // ...
];

export const InternalClassificationTable: React.FC = () => (
  <BaseTable
    title="Resumen clasificación interna"
    columns={columns}
    data={data}
    totalKey="cantidad"
    colors={{ primary: "#e94e1a", secondary: "#f27c00" }}
    IconPlaceholder={WhiteClusterIcon}
  />
);
