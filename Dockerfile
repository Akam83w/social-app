FROM node:22-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY apps/api/package*.json ./api/
RUN cd api && npm ci

COPY apps/web/package*.json ./web/
RUN cd web && npm ci

COPY apps/api ./api
COPY apps/web ./web

RUN cd api && npm run build
RUN cd web && npm run build

EXPOSE 3000

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

CMD ["node", "api/dist/server.js"]
