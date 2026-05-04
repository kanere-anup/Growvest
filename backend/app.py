"""
Main FastAPI application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from loguru import logger

from core.config import settings
from api.routes import api_router
from core.database import init_db
from core.logging import setup_logging, RequestLoggingMiddleware

# Setup logging as early as possible
setup_logging()

# Initialize FastAPI app
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description="Advanced Stock Market Scanner with multiple strategies"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware
app.add_middleware(RequestLoggingMiddleware)

# Mount static files for frontend
if Path(settings.FRONTEND_BUILD_PATH).exists():
    app.mount("/static", StaticFiles(directory=f"{settings.FRONTEND_BUILD_PATH}/static"), name="static")

# Include API routes
from auth.router import auth_router
app.include_router(auth_router, prefix="/api/v1")
app.include_router(api_router, prefix="/api/v1")

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Stock Market Scanner API",
        "version": settings.API_VERSION,
        "status": "running"
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    from datetime import datetime
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Serve frontend
@app.get("/app")
async def serve_frontend():
    """Serve the React frontend"""
    frontend_path = Path(settings.FRONTEND_BUILD_PATH) / "index.html"
    if frontend_path.exists():
        return FileResponse(frontend_path)
    else:
        return {"message": "Frontend not built. Run 'npm run build' in the frontend directory."}

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    init_db()
    logger.info("Database initialized successfully")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True
    )
