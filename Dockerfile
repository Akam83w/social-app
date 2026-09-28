FROM node:22-alpine

WORKDIR /app

# Copy apps package files only (no root package.json exists)
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/

# Install dependencies for both apps with legacy peer deps support
RUN cd apps/api && npm install --legacy-peer-deps
RUN cd apps/web && npm install --legacy-peer-deps

# Copy full source code
COPY apps ./apps

# Build both apps
RUN cd apps/api && npm run build
RUN cd apps/web && npm run build

# Expose port
EXPOSE 3000

# Start the API server
CMD ["node", "apps/api/dist/server.js"]
