import type { Href, Router } from "expo-router";

import { getValidAccessToken } from "skybolt";

// CAMBIAR: ajusta esta ruta al “home” real de tu app
const HOME_ROUTE: Href = "/field-work";

// Ruta de login (auth)
const LOGIN_ROUTE: Href = "/auth/login";

/**
 * Decide a dónde navegar después de la introducción:
 * - Si hay token válido -> Home
 * - Si no hay token válido -> Login
 */
export async function handleIntroAuthNavigation(router: Router): Promise<void> {
  try {
    const token: string | null = await getValidAccessToken();

    if (token) {
      router.replace(HOME_ROUTE);
      return;
    }

    router.replace(LOGIN_ROUTE);
  } catch (error: unknown) {
    console.error("[AuthNavigation] Error al resolver el estado de auth", error);
    // En caso de error, por seguridad mandamos a login
    router.replace(LOGIN_ROUTE);
  }
}
