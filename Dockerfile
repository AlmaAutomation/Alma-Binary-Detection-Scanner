# Multi-stage build for Alma Scanner

# Stage 1: Frontend build
FROM node:20-alpine as frontend-builder
WORKDIR /app/frontend
COPY alma-frontend/package*.json ./
RUN npm ci
COPY alma-frontend/src ./src
COPY alma-frontend/public ./public
COPY alma-frontend/tailwind.config.js ./
COPY alma-frontend/postcss.config.js ./
RUN npm run build

# Stage 2: Backend runtime
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libmagic1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt uvicorn[standard]

# Copy backend code
COPY backend ./backend
COPY core ./core
COPY ews ./ews
COPY data ./data

# Copy frontend build from stage 1
COPY --from=frontend-builder /app/frontend/build ./webui

# Create necessary directories
RUN mkdir -p /app/data/cache /app/data/models /app/data/reports /app/data/telemetry

# Set environment variables
ENV PYTHONPATH=/app/backend
ENV PYTHONUNBUFFERED=1
ENV LOG_LEVEL=warning

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9002/healthz || exit 1

# Expose port
EXPOSE 9002

# Run the application
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9002"]
