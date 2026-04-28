import type { Item, TabType } from "../types/selection";

export const LOTE_ITEMS: Item[] = [
  { id: "IS01", label: "IS01" },
  { id: "IS02", label: "IS02" },
  { id: "IT01", label: "IT01" },
  { id: "IT02", label: "IT02" },
  { id: "IT03", label: "IT03" },
  { id: "IT04", label: "IT04" },
  { id: "IT05", label: "IT05" },
  { id: "IT06", label: "IT06" },
  { id: "IT07", label: "IT07" },
  { id: "IT08", label: "IT08" },
  { id: "IT09", label: "IT09" },
  { id: "IT10", label: "IT10" },
  { id: "IT11", label: "IT11" },
  { id: "IT12", label: "IT12" },
  { id: "IT13", label: "IT13" },
  { id: "IT14", label: "IT14" },
  { id: "IT15", label: "IT15" },
];

export const CENTRO_ITEMS: Item[] = [
  { id: "C01", label: "C01" },
  { id: "C02", label: "C02" },
  { id: "C03", label: "C03" },
  { id: "C04", label: "C04" },
  { id: "C05", label: "C05" },
  { id: "C06", label: "C06" },
  { id: "C07", label: "C07" },
  { id: "C08", label: "C08" },
  { id: "C09", label: "C09" },
  { id: "C10", label: "C10" },
  { id: "C11", label: "C11" },
  { id: "C12", label: "C12" },
  { id: "C13", label: "C13" },
  { id: "C14", label: "C14" },
  { id: "C15", label: "C15" },
];

export async function fetchItems(
  tab: TabType,
  filter: string,
): Promise<Item[]> {
  const source = tab === "lote" ? LOTE_ITEMS : CENTRO_ITEMS;

  // Simulando tiempo de carga
  await new Promise((r) => setTimeout(r, 300));

  return filter
    ? source.filter((it) =>
        it.label.toLowerCase().includes(filter.toLowerCase()),
      )
    : source;
}
