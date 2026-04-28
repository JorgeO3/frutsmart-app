import * as Location from "expo-location";
import * as Network from "expo-network";
import { Alert, Linking, Platform } from "react-native";

import type { Metadata } from "@stores/plantWork";

const nowIso = () => new Date().toISOString();

const isDay = (): "day" | "night" => {
  const h = new Date().getHours();
  return h >= 6 && h < 18 ? "day" : "night";
};

const LOCATION_TIMEOUT_MS = 20_000;

function getErrorKey(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("location-timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function ensureLocationServicesEnabled() {
  const provider = await Location.getProviderStatusAsync();

  if (provider.locationServicesEnabled) {
    return;
  }

  if (Platform.OS === "android") {
    try {
      await Location.enableNetworkProviderAsync();
    } catch {
      throw new Error("location-services-disabled");
    }

    const providerAfterPrompt = await Location.getProviderStatusAsync();
    if (!providerAfterPrompt.locationServicesEnabled) {
      throw new Error("location-services-disabled");
    }

    return;
  }

  throw new Error("location-services-disabled");
}

async function ensureForegroundPermission() {
  let permission = await Location.getForegroundPermissionsAsync();

  if (!permission.granted) {
    permission = await Location.requestForegroundPermissionsAsync();
  }

  if (permission.granted) {
    return;
  }

  const msg = permission.canAskAgain
    ? "Se necesita permiso de ubicación para continuar."
    : "La app no tiene permiso de ubicación. Habilítalo en Ajustes.";

  if (!permission.canAskAgain) {
    Alert.alert("Permiso de ubicación", msg, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Abrir Ajustes",
        onPress: () => {
          void Linking.openSettings();
        },
      },
    ]);
  } else {
    Alert.alert("Permiso de ubicación", msg);
  }

  throw new Error("location-permission-denied");
}

async function safeGetLocation() {
  await ensureLocationServicesEnabled();
  await ensureForegroundPermission();

  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: 120_000,
    requiredAccuracy: 100,
  });

  if (lastKnown) {
    return lastKnown;
  }

  const currentPositionPromise = Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
    mayShowUserSettingsDialog: true,
  });

  return await withTimeout(currentPositionPromise, LOCATION_TIMEOUT_MS);
}

async function readNetworkOnceSafe() {
  try {
    const state = await Network.getNetworkStateAsync();
    const hasInternet = state.isInternetReachable ?? state.isConnected ?? false;

    return {
      state,
      hasInternet: Boolean(hasInternet),
    };
  } catch {
    return {
      state: null,
      hasInternet: false,
    };
  }
}

export const processSessionMetadata = async ({
  setMetadata,
  onOk,
  onError,
}: {
  setMetadata: (m: Metadata) => void;
  onOk: () => void;
  onError?: (e: unknown) => void;
}) => {
  try {
    const [location, net] = await Promise.all([
      safeGetLocation(),
      readNetworkOnceSafe(),
    ]);

    const metadata: Metadata = {
      creationTimestamp: nowIso(),
      device: {
        timeOfDay: isDay(),
        weather: "Despejado", // TODO: integrar API
        hasInternet: net.hasInternet,
      },
      geolocation: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      },
    };

    setMetadata(metadata);
    onOk();
  } catch (error: unknown) {
    const key = getErrorKey(error);

    const messages: Record<string, string> = {
      "location-permission-denied":
        "No podemos continuar sin permiso de ubicación.",
      "location-timeout":
        "No pudimos obtener tu ubicación a tiempo. Intenta activar la ubicación del emulador, fijar una localización manualmente o moverte a un área con mejor señal.",
      "location-services-disabled":
        "Los servicios de ubicación están apagados. Actívalos para continuar.",
    };

    const message =
      messages[key] ??
      "Ocurrió un error inesperado. Por favor, inténtalo de nuevo.";

    Alert.alert("Error", message);
    onError?.(error);
    throw error;
  }
};