#!/bin/bash

# GitHub Memory System Production Deployment Script
# This script prepares and deploys the production-ready system

set -e

echo "🚀 Starting GitHub Memory System Production Deployment"
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if backend is running
check_backend() {
    echo -e "${YELLOW}Checking backend status...${NC}"
    
    if curl -s http://localhost:5000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is running on port 5000${NC}"
    else
        echo -e "${RED}❌ Backend is not running. Please start it first:${NC}"
        echo "   cd ~/.claude/memory"
        echo "   pm2 start ecosystem.config.js"
        exit 1
    fi
}

# Build production frontend
build_frontend() {
    echo -e "${YELLOW}Building production frontend...${NC}"
    
    # Clean previous build
    rm -rf build
    
    # Build with production environment
    NODE_ENV=production npm run build:prod
    
    echo -e "${GREEN}✅ Frontend built successfully${NC}"
}

# Install production dependencies
install_dependencies() {
    echo -e "${YELLOW}Installing production dependencies...${NC}"
    
    # Check if serve is installed globally
    if ! command -v serve &> /dev/null; then
        echo "Installing serve globally..."
        npm install -g serve
    fi
    
    echo -e "${GREEN}✅ Dependencies ready${NC}"
}

# Deploy frontend
deploy_frontend() {
    echo -e "${YELLOW}Deploying frontend...${NC}"
    
    # Kill any existing process on port 8745
    lsof -ti:8745 | xargs kill -9 2>/dev/null || true
    
    # Start production server
    echo "Starting production server on port 8745..."
    nohup serve -s build -l 8745 > frontend.log 2>&1 &
    
    sleep 2
    
    # Check if frontend is running
    if curl -s http://localhost:8745 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend deployed on http://localhost:8745${NC}"
    else
        echo -e "${RED}❌ Frontend deployment failed${NC}"
        exit 1
    fi
}

# Create systemd service (optional)
create_service() {
    echo -e "${YELLOW}Would you like to create a systemd service for auto-start? (y/n)${NC}"
    read -r response
    
    if [[ "$response" == "y" ]]; then
        cat > github-memory-frontend.service << EOF
[Unit]
Description=GitHub Memory System Frontend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(which serve) -s build -l 8745
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
        
        echo -e "${GREEN}✅ Service file created: github-memory-frontend.service${NC}"
        echo "To install: sudo cp github-memory-frontend.service /etc/systemd/system/"
        echo "Then: sudo systemctl enable github-memory-frontend"
    fi
}

# Main deployment flow
main() {
    echo ""
    echo "📋 Pre-deployment checklist:"
    echo "----------------------------"
    
    # Check Node.js version
    node_version=$(node -v)
    echo "Node.js version: $node_version"
    
    # Check npm version
    npm_version=$(npm -v)
    echo "npm version: $npm_version"
    
    # Check current directory
    echo "Current directory: $(pwd)"
    echo ""
    
    # Run deployment steps
    check_backend
    install_dependencies
    build_frontend
    deploy_frontend
    
    echo ""
    echo -e "${GREEN}🎉 Production deployment complete!${NC}"
    echo ""
    echo "📊 System Status:"
    echo "----------------"
    echo "• Frontend: http://localhost:8745"
    echo "• Backend API: http://localhost:5000"
    echo "• Environment: Production"
    echo ""
    echo "📝 Next steps:"
    echo "• Monitor logs: tail -f frontend.log"
    echo "• Check API health: curl http://localhost:5000/health"
    echo "• View metrics: http://localhost:8745/#analytics"
    echo ""
    
    # Optional: create service
    create_service
}

# Run main function
main