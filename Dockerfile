FROM node:22-alpine

WORKDIR /app

COPY apps/api/package*.json ./api/
RUN cd api && npm install --include=dev

COPY apps/web/package*.json ./web/
RUN cd web && npm install --include=dev

COPY apps/api ./api
COPY apps/web ./web

RUN cd api && npm run build
RUN cd web && npm run build

EXPOSE 3000

CMD ["node", "api/dist/server.js"]
