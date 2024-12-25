"""
Alembic migrations package initialization module.
Configures migration discovery and version tracking for database schema changes.

This module serves as a package marker for the migrations directory and enables
automated schema versioning through Alembic integration. It provides version
information and package configuration for proper migration management.

Version: 0.1.0
"""

# alembic v1.12.0
from . import env

# Package version for tracking schema versions
__version__ = '0.1.0'

# Package name for proper module resolution
__package__ = 'app.db.migrations'

# Ensure env module is imported for Alembic configuration
if env:
    pass  # env module imported successfully