# stay-sync-backend — Node/Express + Prisma, PLUS an embedded Python route-server (FastAPI/osmnx)
# that the Node process spawns itself as a child (see src/services/routeServerProcessService.js,
# which expects it at exactly ./route-server/.venv/bin/uvicorn — kept identical here). One
# container, two runtimes, matching how this already runs on the host — not split into two
# services, to avoid changing the app's own process-management design.
FROM node:22

# osmnx pulls in geospatial deps (GDAL/GEOS/PROJ) that a bare Python venv needs system libs for.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-pip \
    gdal-bin libgdal-dev libgeos-dev libspatialindex-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY route-server/requirements.txt ./route-server/requirements.txt
RUN python3 -m venv route-server/.venv \
    && route-server/.venv/bin/pip install --no-cache-dir -r route-server/requirements.txt

COPY . .
RUN npx prisma generate --schema=./prisma/schema.prisma

EXPOSE 4500
CMD ["node", "server.js"]
