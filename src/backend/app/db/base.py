# importlib (latest) - For dynamic module imports
# logging (latest) - For logging functionality

import importlib
import logging
from pathlib import Path
from typing import List

from .session import Base

# Configure module logger
logger = logging.getLogger(__name__)

# List of model modules to register
# These paths are relative to the models directory
MODEL_MODULES = [
    "organization",  # Organization model
    "user",         # User model
    "whatsapp",     # WhatsApp account model
    "chat",         # Chat model
    "message",      # Message model
    "assistant",    # Virtual assistant model
    "campaign",     # Campaign model
    "customer",     # Customer model
    "knowledge"     # Knowledge base model
]

def register_models() -> None:
    """
    Dynamically registers all SQLAlchemy models to ensure proper schema creation
    and relationship management while preventing circular dependencies.
    
    This function imports each model module dynamically to allow models to reference
    each other without creating import cycles. It should be called during application
    startup after the Base class is configured but before creating database tables.
    
    The function will:
    1. Attempt to import each model module from the models package
    2. Log successful model registrations
    3. Handle import errors gracefully
    4. Ensure all models are properly registered with SQLAlchemy metadata
    
    Raises:
        ImportError: If a required model module cannot be found
        Exception: For other unexpected errors during model registration
    """
    try:
        # Get the path to the models directory
        models_path = Path(__file__).parent.parent / "models"
        
        # Verify models directory exists
        if not models_path.exists():
            raise ImportError(f"Models directory not found at {models_path}")
            
        logger.info("Starting model registration process")
        
        # Track successfully registered models
        registered_models: List[str] = []
        
        # Import each model module
        for model_name in MODEL_MODULES:
            try:
                # Construct the full module path
                module_path = f"app.models.{model_name}"
                
                # Dynamically import the module
                importlib.import_module(module_path)
                
                # Track successful registration
                registered_models.append(model_name)
                logger.debug(f"Successfully registered model: {model_name}")
                
            except ImportError as e:
                logger.error(f"Failed to import model {model_name}: {str(e)}")
                raise ImportError(f"Required model module '{model_name}' could not be imported") from e
            except Exception as e:
                logger.error(f"Error registering model {model_name}: {str(e)}")
                raise
        
        # Verify all models were registered
        if len(registered_models) != len(MODEL_MODULES):
            missing_models = set(MODEL_MODULES) - set(registered_models)
            raise Exception(f"Failed to register models: {', '.join(missing_models)}")
        
        # Log successful completion
        logger.info(f"Successfully registered {len(registered_models)} models")
        
        # Verify metadata is properly configured
        if not Base.metadata.tables:
            raise Exception("No tables found in SQLAlchemy metadata after model registration")
            
    except Exception as e:
        logger.error(f"Model registration failed: {str(e)}")
        raise

# Export Base class for model inheritance
__all__ = ["Base", "register_models"]