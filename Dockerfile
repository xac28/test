# AYA web — multi-stage image. Build:  docker build -t aya --build-arg NEXT_PUBLIC_SITE_URL=https://aya.example.com .
FROM node:20-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
# build-time switches (see README): public address, Content-Security-Policy mode, HSTS (only behind HTTPS)
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG CSP_MODE=report-only
ARG ENABLE_HSTS=false
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL CSP_MODE=$CSP_MODE ENABLE_HSTS=$ENABLE_HSTS NEXT_TELEMETRY_DISABLED=1
# the build needs no database; these values only satisfy module initialisation
ENV DATABASE_URL="mysql://build:build@localhost:3306/build" AUTH_SECRET=build NEXTAUTH_URL=http://localhost:3000
RUN npx prisma generate && npx next build

FROM base AS run
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/next.config.js ./next.config.js
COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /app/storage/recordings /app/public/uploads && chown -R node:node /app/storage /app/public/uploads
USER node
EXPOSE 3000
# uploads and lesson recordings must live on volumes (see docker-compose.yml)
VOLUME ["/app/public/uploads", "/app/storage"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
