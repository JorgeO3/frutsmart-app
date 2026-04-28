---
applyTo: "src/**/*.controller.ts,src/**/*.dto.ts,src/**/*.response.ts"
description: "OpenAPI documentation rules"
---

- All controllers must have `@ApiTags`.
- Each route must have correct operation and response decorators.
- DTOs must include `@ApiProperty` annotations.
- OpenAPI docs must be versioned and accurate.