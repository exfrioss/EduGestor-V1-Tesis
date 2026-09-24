FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN npm run prisma:generate --workspace=@edugestor/api \
    && npm run build --workspace=@edugestor/shared \
    && npm run build --workspace=@edugestor/api

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=@edugestor/api"]
