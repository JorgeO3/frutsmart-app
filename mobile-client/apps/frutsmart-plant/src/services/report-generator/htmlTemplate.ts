import type { ReportAssets } from "./types";
import { escapeHtml } from "./utils";

export function createDocumentShell(
  reportBodyHtml: string,
  assets: ReportAssets,
  headerData: { date: string; time: string; location: string },
): string {
  return `<!DOCTYPE html>
  <html lang="es">
  
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Informe FrutSmart - ${headerData.date}</title>
    <link rel="stylesheet" href="${assets.styles}">
  </head>
  
  <body>
    <div class="pdf-document">
      <div class="page-content">
  
        <header class="pdf-header flex items-center justify-between mb-3">
          <div class="logo-container flex items-center">
            <img src="${assets.logo}" alt="Logo FrutSmart">
            <div class="logo-title flex flex-col">
              <h1>FrutSmart</h1>
              <small>Tecnología que Cultiva el futuro</small>
            </div>
          </div>
          <div class="pdf-header__text">
            <p>${escapeHtml(headerData.date)} ${escapeHtml(headerData.location)}</p>
            <p>${escapeHtml(headerData.time)}</p>
          </div>
        </header>
    
        <main class="pdf-content">
          ${reportBodyHtml}
        </main>
      </div>
    </div>
  </body>
  </html>
  `;
}
