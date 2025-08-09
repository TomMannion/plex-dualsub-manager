#!/bin/bash

# Plex Dual Subtitle Manager - macOS Run Script
# This script starts both the backend and frontend services

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}🎬 Plex Dual Subtitle Manager${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Function to cleanup background processes on exit
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
        echo -e "${GREEN}✅ Backend stopped${NC}"
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
        echo -e "${GREEN}✅ Frontend stopped${NC}"
    fi
    exit 0
}

# Set up signal handling
trap cleanup SIGINT SIGTERM

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${RED}❌ Virtual environment not found!${NC}"
    echo -e "${YELLOW}Please run: python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt${NC}"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${RED}❌ Frontend dependencies not found!${NC}"
    echo -e "${YELLOW}Please run: cd frontend && npm install${NC}"
    exit 1
fi

# Activate virtual environment
echo -e "${BLUE}🔧 Activating Python virtual environment...${NC}"
source venv/bin/activate

# Check if required Python packages are installed
echo -e "${BLUE}🔍 Checking dependencies...${NC}"
python -c "import fastapi, uvicorn, plexapi, pysubs2, ffsubsync" 2>/dev/null || {
    echo -e "${RED}❌ Missing Python dependencies!${NC}"
    echo -e "${YELLOW}Installing dependencies...${NC}"
    pip install -r requirements.txt
}

# Start backend server
echo -e "${BLUE}🚀 Starting backend server...${NC}"
cd backend
python main.py &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Check if backend is running
if ! curl -s http://localhost:8000/api/status > /dev/null; then
    echo -e "${RED}❌ Backend failed to start!${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo -e "${GREEN}✅ Backend running at http://localhost:8000${NC}"

# Start frontend server
echo -e "${BLUE}🚀 Starting frontend server...${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Wait a moment for frontend to start
sleep 3

# Get local network IP
NETWORK_IP=$(ifconfig | grep "inet " | grep -Fv 127.0.0.1 | awk '{print $2}' | head -1)

echo ""
echo -e "${GREEN}🎉 Both servers are now running!${NC}"
echo ""
echo -e "${BLUE}📍 Local Access:${NC}"
echo -e "   Frontend: ${GREEN}http://localhost:5173${NC}"
echo -e "   Backend:  ${GREEN}http://localhost:8000${NC}"
echo -e "   API Docs: ${GREEN}http://localhost:8000/docs${NC}"
echo ""
if [ ! -z "$NETWORK_IP" ]; then
    echo -e "${BLUE}📱 Network Access (other devices):${NC}"
    echo -e "   Frontend: ${GREEN}http://${NETWORK_IP}:5173${NC}"
    echo -e "   Backend:  ${GREEN}http://${NETWORK_IP}:8000${NC}"
    echo ""
fi
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID