---
applyTo: "Dockerfile,**/Dockerfile,**/*.dockerfile,**/docker-compose*.yml,**/docker-compose*.yaml,.dockerignore"
description: "Container guidelines"
---

- Images must be minimal and non-root by default.
- Exclude local dev files and node_modules in `.dockerignore`.
- Only expose required ports.
- Add a healthcheck command.