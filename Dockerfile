# syntax=docker/dockerfile:1
#
# AVTOQISM web. Two targets:
#   dev  — Vite dev server with HMR, source mounted from the host
#   prod — nitro node-server build, the image the VPS runs
#
# Build the production image with:  docker build --target prod -t avtoqism-web .
#
# Debian slim rather than Alpine on purpose: Tailwind's oxide binary, rolldown
# and the other native deps publish linux-*-gnu prebuilds far more reliably than
# musl ones, and a missing prebuild turns `npm install` into a compiler error.

# --- dev ---------------------------------------------------------------------
FROM node:22-slim AS dev

WORKDIR /srv/web
ENV NODE_ENV=development
# Vite must listen on every interface, not just the container loopback.
ENV HOST=0.0.0.0

EXPOSE 5173
CMD ["sh", "-c", "npm install --no-audit --no-fund && npx vite dev --host 0.0.0.0 --port 5173"]

# --- build -------------------------------------------------------------------
FROM node:22-slim AS build

WORKDIR /srv/web

# Dependencies first, so a source-only change does not reinstall the world.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Relative by default: nginx serves the app and the API on one origin, so the
# browser calls /api/v1 and never needs CORS.
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV NITRO_PRESET=node-server
RUN npm run build

# --- prod --------------------------------------------------------------------
FROM node:22-slim AS prod

WORKDIR /srv/web
ENV NODE_ENV=production
ENV PORT=3000
# Server-side rendering reaches the API over the compose network, not through
# nginx, so a relative base is resolved against this address.
ENV API_INTERNAL_URL=http://api:8000

COPY --from=build /srv/web/.output ./.output

RUN useradd --system --uid 1001 --create-home avtoqism && chown -R avtoqism:avtoqism /srv/web
USER avtoqism

EXPOSE 3000
# Node 22 has global fetch, so the healthcheck needs no curl or wget in the image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
