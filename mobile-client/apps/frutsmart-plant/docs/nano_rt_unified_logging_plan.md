# NanoRT Unified Logging Plan (RN + Kotlin)

## Objective

Design and implement a unified logging system across React Native and Kotlin for NanoRT and quality-analysis flows, with:

- one shared event format,
- one shared level model,
- configurable sinks and feature flags,
- strong flow correlation (business-auditable),
- compatibility with current module contracts.

This document is the reference plan for implementation.

## Why this is needed

Current state has two log worlds:

- Kotlin logs are more structured and useful.
- RN logs are noisy (`console.*`) and hard to audit.

As a result, we can infer flow success, but not always prove it cleanly without manual reconstruction.

## Scope for v1

Primary scope: NanoRT + quality-analysis business flow.

- include lifecycle/readiness,
- include 4 external + 3 internal inference steps,
- include payload/timing checks.

Do not expand to auth/uploads/report generation in v1.

## Non-negotiables

- Do not break external NanoRT JS/Expo API contracts.
- RN and Kotlin must share the same event model.
- Logs must be auditable by flow id and step id.
- Level policy must be consistent across RN and Kotlin.
- Must be controllable by feature flags.

## Universal event schema

Use one structured envelope in both layers:

```ts
type UnifiedLogEvent = {
  ts: string; // ISO8601
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  source: 'js' | 'native';
  domain: 'nanort' | 'workflow' | 'lifecycle' | 'ui' | 'storage' | 'auth';
  component: string;
  event: string;
  message?: string;
  qualityFlowId?: string;
  workflowId?: string;
  stepType?: 'external' | 'internal';
  stepIndex?: number;
  stepCount?: number;
  attrs?: Record<string, unknown>;
  error?: {
    type?: string;
    code?: string;
    message: string;
    stack?: string;
  };
};
```

## Event taxonomy (stable names)

### Lifecycle/readiness

- `module_init_begin`
- `module_init_success`
- `module_init_fail`
- `on_ready_emitted`
- `on_init_error_emitted`
- `module_destroy_begin`
- `module_destroy_end`

### Warmup/runtime

- `warmup_begin`
- `warmup_model_ok`
- `warmup_model_fail`
- `warmup_end`
- `model_ready`
- `gpu_fallback_to_cpu`
- `workflow_cleanup`

### Business flow

- `quality_flow_begin`
- `workflow_step_begin`
- `workflow_step_success`
- `workflow_step_fail`
- `quality_flow_complete`

### Payload checks

- `payload_validation_ok`
- `payload_validation_fail`

## Correlation model

Required correlation keys:

- `qualityFlowId`: one id for the full quality-analysis process.
- `workflowId`: one id per inference step.
- `stepType`: external/internal.
- `stepIndex` and `stepCount`: e.g. 2/4 or 1/3.

Policy:

- RN creates `qualityFlowId` and `workflowId`.
- RN passes context to native before each inference.
- Kotlin emits events using the same ids.

## Level policy

- `trace`: very fine diagnostics, local debug only.
- `debug`: internal technical detail and timings.
- `info`: business/lifecycle begin-end-success markers.
- `warn`: degradations/fallbacks/recoverable anomalies.
- `error`: true failures.

Important:

- Business audit markers must exist at least in `info`.
- Noise must never dominate `info`.

## Sink model

Support independent sinks:

- JS console sink,
- native logcat sink,
- memory buffer sink (for local export/analysis),
- optional future file sink.

Allow activation of:

- RN only,
- native only,
- both,
- none.

## Feature flags and config

Proposed flags:

```ts
featureFlags: {
  unifiedLoggingEnabled: boolean;
  nanortFlowLoggingEnabled: boolean;
  jsConsoleSinkEnabled: boolean;
  nativeLogcatSinkEnabled: boolean;
  memoryLogSinkEnabled: boolean;
  flowCorrelationEnabled: boolean;
  payloadValidationLoggingEnabled: boolean;
  verboseNativeRuntimeLoggingEnabled: boolean;
}

logging: {
  minLevel: 'info' | 'debug' | 'trace' | 'warn' | 'error';
  jsMinLevel: 'info' | 'debug' | 'trace' | 'warn' | 'error';
  nativeMinLevel: 'info' | 'debug' | 'trace' | 'warn' | 'error';
}
```

## Architecture

### Shared concepts

- stable event schema,
- stable event names,
- stable correlation keys,
- stable level semantics.

### JS layer

- centralized logger adapter (replace ad-hoc `console.*` for NanoRT flow),
- flow helper API:
  - `beginQualityFlow`,
  - `beginWorkflowStep`,
  - `completeWorkflowStep`,
  - `failWorkflowStep`,
  - `completeQualityFlow`.

### Native layer

- keep `ModuleLogger` as backend,
- add structured-event facade on top,
- consume flow context and emit with shared ids.

### Context bridge

Additive (non-breaking) context mechanism to pass correlation metadata from JS to native (before each inference or scoped per flow).

## Implementation phases

### Phase A - Contract and config

1. Freeze schema and taxonomy in code/docs.
2. Add logging flags/config in Expo extra config.
3. Define env defaults (dev/qa/release).

### Phase B - JS infrastructure

1. Add unified JS logger adapter.
2. Replace NanoRT flow `console.*` with structured events.
3. Add flow-level helper utilities.

### Phase C - Native infrastructure

1. Add structured native event adapter over `ModuleLogger`.
2. Keep compatibility with existing `logD/logI/logW/logE`.
3. Implement level/sink gating from config/flags.

### Phase D - Correlation bridge

1. Add context bridge API (additive).
2. Ensure every native workflow event can include `qualityFlowId/workflowId/step*`.
3. Verify RN and Kotlin emit same ids for same step.

### Phase E - Flow instrumentation

Instrument all quality-analysis steps:

- 4 external steps,
- 3 internal steps,
- payload validations,
- per-step timings,
- final flow summary.

### Phase F - Validation and hardening

1. Targeted tests for schema/levels/sinks/flags/correlation.
2. Integration test proving one flow can be reconstructed deterministically.
3. Manual Phase 14 run with exported structured evidence.

## Testing plan (explicit)

### JS tests

- schema shape and required fields,
- min-level gating,
- sink on/off behavior,
- feature flag behavior,
- correlation propagation in flow helpers.

### Android tests

- native min-level gating,
- sink on/off behavior,
- structured event formatting,
- context propagation into runtime events.

### Integration tests

- one workflow emits RN + native events with same ids,
- full quality flow emits:
  - one `quality_flow_begin`,
  - 7 step begin/end outcomes,
  - one `quality_flow_complete`,
- payload validation events emitted consistently.

## Definition of done

A run is auditable without manual inference when:

1. We can query by `qualityFlowId` and reconstruct all 7 steps.
2. Every step has explicit begin + success/fail markers.
3. Step payload checks and timings are present.
4. Noise does not obscure `info` audit markers.
5. RN/native can be toggled independently (or together) via flags.

## Known noise policy

Do not classify as NanoRT failures unless explicitly correlated by flow ids/event taxonomy:

- generic font/typeface warnings,
- packager/dev websocket noise,
- generic React warnings,
- non-correlated system/vendor logs.

## Rollout recommendation

1. Implement for NanoRT flow only (v1).
2. Validate with Phase 14 evidence.
3. Expand to other domains only after v1 is stable.
