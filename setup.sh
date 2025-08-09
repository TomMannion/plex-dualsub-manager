#!/bin/bash

# Plex Dual Subtitle Manager - Setup Script for macOS
# This script sets up the development environment

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

echo -e "${BLUE}🎬 Plex Dual Subtitle Manager - Setup${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Check if Python 3 is installed
echo -e "${BLUE}🔍 Checking Python installation...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed!${NC}"
    echo -e "${YELLOW}Please install Python 3 from https://python.org${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
echo -e "${GREEN}✅ Python ${PYTHON_VERSION} found${NC}"

# Check if Node.js is installed
echo -e "${BLUE}🔍 Checking Node.js installation...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed!${NC}"
    echo -e "${YELLOW}Please install Node.js from https://nodejs.org${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js ${NODE_VERSION} found${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed!${NC}"
    echo -e "${YELLOW}npm should come with Node.js. Please reinstall Node.js.${NC}"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo -e "${GREEN}✅ npm ${NPM_VERSION} found${NC}"

# Create Python virtual environment
echo -e "${BLUE}🐍 Creating Python virtual environment...${NC}"
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "${GREEN}✅ Virtual environment created${NC}"
else
    echo -e "${YELLOW}⚠️  Virtual environment already exists${NC}"
fi

# Activate virtual environment and install Python dependencies
echo -e "${BLUE}📦 Installing Python dependencies...${NC}"
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
echo -e "${GREEN}✅ Python dependencies installed${NC}"

# Install Node.js dependencies
echo -e "${BLUE}📦 Installing Node.js dependencies...${NC}"
cd frontend
npm install
cd ..
echo -e "${GREEN}✅ Node.js dependencies installed${NC}"

# Check if ffmpeg is installed (required for ffsubsync)
echo -e "${BLUE}🔍 Checking ffmpeg installation...${NC}"
if ! command -v ffmpeg &> /dev/null; then
    echo -e "${YELLOW}⚠️  ffmpeg is not installed!${NC}"
    echo -e "${YELLOW}ffsubsync synchronization will not work without ffmpeg.${NC}"
    echo -e "${YELLOW}To install ffmpeg on macOS:${NC}"
    echo -e "${YELLOW}  brew install ffmpeg${NC}"
    echo -e "${YELLOW}Or download from: https://ffmpeg.org/download.html${NC}"
else
    FFMPEG_VERSION=$(ffmpeg -version 2>&1 | head -n1 | cut -d' ' -f3)
    echo -e "${GREEN}✅ ffmpeg ${FFMPEG_VERSION} found${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Setup completed successfully!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "${YELLOW}1. Configure your Plex server connection (if not already done)${NC}"
echo -e "${YELLOW}2. Run: ${GREEN}./run.sh${YELLOW} to start both frontend and backend${NC}"
echo -e "${YELLOW}3. Open ${GREEN}http://localhost:5173${YELLOW} in your browser${NC}"
echo ""
echo -e "${BLUE}Optional: Install ffmpeg for subtitle synchronization${NC}"
echo -e "${YELLOW}  brew install ffmpeg${NC}"
echo ""