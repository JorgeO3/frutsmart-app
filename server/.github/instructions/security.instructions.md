---
applyTo: "src/**/*.controller.ts,src/**/*.guard.ts,src/**/*.interceptor.ts,src/**/*.filter.ts,src/**/*.pipe.ts,src/**/*.service.ts,main.ts"
description: "Security rules for APIs"
---

- CORS must be restrictive by default and only allow configured origins.
- Input validation is mandatory for all incoming data.
- Use guards for authentication and authorization.
- Never expose secrets in logs or responses.
- Error responses must be sanitized and safe for public consumption.
- Apply rate limiting to sensitive endpoints.
- Uploaded files must be size-limited and validated.