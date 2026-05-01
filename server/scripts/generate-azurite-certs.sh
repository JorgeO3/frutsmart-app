#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CERT_DIR="${SERVER_DIR}/docker/azurite-certs"
AZURITE_CERT="${CERT_DIR}/azurite.pem"
AZURITE_KEY="${CERT_DIR}/azurite.key"
ROOT_CA="${CERT_DIR}/rootCA.pem"

LAN_IP="${1:-}"

if [[ -z "${LAN_IP}" ]]; then
  LAN_IP="$(hostname -I | awk '{print $1}')"
fi

if [[ -z "${LAN_IP}" ]]; then
  echo "Could not detect LAN IP. Pass it explicitly:"
  echo "  scripts/generate-azurite-certs.sh 192.168.x.x"
  exit 1
fi

mkdir -p "${CERT_DIR}"

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert is required. Install it first: https://github.com/FiloSottile/mkcert"
  exit 1
fi

echo "Installing local CA (if missing)..."
mkcert -install

CAROOT="$(mkcert -CAROOT)"
if [[ ! -f "${CAROOT}/rootCA.pem" ]]; then
  echo "mkcert root CA not found at ${CAROOT}/rootCA.pem"
  exit 1
fi

cp "${CAROOT}/rootCA.pem" "${ROOT_CA}"

echo "Generating Azurite cert for localhost, 127.0.0.1 and ${LAN_IP}..."
mkcert \
  -cert-file "${AZURITE_CERT}" \
  -key-file "${AZURITE_KEY}" \
  localhost 127.0.0.1 "${LAN_IP}"

chmod 600 "${AZURITE_KEY}"

echo "Done. Generated:"
echo "- ${AZURITE_CERT}"
echo "- ${AZURITE_KEY}"
echo "- ${ROOT_CA}"
echo
echo "Android root install helper:"
echo "1) HASH=\$(openssl x509 -inform PEM -subject_hash_old -in ${ROOT_CA} | head -1)"
echo "2) cp ${ROOT_CA} \"\${HASH}.0\""
echo "3) adb root && adb remount"
echo "4) adb push \"\${HASH}.0\" /system/etc/security/cacerts/\"\${HASH}.0\""
echo "5) adb shell chmod 644 /system/etc/security/cacerts/\"\${HASH}.0\""
echo "6) adb shell chown root:root /system/etc/security/cacerts/\"\${HASH}.0\""
echo "7) adb reboot"
