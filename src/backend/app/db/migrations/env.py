# alembic v1.12.0
# sqlalchemy v2.0.0
# asyncio v3.11
# logging v3.11

import asyncio
import logging
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine

from app.db.base import Base
from app.core.config import settings

# Initialize Alembic config object
config = context.config

# Configure logging from alembic.ini if specified
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Initialize logger
logger = logging.getLogger('alembic.env')

# Set target metadata for migrations
target_metadata = Base.metadata

# Configure environment-specific pool settings
POOL_SIZE = settings.DB_POOL_SIZE if settings.ENVIRONMENT == 'production' else 5
POOL_TIMEOUT = settings.DB_POOL_TIMEOUT if settings.ENVIRONMENT == 'production' else 30

def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.
    
    This configures the context with just a URL and not an Engine,
    though an Engine is acceptable here as well. By skipping the Engine creation
    we don't even need a DBAPI to be available.
    
    Calls to context.execute() here emit the given string to the script output.
    """
    try:
        logger.info("Starting offline migration")
        
        # Get database URL from config or settings
        url = config.get_main_option("sqlalchemy.url", settings.DATABASE_URL)
        
        # Configure context with URL and target metadata
        context.configure(
            url=url,
            target_metadata=target_metadata,
            literal_binds=True,
            dialect_opts={"paramstyle": "named"},
            compare_type=True,
            compare_server_default=True,
            include_schemas=True
        )

        with context.begin_transaction():
            logger.debug("Executing offline migration")
            context.run_migrations()
            
        logger.info("Offline migration completed successfully")
        
    except Exception as e:
        logger.error(f"Offline migration failed: {str(e)}")
        raise

async def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode with proper connection handling and pooling.
    
    Creates an Engine and associates a connection with the context.
    Includes comprehensive error handling and resource cleanup.
    """
    try:
        # Configure database connection
        connectable = AsyncEngine(
            config.get_main_option("sqlalchemy.url", settings.DATABASE_URL),
            poolclass=pool.QueuePool,
            pool_size=POOL_SIZE,
            pool_timeout=POOL_TIMEOUT,
            pool_pre_ping=True
        )

        # Configure connection parameters based on environment
        connect_args = {
            "timeout": 60,  # Connection timeout in seconds
            "keepalives": 1 if settings.ENVIRONMENT == "production" else 0,
            "keepalives_idle": 60 if settings.ENVIRONMENT == "production" else 0
        }

        async with connectable.connect() as connection:
            await connection.run_sync(do_run_migrations, connect_args)

        logger.info("Online migration completed successfully")
        
    except Exception as e:
        logger.error(f"Online migration failed: {str(e)}")
        raise
    
    finally:
        await connectable.dispose()

def do_run_migrations(connection: Connection) -> None:
    """
    Execute migrations with the given connection.
    Handles transaction management and context configuration.
    """
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        include_schemas=True,
        transaction_per_migration=True,
        render_as_batch=True
    )
    
    with context.begin_transaction():
        logger.debug("Executing online migration")
        context.run_migrations()

async def run_async_migrations() -> None:
    """
    Asynchronous wrapper for executing migrations.
    Ensures proper async context and resource management.
    """
    try:
        logger.info(f"Starting migration in {settings.ENVIRONMENT} environment")
        
        # Configure logging level based on environment
        if settings.ENVIRONMENT == "production":
            logging.getLogger('alembic').setLevel(logging.WARNING)
        else:
            logging.getLogger('alembic').setLevel(logging.DEBUG)
            
        await run_migrations_online()
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        raise
        
    finally:
        logger.info("Migration process completed")

if context.is_offline_mode():
    logger.info("Running migrations offline")
    run_migrations_offline()
else:
    logger.info("Running migrations online")
    asyncio.run(run_async_migrations())