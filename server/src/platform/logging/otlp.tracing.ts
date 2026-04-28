/**
 * Placeholder si decides habilitar OpenTelemetry más adelante.
 * Aquí podrías inicializar SDK OTEL, propagators (W3C), exporters, etc.
 * Lo mantenemos opcional para no acoplar el proyecto a OTEL de entrada.
 */
export function initTracingIfEnabled() {
	if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
		// inicialización de tracing aquí...
	}
}
