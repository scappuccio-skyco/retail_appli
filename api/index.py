"""
Vercel Serverless Function for FastAPI Backend
This file serves as the entry point for Vercel serverless functions
"""
import sys
import os

# Add backend directory to Python path
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, os.path.abspath(backend_path))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from mangum import Mangum

# Import must be done after path setup
from backend.main import app

# Create Mangum handler for AWS Lambda/Vercel
# Vercel expects the handler to be named 'handler'
# Note: Mangum automatically handles CORS headers from FastAPI's CORSMiddleware
handler = Mangum(app, lifespan="off")

