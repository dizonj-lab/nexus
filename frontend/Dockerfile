# NEXUS web app. Build from the repository root (the canvas comes from poc/prototype):
#   docker build -f frontend/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend ./
COPY poc/prototype /src/poc/prototype
COPY poc/strategy /src/poc/strategy
ENV NEXT_TELEMETRY_DISABLED=1 NEXUS_BACKEND_URL=http://backend:8000
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /src/frontend/.next/standalone ./
COPY --from=build /src/frontend/.next/static ./.next/static
COPY --from=build /src/frontend/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "server.js"]
