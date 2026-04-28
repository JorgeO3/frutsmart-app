import type { ReportData, TableVariant } from "../../types";
import { escapeHtml } from "../../utils";

/**
 * Helper genérico para crear una tabla de resumen con soporte para variantes de estilo.
 */
function createSummaryTable(
  data: Record<string, number | null>,
  headers: [string, string],
  variant: TableVariant,
): string {
  const summaryArray = Object.entries(data).map(([key, value]) => ({
    key,
    count: value ?? 0,
  }));

  const total = summaryArray.reduce((sum, item) => sum + item.count, 0);

  const rows = summaryArray
    .map(
      ({ key, count }) =>
        `<tr><td>${escapeHtml(key.replace("Clase ", "").toUpperCase())}</td><td>${count}</td></tr>`,
    )
    .join("");

  const totalRow = `<tr class="row-total font-bold"><td>Total</td><td>${total}</td></tr>`;

  return `
    <table class="table" data-variant="${variant}">
      <thead><tr><th>${headers[0]}</th><th>${headers[1]}</th></tr></thead>
      <tbody>${rows}${totalRow}</tbody>
    </table>
  `;
}

/**
 * Crea la sección principal que contiene la tabla de totales.
 */
export function createTotalSummarySection(
  title: string,
  data: Record<string, number | null>,
  headers: [string, string],
  variant: TableVariant,
): string {
  const tableHtml = createSummaryTable(data, headers, variant);

  return `
    <article class="content-section mb-5">
      <h3 class="text-accent">${escapeHtml(title)}</h3>
      <div class="content-section__body">${tableHtml}</div>
    </article>
  `;
}

/**
 * Crea la sección con las 3 tablas de resumen, aplicando diferentes variantes de estilo.
 */
export function createSummariesSection(
  external: Record<string, number>,
  internal: Record<string, number>,
  criteria: Record<string, number | null>,
): string {
  const sections = [
    {
      title: "Resumen Clasificación Externa",
      data: external,
      headers: ["Clase", "Cantidad"] as [string, string],
      variant: "primary" as TableVariant,
    },
    {
      title: "Resumen Clasificación Interna",
      data: internal,
      headers: ["Tipo", "Cantidad"] as [string, string],
      variant: "primary" as TableVariant,
    },
    {
      title: "Resumen Criterios de Cosecha",
      data: criteria,
      headers: ["Criterio", "Cantidad"] as [string, string],
      variant: "quaternary" as TableVariant,
    },
  ];

  return sections
    .map(({ title, data, headers, variant }) =>
      createTotalSummarySection(title, data, headers, variant),
    )
    .join("");
}

/**
 * Crea una tabla de detalles con concepto, valor y observaciones.
 */
function createDetailsTable(
  details: { concept: string; value: string; observations: string }[],
): string {
  const rows = details
    .map(
      ({ concept, value, observations }) => `
      <tr>
        <td class="col-concept">${escapeHtml(concept)}</td>
        <td class="col-value">${escapeHtml(value)}</td>
        <td class="col-obs">${escapeHtml(observations)}</td>
      </tr>
    `,
    )
    .join("");

  return `
    <table class="table" data-variant="details">
      <thead>
        <tr>
          <th>Concepto</th>
          <th>Valor</th>
          <th>Observaciones</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/**
 * Crea un elemento de foto en la grilla con su estatus correspondiente.
 */
function createPhotoGridItem(
  uri: string | null,
  alt: string,
  statusClass: string,
  statusText?: string,
): string {
  const imageContent = uri
    ? `<img src="${uri}" alt="${alt}">`
    : '<div class="no-photo"><p>N/A</p></div>';

  const statusLabel = statusText
    ? `
      <div class="flex items-center gap-1">
        <div class="status-dot ${statusClass} mr-1"></div>
        <small class="text-xss text-${statusClass.replace("bg-", "")} font-semibold leading-none">${statusText}</small>
      </div>
    `
    : "";

  return `
    <div class="photo-grid__item">
      <div class="photo-grid__img-container relative">
        ${imageContent}
        <div class="status-dot ${statusClass} absolute"></div>
      </div>
      ${statusLabel}
    </div>
  `;
}

/**
 * Crea la sección de iteraciones (lanzamientos) con sus respectivas fotografías.
 */
function createIterationsSection(iterations: ReportData["iterations"]): string {
  return iterations
    .map((iter) => {
      const internalPhoto = iter.internal_photo_uri
        ? createPhotoGridItem(
            iter.internal_photo_uri,
            `Foto Interna ${iter.iteration_index + 1}`,
            "bg-dark-green",
            "Fotografía interna",
          )
        : "";

      const externalPhotos = iter.external_photo_uris
        .map((uri, index) =>
          createPhotoGridItem(
            uri,
            `Segmento ${index + 1}`,
            "bg-accent",
            index === 0 ? "Fotografías externas" : undefined,
          ),
        )
        .join("");

      return `
        <article class="content-section mt-5">
          <h2>Lanzamiento ${iter.iteration_index + 1}</h2>
          <div class="photo-grid">
            ${internalPhoto}
            ${externalPhotos}
          </div>
        </article>
      `;
    })
    .join("");
}

/**
 * Construye los datos de la tabla de detalles basado en el tipo de proveedor.
 */
function buildDetailsData(
  reportData: ReportData,
): { concept: string; value: string; observations: string }[] {
  const details = [
    {
      concept: "Procedencia",
      value:
        reportData.provider === "own" ? "Fruto Propio" : "Compra a Terceros",
      observations: "",
    },
  ];

  if (reportData.provider === "own" && reportData.program) {
    details.push(
      {
        concept: "Programa",
        value: reportData.program.name,
        observations: "",
      },
      {
        concept: "Lotes",
        value: reportData.lots.map((l) => l.name).join(", "),
        observations: "",
      },
    );
  } else {
    details.push(
      {
        concept: "Proveedor",
        value: reportData.vendor ?? "N/A",
        observations: "",
      },
      {
        concept: "Subproveedor",
        value: reportData.sub_vendor ?? "N/A",
        observations: "",
      },
    );
  }

  details.push(
    {
      concept: "Placa Vehículo",
      value: reportData.truck_plate,
      observations: "",
    },
    {
      concept: "Consecutivo",
      value: reportData.consecutive_number,
      observations: "",
    },
  );

  return details;
}

/**
 * Crea la sección de detalles del lote incluyendo iteraciones.
 */
export function createBunchDetailsSection(reportData: ReportData): string {
  const detailsData = buildDetailsData(reportData);
  const detailsTableHtml = createDetailsTable(detailsData);
  const iterationsSection = createIterationsSection(reportData.iterations);

  return `
    <article class="content-section">
      ${detailsTableHtml}
    </article>
    ${iterationsSection}
  `;
}
