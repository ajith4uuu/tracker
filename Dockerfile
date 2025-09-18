# -------- Base image (for caching) --------
FROM node:20-slim AS base
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

# Ensure reliable signal handling
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/*

# -------- Dependencies layer --------
FROM base AS deps
# Only copy package manifests for better caching
COPY package*.json ./
# Install all deps (allow scripts for packages that need postinstall)
RUN npm ci && npm cache clean --force

# -------- Build layer --------
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build with React Router (Vite). VITE_* come from .env.production baked in the image
RUN npm run build
# Prune devDependencies for runtime
RUN npm prune --omit=dev && npm cache clean --force

# -------- Runtime layer --------
FROM node:20-slim AS runner
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/* \
  && addgroup --system nodejs && adduser --system --ingroup nodejs nodeuser

# Copy artifacts
COPY --chown=nodeuser:nodejs --from=build /app/node_modules ./node_modules
COPY --chown=nodeuser:nodejs --from=build /app/build ./build
COPY --chown=nodeuser:nodejs package*.json ./

USER nodeuser
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["node","node_modules/@react-router/serve/dist/cli.js","./build/server/index.js"]
