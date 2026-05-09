1# Propuesta: Reimplementación del Upload Scheduler como Extended State Machine

## Problemas de la implementación actual

| Problema | Causa raíz |
|---|---|
| Data races: `syncMetricsFromSessionId` y `handleSessionCompleted` se ejecutan simultáneamente 2-3 veces por el mismo evento | `addUploadListener` crea un `NativeEventEmitter` nuevo en cada llamada; hay 3 suscriptores en el árbol React (`SkyboltUploadProvider`, `SkyboltNativeUploadProvider`, `useSkybolt`) |
| Triple dispatch de eventos nativos | Se parcheó con `syncInFlight` / `completionInFlight` en `UploadService`, pero es una curita |
| `sessionAlreadyHandled` (Set en memoria) requiere limpieza manual en cada path de error | Fuga de memoria si un evento `session:completed` llega sin job asociado |
| `handleUploadLifecycleRunning` necesita guard en `"complete_session" / "evaluation" / "done"` para no degradar el job | El evento `session:started` llega en reconnection y pisa estados avanzados |
| `incrementAttempts` se llama DESPUÉS de `updateJobStep(..., "running")` en handlers | Si el handler falla entre ambos, el intento se pierde o se infla según orden |
| Polling + eventos + scheduler compiten por avanzar el mismo job | No hay una autoridad única que decida qué transición es válida |
| Errores HTTP no se clasifican consistentemente (falta algunos 4xx) | `isPermanentError` es un switch manual, fácil de olvidar un código |
| Lógica de backoff y schedule filter mezclada con la lógica de pipeline | Scheduler hace de "orquestador" y de "repo worker" a la vez |

---

## Por qué NO un DFA puro

Un Deterministic Finite Automaton (DFA) tiene:
- **Estados finitos** (solo un conjunto fijo de labels)
- **Alfabeto finito** (símbolos de input puros, sin payload)
- **Transiciones determinísticas** (dado estado + símbolo, siempre el mismo destino)

Este sistema necesita:
- **Contadores** (`attempts_count`) que influyen en las transiciones (backoff, max attempts)
- **Datos asociados** (`backend_session_id`, `skybolt_session_id`, métricas de progreso)
- **Timeouts** (polling, backoff) que no son inputs discretos sino triggers temporales
- **Guardas condicionales** (`canRun`: ¿se superó el backoff? ¿es error permanente?)
- **Side effects** (HTTP calls, native API calls) que ocurren AL ENTRAR a un estado

Esto es una **Extended State Machine** (XFSM) o **Statechart**, donde:
- El **state** es un valor como `create_session.creating`
- El **context** es un objeto mutable con datos extendidos
- Las **transiciones** tienen **guards** (condiciones) y **actions** (side effects)
- Los **events** llevan payload opcional

---

## Arquitectura propuesta

```
┌──────────────────────────────────────────────────────────────┐
│                    UploadOrchestrator                        │
│                                                              │
│  ┌──────────────────────┐       ┌─────────────────────────┐  │
│  │  UploadJobMachine     │       │  UploadJobMachine       │  │
│  │  (por job en DB)     │  ...  │  (por job en DB)        │  │
│  │                      │       │                         │  │
│  │ create_session       │       │ create_session          │  │
│  │   idle → creating    │       │   idle → creating       │  │
│  │              → failed│       │              → failed   │  │
│  │ upload               │       │ upload                  │  │
│  │   idle → uploading   │       │   idle → uploading      │  │
│  │       → paused       │       │       → paused          │  │
│  │       → failed       │       │       → failed          │  │
│  │ complete_session     │       │ complete_session        │  │
│  │ evaluation           │       │ evaluation              │  │
│  │ done                 │       │ done                    │  │
│  │   success            │       │   success               │  │
│  │   permanently_failed │       │   permanently_failed    │  │
│  └──────────────────────┘       └─────────────────────────┘  │
│                                                              │
│  ┌───────────────────┐                                       │
│  │  SchedulerActor    │  → envía SCHEDULER_TICK cada 30s     │
│  └───────────────────┘                                       │
│  ┌───────────────────┐                                       │
│  │  NativeActor       │  → escucha Skybolt, traduce eventos  │
│  └───────────────────┘                                       │
│  ┌───────────────────┐                                       │
│  │  PollingActor      │  → envía POLL_TICK cada 3s (on demand)│
│  └───────────────────┘                                       │
└──────────────────────────────────────────────────────────────┘
```

---

## Estados del pipeline (hierarchical)

```
create_session
  ├── idle        (esperando a ser procesado)
  ├── creating    (POST /upload/sessions en curso)
  └── failed      (error permanente o transitorio)

upload
  ├── idle        (sesión backend creada, listo para nativo)
  ├── uploading   (Skybolt subiendo archivos)
  ├── paused      (usuario pausó)
  └── failed      (error en la subida nativa)

complete_session
  ├── idle        (upload terminó, listo para completar)
  ├── completing  (POST /upload/sessions/:id/complete en curso)
  └── failed      (error al completar)

evaluation
  ├── idle        (sesión completada, listo para evaluar)
  ├── evaluating  (POST /evaluations en curso)
  └── failed      (error en evaluación)

done
  ├── success             (todo OK)
  └── permanently_failed  (error permanente, no reintentar)
```

---

## Context (extended state)

```typescript
interface UploadContext {
  jobId: string;
  analysisId: string;
  domain: "plant" | "field";
  backendSessionId: string | null;
  skyboltSessionId: string | null;
  totalFiles: number;
  completedFiles: number;
  totalBytes: number;
  uploadedBytes: number;
  attempts: number;
  lastError: string | null;
  lastAttemptAt: number | null;
  createdAt: string;
}
```

Se persiste en SQLite como la fila `upload_jobs` actual. La máquina en memoria se rehidrata desde la DB al boot.

---

## Events (inputs que disparan transiciones)

```typescript
type UploadJobEvent =
  // Del scheduler
  | { type: "SCHEDULER_TICK" }

  // Del actor nativo (Skybolt)
  | { type: "NATIVE_STARTED"; skyboltSessionId: string }
  | { type: "NATIVE_COMPLETED" }
  | { type: "NATIVE_FAILED"; error: string }
  | { type: "NATIVE_PROGRESS"; totalFiles: number; completedFiles: number; totalBytes: number; uploadedBytes: number }
  | { type: "NATIVE_PAUSED" }

  // Del actor de backend (HTTP)
  | { type: "SESSION_CREATED"; sessionId: string }
  | { type: "SESSION_ERROR"; statusCode: number; message: string }
  | { type: "COMPLETE_OK" }
  | { type: "COMPLETE_ERROR"; statusCode: number; message: string }
  | { type: "EVALUATION_OK" }
  | { type: "EVALUATION_ERROR"; statusCode: number; message: string }

  // Del usuario
  | { type: "USER_RETRY" }
  | { type: "USER_CANCEL" }
  | { type: "USER_PAUSE" }
  | { type: "USER_RESUME" }

  // Del polling actor (fallback)
  | { type: "POLL_TICK"; status: string; metrics: NativeMetrics | null };
```

---

## Tabla de transiciones

Estado actual → Evento → [Guard] → Estado destino → Acciones

### create_session

| Desde | Evento | Guard | Hasta | Acciones |
|---|---|---|---|---|
| idle | SCHEDULER_TICK | canRun | creating | incrementAttempts, backend.createUploadSession() |
| creating | SESSION_CREATED | — | upload.idle | setBackendSessionId, resetAttempts, persistStep |
| creating | SESSION_ERROR | isPermanent | done.permanently_failed | persistError(“[PERMANENT] …”) |
| creating | SESSION_ERROR | !isPermanent | create_session.failed | persistError |
| failed | SCHEDULER_TICK | canRun | creating | incrementAttempts, backend.createUploadSession() |
| failed | USER_RETRY | — | creating | resetAttempts, backend.createUploadSession() |
| * | USER_CANCEL | — | done.permanently_failed | cancelNative (si existe), persistError(“cancelled”) |

### upload

| Desde | Evento | Guard | Hasta | Acciones |
|---|---|---|---|---|
| idle | SCHEDULER_TICK | canRun | uploading | incrementAttempts, native.startSession(), startPolling() |
| idle | NATIVE_STARTED | — | uploading | setSkyboltSessionId, startPolling() |
| uploading | NATIVE_COMPLETED | — | complete_session.idle | syncMetrics, stopPolling, resetAttempts, persistStep |
| uploading | NATIVE_FAILED | — | upload.failed | stopPolling, persistError |
| uploading | NATIVE_PROGRESS | — | uploading | updateMetrics (no cambia de estado) |
| uploading | POLL_TICK | status === "completed" | complete_session.idle | syncMetrics, stopPolling, persistStep |
| uploading | POLL_TICK | status === "failed" | upload.failed | stopPolling, persistError |
| uploading | USER_PAUSE | — | paused | native.pauseSession() |
| paused | USER_RESUME | — | uploading | native.resumeSession() |
| paused | NATIVE_FAILED | — | upload.failed | persistError |
| paused | USER_RETRY | — | uploading | native.startSession() |
| * | USER_CANCEL | — | done.permanently_failed | cancelNative(), stopPolling(), persistError |
| failed | SCHEDULER_TICK | canRun | uploading | incrementAttempts, native.resumeSession() |
| failed | USER_RETRY | — | uploading | resetAttempts, native.resumeSession() |

### complete_session

| Desde | Evento | Guard | Hasta | Acciones |
|---|---|---|---|---|
| idle | SCHEDULER_TICK | canRun | completing | incrementAttempts, backend.completeUploadSession() |
| completing | COMPLETE_OK | — | evaluation.idle | resetAttempts, persistStep |
| completing | COMPLETE_ERROR | isPermanent | done.permanently_failed | persistError(“[PERMANENT] …”) |
| completing | COMPLETE_ERROR | !isPermanent | complete_session.failed | persistError |
| failed | SCHEDULER_TICK | canRun | completing | incrementAttempts, backend.completeUploadSession() |
| failed | USER_RETRY | — | completing | resetAttempts, backend.completeUploadSession() |
| * | USER_CANCEL | — | done.permanently_failed | persistError(“cancelled”) |

### evaluation

| Desde | Evento | Guard | Hasta | Acciones |
|---|---|---|---|---|
| idle | SCHEDULER_TICK | canRun && hasMetrics | evaluating | incrementAttempts, backend.createEvaluation() |
| evaluating | EVALUATION_OK | — | done.success | persistDone |
| evaluating | EVALUATION_ERROR | isPermanent | done.permanently_failed | persistError(“[PERMANENT] …”) |
| evaluating | EVALUATION_ERROR | !isPermanent | evaluation.failed | persistError |
| failed | SCHEDULER_TICK | canRun | evaluating | incrementAttempts, backend.createEvaluation() |
| failed | USER_RETRY | — | evaluating | resetAttempts, backend.createEvaluation() |
| * | USER_CANCEL | — | done.permanently_failed | persistError(“cancelled”) |

### done (terminal)

| Desde | Evento | Guard | Hasta | Acciones |
|---|---|---|---|---|
| success | *cualquiera* | — | (se ignora) | no-op |
| permanently_failed | USER_RETRY | — | vuelve al paso anterior | resetAttempts, clearPermanentFlag |

---

## Guards

| Guard | Lógica |
|---|---|
| canRun | `context.attempts < maxAttemptsPerStep` AND NOT `context.lastError?.startsWith("[PERMANENT]")` AND `now - lastAttemptAt >= computeBackoff(attempts)` |
| isPermanent | `event.statusCode` in (400, 401, 403, 404, 409, 422) OR `error` is instance of UploadApiError con esos códigos |
| hasMetrics | `context.totalFiles > 0 || context.totalBytes > 0` |
| pollDetectedCompleted | `event.status === "completed"` |
| pollDetectedFailed | `event.status === "failed"` |

---

## Actions (side effects)

| Action | Qué hace |
|---|---|
| `incrementAttempts` | `attempts += 1` en context; `UPDATE upload_jobs SET attempts_count = ..., last_attempt_at = ...` |
| `resetAttempts` | `attempts = 0, lastAttemptAt = null` en context; `UPDATE` en DB |
| `persistStep` | `UPDATE upload_jobs SET pipeline_step = nuevo, step_status = "pending"` |
| `persistError` | `UPDATE upload_jobs SET step_status = "failed", last_error = msg` |
| `persistDone` | `UPDATE upload_jobs SET pipeline_step = "done", step_status = "success"` |
| `persistMetrics` | `UPDATE upload_jobs SET total_files = ..., completed_files = ..., total_bytes = ..., uploaded_bytes = ...` |
| `setBackendSessionId` | context.backendSessionId = id; `UPDATE ... SET backend_session_id = ...` |
| `setSkyboltSessionId` | context.skyboltSessionId = id; `UPDATE ... SET skybolt_session_id = ...` |
| `startPolling` | Inicia un setInterval que envía POLL_TICK al job cada 3s |
| `stopPolling` | Limpia el setInterval |
| `cancelNative` | `Skybolt.cancelSession(skyboltSessionId)` (si existe) |

Los side effects de I/O (`backend.createUploadSession()`, `native.startSession()`) NO son acciones inline. La máquina los **delega a actores externos**:

1. La máquina setea estado a `creating` y emite un evento interno
2. El **BackendActor** escucha ese cambio, ejecuta la operación HTTP, y responde con `SESSION_CREATED` o `SESSION_ERROR`
3. La máquina recibe ese evento y transiciona

Esto mantiene la máquina **pura** (solo lógica de transiciones) y testearne sin red.

---

## Implementación concreta

### Core: StateMachine class (~150-200 líneas)

```typescript
type StateValue = string; // e.g. "create_session.creating"
type EventType = string;

interface Transition<S extends StateValue, E extends EventType, C> {
  target: S;
  guard?: (context: C, event: { type: E } & Record<string, unknown>) => boolean;
  actions?: Array<(context: C, event: unknown) => void | Promise<void>>;
}

interface StateNode<S extends StateValue, E extends EventType, C> {
  initial?: S;
  on: Record<E, Transition<S, E, C> | Transition<S, E, C>[]>;
  entry?: Array<(context: C) => void | Promise<void>>;
  exit?: Array<(context: C) => void | Promise<void>>;
}

class StateMachine<S extends StateValue, E extends EventType, C> {
  private state: S;
  private context: C;

  constructor(
    private readonly states: Record<string, StateNode<S, E, C>>,
    initialState: S,
    initialContext: C,
  ) {}

  get value(): S { return this.state; }
  get ctx(): C { return this.context; }

  async send(event: { type: E } & Record<string, unknown>): Promise<boolean> {
    const node = this.resolveNode(this.state);
    const transitions = node.on[event.type];
    if (!transitions) return false;

    const t = Array.isArray(transitions) ? transitions : [transitions];
    for (const tr of t) {
      if (tr.guard && !tr.guard(this.context, event)) continue;
      // exit current state
      await this.runActions(node.exit, this.context);
      // transition
      this.state = tr.target;
      // actions
      if (tr.actions) await this.runActions(tr.actions, this.context, event);
      // entry new state
      const nextNode = this.resolveNode(this.state);
      await this.runActions(nextNode.entry, this.context);
      return true;
    }
    return false;
  }

  private resolveNode(state: S): StateNode<S, E, C> {
    // "upload.idle" → find node "upload", then "idle"
    const parts = state.split(".");
    return parts.reduce((node, key) => node?.states?.[key] ?? node, this.states as any);
  }
}
```

No requiere librería externa. Se implementa en una tarde, se entiende en 5 minutos.

### Actores

Cada actor es una clase o función que:
- Recibe la máquina como dependencia (o un event bus compartido)
- Escucha cambios de estado o un timer
- Ejecuta I/O y envía eventos de vuelta

```typescript
class NativeActor {
  constructor(
    private readonly send: (event: UploadJobEvent) => void,
    private readonly skyboltSessionId: () => string | null,
  ) {
    Skybolt.addUploadListener((evt) => this.onNativeEvent(evt));
  }

  async startSession(input: { sessionId: string; items: PreparedSkyboltItem[] }) {
    try {
      await Skybolt.initializeSession({ sessionId: input.sessionId, items, options: {...} });
      await Skybolt.startSession(input.sessionId);
      this.send({ type: "NATIVE_STARTED", skyboltSessionId: input.sessionId });
    } catch (err) {
      this.send({ type: "NATIVE_FAILED", error: String(err) });
    }
  }

  private onNativeEvent(evt: UploadEvent) {
    switch (evt.type) {
      case "session:completed":
        this.send({ type: "NATIVE_COMPLETED" });
        break;
      case "session:failed":
        this.send({ type: "NATIVE_FAILED", error: evt.error.message });
        break;
      case "item:progress":
      case "item:completed":
      case "item:failed":
        this.syncAndSendProgress(evt.sessionId);
        break;
    }
  }
}
```

### UploadOrchestrator

Coordina todas las máquinas + actores:

```typescript
class UploadOrchestrator {
  private jobs = new Map<string, JobMachine>(); // máquina por jobId
  private schedulerActor: SchedulerActor;
  private nativeActor: NativeActor;
  private pollingActors = new Map<string, PollingActor>();

  constructor() {
    this.schedulerActor = new SchedulerActor(() => this.onTick());
    this.nativeActor = new NativeActor(
      (event, jobId) => this.dispatch(jobId, event),
    );
  }

  async bootstrap(): Promise<void> {
    const rows = await database.uploadJobs.getRunnableJobs();
    for (const row of rows) {
      const machine = this.rehydrate(row);
      this.jobs.set(row.id, machine);
    }
  }

  async dispatch(jobId: string, event: UploadJobEvent): Promise<void> {
    const machine = this.jobs.get(jobId);
    if (!machine) return;
    const transitioned = await machine.send(event);
    if (transitioned) {
      const state = machine.value;
      const ctx = machine.ctx;
      // Notificar a UI via observable/signal
      this.notifyUI(jobId, state, ctx);
      // Si el job terminó, cleanup
      if (state.startsWith("done")) {
        this.jobs.delete(jobId);
        this.pollingActors.delete(jobId);
      }
    }
  }

  private onTick(): void {
    for (const [jobId, machine] of this.jobs) {
      const event: UploadJobEvent = { type: "SCHEDULER_TICK" };
      void this.dispatch(jobId, event);
    }
  }
}
```

---

## ¿Qué bugs específicos desaparecen?

| Bug actual | Con state machine |
|---|---|
| Data race en `syncMetricsFromSessionId` llamada 3 veces | Solo hay un actor nativo, que emite `NATIVE_PROGRESS`. Si se llama 2 veces, la máquina ya no está en el estado que acepta ese evento → se descarta. |
| `sessionAlreadyHandled` set en memoria (fuga si no se limpia) | No existe. El estado de la máquina es la autoridad. |
| `handleUploadLifecycleRunning` degradando `done` a `upload` | `done.success` NO tiene transiciones salientes. Cualquier evento se ignora. |
| Contador de attempts inflado | `incrementAttempts` es una acción atómica en la transición `idle → running`. Una sola vez por intento. |
| Polling + evento nativo compiten por avanzar a `complete_session` | Ambos producen el mismo evento (`NATIVE_COMPLETED`). La máquina lo procesa una vez; el segundo `send()` no encuentra transición disponible. |
| `handleSessionCompleted` que no avanza porque `syncMetrics` falló | La máquina se queda en `upload.uploading`. El scheduler reintenta según backoff. |
| Error permanente que se reintenta infinitamente | El estado terminal `done.permanently_failed` no tiene transición `SCHEDULER_TICK`. Solo `USER_RETRY` puede sacarlo. |
| `complete_session.failed` que debería ser permanente pero se reintenta | `isPermanent` guard en la transición `completing → done.permanently_failed`. |
| Múltiples providers registrando listeners | Un solo `NativeActor` escucha el nativo. No hay listeners duplicados. |

---

## ¿Qué NO cambia?

- **El schema de `upload_jobs`** (se usa como persistencia de la máquina)
- **El repositorio `UploadJobsRepository`** (seguimos usándolo para leer/escribir)
- **La UI** (consume `UploadJobViewModel` igual que hoy, pero ahora generado desde la máquina)
- **La API del backend** (los endpoints `/upload/sessions`, `/upload/sessions/:id/complete`, `/evaluations`)

---

## ¿Qué SÍ cambia?

- `UploadScheduler.ts` y `UploadService.ts` se reemplazan por la nueva arquitectura
- `SkyboltUploadProvider.tsx` ya no registra su propio listener; solo el `NativeActor` escucha
- La lógica de clasificación de errores (`isPermanentError`) vive en los guards de la máquina
- El `polling` es un actor dedicado, no parte del `UploadService`
- Los tests se escriben contra la máquina pura (sin I/O): solo probar que dado estado + evento → nuevo estado + acciones

---

## Decisión: librería vs propia

| Criterio | XState v5 | Propia (~250 líneas) |
|---|---|---|
| Curva de aprendizaje | Alta (actors, spawn, invocations, etc.) | Baja |
| Bundle size | ~15 KB gzipped | ~1 KB |
| DevTools | Stately Inspector (muy útil para debug) | N/A (console.log) |
| Serialización | JSON nativa | Custom |
| Control sobre DB sync | Indirecto (vía actors) | Total |
| Testing | Stately's model-based testing | Jest simple |

**Recomendación: empezar con implementación propia.** Si el flujo se vuelve complejo (paralelismo real, timed automata), migrar a XState es sencillo porque la interfaz es la misma (`state`, `context`, `send(event)`).

---

## Preguntas abiertas

1. **¿Persistencia completa de la máquina o rehidratación desde SQLite?**  
   Si la app se mata en background: ¿cargamos todas las máquinas desde `upload_jobs` al boot? ¿O serializamos el estado actual en AsyncStorage?

2. **¿Scope exacto de la reimplementación?**  
   Solo `UploadScheduler` + `UploadService`? ¿O también refactorizar la UI para usar `state.value` y `context` directamente?

3. **¿Qué pasa con los jobs que están "en el medio" cuando desplegamos?**  
   Transición: jobs en `upload.uploading` → al rehidratar, el NativeActor puede detectar que la sesión Skybolt sigue activa y emitir `NATIVE_STARTED`.

4. **¿Tests?**  
   La máquina pura es trivial de testear. ¿Priorizamos tests unitarios de todas las transiciones antes de refactorizar la app?
