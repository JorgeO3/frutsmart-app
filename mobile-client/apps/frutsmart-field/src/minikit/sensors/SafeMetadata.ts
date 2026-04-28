import * as Location from "expo-location";
import * as Network from "expo-network";

const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T) =>
  Promise.race([
    p,
    new Promise<T>((res) => setTimeout(() => res(fallback), ms)),
  ]);

export async function collectMetadata() {
  const [perm] = await Location.requestForegroundPermissionsAsync();
  const hasLoc = perm.status === "granted";

  const [loc, net] = await Promise.all([
    hasLoc
      ? withTimeout(
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          2500,
          { coords: { latitude: 0, longitude: 0 } } as any,
        )
      : { coords: { latitude: 0, longitude: 0 } },
    withTimeout(Network.getNetworkStateAsync(), 1500, {
      isInternetReachable: null,
    } as any),
  ]);

  return {
    creationTimestamp: new Date().toISOString(),
    device: {
      timeOfDay: ((h) => (h >= 6 && h < 18 ? "day" : "night"))(
        new Date().getHours(),
      ),
      weather: "Despejado",
      hasInternet: Boolean((net as any)?.isInternetReachable),
    },
    geolocation: {
      latitude: Number((loc as any)?.coords?.latitude ?? 0),
      longitude: Number((loc as any)?.coords?.longitude ?? 0),
    },
  };
}
