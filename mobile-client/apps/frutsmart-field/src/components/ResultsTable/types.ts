export interface Column {
  key: string;
  label: string;
}

export interface Colors {
  primary: string;
  secondary: string;
}

export interface ResultsTableProps {
  title: string;
  columns: Column[]; // Debe tener exactamente 2 elementos
  data: Array<Record<string, number>>;
  totalKey: string;
  colors: Colors;
  IconPlaceholder?: React.ReactNode;
}
