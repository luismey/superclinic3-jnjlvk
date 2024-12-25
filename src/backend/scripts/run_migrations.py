#!/usr/bin/env python3
# alembic v1.12.0
# click v8.1.0
# redis v4.5.0
# tenacity v8.2.0

import os
import sys
import time
from pathlib import Path
from datetime import datetime
import logging
from typing import Optional

import click
import redis
import tenacity
from alembic.config import Config
from alembic import command
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory

from ..app.core.config import ENVIRONMENT, DATABASE_URL
from ..app.db.base import Base

# Configure logging with detailed format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Constants
LOCK_TIMEOUT = 600  # 10 minutes
MAX_RETRIES = 3
MIGRATION_LOCK_KEY = f"porfin:migration_lock:{ENVIRONMENT}"

def setup_alembic_config() -> Config:
    """
    Configure Alembic with proper database URL and migration settings.
    
    Returns:
        Config: Configured Alembic Config object
        
    Raises:
        FileNotFoundError: If alembic.ini is missing
        ValueError: If configuration is invalid
    """
    try:
        # Get project root directory
        project_root = Path(__file__).parent.parent.parent
        alembic_ini_path = project_root / 'alembic.ini'
        
        if not alembic_ini_path.exists():
            raise FileNotFoundError(f"alembic.ini not found at {alembic_ini_path}")
            
        # Create Alembic config
        alembic_cfg = Config(str(alembic_ini_path))
        
        # Set database URL from environment
        alembic_cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
        
        # Set migration script location
        migrations_dir = project_root / 'alembic' / 'versions'
        alembic_cfg.set_main_option("script_location", str(migrations_dir))
        
        # Environment-specific settings
        if ENVIRONMENT == "production":
            alembic_cfg.set_main_option("logging_level", "INFO")
            alembic_cfg.set_main_option("transaction_per_migration", "true")
        else:
            alembic_cfg.set_main_option("logging_level", "DEBUG")
        
        return alembic_cfg
        
    except Exception as e:
        logger.error(f"Failed to configure Alembic: {str(e)}")
        raise

def acquire_migration_lock(redis_client: redis.Redis) -> bool:
    """
    Acquire distributed lock for migration execution.
    
    Args:
        redis_client: Redis client instance
        
    Returns:
        bool: True if lock acquired, False otherwise
    """
    try:
        lock_acquired = redis_client.set(
            MIGRATION_LOCK_KEY,
            str(datetime.utcnow()),
            ex=LOCK_TIMEOUT,
            nx=True
        )
        
        if lock_acquired:
            logger.info("Successfully acquired migration lock")
            return True
        else:
            logger.warning("Migration lock already held by another process")
            return False
            
    except redis.RedisError as e:
        logger.error(f"Redis lock error: {str(e)}")
        return False

def validate_migration(alembic_config: Config, command: str, revision: str) -> bool:
    """
    Perform pre and post migration validation checks.
    
    Args:
        alembic_config: Alembic configuration
        command: Migration command (upgrade/downgrade)
        revision: Target revision
        
    Returns:
        bool: Validation status
    """
    try:
        # Verify database connection
        script = ScriptDirectory.from_config(alembic_config)
        with Base.metadata.bind.connect() as conn:
            context = MigrationContext.configure(conn)
            current_rev = context.get_current_revision()
            
        # Validate revision exists
        if revision != "head" and not script.get_revision(revision):
            raise ValueError(f"Invalid revision: {revision}")
            
        # Additional checks for production
        if ENVIRONMENT == "production":
            if command == "downgrade":
                logger.warning("Downgrade operation requested in production")
                return False
                
            # Verify backup exists for upgrade
            if command == "upgrade":
                backup_path = Path("/backups") / f"pre_migration_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
                if not backup_path.exists():
                    logger.error("Database backup not found before production upgrade")
                    return False
        
        return True
        
    except Exception as e:
        logger.error(f"Migration validation failed: {str(e)}")
        return False

@click.command()
@click.option('--command', default='upgrade', help='Migration command (upgrade/downgrade)')
@click.option('--revision', default='head', help='Migration revision target')
@tenacity.retry(
    stop=tenacity.stop_after_attempt(MAX_RETRIES),
    wait=tenacity.wait_exponential(multiplier=1, min=4, max=10),
    retry=tenacity.retry_if_exception_type(Exception),
    before=tenacity.before_log(logger, logging.INFO),
    after=tenacity.after_log(logger, logging.INFO)
)
def run_migrations(command: str, revision: str) -> None:
    """
    Execute database migrations with comprehensive error handling and progress tracking.
    
    Args:
        command: Migration command (upgrade/downgrade)
        revision: Target revision
    """
    start_time = time.time()
    redis_client = None
    
    try:
        # Initialize Redis client
        redis_client = redis.Redis.from_url(
            os.getenv("REDIS_URL", "redis://localhost:6379/0"),
            socket_timeout=5
        )
        
        # Acquire distributed lock
        if not acquire_migration_lock(redis_client):
            logger.error("Could not acquire migration lock. Exiting.")
            sys.exit(1)
            
        # Setup and validate Alembic configuration
        alembic_cfg = setup_alembic_config()
        
        # Validate migration
        if not validate_migration(alembic_cfg, command, revision):
            logger.error("Migration validation failed")
            sys.exit(1)
            
        logger.info(f"Starting {command} migration to {revision}")
        
        # Execute migration command
        if command == "upgrade":
            command.upgrade(alembic_cfg, revision)
        elif command == "downgrade":
            command.downgrade(alembic_cfg, revision)
        else:
            raise ValueError(f"Invalid command: {command}")
            
        # Log execution time
        execution_time = time.time() - start_time
        logger.info(f"Migration completed successfully in {execution_time:.2f} seconds")
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        raise
        
    finally:
        # Release migration lock
        if redis_client:
            try:
                redis_client.delete(MIGRATION_LOCK_KEY)
                logger.info("Released migration lock")
            except redis.RedisError as e:
                logger.error(f"Failed to release migration lock: {str(e)}")

if __name__ == "__main__":
    run_migrations()