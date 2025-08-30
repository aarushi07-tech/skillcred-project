# Use Node.js 18 as base
FROM node:18 AS build

WORKDIR /app

# Copy frontend and backend package manifests
COPY frontend/package.json frontend/package-lock.json ./frontend/
COPY backend/package.json backend/package-lock.json ./backend/

# Install dependencies
RUN cd frontend && npm install
RUN cd backend && npm install

# Copy all source files
COPY frontend ./frontend
COPY backend ./backend

# Build frontend
RUN cd frontend && npm run build

# --- Runtime image ---
FROM node:18

WORKDIR /app

# Copy backend code
COPY backend ./backend

# Copy frontend build into backend/public (to be served by Express)
COPY --from=build /app/frontend/dist ./backend/public

# Set working directory to backend
WORKDIR /app/backend

# Expose port
EXPOSE 8080

# Start backend
CMD ["npm", "start"]
