# Stock Market Scanner - Makefile
# Usage: make [target]

.PHONY: help setup test start scan frontend build clean install

# Default target
help:
	@echo "🎯 Stock Market Scanner - Available Commands"
	@echo "=============================================="
	@echo "make setup     - Complete project setup"
	@echo "make test      - Test if setup is working"
	@echo "make start     - Start backend server"
	@echo "make scan      - Run direct scanner"
	@echo "make frontend  - Start frontend development server"
	@echo "make build     - Build frontend for production"
	@echo "make install   - Install all dependencies"
	@echo "make clean     - Clean build artifacts"
	@echo "=============================================="

# Setup
setup:
	@echo "🚀 Running complete setup..."
	python setup.py

# Test
test:
	@echo "🧪 Testing setup..."
	python test_setup.py

# Start backend
start:
	@echo "🚀 Starting backend server..."
	python start_backend.py

# Run scanner
scan:
	@echo "🔍 Running direct scanner..."
	python run_scanner_new.py

# Start frontend
frontend:
	@echo "🎨 Starting frontend development server..."
	cd frontend && npm start

# Build frontend
build:
	@echo "🏗️ Building frontend for production..."
	cd frontend && npm run build

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	pip install -r requirements.txt
	cd frontend && npm install

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf frontend/build
	rm -rf frontend/node_modules
	rm -rf __pycache__
	rm -rf backend/__pycache__
	rm -rf backend/core/__pycache__
	rm -rf backend/api/__pycache__
	rm -rf backend/services/__pycache__
	find . -name "*.pyc" -delete
	find . -name "*.pyo" -delete
