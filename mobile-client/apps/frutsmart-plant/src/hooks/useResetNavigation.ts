import type { Href } from "expo-router";

import { useRouter } from "expo-router";
import { useCallback } from "react";

export const useResetNavigation = () => {
  const router = useRouter();

  // biome-ignore lint/correctness/useExhaustiveDependencies: This is a stable function that does not change.
  const navigate = useCallback((route: Href) => {
    if (router.canDismiss()) router.dismissAll();
    router.replace(route);
  }, []);

  return navigate;
};
