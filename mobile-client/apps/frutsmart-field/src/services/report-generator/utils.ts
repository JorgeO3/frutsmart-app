/**
 * Wrapper para manejo de errores con patrón de tupla
 * Convierte promesas en tuplas [error, data] para un manejo más limpio
 */
export function catchError<T>(
  promise: Promise<T>,
): Promise<[undefined, T] | [Error]> {
  return promise
    .then((data) => {
      return [undefined, data] as [undefined, T];
    })
    .catch((error) => {
      return [error];
    });
}

/**
 * Formatea una fecha ISO a formato legible
 * @param isoDate - Fecha en formato ISO string o objeto Date
 * @returns Fecha formateada como "DD/MM/YYYY"
 */
export function formatDate(isoDate: string | Date): string {
  const date = isoDate instanceof Date ? isoDate : new Date(isoDate);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formatea una hora ISO a formato legible
 * @param isoDate - Fecha/hora en formato ISO string o objeto Date
 * @returns Hora formateada como "HH:MM AM/PM GTM-5"
 */
export function formatTime(isoDate: string | Date): string {
  const date = isoDate instanceof Date ? isoDate : new Date(isoDate);
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // El 0 debe ser 12
  return `${hours}:${minutes} ${ampm} GTM-5`;
}

/**
 * Agrupa un array por una propiedad específica
 * @param array - Array a agrupar
 * @param key - Clave por la cual agrupar
 * @returns Objeto con los elementos agrupados
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce(
    (groups, item) => {
      const groupKey = String(item[key]);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    },
    {} as Record<string, T[]>,
  );
}

/**
 * Escapa caracteres HTML para prevenir XSS
 * @param text - Texto a escapar
 * @returns Texto con caracteres HTML escapados
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Lee un archivo y lo convierte a Base64
 * @param filePath - Ruta del archivo
 * @returns String Base64 del archivo
 */
export async function fileToBase64(filePath: string): Promise<string> {
  // try {
  //   const fileData = await Deno.readFile(filePath);
  //   return btoa(String.fromCharCode(...fileData));
  // } catch (error) {
  //   const e = error instanceof Deno.errors.NotFound
  //     ? new Error(`File not found: ${filePath}`)
  //     : error instanceof Error
  //       ? error
  //       : new Error(String(error));
  //   console.error(e.message);
  //   throw new Error(`Error reading file ${filePath}: ${e.message}`);
  // }
  return "";
}

/**
 * Genera un placeholder para gráficos (temporal)
 * @returns String Base64 de un SVG placeholder
 */
export function generateChartPlaceholder(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="#f3f4f6"/>
    <text x="100" y="100" text-anchor="middle" fill="#9ca3af" font-family="sans-serif" font-size="14">
      Gráfico
    </text>
  </svg>`;
  return btoa(svg);
}