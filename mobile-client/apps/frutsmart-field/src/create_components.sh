#!/usr/bin/env bash
# create_components.sh
# Crea bajo components/ la misma estructura de carpetas que src/app/, omitiendo las que ya existan.

set -euo pipefail

# Directorio base donde crear los componentes
BASE_DIR="components"

# Lista de rutas (relativas a BASE_DIR) a crear
DIRS=(
  "account-blocked"
  "account-deleted"
  "auth/_layout"
  "auth/login"
  "auth/profile-selection"
  "auth/welcome"
  "field-work/_layout"
  "field-work/home"
  "field-work/summary-records"
  "field-work/index"
  "field-work/harvest-criteria"
  "field-work/(work-flow)/cluster-summary"
  "field-work/(work-flow)/confirm-center"
  "field-work/(work-flow)/confirm-lot"
  "field-work/(work-flow)/end"
  "field-work/(work-flow)/(external)/classification-intro"
  "field-work/(work-flow)/(external)/classification-result"
  "field-work/(work-flow)/(external)/classification-review"
  "field-work/(work-flow)/(external)/classification"
  "field-work/(work-flow)/(external)/classification-tutorial"
  "field-work/(work-flow)/(external)/detection"
  "field-work/(work-flow)/(external)/overview"
  "field-work/(work-flow)/(external)/picture"
  "field-work/(work-flow)/(external)/preview"
  "field-work/(work-flow)/(external)/steps"
  "field-work/(work-flow)/(external)/tutorial"
  "field-work/(work-flow)/(internal)/classification-intro"
  "field-work/(work-flow)/(internal)/classification-result"
  "field-work/(work-flow)/(internal)/classification-review"
  "field-work/(work-flow)/(internal)/classification"
  "field-work/(work-flow)/(internal)/classification-tutorial"
  "field-work/(work-flow)/(internal)/detection"
  "field-work/(work-flow)/(internal)/overview"
  "field-work/(work-flow)/(internal)/picture"
  "field-work/(work-flow)/(internal)/preview"
  "field-work/(work-flow)/(internal)/steps"
  "field-work/(work-flow)/(internal)/tutorial"
  "index"
  "_layout"
  "+not-found"
  "onboard/_layout"
  "onboard/index"
  "onboard/introduction"
  "onboard/harvest-criteria"
  "onboard/internal-formation"
  "onboard/classification-classes"
  "ui"
)

# Crear cada directorio
for dir in "${DIRS[@]}"; do
  mkdir -p "${BASE_DIR}/${dir}"
done

echo "Estructura de components/ creada o ya existente."
