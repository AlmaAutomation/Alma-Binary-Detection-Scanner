# Installation & Deployment Guide

This guide covers multiple deployment scenarios for Alma Scanner.

## Table of Contents

1. [Quick Start (Docker Compose)](#quick-start-docker-compose)
2. [Manual Installation](#manual-installation)
3. [Systemd Service](#systemd-service)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Cloud Deployment](#cloud-deployment)
6. [Troubleshooting](#troubleshooting)

## Quick Start (Docker Compose)

The easiest way to get started is using Docker Compose.

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum
- 10GB disk space

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/alma-scanner.git
cd alma-scanner

# Make deploy script executable
chmod +x deploy.sh

# Run the deployment script
./deploy.sh
```

The deployment script will:
1. Check Docker installation
2. Build the Docker image
3. Start all services (Alma Scanner, Grafana, Prometheus)
4. Verify health checks
5. Display access URLs

### Access the Application

After deployment:

```
Frontend:   http://localhost:9002/app
API Docs:   http://localhost:9002/docs
Grafana:    http://localhost:3000
Prometheus: http://localhost:9090
```

Default credentials:
- Grafana: admin / admin

### Stop Services

```bash
docker-compose down
```

### View Logs

```bash
# Real-time logs
docker-compose logs -f alma-scanner

# Specific service
docker-compose logs grafana
```

## Manual Installation

For development or systems without Docker.

### Prerequisites

- Python 3.9+
- Node.js 16+
- npm 8+
- libmagic (for file type detection)
- Linux/Unix-like system

### Backend Setup

```bash
# Install system dependencies (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv libmagic1 curl

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r backend/requirements.txt

# Verify installation
python -c "import fastapi; print('FastAPI installed')"
```

### Frontend Setup

```bash
# Install Node dependencies
cd alma-frontend
npm install

# Build for production
npm run build

# Or run development server
npm start  # runs on localhost:3000 by default
```

### Deploy Frontend to Backend

```bash
# Copy built frontend to webui directory
cp -r alma-frontend/build/* webui/
```

### Start the Backend

```bash
# From project root
export PYTHONPATH=backend

# Development
python3 -m uvicorn app.main:app \
  --host 127.0.0.1 \
  --port 9002 \
  --reload

# Production
python3 -m uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 9002 \
  --workers 4
```

### Verify Installation

```bash
# Check backend health
curl http://localhost:9002/healthz

# Check API docs
curl http://localhost:9002/docs

# Try demo endpoint
curl -X POST http://localhost:9002/demo/run \
  -H "Content-Type: application/json" \
  -d '{"folder": "/usr/bin", "arch_filter": "all", "limit": 10, "forensic": false}'
```

## Systemd Service

Run Alma Scanner as a system service on Linux.

### Installation

```bash
# Create alma user (optional but recommended)
sudo useradd -r -s /bin/false alma

# Copy service file
sudo cp alma-scanner.service /etc/systemd/system/

# Create application directory
sudo mkdir -p /opt/alma-scanner
sudo cp -r . /opt/alma-scanner/
sudo chown -R alma:alma /opt/alma-scanner

# Install Python dependencies as system packages
cd /opt/alma-scanner
pip install -r backend/requirements.txt

# Reload systemd daemon
sudo systemctl daemon-reload
```

### Enable and Start

```bash
# Enable on boot
sudo systemctl enable alma-scanner

# Start the service
sudo systemctl start alma-scanner

# Check status
sudo systemctl status alma-scanner

# View logs
sudo journalctl -u alma-scanner -f
```

### Stop and Disable

```bash
sudo systemctl stop alma-scanner
sudo systemctl disable alma-scanner
```

### Service Configuration

Edit `/etc/systemd/system/alma-scanner.service` to customize:
- Port (default: 9002)
- Workers (default: 4)
- Memory limit
- CPU quota

Then restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart alma-scanner
```

## Kubernetes Deployment

Deploy Alma Scanner on Kubernetes.

### Prerequisites

- Kubernetes 1.18+
- kubectl configured
- Container registry access

### Build and Push Image

```bash
# Build image
docker build -t yourregistry.azurecr.io/alma-scanner:latest .

# Push to registry
docker push yourregistry.azurecr.io/alma-scanner:latest
```

### Deploy to Kubernetes

```bash
# Create namespace
kubectl create namespace alma-scanner

# Create deployment
cat > k8s-deployment.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alma-scanner
  namespace: alma-scanner
spec:
  replicas: 2
  selector:
    matchLabels:
      app: alma-scanner
  template:
    metadata:
      labels:
        app: alma-scanner
    spec:
      containers:
      - name: alma-scanner
        image: yourregistry.azurecr.io/alma-scanner:latest
        ports:
        - containerPort: 9002
        env:
        - name: LOG_LEVEL
          value: "warning"
        - name: PYTHONUNBUFFERED
          value: "1"
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2"
        livenessProbe:
          httpGet:
            path: /healthz
            port: 9002
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /healthz
            port: 9002
          initialDelaySeconds: 5
          periodSeconds: 10
        volumeMounts:
        - name: data
          mountPath: /app/data
      volumes:
      - name: data
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: alma-scanner-service
  namespace: alma-scanner
spec:
  selector:
    app: alma-scanner
  type: LoadBalancer
  ports:
  - protocol: TCP
    port: 80
    targetPort: 9002
EOF

kubectl apply -f k8s-deployment.yaml
```

### Verify Deployment

```bash
# Check pods
kubectl get pods -n alma-scanner

# Check service
kubectl get svc -n alma-scanner

# View logs
kubectl logs -n alma-scanner deployment/alma-scanner -f
```

## Cloud Deployment

### AWS Elastic Container Service (ECS)

```bash
# Create ECR repository
aws ecr create-repository --repository-name alma-scanner

# Build and push image
docker build -t alma-scanner:latest .
docker tag alma-scanner:latest \
  <aws-account>.dkr.ecr.<region>.amazonaws.com/alma-scanner:latest
docker push <aws-account>.dkr.ecr.<region>.amazonaws.com/alma-scanner:latest

# Create ECS task definition
aws ecs register-task-definition \
  --cli-input-json file://ecs-task-definition.json
```

### Azure Container Instances

```bash
# Create resource group
az group create --name alma-rg --location eastus

# Deploy container
az container create \
  --resource-group alma-rg \
  --name alma-scanner \
  --image yourregistry.azurecr.io/alma-scanner:latest \
  --ports 9002 \
  --cpu 2 --memory 2 \
  --environment-variables LOG_LEVEL=warning
```

### Google Cloud Run

```bash
# Build and push to Google Container Registry
gcloud builds submit --tag gcr.io/PROJECT-ID/alma-scanner

# Deploy
gcloud run deploy alma-scanner \
  --image gcr.io/PROJECT-ID/alma-scanner \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Troubleshooting

### Docker Issues

```bash
# Check Docker daemon
docker ps

# View container logs
docker-compose logs alma-scanner

# Rebuild image (clear cache)
docker-compose build --no-cache

# Check disk space
docker system df
docker system prune -a  # WARNING: removes unused images
```

### Port Already in Use

```bash
# Find process using port 9002
lsof -i :9002

# Kill process
kill -9 <PID>

# Or use different port in docker-compose.yml
```

### Permission Denied

```bash
# Add current user to docker group (Ubuntu/Debian)
sudo usermod -aG docker $USER

# Apply new group membership
newgrp docker

# Test Docker without sudo
docker ps
```

### Frontend Not Loading

```bash
# Check if backend is running
curl http://localhost:9002/healthz

# Check if frontend files exist
ls -la webui/

# Rebuild frontend
cd alma-frontend
npm run build
cp -r build/* ../webui/
```

### High Memory Usage

```bash
# Limit container memory in docker-compose.yml
services:
  alma-scanner:
    mem_limit: 1g
    memswap_limit: 1g
```

### API Timeout

```bash
# Increase timeout in docker-compose.yml
services:
  alma-scanner:
    environment:
      - API_TIMEOUT=300
```

## Performance Tuning

### Backend Workers

Edit `docker-compose.yml`:
```yaml
environment:
  - WORKERS=8  # Increase for high load
```

### Database Connection Pool

Edit backend configuration:
```python
# backend/app/main.py
import sqlalchemy as sa
engine = sa.create_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=40,
    pool_pre_ping=True
)
```

### Cache Configuration

```bash
# Increase cache size
docker-compose exec alma-scanner \
  python -c "from app.storage.cache import set_cache_size; set_cache_size(1000000)"
```

## Upgrading

### Docker Compose

```bash
# Backup data
docker-compose exec alma-scanner tar czf /backup/data.tar.gz /app/data

# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose up -d --build
```

### Manual Installation

```bash
# Backup
tar czf backup.tar.gz backend/ alma-frontend/ webui/

# Update code
git pull origin main

# Reinstall dependencies
pip install -r backend/requirements.txt --upgrade
cd alma-frontend && npm update

# Restart service
sudo systemctl restart alma-scanner
```

## Support

For issues, questions, or suggestions:

- GitHub Issues: https://github.com/yourusername/alma-scanner/issues
- Documentation: https://docs.example.com
- Community: https://community.example.com
