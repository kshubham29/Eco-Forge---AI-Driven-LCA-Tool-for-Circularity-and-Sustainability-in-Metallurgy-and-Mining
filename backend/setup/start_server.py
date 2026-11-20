#!/usr/bin/env python3
"""
Start the FastAPI server for the LCA application
"""
import uvicorn
import os
from pathlib import Path

if __name__ == "__main__":
    # Get the directory of this script
    backend_dir = Path(__file__).parent
    
    # Change to backend directory
    os.chdir(backend_dir)
    
    print("Starting LCA Backend Server...")
    print("Backend will be available at: http://localhost:8000")
    print("API documentation at: http://localhost:8000/docs")
    print("Press Ctrl+C to stop the server")
    
    # Start the server
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
