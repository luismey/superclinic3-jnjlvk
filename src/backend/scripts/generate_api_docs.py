"""
Script to automatically generate comprehensive OpenAPI/Swagger documentation for the FastAPI backend API endpoints.
Includes enhanced security documentation, rate limiting information, and sanitized examples.

Version: 1.0.0
Dependencies:
- typer: ^0.9.0
- pyyaml: ^6.0.1
- rich: ^13.5.2
"""

import json
from pathlib import Path
import typer
import yaml
from rich.console import Console
from rich.panel import Panel

from app.core.config import settings, PROJECT_NAME, VERSION
from main import app

# Initialize CLI app and console
app = typer.Typer(help="API documentation generator CLI")
console = Console()

# Constants
DOCS_DIR = Path(__file__).parent.parent / "docs"

# Security scheme definitions for OpenAPI
SECURITY_SCHEMES = {
    "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "JWT access token obtained from /auth/login endpoint"
    },
    "apiKeyAuth": {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key",
        "description": "API key for application authentication"
    }
}

def generate_openapi_spec() -> dict:
    """
    Generates enhanced OpenAPI specification with comprehensive security documentation.
    
    Returns:
        dict: Enhanced OpenAPI specification
    """
    # Get base OpenAPI schema
    openapi_schema = app.openapi()
    
    # Add security schemes
    openapi_schema["components"]["securitySchemes"] = SECURITY_SCHEMES
    
    # Add global security requirement
    openapi_schema["security"] = [{"bearerAuth": []}]
    
    # Add API information
    openapi_schema["info"].update({
        "title": PROJECT_NAME,
        "version": VERSION,
        "description": "Porfin API - AI-powered WhatsApp automation platform",
        "contact": {
            "name": "API Support",
            "email": "api@porfin.com"
        },
        "license": {
            "name": "Proprietary",
            "url": "https://porfin.com/terms"
        }
    })
    
    # Add server information
    openapi_schema["servers"] = [
        {"url": "/api/v1", "description": "Production API"},
        {"url": "https://staging.porfin.com/api/v1", "description": "Staging API"}
    ]
    
    return openapi_schema

def enhance_security_docs(openapi_spec: dict) -> dict:
    """
    Enhances OpenAPI spec with detailed security documentation.
    
    Args:
        openapi_spec: Base OpenAPI specification
        
    Returns:
        dict: Enhanced specification with security docs
    """
    # Add authentication flow documentation
    openapi_spec["components"]["securitySchemes"]["bearerAuth"]["x-auth-flow"] = {
        "type": "oauth2",
        "flow": "password",
        "tokenUrl": "/auth/login",
        "refreshUrl": "/auth/refresh",
        "scopes": {
            "read": "Read access",
            "write": "Write access"
        }
    }
    
    # Add rate limiting documentation
    openapi_spec["components"]["parameters"] = {
        "RateLimit-Limit": {
            "name": "X-RateLimit-Limit",
            "in": "header",
            "description": "Request limit per time window",
            "required": False,
            "schema": {"type": "integer"}
        },
        "RateLimit-Remaining": {
            "name": "X-RateLimit-Remaining",
            "in": "header",
            "description": "Remaining requests in current time window",
            "required": False,
            "schema": {"type": "integer"}
        },
        "RateLimit-Reset": {
            "name": "X-RateLimit-Reset",
            "in": "header",
            "description": "Time window reset timestamp",
            "required": False,
            "schema": {"type": "integer"}
        }
    }
    
    # Add security error responses
    openapi_spec["components"]["responses"] = {
        "UnauthorizedError": {
            "description": "Authentication failed",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "detail": {"type": "string"}
                        }
                    },
                    "example": {"detail": "Invalid credentials"}
                }
            }
        },
        "RateLimitError": {
            "description": "Rate limit exceeded",
            "headers": {
                "Retry-After": {
                    "description": "Seconds to wait before retrying",
                    "schema": {"type": "integer"}
                }
            },
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "detail": {"type": "string"}
                        }
                    },
                    "example": {"detail": "Rate limit exceeded"}
                }
            }
        }
    }
    
    return openapi_spec

def add_examples(openapi_spec: dict) -> dict:
    """
    Adds comprehensive examples to OpenAPI specification.
    
    Args:
        openapi_spec: OpenAPI specification
        
    Returns:
        dict: Specification with examples
    """
    # Add authentication examples
    auth_path = openapi_spec["paths"]["/auth/login"]
    auth_path["post"]["requestBody"]["content"]["application/json"]["example"] = {
        "email": "user@example.com",
        "password": "********"
    }
    
    # Add user examples
    user_path = openapi_spec["paths"]["/users"]
    user_path["post"]["requestBody"]["content"]["application/json"]["example"] = {
        "email": "newuser@example.com",
        "full_name": "New User",
        "role": "OPERATOR",
        "organization_id": "123e4567-e89b-12d3-a456-426614174000"
    }
    
    # Add assistant examples
    assistant_path = openapi_spec["paths"]["/assistants"]
    assistant_path["post"]["requestBody"]["content"]["application/json"]["example"] = {
        "name": "Sales Assistant",
        "type": "SALES",
        "config": {
            "language": "pt-BR",
            "greeting": "Olá! Como posso ajudar?",
            "tone": "professional"
        }
    }
    
    return openapi_spec

def save_docs(openapi_spec: dict, output_dir: str) -> None:
    """
    Saves generated API documentation in multiple formats.
    
    Args:
        openapi_spec: OpenAPI specification
        output_dir: Output directory path
    """
    # Create output directory
    docs_dir = Path(output_dir)
    docs_dir.mkdir(parents=True, exist_ok=True)
    
    # Save as JSON
    with open(docs_dir / "openapi.json", "w", encoding="utf-8") as f:
        json.dump(openapi_spec, f, indent=2, ensure_ascii=False)
    
    # Save as YAML
    with open(docs_dir / "openapi.yaml", "w", encoding="utf-8") as f:
        yaml.dump(openapi_spec, f, allow_unicode=True)
    
    # Save security documentation separately
    security_docs = {
        "authentication": openapi_spec["components"]["securitySchemes"],
        "rate_limiting": openapi_spec["components"]["parameters"],
        "error_responses": openapi_spec["components"]["responses"]
    }
    with open(docs_dir / "security.json", "w", encoding="utf-8") as f:
        json.dump(security_docs, f, indent=2)
    
    console.print(
        Panel.fit(
            "[green]API documentation generated successfully[/green]\n"
            f"Output directory: {docs_dir}",
            title="Documentation Generator"
        )
    )

@app.command()
def main(
    output_dir: str = typer.Option(
        str(DOCS_DIR),
        "--output", "-o",
        help="Output directory for documentation files"
    ),
    include_examples: bool = typer.Option(
        True,
        "--examples/--no-examples",
        help="Include request/response examples"
    ),
    enhanced_security: bool = typer.Option(
        True,
        "--security/--no-security",
        help="Include enhanced security documentation"
    )
) -> None:
    """
    Generate enhanced API documentation with security details and examples.
    """
    try:
        # Generate base specification
        console.print("Generating OpenAPI specification...")
        spec = generate_openapi_spec()
        
        # Add security documentation
        if enhanced_security:
            console.print("Adding security documentation...")
            spec = enhance_security_docs(spec)
        
        # Add examples
        if include_examples:
            console.print("Adding request/response examples...")
            spec = add_examples(spec)
        
        # Save documentation
        console.print("Saving documentation files...")
        save_docs(spec, output_dir)
        
    except Exception as e:
        console.print(f"[red]Error generating documentation: {str(e)}[/red]")
        raise typer.Exit(code=1)

if __name__ == "__main__":
    app()