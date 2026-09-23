# ---- Build stage ----
FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the project files
COPY . .

# Build SvelteKit app
RUN npm run build

# ---- Production stage ----
FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production

# Only `node` is needed at runtime. The package managers' bundled dependencies (tar,
# brace-expansion, ...) are where the base image's reported CVEs live, so remove them.
RUN rm -rf /usr/local/lib/node_modules /opt/yarn-* \
	/usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg

# adapter-node bundles everything the server needs into ./build (all packages are
# devDependencies), so no node_modules are needed at runtime. package.json is kept for
# "type": "module".
COPY --from=builder /app/package.json ./
COPY --from=builder /app/build ./build

USER node

# Expose SvelteKit default port
EXPOSE 3000

CMD ["node", "build"]
