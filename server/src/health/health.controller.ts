import { Controller, Get, Optional } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
} from "@nestjs/swagger";
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  TypeOrmHealthIndicator,
} from "@nestjs/terminus";
import type {
  HealthCheckResult,
  HealthIndicatorResult,
} from "@nestjs/terminus";
import { Public } from "@shared/decorators/public.decorator";

@ApiTags("Health")
@Public()
@Controller("health")
export class HealthController {
  private readonly heapMaxBytes = 512 * 1024 * 1024; // 150MB
  private readonly rssMaxBytes = 512 * 1024 * 1024; // 150MB

  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    @Optional() private readonly db?: TypeOrmHealthIndicator,
  ) { }

  /**
   * GET /health
   * Devuelve 200 cuando todos los checks pasan; 503 si alguno falla.
   */
  @Get()
  @ApiOperation({ summary: "Get application health status" })
  @ApiOkResponse({ description: "Health check successful" })
  @ApiServiceUnavailableResponse({ description: "Health check failed" })
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    const checks: Array<() => Promise<HealthIndicatorResult>> = [
      () => this.memory.checkHeap("memory_heap", this.heapMaxBytes),
      () => this.memory.checkRSS("memory_rss", this.rssMaxBytes),
      () =>
        this.disk.checkStorage("storage", { path: "/", thresholdPercent: 0.9 }),
    ];

    // Solo ping a DB si hay indicador y está configurada
    if (this.db && (process.env.BACKEND_DATABASE_HOST || process.env.BACKEND_DATABASE_URL)) {
      const db = this.db;
      checks.push(() => db.pingCheck("database"));
    }

    return this.health.check(checks);
  }

  /**
   * GET /health/ready
   * Sonda de readiness simple.
   */
  @Get("ready")
  @ApiOperation({ summary: "Readiness probe" })
  @ApiOkResponse({ description: "Application is ready" })
  getReady(): {
    status: string;
    timestamp: string;
    uptime: number;
    // Puedes añadir más campos si quieres (env, version, etc.)
  } {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * GET /health/live
   * Sonda de liveness simple.
   */
  @Get("live")
  @ApiOperation({ summary: "Liveness probe" })
  @ApiOkResponse({ description: "Application is alive" })
  getLiveness(): { status: string; timestamp: string } {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
