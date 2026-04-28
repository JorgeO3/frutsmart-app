import { Paths } from "expo-file-system/next";

import { escapeHtml } from "../../utils";
import type {
  BunchDetail,
  ClassificationSummary,
  DetailRow,
  HarvestCriteriaSummary,
  LotClassificationSummary,
  LotHarvestSummary,
  Photo,
} from "../../types";
import type { TableVariant } from "../../types"; // Asumiendo que TableVariant es un tipo compartido.

/**
 * Crea una tabla de resumen (sirve para clasificación y criterios).
 */
function createSummaryTable(
  summary: (ClassificationSummary | HarvestCriteriaSummary)[],
  headers: [string, string],
  variant: TableVariant,
): string {
  const total = summary.reduce((sum, item) => sum + item.count, 0);

  const rows = summary
    .map((item) => {
      const label = "className" in item ? item.className : item.criterion;
      return `<tr><td>${escapeHtml(label)}</td><td>${item.count.toString()}</td></tr>`;
    })
    .join("");

  const totalRow = `<tr class="row-total"><td>Total</td><td>${total.toString()}</td></tr>`;

  return `
    <table class="table" data-variant="${variant}">
      <thead><tr><th>${headers[0]}</th><th>${headers[1]}</th></tr></thead>
      <tbody>${rows}${totalRow}</tbody>
    </table>
  `;
}

/**
 * Crea una sección completa para un lote, incluyendo su gráfico y tabla.
 */
export function createLotSummarySection(
  lot: LotClassificationSummary | LotHarvestSummary,
  type: "classification" | "harvest",
  variant: TableVariant,
): string {
  const title = `Resumen Racimos Lote ${escapeHtml(lot.lotName)}`;
  const headers: [string, string] =
    type === "classification"
      ? ["Clase", `Cant. Racimos Lote ${escapeHtml(lot.lotName)}`]
      : ["Criterio", `Cant. Racimos Lote ${escapeHtml(lot.lotName)}`];

  const tableHtml = createSummaryTable(lot.summary, headers, variant);

  return `
    <article class="content-section mb-5">
      <h3 class="text-accent">${title}</h3>
      <div class="grid-cols-2">
        <div class="chart-container">
          <img 
            src="${lot.chartImageUri}"
            style="width: 300px; height: 240px;"
            alt="Gráfico para ${escapeHtml(lot.lotName)}">
        </div>
        <div>${tableHtml}</div>
      </div>
    </article>
  `;
}

/**
 * Crea la sección principal que contiene la tabla de totales.
 */
export function createTotalSummarySection(
  summary: (ClassificationSummary | HarvestCriteriaSummary)[],
  title: string,
  headers: [string, string],
  variant: TableVariant,
): string {
  const tableHtml = createSummaryTable(summary, headers, variant);
  return `
    <article class="content-section mb-5">
      <h3 class="text-accent">${escapeHtml(title)}</h3>
      <div class="content-section__body">${tableHtml}</div>
    </article>
  `;
}

/**
 * Crea la grilla de fotos para un racimo
 */
function createPhotoGrid(
  externalPhotos: Photo[],
  internalPhotos: Photo[],
): string {
  let photoItems = "";

  // Fotos externas
  externalPhotos.forEach(({ uri }, index) => {
    const label =
      index === 0
        ? `
          <div class="flex items-center gap-1">
            <div class="status-dot bg-accent mr-1"></div>
            <small class="text-xss text-accent font-semibold leading-none">Fotografías externas del racimo</small>
          </div>`
        : "";

    photoItems += `
      <div class="photo-grid__item">
        <div class="photo-grid__img-container relative">
        <img 
          src="${uri}"
          style="width: 100%; height: 100%; object-fit: cover; aspect-ratio: 1/1;"
          alt="Foto externa ${index + 1}">
        <div class="status-dot bg-accent absolute"></div>
        </div>
        ${label}
      </div>`;
  });

  // Fotos internas
  internalPhotos.forEach(({ uri }, index) => {
    const imageSrc = uri || `${Paths.cache}images/TipoA.webp`;

    const label =
      index === 0
        ? `
          <div class="flex items-center gap-1">
            <div class="status-dot bg-dark-green mr-1"></div>
            <small class="text-xss text-dark-green font-semibold leading-none">Fotografías internas del racimo</small>
          </div>`
        : "";

    photoItems += `
      <div class="photo-grid__item">
        <div class="photo-grid__img-container relative">
        <img 
          src="${imageSrc}"
          style="width: 100%; height: 100%; object-fit: cover; aspect-ratio: 1/1;"
          alt="Foto interna ${index + 1}">
        <div class="status-dot bg-dark-green absolute"></div>
        </div>
        ${label}
      </div>`;
  });

  return `<div class="photo-grid mb-4">${photoItems}</div>`;
}

/**
 * Crea la tabla de detalles de un racimo
 */
function createDetailsTable(details: DetailRow[]): string {
  const rows = details
    .map(
      (detail) => `
          <tr>
            <td class="col-concept">${escapeHtml(detail.concept)}</td>
            <td class="col-value">${escapeHtml(detail.value)}</td>
            <td class="col-obs">${escapeHtml(detail.observations)}</td>
          </tr>`,
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
 * Crea una sección de detalle de racimo
 */
export function createBunchDetailSection(bunch: BunchDetail): string {
  const photoGrid = createPhotoGrid(bunch.externalPhotos, bunch.internalPhotos);
  const detailsTable = createDetailsTable(bunch.details);

  return `
        <article class="content-section">
          <h2>Racimo ${bunch.bunchNumber}</h2>
          ${photoGrid}
          ${detailsTable}
        </article>
  `;
}
