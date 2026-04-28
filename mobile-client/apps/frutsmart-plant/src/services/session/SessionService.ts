import { database } from "@adapters/repository/Database";
import * as Crypto from "expo-crypto";
import type { Session } from "src/adapters/repository/types-backup";

// ============================================================
// Clase del Servicio de Sesión
// ============================================================

/**
 * Contiene la lógica de negocio para gestionar las sesiones de usuario.
 * Es el único lugar que interactúa con el SessionRepository.
 */
export class SessionService {
  /**
   * Inicia una nueva sesión de trabajo.
   * @returns La entidad de la sesión recién creada.
   */
  public async startNewSession(): Promise<Session> {
    try {
      const newSessionId = Crypto.randomUUID();
      console.log(
        `[SessionService] Creando nueva sesión en la DB con ID: ${newSessionId}`,
      );

      // Llama al repositorio para realizar la operación de base de datos.
      const newSession = await database.sessions.create(newSessionId);

      return newSession;
    } catch (error) {
      console.error(
        "[SessionService] Error al iniciar una nueva sesión:",
        error,
      );
      throw error;
    }
  }

  /**
   * Finaliza una sesión activa.
   * @param sessionId - El ID de la sesión a finalizar.
   */
  public async endSession(sessionId: string): Promise<void> {
    if (!sessionId) {
      console.warn(
        "[SessionService] Se intentó finalizar una sesión sin un ID.",
      );
      return;
    }

    try {
      console.log(`[SessionService] Finalizando sesión en la DB: ${sessionId}`);
      await database.sessions.endSession(sessionId);
    } catch (error) {
      console.error("[SessionService] Error al finalizar la sesión:", error);
      throw error;
    }
  }
}

// Exportamos una instancia singleton para que sea fácil de usar en toda la app.
export const sessionService = new SessionService();
