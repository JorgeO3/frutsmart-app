---
applyTo: "**/*.spec.ts,**/*.test.ts,src/**/*.service.ts,src/**/*.controller.ts"
description: "Testing guidelines"
---

- Unit tests are required for services.
- E2E tests are required for critical endpoints.
- Aim for at least 80% coverage.
- Tests must be deterministic and isolated.
- Prefer explicit assertions over snapshots.
