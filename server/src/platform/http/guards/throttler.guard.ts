import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Usa @Throttle() en controladores/métodos, o registra ThrottlerModule global.
 * Este guard se puede registrar globalmente o por ruta.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {}
