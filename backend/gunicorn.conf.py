# Gunicorn configuration file for Emergent deployment
# Optimized for container startup with limited resources

import multiprocessing
import os

# Bind to port 8001
bind = "0.0.0.0:8001"

# Use 1 worker to reduce CPU/memory load during startup
# This prevents health check timeouts (520 errors)
workers = 1

# Worker class for async support
worker_class = "uvicorn.workers.UvicornWorker"

# Timeout settings - increase for Atlas cold starts
timeout = 120
graceful_timeout = 30
keepalive = 5

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Process naming
proc_name = "retail-performer-api"

# Preload app for faster worker startup
preload_app = True

# Print startup info
print(f"[GUNICORN CONFIG] Workers: {workers}, Timeout: {timeout}s", flush=True)
