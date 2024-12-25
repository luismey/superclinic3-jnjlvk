from setuptools import setup, find_packages  # setuptools v65.5.1+

def read_requirements():
    """Read and parse requirements from requirements.txt file."""
    with open('requirements.txt', 'r', encoding='utf-8') as f:
        return [line.strip() for line in f.readlines() 
                if line.strip() and not line.startswith('#')]

setup(
    name="porfin-backend",
    version="0.1.0",
    description="Backend service for Porfin WhatsApp automation platform with AI-powered customer communication capabilities",
    author="Porfin Team",
    author_email="team@porfin.com",
    python_requires=">=3.11",
    
    # Package discovery
    package_dir={"": "app"},
    packages=find_packages(where="app"),
    
    # Core dependencies
    install_requires=[
        # Core Framework
        "fastapi>=0.100.0",
        "uvicorn>=0.22.0",
        "gunicorn>=21.2.0",
        "starlette>=0.27.0",
        
        # Data Validation
        "pydantic>=2.0.0",
        "email-validator>=2.0.0",
        "python-multipart>=0.0.6",
        
        # Database
        "sqlalchemy>=2.0.0",
        "alembic>=1.11.0",
        "firebase-admin>=6.2.0",
        "redis>=5.0.0",
        "asyncpg>=0.27.0",
        
        # Security
        "python-jose>=3.3.0",
        "passlib>=1.7.4",
        "bcrypt>=4.0.1",
        "cryptography>=41.0.0",
        
        # AI/ML
        "openai>=1.0.0",
        "numpy>=1.24.0",
        "pandas>=2.0.0",
        
        # Utilities
        "aiohttp>=3.8.5",
        "python-dateutil>=2.8.2",
        "pytz>=2023.3",
        "pyyaml>=6.0.1",
        "ujson>=5.8.0",
    ],
    
    # Optional dependencies
    extras_require={
        "dev": [
            "pytest>=7.4.0",
            "pytest-asyncio>=0.21.1",
            "pytest-cov>=4.1.0",
            "pytest-mock>=3.11.1",
            "black>=23.7.0",
            "flake8>=6.1.0",
            "mypy>=1.5.0",
            "isort>=5.12.0",
            "pre-commit>=3.3.3",
            "bandit>=1.7.5",
        ],
        "monitoring": [
            "opentelemetry-api>=1.20.0",
            "opentelemetry-sdk>=1.20.0",
            "opentelemetry-instrumentation-fastapi>=0.41b0",
            "opentelemetry-instrumentation-sqlalchemy>=0.41b0",
            "opentelemetry-instrumentation-redis>=0.41b0",
            "prometheus-client>=0.17.1",
        ],
    },
    
    # Entry points
    entry_points={
        "console_scripts": [
            "porfin-backend=app.main:start",
        ],
    },
    
    # Package metadata
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Programming Language :: Python :: 3.11",
        "Operating System :: OS Independent",
        "Framework :: FastAPI",
        "Topic :: Software Development :: Libraries :: Application Frameworks",
        "Topic :: Communications :: Chat",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Natural Language :: Portuguese",
        "Environment :: Web Environment",
        "License :: OSI Approved :: MIT License",
    ],
    
    # Additional package metadata
    keywords="whatsapp automation ai chatbot fastapi async",
    project_urls={
        "Documentation": "https://docs.porfin.com",
        "Source": "https://github.com/porfin/backend",
        "Issues": "https://github.com/porfin/backend/issues",
    },
    
    # Package data and configuration
    include_package_data=True,
    zip_safe=False,
    
    # License
    license="MIT",
)