# Nano RT Migration Checklist

Source of truth: `docs/migration_plan_nano_rt.md`

Phase 12 validation guide: `docs/nano_rt_phase12_validation.md`

Phase 0 contract freeze: `docs/nano_rt_phase0_contract_freeze.md`

Phase 1 migration map: `docs/nano_rt_phase1_file_migration_map.md`

Phase 10/11 correctness plan: `docs/nano_rt_phase10_11_correctness_plan.md`

Phase 8 GPU correctness plan: `docs/nano_rt_phase8_gpu_correctness_plan.md`

Phase 6/7 closeout guide: `docs/nano_rt_phase6_7_closeout.md`

Phase 14 closeout guide: `docs/nano_rt_phase14_closeout.md`

Legend:
- `[x]` completed
- `[-]` in progress / partially completed
- `[ ]` pending

## Phase status

- `[x]` Phase 0 - Freeze external contracts
  - External API invariants were documented and frozen in `docs/nano_rt_phase0_contract_freeze.md`.
  - Module/events/output contracts are explicitly locked for remaining phases.

- `[x]` Phase 1 - File-by-file migration map
  - Definitive replace/adapt/keep map published in `docs/nano_rt_phase1_file_migration_map.md`.
  - Migration file plan is now explicit and auditable.

- `[x]` Phase 2 - Port hardened runtime core
  - Actor runtime and internal protocol moved into `modules/nano-rt`.

- `[x]` Phase 3 - Port hardened `NanoRTInterpreter`
  - Owner-thread checks, lease controls, and lifecycle hardening migrated.

- `[x]` Phase 4 - Rewrite `ModelManager` over actor
  - `ModelManager` now delegates through actor/session flow.

- `[x]` Phase 5 - Adapt pipelines to `InterpreterSession`
  - Classification and segmentation paths execute through session API.

- `[x]` Phase 6 - Workspaces and buffer strategy validation
  - Workspace compatibility/snapshot/aliasing correctness is covered by dedicated workflow tests.
  - Baseline-vs-new latency and memory/direct-buffer evidence is documented in Phase 12 artifacts.
  - Final decision recorded: current copy strategy is acceptable.

- `[-]` Phase 7 - Expo lifecycle/readiness
  - Teardown path hardened (`ModelManager.shutdown()` via `Dispatchers.Default`, no `shutdownBlocking` on uncontrolled thread).
  - Readiness semantics hardened: strict warmup failure handling and `isReady` reflects successful readiness only.
  - Full host-app readiness/event validation matrix is still pending (shared closeout with Phase 14).

- `[x]` Phase 8 - GPU policy/quarantine/delegate correctness
  - GPU policy decision path covered (`flag`, blacklist/signature, compat, quarantine).
  - Quarantine persistence/durability covered.
  - GPU failure -> CPU fallback and quarantined skip path covered.

- `[x]` Phase 9 - Test infrastructure in `nano-rt`
  - Android instrumentation infrastructure created in module.

- `[x]` Phase 10 - Critical runtime test port
  - Runtime-critical categories covered in module tests, including delegate pool bounds/concurrency/LRU/token, output lease escape, thread leak, and real-engine shutdown stress.

- `[x]` Phase 11 - Workflow/workspace-specific tests
  - Workflow/workspace correctness coverage includes classification and segmentation processor regressions, snapshot/aliasing checks, and explicit shape/contract assertions.

- `[x]` Phase 12 - Performance and memory validation
  - Performance/memory battery expanded with warmup benchmark, restart matrix, preprocess regression and native-memory observation tests.
  - Targeted Phase 12 instrumentation suite is green.
  - Baseline-vs-actual comparison documented and formal decision recorded in `docs/nano_rt_phase12_validation.md`.

- `[x]` Phase 13 - Manual soak port to Expo module
  - Debug soak service/receiver/tasks implemented.
  - Finite soak profiles validated with PASS reports: `mixed`, `rotation`, `shutdown`, `workflow_classification`, `workflow_segmentation`.

- `[-]` Phase 14 - Real host app integration validation
  - App startup smoke on device/emulator passes (`MainActivity` launches and process remains alive).
  - End-to-end product flows on host screens are still pending final validation pass.

- `[ ]` Phase 15 - Final cleanup and docs hardening
  - Legacy cleanup and final architecture docs still pending.

## Recent validation evidence

- `./gradlew :nano-rt:compileDebugAndroidTestKotlin` (pass)
- `./gradlew :nano-rt:connectedDebugAndroidTest` (20 tests, pass)
- `./gradlew :nano-rt:soakRun -Psoak.appId=com.anonymous.FrutSmartP -Psoak.profile=mixed -Psoak.durationMinutes=1` (pass)
  - Report highlights:
    - `status=PASS`
    - `elapsedMs=60061`
    - `iterations=1088`
    - `errors=0`
    - `fatalTerminationCount=0`
    - `pendingReplies=0`
- `./gradlew :nano-rt:soakRun -Psoak.appId=com.anonymous.FrutSmartP -Psoak.profile=workflow_segmentation -Psoak.durationMinutes=1` (pass)
  - Report highlights:
    - `status=PASS`
    - `elapsedMs=60046`
    - `iterations=437`
    - `errors=0`
    - `fatalTerminationCount=0`
    - `pendingReplies=0`
- `adb shell am start -n com.anonymous.FrutSmartP/.MainActivity && adb shell pidof com.anonymous.FrutSmartP` (pass)
  - Smoke highlights:
    - `MainActivity` launch intent accepted by ActivityTaskManager.
    - Process remains alive after startup (`pidof` returned a valid PID).
- `bash scripts/nanort_phase14_gate.sh` (pass)
  - Gate highlights:
    - Startup gate artifacts generated under `artifacts/nanort-phase14/`.
    - App process alive and no `FATAL EXCEPTION` found.
    - Manual matrix template emitted for Phase 14 closeout evidence.
- `./gradlew :nano-rt:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=expo.modules.nanort.module.workflows.WorkflowPerformanceRegressionAndroidTest,expo.modules.nanort.module.workflows.WarmupBenchmarkAndroidTest,expo.modules.nanort.module.workflows.WorkflowRestartMatrixAndroidTest,expo.modules.nanort.module.workflows.DirectMemoryObservationAndroidTest,expo.modules.nanort.module.workflows.ClassificationProcessorRegressionAndroidTest` (pass, 5 tests)
  - Phase 12 highlights:
    - Warmup benchmark + restart matrix green.
    - Native memory observation test green.
    - Classification preprocess regression test green.
- `./gradlew :nano-rt:soakRun -Psoak.appId=com.anonymous.FrutSmartP -Psoak.profile=mixed -Psoak.durationMinutes=5` (pass)
- `./gradlew :nano-rt:soakRun -Psoak.appId=com.anonymous.FrutSmartP -Psoak.profile=workflow_classification -Psoak.durationMinutes=5` (pass)
- `./gradlew :nano-rt:soakRun -Psoak.appId=com.anonymous.FrutSmartP -Psoak.profile=workflow_segmentation -Psoak.durationMinutes=5` (pass)
- `./gradlew :nano-rt:soakRun -Psoak.appId=com.anonymous.FrutSmartP -Psoak.profile=shutdown -Psoak.durationMinutes=5` (pass)
  - Soak highlights:
    - All 4 profiles finished `status=PASS`, `errors=0`.
    - `fatalTerminationCount=0`, `pendingReplies=0`, `childJobCount=1`.
    - `queueWait p99` and `hold p99` stayed far below thresholds.
- `./gradlew :nano-rt:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=expo.modules.nanort.module.interpreter.safety.OutputBufferLeaseEscapeAndroidTest,expo.modules.nanort.module.interpreter.resources.DelegatePoolCapacityBoundAndroidTest,expo.modules.nanort.module.interpreter.resources.DelegatePoolConcurrencyAndroidTest,expo.modules.nanort.module.interpreter.resources.DelegatePoolLruOrderAndroidTest,expo.modules.nanort.module.interpreter.resources.DelegatePoolTokenKeyUniquenessAndroidTest,expo.modules.nanort.module.interpreter.actor.FastRefreshThreadLeakAndroidTest,expo.modules.nanort.module.interpreter.integration.RealEngineShutdownStressAndroidTest,expo.modules.nanort.module.workflows.SegmentationProcessorRegressionAndroidTest,expo.modules.nanort.module.workflows.WorkflowOutputSnapshotAndroidTest,expo.modules.nanort.module.workflows.ClassificationWorkspaceAliasingAndroidTest,expo.modules.nanort.module.workflows.WorkflowShapeContractAndroidTest` (pass, 12 tests)
  - Phase 10/11 highlights:
    - Missing Phase 10 categories now covered with explicit tests.
    - Phase 11 now includes explicit segmentation preprocess/postprocess, snapshot, aliasing, and shape-contract checks.
- `./gradlew :nano-rt:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=expo.modules.nanort.module.interpreter.GpuPolicyAndroidTest,expo.modules.nanort.module.interpreter.GpuQuarantineStoreAndroidTest,expo.modules.nanort.module.interpreter.persistence.QuarantineAtomicityAndroidTest,expo.modules.nanort.module.interpreter.integration.QuarantineDurabilityAndroidTest,expo.modules.nanort.module.interpreter.integration.DelegateFallbackToCpuAndroidTest,expo.modules.nanort.module.interpreter.integration.QuarantinedModelSkipsGpuAttemptAndroidTest` (pass, 10 tests)
  - Phase 8 highlights:
    - GPU decision policy covered with deterministic tests.
    - Quarantine write durability and restart persistence covered.
    - GPU delegate failure fallback to CPU covered.
- `./gradlew :nano-rt:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=expo.modules.nanort.ModuleInitStateMachineAndroidTest,expo.modules.nanort.module.interpreter.InterpreterWarmerPolicyAndroidTest,expo.modules.nanort.module.workflows.WarmupBenchmarkAndroidTest,expo.modules.nanort.module.interpreter.ShutdownBlockingMainThreadGuardAndroidTest` (pass, 5 tests)
  - Phase 7 highlights:
    - `isReady` and await semantics validated by state machine tests.
    - Warmup failure policy validated as strict and deterministic.
    - Main-thread shutdown guardrail remains validated.
- `./gradlew :nano-rt:connectedDebugAndroidTest` (pass, 37 tests)
  - Full-suite highlights:
    - End-to-end module androidTest suite remains green after Phase 10/11 expansion.
- `./gradlew :nano-rt:connectedDebugAndroidTest` (pass, 47 tests)
  - Full-suite highlights:
    - End-to-end module androidTest suite remains green after Phase 8 expansion.
- `./gradlew :nano-rt:connectedDebugAndroidTest` (pass, 50 tests)
  - Full-suite highlights:
    - End-to-end module androidTest suite remains green after Phase 6/7 hardening.

## Next execution steps

1. Execute and record the Phase 14 closeout matrix in `docs/nano_rt_phase14_closeout.md`.
2. Complete host-app validation evidence for all 4 workflows and readiness events.
3. Phase 15 cleanup/docs pass and final migration sign-off.
