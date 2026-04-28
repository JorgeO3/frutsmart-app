# syntax=docker/dockerfile:1.7

########## Base ##########
FROM node:lts-alpine3.21 AS base
WORKDIR /app

########## Deps (solo prod) ##########
FROM base AS deps
COPY package*.json ./
# Usa cache de npm; si hay lockfile -> ci, si no -> i
RUN --mount=type=cache,target=/root/.npm \
  if [ -f package-lock.json ]; then \
  npm ci --omit=dev --no-audit --no-fund ; \
  else \
  npm i  --omit=dev --no-audit --no-fund ; \
  fi

########## Builder (dev deps + build TS) ##########
FROM base AS builder
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
  if [ -f package-lock.json ]; then \
  npm ci --no-audit --no-fund ; \
  else \
  npm i  --no-audit --no-fund ; \
  fi
COPY . .
RUN npm run build

########## Runner (mínimo) ##########
FROM node:lts-alpine3.21 AS runner
WORKDIR /app

RUN apk add --no-cache tzdata

# Usuario no-root
RUN addgroup -S nodejs -g 1001 && adduser -S nodeuser -G nodejs -u 1001

ENV NODE_ENV=production \
  TZ=America/Bogota

# Copia lo necesario
COPY --from=deps    --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/dist         ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/package.json ./package.json

RUN mkdir -p /app/logs && chown -R nodeuser:nodejs /app

USER nodeuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD sh -c 'p="${API_PREFIX:-}"; p="${p#/}"; path=$([ -n "$p" ] && echo "/$p/health" || echo "/health"); wget -qO- "http://127.0.0.1:${PORT:-3000}$path" >/dev/null || exit 1'

CMD ["node", "dist/main.js"]
