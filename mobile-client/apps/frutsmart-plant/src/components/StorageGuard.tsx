import { useEffect } from "react";
import { Alert } from "react-native";

import * as FileSystem from "expo-file-system/legacy";
import { type Href, usePathname, useRouter } from "expo-router";

import {
  INFERENCE_BUDGET,
  LOGIN_SYNC_BUDGET,
  PDF_GENERATION_BUDGET,
  PHOTO_CAPTURE_BUDGET,
} from "@src/constants/spaceBudgets";
import { openStorageManagement } from "@utils/openStorageManagement";
import { ensureSpace } from "@utils/storage";

const routeBudgets = {
  "/auth/login": LOGIN_SYNC_BUDGET,
  "/plant-work/work-flow/external/picture": PHOTO_CAPTURE_BUDGET,
  "/plant-work/work-flow/internal/picture": PHOTO_CAPTURE_BUDGET,
  "/plant-work/work-flow/external/detection": INFERENCE_BUDGET,
  "/plant-work/work-flow/internal/detection": INFERENCE_BUDGET,
  "/plant-work/work-flow/report-generation": PDF_GENERATION_BUDGET,
} as const;

type BudgetedRoute = keyof typeof routeBudgets;

function isBudgetedRoute(pathname: string): pathname is BudgetedRoute {
  return pathname in routeBudgets;
}

export interface StorageGuardProps {
  enabled: boolean;
}

export function StorageGuard({ enabled }: StorageGuardProps): null {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const budget = isBudgetedRoute(pathname)
      ? routeBudgets[pathname]
      : undefined;
    if (!budget) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const tempDirUri: string = `${FileSystem.documentDirectory}tmp_media`;

      const result = await ensureSpace(budget, {
        tempDirUri,
        tryCleanup: true,
      });

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        Alert.alert(
          "Espacio insuficiente",
          "Necesitas liberar espacio para continuar.",
          [
            {
              text: "Liberar espacio",
              onPress: () => openStorageManagement(),
              style: "destructive",
            },
            {
              text: "Reintentar",
              style: "default",
              onPress: () => router.replace(pathname as Href),
            },
            { text: "Cancelar", style: "cancel" },
          ],
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, pathname, router]);

  return null;
}
