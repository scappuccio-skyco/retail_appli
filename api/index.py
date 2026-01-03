"""
Vercel Serverless Function for FastAPI Backend
This file serves as the entry point for Vercel serverless functions
"""
import sys
import os

# Add backend directory to Python path
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, backend_path)

from mangum import Mangum
from backend.main import app

# Create Mangum handler for AWS Lambda/Vercel
handler = Mangum(app, lifespan="off")

