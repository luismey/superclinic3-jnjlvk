#!/usr/bin/env python3
"""
Superuser creation script for Porfin platform with enhanced security and LGPD compliance.
Provides interactive prompts in Portuguese for secure user creation with full system access.

Version: 1.0.0
Dependencies:
- asyncio: latest
- getpass: latest
- uuid: latest
- argon2-cffi: 21.3.0
"""

import asyncio
import getpass
import uuid
from argon2 import PasswordHasher
from typing import Dict, Optional

from ..app.core.config import ENVIRONMENT, DATABASE_URL, SECURITY_CONFIG
from ..app.models.users import User, UserRole
from ..app.db.session import init_db
from ..app.utils.validators import validate_phone_number

# Security configuration
PASSWORD_REQUIREMENTS = {
    "min_length": 12,
    "require_uppercase": True,
    "require_lowercase": True,
    "require_numbers": True,
    "require_special": True
}

# Default admin preferences with security settings
DEFAULT_PREFERENCES = {
    "notifications": True,
    "language": "pt-BR",
    "theme": "light",
    "security": {
        "mfa_enabled": True,
        "password_expiry_days": 90,
        "session_timeout_minutes": 30
    }
}

MAX_ATTEMPTS = 3

async def get_user_input() -> Dict[str, str]:
    """
    Prompts for and validates user input with enhanced security checks.
    
    Returns:
        Dict containing validated user input
        
    Raises:
        ValueError: If validation fails after maximum attempts
    """
    print("\n=== Criação de Superusuário Porfin ===")
    print("Por favor, forneça as informações necessárias:\n")
    
    user_data = {}
    attempts = 0
    
    while attempts < MAX_ATTEMPTS:
        try:
            # Email validation
            email = input("Email: ").strip().lower()
            if not User.validate_email(email):
                raise ValueError("Formato de email inválido")
            if await User.check_duplicate_email(email):
                raise ValueError("Email já cadastrado")
            user_data['email'] = email
            
            # Full name validation
            full_name = input("Nome completo: ").strip()
            if len(full_name) < 5:
                raise ValueError("Nome deve ter pelo menos 5 caracteres")
            user_data['full_name'] = full_name
            
            # Phone validation
            phone = input("Telefone (com DDD): ").strip()
            validation_result = validate_phone_number(phone)
            if not validation_result.is_valid:
                raise ValueError(validation_result.error_message)
            user_data['phone'] = phone
            
            # Secure password input
            while True:
                password = getpass.getpass("Senha: ")
                if not validate_password_strength(password):
                    print("A senha deve conter pelo menos 12 caracteres, incluindo maiúsculas, minúsculas, números e caracteres especiais")
                    continue
                    
                confirm_password = getpass.getpass("Confirme a senha: ")
                if password != confirm_password:
                    print("As senhas não coincidem")
                    continue
                    
                user_data['password'] = password
                break
            
            # LGPD consent
            print("\nTermos de Consentimento LGPD:")
            print("Ao criar uma conta de superusuário, você concorda com o processamento dos seus dados pessoais")
            consent = input("Digite 'ACEITO' para confirmar: ").strip()
            if consent != "ACEITO":
                raise ValueError("É necessário aceitar os termos LGPD")
            
            return user_data
            
        except ValueError as e:
            attempts += 1
            remaining = MAX_ATTEMPTS - attempts
            if remaining > 0:
                print(f"\nErro: {str(e)}")
                print(f"Tentativas restantes: {remaining}\n")
            else:
                raise ValueError("Número máximo de tentativas excedido")

def validate_password_strength(password: str) -> bool:
    """
    Validates password against security requirements.
    
    Args:
        password: Password string to validate
        
    Returns:
        bool: True if password meets all requirements
    """
    if len(password) < PASSWORD_REQUIREMENTS["min_length"]:
        return False
        
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(not c.isalnum() for c in password)
    
    return all([
        has_upper or not PASSWORD_REQUIREMENTS["require_uppercase"],
        has_lower or not PASSWORD_REQUIREMENTS["require_lowercase"],
        has_digit or not PASSWORD_REQUIREMENTS["require_numbers"],
        has_special or not PASSWORD_REQUIREMENTS["require_special"]
    ])

async def create_superuser(user_data: Dict[str, str]) -> Optional[User]:
    """
    Creates a superuser account with admin privileges and security measures.
    
    Args:
        user_data: Dictionary containing validated user information
        
    Returns:
        Created User instance or None if creation fails
        
    Raises:
        Exception: If database operations fail
    """
    try:
        # Initialize database connection
        await init_db()
        
        # Validate environment
        if ENVIRONMENT == "production":
            print("\nAtenção: Criando superusuário em ambiente de produção!")
            confirm = input("Digite 'CONFIRMAR' para prosseguir: ")
            if confirm != "CONFIRMAR":
                raise ValueError("Operação cancelada pelo usuário")
        
        # Create user instance
        user = User(
            id=uuid.uuid4(),
            email=user_data['email'],
            full_name=user_data['full_name'],
            role=UserRole.ADMIN,
            phone=user_data['phone'],
            preferences=DEFAULT_PREFERENCES
        )
        
        # Set password with Argon2 hashing
        ph = PasswordHasher()
        user.hashed_password = ph.hash(user_data['password'])
        
        # Set LGPD consent tracking
        user.consent_tracking = {
            "terms_accepted": True,
            "data_processing_consent": True,
            "consent_history": [{
                "type": "initial_consent",
                "timestamp": datetime.utcnow().isoformat(),
                "granted": True
            }]
        }
        
        # Save user to database
        async with AsyncSession() as session:
            async with session.begin():
                session.add(user)
                await session.commit()
        
        print("\nSuperusuário criado com sucesso!")
        print(f"Email: {user.email}")
        print("Por favor, faça login para configurar autenticação de dois fatores.")
        
        return user
        
    except Exception as e:
        print(f"\nErro ao criar superusuário: {str(e)}")
        return None

async def main() -> None:
    """
    Main entry point with enhanced error handling and security checks.
    """
    try:
        # Validate script execution environment
        if ENVIRONMENT not in ["development", "staging", "production"]:
            raise ValueError(f"Ambiente inválido: {ENVIRONMENT}")
            
        # Get user input
        user_data = await get_user_input()
        
        # Create superuser
        user = await create_superuser(user_data)
        if not user:
            raise ValueError("Falha na criação do superusuário")
            
    except Exception as e:
        print(f"\nErro fatal: {str(e)}")
        exit(1)
    finally:
        # Cleanup
        print("\nOperação finalizada.")

if __name__ == "__main__":
    asyncio.run(main())