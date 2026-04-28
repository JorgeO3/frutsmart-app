---
applyTo: "main.ts,src/**/*.module.ts,src/**/*.controller.ts,src/**/*.service.ts,src/**/*.guard.ts,src/**/*.interceptor.ts,src/**/*.filter.ts,src/**/*.pipe.ts"
description: "High-level architectural rules for NestJS"
---

- Use Fastify as the default HTTP adapter unless explicitly told otherwise.
- Global prefix must be `/api` and versioning must be enabled.
- DTOs must be used for all incoming and outgoing data.
- Do not place business logic in controllers; keep it inside services.
- Follow clear separation of concerns: modules → controllers → services → repositories.
- Avoid blocking operations inside the request lifecycle; delegate to background workers.
- Do not leak database entities directly through controllers.
- All errors must be mapped to appropriate HTTP exceptions.