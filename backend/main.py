#!/usr/bin/env python3
"""
Startup script for the Stock Market Scanner Backend
"""
import os
import sys
import subprocess
import time
from pathlib import Path

def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 8):
        print("❌ Python 3.8+ is required")
        sys.exit(1)
    print("✅ Python version check passed")

def check_dependencies():
    """Check if required dependencies are installed"""
    try:
        import fastapi
        import uvicorn
        import pandas
        import yfinance
        import sqlalchemy
        print("✅ All dependencies are installed")
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Please run: pip install -r requirements.txt")
        sys.exit(1)

def setup_directories():
    """Create necessary directories"""
    # directories = [
    #     "../data",
    #     "../logs",
    #     "../exports",
    #     "../frontend/build"
    # ]
    directories = [
        "logs",
        "exports",
    ]
    
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
    print("✅ Directories created")

def initialize_database():
    """Initialize the database"""
    try:
        from core.database import init_db
        init_db()
        print("✅ Database initialized")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        sys.exit(1)

def start_backend():
    """Start the FastAPI backend"""
    print("🚀 Starting backend server...")
    try:
        import uvicorn
        from app import app
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=8000,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n👋 Backend server stopped")
    except Exception as e:
        print(f"❌ Backend startup failed: {e}")
        sys.exit(1)

def main():
    """Main startup function"""
    print("🎯 Stock Market Scanner Backend - Starting up...")
    print("=" * 60)
    
    # Pre-flight checks
    check_python_version()
    check_dependencies()
    setup_directories()
    initialize_database()
    
    print("\n🎉 All checks passed! Starting server...")
    print("📊 Backend will be available at: http://localhost:8000")
    print("📱 API docs will be available at: http://localhost:8000/docs")
    print("🛑 Press Ctrl+C to stop the server")
    print("=" * 60)
    
    # Start the backend
    start_backend()

if __name__ == "__main__":
    main()
