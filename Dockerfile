# --- Frontend build stage ---
FROM node:18 AS frontend
WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# --- Backend stage ---
FROM node:18 AS backend
WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./
RUN npm install

# Copy backend source code
COPY backend/ ./

# Copy frontend build into /app/public
RUN mkdir -p public
COPY --from=frontend /frontend/dist ./public

# Expose Render PORT
ENV PORT=8080
EXPOSE 8080

# Start backend server
CMD ["node", "server.js"]
