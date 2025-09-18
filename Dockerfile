# ---------- Base Dependencies ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ---------- Builder Stage ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts && npm cache clean --force
COPY . .
RUN npm run build

# ---------- Runtime Stage ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Init + non-root user
RUN apk add --no-cache tini
RUN addgroup -g 1001 nodejs && adduser -D -u 1001 nodeuser -G nodejs

# Copy artifacts with correct ownership
COPY --from=deps --chown=1001:1001 /app/node_modules ./node_modules
COPY --from=build --chown=1001:1001 /app/build ./build
COPY --chown=1001:1001 package*.json ./

USER nodeuser
EXPOSE 8080
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "node_modules/@react-router/serve/dist/cli.js", "./build/server/index.js"]
