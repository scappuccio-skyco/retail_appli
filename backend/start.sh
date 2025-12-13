#!/bin/bash
# Custom startup script for Emergent deployment
# Uses 1 worker to reduce CPU/memory load during startup

echo "[STARTUP SCRIPT] Starting backend with 1 worker..."
exec uvicorn main:app --host 0.0.0.0 --port 8001 --workers 1
