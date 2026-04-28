const { getDefaultConfig } = require("@expo/metro-config");
const path = require("node:path");

const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

module.exports = (() => {
  // Carga la configuración base de Expo
  const config = getSentryExpoConfig(__dirname);

  // Personaliza las extensiones de assets y define tu alias
  config.resolver = {
    ...config.resolver,
    assetExts: [
      ...config.resolver.assetExts,
      "db",
      "sql",
      "tflite",
      "json",
      "b64",
      "css",
      "txt",
      "woff2",
    ],
    alias: {
      "@": path.resolve(__dirname),
    },
  };

  return config;
})();