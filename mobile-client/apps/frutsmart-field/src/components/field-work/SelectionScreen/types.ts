export type Item = {
  id: string;
  label: string;
};

export type TabType = "lote" | "centro";

export interface SelectionProps {
  onContinue: (ids: string[]) => void;
}

export type FormValues = {
  selectedItems: string[];
};
