FROM node:22-alpine

WORKDIR /app

COPY apps/api/package*.json ./
RUN npm ci

COPY apps/api/ ./

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/server.js"]
