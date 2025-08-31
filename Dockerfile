# --- Frontend build stage ---
FROM node:18 AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Backend stage ---
FROM node:18 AS backend
WORKDIR /app

# Install backend deps
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy backend source
COPY backend ./backend

# Copy built frontend into backend/public
RUN mkdir -p backend/public
COPY --from=frontend /app/frontend/dist ./backend/public

WORKDIR /app/backend
EXPOSE 8080
CMD ["node", "server.js"]
