"""
Initialization module for backend administration scripts providing centralized access
to system utilities with comprehensive error handling and security validation.

Version: 1.0.0
Dependencies:
- typer: ^0.9.0
- logging: built-in
- os: built-in
"""

import logging
import os
from typing import Dict, Optional

import typer

from .create_superuser import main as create_superuser_main
from .generate_api_docs import app as docs_app
from .run_migrations import run_migrations as run_migrations_main
from .seed_database import main as seed_database_main

# Initialize Typer app with help description
app = typer.Typer(help="Porfin backend administration utilities")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

def validate_environment() -> bool:
    """
    Validate execution environment for command safety.
    
    Returns:
        bool: True if environment is valid, raises EnvironmentError otherwise
    
    Raises:
        EnvironmentError: If environment validation fails
    """
    try:
        # Check required environment variables
        required_vars = [
            "DATABASE_URL",
            "ENVIRONMENT",
            "SECRET_KEY",
            "REDIS_URL"
        ]
        
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        if missing_vars:
            raise EnvironmentError(
                f"Missing required environment variables: {', '.join(missing_vars)}"
            )
            
        # Validate environment value
        valid_environments = {"development", "staging", "production"}
        current_env = os.getenv("ENVIRONMENT", "").lower()
        if current_env not in valid_environments:
            raise EnvironmentError(
                f"Invalid environment: {current_env}. Must be one of: {', '.join(valid_environments)}"
            )
            
        # Verify database URL format
        db_url = os.getenv("DATABASE_URL", "")
        if not db_url.startswith(("postgresql://", "postgresql+asyncpg://")):
            raise EnvironmentError("Invalid DATABASE_URL format")
            
        logger.info(f"Environment validated successfully: {current_env}")
        return True
        
    except Exception as e:
        logger.error(f"Environment validation failed: {str(e)}")
        raise

def handle_command_error(error: Exception, command_name: str) -> None:
    """
    Handle and log command execution errors with proper context.
    
    Args:
        error: Exception that occurred
        command_name: Name of the command that failed
        
    Raises:
        typer.Exit: With appropriate error code
    """
    error_msg = f"Command '{command_name}' failed: {str(error)}"
    logger.error(error_msg)
    
    # Map error types to exit codes
    error_codes = {
        EnvironmentError: 1,
        ValueError: 2,
        PermissionError: 3,
        ConnectionError: 4
    }
    
    exit_code = error_codes.get(type(error), 5)
    raise typer.Exit(code=exit_code)

def register_commands() -> None:
    """
    Register all available CLI commands with proper error handling and validation.
    """
    try:
        # Validate environment before registering commands
        validate_environment()
        
        @app.command()
        def create_superuser() -> None:
            """Create a new superuser account with enhanced security validation."""
            try:
                typer.run(create_superuser_main)
            except Exception as e:
                handle_command_error(e, "create_superuser")
                
        @app.command()
        def generate_docs(
            output_dir: str = typer.Option(
                "docs",
                "--output", "-o",
                help="Output directory for API documentation"
            ),
            include_examples: bool = typer.Option(
                True,
                "--examples/--no-examples",
                help="Include request/response examples"
            )
        ) -> None:
            """Generate comprehensive API documentation."""
            try:
                docs_app(
                    output_dir=output_dir,
                    include_examples=include_examples
                )
            except Exception as e:
                handle_command_error(e, "generate_docs")
                
        @app.command()
        def run_migrations(
            command: str = typer.Option(
                "upgrade",
                "--command", "-c",
                help="Migration command (upgrade/downgrade)"
            ),
            revision: str = typer.Option(
                "head",
                "--revision", "-r",
                help="Migration revision target"
            )
        ) -> None:
            """Run database migrations with proper validation."""
            try:
                run_migrations_main(command=command, revision=revision)
            except Exception as e:
                handle_command_error(e, "run_migrations")
                
        @app.command()
        def seed_database() -> None:
            """Seed database with sample data for development."""
            try:
                if os.getenv("ENVIRONMENT") == "production":
                    raise EnvironmentError("Cannot seed database in production environment")
                typer.run(seed_database_main)
            except Exception as e:
                handle_command_error(e, "seed_database")
                
        logger.info("CLI commands registered successfully")
        
    except Exception as e:
        logger.error(f"Failed to register commands: {str(e)}")
        raise

# Register commands on module import
register_commands()

# Export the Typer app instance
__all__ = ["app"]