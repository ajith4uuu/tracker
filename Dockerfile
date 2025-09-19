# -------- Base image --------
FROM node:20-slim AS base
ENV PORT=8080
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/*

# -------- Dependencies (with dev deps) --------
FROM base AS deps
COPY package*.json ./
# Install ALL deps so build tools (e.g. @react-router/dev) are available
RUN npm ci --include=dev && npm cache clean --force

# -------- Build --------
FROM base AS build
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# Prune to production-only for runtime
RUN npm prune --omit=dev && npm cache clean --force

# -------- Runtime --------
FROM node:20-slim AS runner
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/* \
  && addgroup --system nodejs && adduser --system --ingroup nodejs nodeuser

COPY --chown=nodeuser:nodejs --from=build /app/node_modules ./node_modules
COPY --chown=nodeuser:nodejs --from=build /app/build ./build
COPY --chown=nodeuser:nodejs package*.json ./

USER nodeuser
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["node","node_modules/@react-router/serve/dist/cli.js","./build/server/index.js"]
