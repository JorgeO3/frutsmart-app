import { Paths } from "expo-file-system";

import { escapeHtml } from "../../utils";
import type { BunchDetail, Photo } from "./types";

function createDetailsTable(details: BunchDetail["details"]): string {
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
          <tbody>
            ${rows}
          </tbody>
        </table>
  `;
}

function createPhotoGrid(
  externalPhotos: Photo[],
  internalPhotos: Photo[],
): string {
  const photoItems: string[] = [];

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
    photoItems.push(`
      <div class="photo-grid__item">
        <div class="photo-grid__img-container relative">
        <img 
          src="${uri}"
          style="width: 100%; height: 100%; object-fit: cover; aspect-ratio: 1/1;"
          alt="Foto externa ${index + 1}">
        <div class="status-dot bg-accent absolute"></div>
        </div>
        ${label}
      </div>`);
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
    photoItems.push(`
      <div class="photo-grid__item">
        <div class="photo-grid__img-container relative">
        <img 
          src="${imageSrc}"
          style="width: 100%; height: 100%; object-fit: cover; aspect-ratio: 1/1;"
          alt="Foto interna ${index + 1}">
        <div class="status-dot bg-dark-green absolute"></div>
        </div>
        ${label}
      </div>`);
  });

  return `<div class="photo-grid mb-4">${photoItems.join("")}</div>`;
}

// La función principal que construye toda la sección de detalle
export function createSingleBunchDetailSection(bunch: BunchDetail): string {
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
