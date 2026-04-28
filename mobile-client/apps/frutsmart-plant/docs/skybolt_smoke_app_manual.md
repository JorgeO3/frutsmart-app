# Skybolt App Smoke (Local-Only)

## Preconditions

- Android emulator/device running.
- Local backend available (if the flow needs API) OR auth disabled for local mode.
- App built with current branch changes.

## Runbook

0. (Opcional recomendado) iniciar captura de evidencia:
   - `just skybolt_smoke_capture_start`

1. Start app in Android debug mode.
2. Open a plant analysis and save it.
3. Confirm upload job is created and visible in uploads screen.
4. From uploads UI, validate actions:
   - pause
   - resume
   - retry
   - cancel
5. Re-open app and confirm recovery behavior:
   - pending/running job is still visible
   - resumed or paused state remains coherent
6. Validate auth toggle behavior:
   - `EXPO_PUBLIC_AUTH_ENABLED=false` works without auth prompts
   - `EXPO_PUBLIC_AUTH_ENABLED=true` handles auth-required path and visible errors
7. Validate user-facing errors:
   - network-like failure shown in UI
   - retry action available and functional

8. (Opcional recomendado) detener captura de evidencia:
   - `just skybolt_smoke_capture_stop`
   - artifacts in `artifacts/skybolt-smoke/<timestamp>`

## Evidence Checklist

- [ ] save-analysis -> enqueue upload confirmed
- [ ] uploads screen shows job with coherent progress
- [ ] pause/resume/retry/cancel actions work from modal
- [ ] recovery after reopen validated
- [ ] auth ON/OFF behavior validated
- [ ] user-visible errors are actionable

## Result

- [ ] PASS
- [ ] FAIL

Notes:

- Device/emulator:
- Build variant:
- Date/time:
- Observations:
