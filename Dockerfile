# --- Frontend build stage ---
FROM node:18 AS frontend
WORKDIR /app/frontend

# Copy package.json first and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy rest of the frontend code
COPY frontend/ ./

# Build frontend using npx
RUN npx vite build


# --- Backend stage ---
FROM node:18 AS backend
WORKDIR /app

# Copy backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy backend code
COPY backend ./backend

# Copy frontend build into backend's public folder
RUN mkdir -p backend/public
COPY --from=frontend /app/frontend/dist ./backend/public

WORKDIR /app/backend
EXPOSE 8080
CMD ["node", "server.js"]
