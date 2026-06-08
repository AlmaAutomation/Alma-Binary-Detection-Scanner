#!/bin/bash
# Alma Scanner - Production Deployment Script

set -e

PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$PROJECT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Alma Scanner Deployment ===${NC}"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[i]${NC} $1"
}

# Check prerequisites
print_info "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    exit 1
fi
print_status "Docker is installed"

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed"
    exit 1
fi
print_status "Docker Compose is installed"

# Clean up old containers
print_info "Cleaning up old containers..."
docker-compose down 2>/dev/null || true

# Build the application
print_info "Building Docker image..."
docker-compose build --no-cache

# Start the services
print_info "Starting services..."
docker-compose up -d

# Wait for service to be ready
print_info "Waiting for services to be ready..."
sleep 10

# Check health
print_info "Checking service health..."
if curl -s http://localhost:9002/healthz > /dev/null; then
    print_status "Backend is healthy"
else
    print_error "Backend health check failed"
    docker-compose logs alma-scanner
    exit 1
fi

# Verify frontend is accessible
if curl -s http://localhost:9002/app > /dev/null; then
    print_status "Frontend is accessible"
else
    print_error "Frontend is not accessible"
    exit 1
fi

# Print summary
echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Services running:"
docker-compose ps
echo ""
echo "Access the application:"
echo "  Frontend:  http://localhost:9002/app"
echo "  API Docs:  http://localhost:9002/docs"
echo "  Grafana:   http://localhost:3000 (admin/admin)"
echo ""
echo "View logs:"
echo "  docker-compose logs -f alma-scanner"
echo ""
echo "Stop services:"
echo "  docker-compose down"
echo ""
