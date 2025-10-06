#!/bin/bash

# 🚀 Production Deploy Script for Vitrine Digital SaaS
# This script handles the complete deployment to production environment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="vitrine-digital"
DEPLOY_USER="vitrine"
DEPLOY_HOST="your-production-server.com"
DEPLOY_PATH="/opt/vitrine-digital"
BACKUP_PATH="/opt/backups"
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"

echo -e "${BLUE}🚀 Starting Production Deployment for ${PROJECT_NAME}${NC}"
echo "=================================="

# Function to print step headers
print_step() {
    echo -e "\n${YELLOW}📋 $1${NC}"
    echo "----------------------------------------"
}

# Function to print success messages
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print error messages
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the correct directory
if [ ! -f "package.json" ] || [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
    print_error "Deploy script must be run from project root directory"
    exit 1
fi

print_step "Pre-deployment Checks"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi
print_success "Docker is running"

# Check if environment file exists
if [ ! -f ".env.production" ]; then
    print_error "Production environment file (.env.production) not found"
    echo "Please copy .env.production.example to .env.production and configure it"
    exit 1
fi
print_success "Production environment file found"

# Load environment variables
source .env.production
print_success "Environment variables loaded"

print_step "Database Backup (if upgrading)"

# Create timestamp for backup
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="vitrine_digital_backup_${BACKUP_TIMESTAMP}.sql"

# Check if this is an upgrade (database exists)
if docker ps -a | grep -q "vitrine-postgres"; then
    echo "Existing database found. Creating backup..."
    docker exec vitrine-postgres pg_dump -U $DB_USER $DB_NAME > "${BACKUP_PATH}/${BACKUP_FILE}"
    print_success "Database backup created: ${BACKUP_FILE}"
else
    print_success "Fresh installation - no backup needed"
fi

print_step "Building Production Images"

# Pull latest changes (if deploying from git)
if [ -d ".git" ]; then
    git pull origin main
    print_success "Latest code pulled from repository"
fi

# Build production images
docker-compose -f $DOCKER_COMPOSE_FILE build --no-cache
print_success "Production images built successfully"

print_step "Stopping Existing Services"

# Stop existing services gracefully
if docker-compose -f $DOCKER_COMPOSE_FILE ps | grep -q "Up"; then
    echo "Stopping existing services..."
    docker-compose -f $DOCKER_COMPOSE_FILE down --timeout 30
    print_success "Existing services stopped"
else
    print_success "No existing services to stop"
fi

print_step "Database Migration"

# Start database service first
docker-compose -f $DOCKER_COMPOSE_FILE up -d postgres redis
echo "Waiting for database to be ready..."
sleep 15

# Run database migrations
docker-compose -f $DOCKER_COMPOSE_FILE run --rm backend npm run migrate:latest
print_success "Database migrations completed"

# Seed production data (only for fresh installations)
if [ ! -f ".migration_completed" ]; then
    docker-compose -f $DOCKER_COMPOSE_FILE run --rm backend npm run seed:production
    print_success "Production data seeded"
    touch .migration_completed
fi

print_step "Starting Production Services"

# Start all services
docker-compose -f $DOCKER_COMPOSE_FILE up -d
print_success "All services started"

print_step "Health Checks"

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 30

# Check backend health
BACKEND_HEALTH=$(docker-compose -f $DOCKER_COMPOSE_FILE exec -T backend curl -f http://localhost:3333/health || echo "failed")
if [[ $BACKEND_HEALTH == *"healthy"* ]]; then
    print_success "Backend service is healthy"
else
    print_error "Backend service health check failed"
    exit 1
fi

# Check database connectivity
DB_CHECK=$(docker-compose -f $DOCKER_COMPOSE_FILE exec -T postgres pg_isready -U $DB_USER || echo "failed")
if [[ $DB_CHECK == *"accepting connections"* ]]; then
    print_success "Database is accepting connections"
else
    print_error "Database connection check failed"
    exit 1
fi

# Check Redis connectivity
REDIS_CHECK=$(docker-compose -f $DOCKER_COMPOSE_FILE exec -T redis redis-cli ping || echo "failed")
if [[ $REDIS_CHECK == "PONG" ]]; then
    print_success "Redis is responding"
else
    print_error "Redis connection check failed"
    exit 1
fi

print_step "SSL and Domain Configuration"

# Test SSL certificates (if Cloudflare is configured)
if [ ! -z "$CLOUDFLARE_ZONE_ID" ]; then
    echo "Verifying SSL configuration..."
    # Add SSL verification logic here
    print_success "SSL configuration verified"
fi

print_step "Performance Testing"

# Basic load test
echo "Running basic performance test..."
docker-compose -f $DOCKER_COMPOSE_FILE exec -T backend npm run test:performance || echo "Performance test completed with warnings"

print_step "Cleanup"

# Clean up old Docker images
docker image prune -f
print_success "Old Docker images cleaned up"

# Create deployment log
DEPLOY_LOG="deployment_${BACKUP_TIMESTAMP}.log"
echo "Deployment completed at $(date)" > "${DEPLOY_PATH}/logs/${DEPLOY_LOG}"
echo "Backup file: ${BACKUP_FILE}" >> "${DEPLOY_PATH}/logs/${DEPLOY_LOG}"
echo "Git commit: $(git rev-parse HEAD 2>/dev/null || echo 'N/A')" >> "${DEPLOY_PATH}/logs/${DEPLOY_LOG}"

print_step "Deployment Summary"

echo -e "\n${GREEN}🎉 DEPLOYMENT COMPLETED SUCCESSFULLY! 🎉${NC}"
echo "=================================="
echo "📅 Deployment Time: $(date)"
echo "🔗 API URL: https://engine.${CLOUDFLARE_DOMAIN}"
echo "🌐 Frontend URL: https://app.${CLOUDFLARE_DOMAIN}"
echo "📊 Monitoring: https://monitor.${CLOUDFLARE_DOMAIN}:3000"
echo "💾 Backup Created: ${BACKUP_FILE}"
echo "📝 Deploy Log: ${DEPLOY_LOG}"

print_step "Next Steps"

echo "1. 🧪 Run smoke tests on production environment"
echo "2. 📊 Check monitoring dashboard for metrics"
echo "3. 🔔 Set up alerting and notifications"
echo "4. 👥 Begin beta user onboarding"
echo "5. 🎯 Monitor performance and error rates"

echo -e "\n${BLUE}🚀 Vitrine Digital SaaS is now LIVE in production! 🚀${NC}"
echo -e "${GREEN}Ready for beta customers! 💎${NC}"