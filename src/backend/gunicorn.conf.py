# gunicorn v21.2.0
# uvicorn v0.23.0

import multiprocessing
import logging
from app.core.config import DEBUG, ENVIRONMENT, LOG_LEVEL
from app.core.logging import setup_logging

# WSGI Application
wsgi_app = 'main:app'

# Binding
bind = '0.0.0.0:8000'

# Worker Configuration
# Using recommended formula: (2 x CPU cores) + 1, capped at 8 workers per instance
# based on infrastructure requirements of 2 vCPU
workers = min(multiprocessing.cpu_count() * 2 + 1, 8)
worker_class = 'uvicorn.workers.UvicornWorker'

# Connection Settings
# Configured for 1000 concurrent users requirement
worker_connections = 1000
backlog = 2048

# Worker Lifecycle
max_requests = 5000  # Restart workers after handling max_requests
max_requests_jitter = 500  # Add randomness to prevent all workers restarting at once
timeout = 30  # Worker timeout in seconds
graceful_timeout = 30  # Graceful worker shutdown time
keepalive = 2  # Keep-alive connection timeout

# Logging Configuration
accesslog = '-'  # stdout
errorlog = '-'  # stderr
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(L)s'
loglevel = LOG_LEVEL

# Performance Optimizations
worker_tmp_dir = '/dev/shm'  # Use RAM-based directory for worker temp files
preload_app = True  # Preload application code before forking workers

def on_starting(server):
    """
    Initialize server configuration and logging before master process starts.
    """
    # Set up structured logging
    setup_logging()
    logger = logging.getLogger("gunicorn.error")
    
    # Log startup configuration
    logger.info(
        "Initializing Gunicorn server",
        extra={
            "environment": ENVIRONMENT,
            "workers": workers,
            "worker_class": worker_class,
            "worker_connections": worker_connections,
            "max_requests": max_requests,
            "preload_app": preload_app
        }
    )

def post_worker_init(worker):
    """
    Configure worker-specific settings after worker initialization.
    """
    logger = logging.getLogger("gunicorn.error")
    
    # Set worker-specific logging context
    logger.info(
        "Initializing worker",
        extra={
            "worker_id": worker.pid,
            "worker_connections": worker_connections,
            "max_requests": max_requests,
            "memory_limit": "4GB"  # Based on infrastructure requirements
        }
    )
    
    # Configure worker resource limits
    try:
        import resource
        # Set soft memory limit to 4GB per worker based on infrastructure specs
        memory_limit = 4 * 1024 * 1024 * 1024  # 4GB in bytes
        resource.setrlimit(resource.RLIMIT_AS, (memory_limit, memory_limit))
    except ImportError:
        logger.warning("Resource module not available for setting memory limits")

def worker_exit(server, worker):
    """
    Handle cleanup and logging when a worker exits.
    """
    logger = logging.getLogger("gunicorn.error")
    
    logger.info(
        "Worker exiting",
        extra={
            "worker_id": worker.pid,
            "requests_handled": worker.requests_handled,
            "exit_code": worker.exitcode if hasattr(worker, 'exitcode') else None
        }
    )

def worker_abort(worker):
    """
    Handle abnormal worker termination.
    """
    logger = logging.getLogger("gunicorn.error")
    
    logger.critical(
        "Worker aborted abnormally",
        extra={
            "worker_id": worker.pid,
            "exit_code": worker.exitcode if hasattr(worker, 'exitcode') else None,
            "last_request": getattr(worker, 'last_request', None)
        }
    )