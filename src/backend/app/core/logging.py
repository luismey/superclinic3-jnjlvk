# python-json-logger v2.0.0

import asyncio
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional, Dict, Any
from pythonjsonlogger import jsonlogger
import contextvars
from datetime import datetime

from app.core.config import DEBUG, ENVIRONMENT, settings

# Global constants
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
JSON_LOG_FORMAT = "%(timestamp)s %(name)s %(levelname)s %(message)s %(trace_id)s %(environment)s %(performance_metrics)s %(security_event)s"

# Log file paths
LOG_FILE_PATH = Path('logs/app.log')
SECURITY_LOG_PATH = Path('logs/security.log')
PERFORMANCE_LOG_PATH = Path('logs/performance.log')

# Log rotation settings (10MB with 5 backups)
MAX_BYTES = 10_485_760  # 10MB
BACKUP_COUNT = 5

# Async logging queue size
LOG_QUEUE_SIZE = 10_000

# Trace ID context variable for distributed tracing
trace_id_var = contextvars.ContextVar('trace_id', default=None)

class CustomJSONFormatter(jsonlogger.JsonFormatter):
    """Enhanced JSON formatter with support for trace ID, metrics, and security events."""
    
    RESERVED_ATTRS = {
        'args', 'asctime', 'created', 'exc_info', 'exc_text', 'filename',
        'funcName', 'levelname', 'levelno', 'lineno', 'module', 'msecs',
        'msg', 'name', 'pathname', 'process', 'processName', 'relativeCreated',
        'stack_info', 'thread', 'threadName'
    }

    SECURITY_FIELDS = {
        'user_id', 'ip_address', 'endpoint', 'action', 'status',
        'auth_method', 'session_id'
    }

    PERFORMANCE_FIELDS = {
        'response_time', 'cpu_usage', 'memory_usage', 'db_query_time',
        'cache_hits', 'request_id'
    }

    def __init__(self, *args, **kwargs):
        """Initialize the JSON formatter with enhanced formatting capabilities."""
        self.enable_security = kwargs.pop('enable_security', False)
        self.enable_performance = kwargs.pop('enable_performance', False)
        super().__init__(*args, **kwargs)

    def add_fields(self, log_record: Dict[str, Any], record: logging.LogRecord, message_dict: Dict[str, Any]) -> None:
        """Add enhanced fields to the log record."""
        super().add_fields(log_record, record, message_dict)

        # Add ISO format timestamp
        log_record['timestamp'] = datetime.fromtimestamp(record.created).isoformat()
        
        # Add environment information
        log_record['environment'] = ENVIRONMENT
        
        # Add trace ID if available
        trace_id = trace_id_var.get()
        if trace_id:
            log_record['trace_id'] = trace_id

        # Add performance metrics if enabled
        if self.enable_performance:
            metrics = {
                field: getattr(record, field, None)
                for field in self.PERFORMANCE_FIELDS
                if hasattr(record, field)
            }
            if metrics:
                log_record['performance_metrics'] = metrics

        # Add security event data if enabled
        if self.enable_security:
            security_data = {
                field: getattr(record, field, None)
                for field in self.SECURITY_FIELDS
                if hasattr(record, field)
            }
            if security_data:
                log_record['security_event'] = security_data

        # Mask sensitive data
        self._mask_sensitive_data(log_record)

        # Remove reserved attributes to avoid duplication
        for attr in self.RESERVED_ATTRS:
            log_record.pop(attr, None)

    def _mask_sensitive_data(self, log_record: Dict[str, Any]) -> None:
        """Mask sensitive data in log records."""
        sensitive_fields = {'password', 'token', 'secret', 'key', 'credential'}
        
        def mask_dict(d: Dict[str, Any]) -> None:
            for k, v in d.items():
                if isinstance(v, dict):
                    mask_dict(v)
                elif any(field in k.lower() for field in sensitive_fields):
                    d[k] = '********'

        mask_dict(log_record)

def setup_logging() -> None:
    """Configure application-wide logging with enhanced capabilities."""
    # Create logs directory if it doesn't exist
    for path in [LOG_FILE_PATH, SECURITY_LOG_PATH, PERFORMANCE_LOG_PATH]:
        path.parent.mkdir(parents=True, exist_ok=True)

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(settings.LOG_LEVEL if hasattr(settings, 'LOG_LEVEL') else logging.INFO)

    # Create formatters
    json_formatter = CustomJSONFormatter(JSON_LOG_FORMAT)
    console_formatter = logging.Formatter(LOG_FORMAT)

    # Configure main application log handler
    app_handler = RotatingFileHandler(
        LOG_FILE_PATH,
        maxBytes=MAX_BYTES,
        backupCount=BACKUP_COUNT,
        encoding='utf-8'
    )
    app_handler.setFormatter(json_formatter)
    root_logger.addHandler(app_handler)

    # Configure security log handler
    security_handler = RotatingFileHandler(
        SECURITY_LOG_PATH,
        maxBytes=MAX_BYTES,
        backupCount=BACKUP_COUNT,
        encoding='utf-8'
    )
    security_handler.setFormatter(CustomJSONFormatter(JSON_LOG_FORMAT, enable_security=True))
    security_handler.addFilter(lambda record: hasattr(record, 'security_event'))
    root_logger.addHandler(security_handler)

    # Configure performance log handler
    performance_handler = RotatingFileHandler(
        PERFORMANCE_LOG_PATH,
        maxBytes=MAX_BYTES,
        backupCount=BACKUP_COUNT,
        encoding='utf-8'
    )
    performance_handler.setFormatter(CustomJSONFormatter(JSON_LOG_FORMAT, enable_performance=True))
    performance_handler.addFilter(lambda record: hasattr(record, 'performance_metrics'))
    root_logger.addHandler(performance_handler)

    # Add console handler in development mode
    if DEBUG:
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(console_formatter)
        root_logger.addHandler(console_handler)

    # Configure async logging
    if not DEBUG:
        queue_handler = logging.handlers.QueueHandler(asyncio.Queue(maxsize=LOG_QUEUE_SIZE))
        root_logger.addHandler(queue_handler)

def get_logger(
    name: str,
    enable_security_logging: bool = False,
    enable_performance_logging: bool = False
) -> logging.Logger:
    """Get a configured logger instance with enhanced capabilities."""
    logger = logging.getLogger(name)

    # Ensure root logger is configured
    if not logger.handlers and not logging.getLogger().handlers:
        setup_logging()

    # Set logger level based on environment
    logger.setLevel(settings.LOG_LEVEL if hasattr(settings, 'LOG_LEVEL') else logging.INFO)

    # Add context manager for trace ID if not present
    if not hasattr(logger, 'trace_id'):
        setattr(logger, 'trace_id', trace_id_var)

    return logger