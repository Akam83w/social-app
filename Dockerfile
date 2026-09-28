FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/

# Install dependencies
RUN npm install --legacy-peer-deps
RUN cd apps/api && npm install --legacy-peer-deps
RUN cd apps/web && npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build both apps
RUN cd apps/api && npm run build
RUN cd apps/web && npm run build

# Expose port
EXPOSE 3000

# Start the API server
CMD ["node", "apps/api/dist/server.js"]
