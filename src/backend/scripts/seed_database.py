"""
Database seeding script for Porfin platform.
Creates realistic Brazilian test data for development and staging environments.

Dependencies:
- asyncio: latest
- Faker: ^14.0.0
- datetime: latest
- uuid: latest
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import uuid
from functools import wraps
from faker import Faker
from faker.providers import company, internet, person, phone_number

# Internal imports
from app.db.session import init_db, SessionLocal
from app.models.users import User, UserRole
from app.models.organizations import Organization, VALID_PLANS
from app.core.security import get_password_hash

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure Faker for Brazilian Portuguese
fake = Faker('pt_BR')
fake.add_provider(company)
fake.add_provider(internet)
fake.add_provider(person)
fake.add_provider(phone_number)

# Constants
BATCH_SIZE = 50
MAX_RETRIES = 3

# Sample data configuration
SAMPLE_ORGANIZATIONS = [
    {
        'name': 'Clínica São Paulo',
        'plan': 'professional',
        'type': 'healthcare',
        'settings': {
            'timezone': 'America/Sao_Paulo',
            'language': 'pt-BR',
            'business_hours': {
                'monday': {'start': '08:00', 'end': '18:00'},
                'tuesday': {'start': '08:00', 'end': '18:00'},
                'wednesday': {'start': '08:00', 'end': '18:00'},
                'thursday': {'start': '08:00', 'end': '18:00'},
                'friday': {'start': '08:00', 'end': '18:00'}
            }
        }
    },
    {
        'name': 'Auto Peças Brasil',
        'plan': 'starter',
        'type': 'retail',
        'settings': {
            'timezone': 'America/Sao_Paulo',
            'language': 'pt-BR',
            'business_hours': {
                'monday': {'start': '09:00', 'end': '19:00'},
                'tuesday': {'start': '09:00', 'end': '19:00'},
                'wednesday': {'start': '09:00', 'end': '19:00'},
                'thursday': {'start': '09:00', 'end': '19:00'},
                'friday': {'start': '09:00', 'end': '19:00'},
                'saturday': {'start': '09:00', 'end': '13:00'}
            }
        }
    }
]

def retry_with_backoff(max_attempts: int = MAX_RETRIES):
    """Decorator for retrying database operations with exponential backoff."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_attempts - 1:
                        logger.error(f"Max retry attempts reached for {func.__name__}: {str(e)}")
                        raise
                    wait_time = (2 ** attempt) + 1
                    logger.warning(f"Attempt {attempt + 1} failed, retrying in {wait_time}s: {str(e)}")
                    await asyncio.sleep(wait_time)
            return None
        return wrapper
    return decorator

@retry_with_backoff()
async def create_sample_organizations(db_session) -> List[Organization]:
    """Create sample organizations with Brazilian business profiles."""
    organizations = []
    
    try:
        # Create predefined organizations
        for org_data in SAMPLE_ORGANIZATIONS:
            org = Organization(
                name=org_data['name'],
                plan=org_data['plan'],
                settings=org_data['settings']
            )
            organizations.append(org)
            db_session.add(org)
        
        # Create additional random organizations
        for _ in range(3):
            org = Organization(
                name=fake.company(),
                plan=fake.random_element(VALID_PLANS),
                settings={
                    'timezone': 'America/Sao_Paulo',
                    'language': 'pt-BR',
                    'business_hours': {
                        'monday': {'start': '09:00', 'end': '18:00'},
                        'tuesday': {'start': '09:00', 'end': '18:00'},
                        'wednesday': {'start': '09:00', 'end': '18:00'},
                        'thursday': {'start': '09:00', 'end': '18:00'},
                        'friday': {'start': '09:00', 'end': '18:00'}
                    },
                    'industry': fake.random_element(['retail', 'healthcare', 'services', 'education']),
                    'whatsapp_templates_enabled': True
                }
            )
            organizations.append(org)
            db_session.add(org)
        
        await db_session.flush()
        logger.info(f"Created {len(organizations)} sample organizations")
        return organizations
    
    except Exception as e:
        logger.error(f"Error creating organizations: {str(e)}")
        raise

@retry_with_backoff()
async def create_sample_users(db_session, organizations: List[Organization]) -> List[User]:
    """Create sample users with Brazilian profiles for each organization."""
    users = []
    
    try:
        for org in organizations:
            # Create admin user
            admin = User(
                email=f"admin@{org.name.lower().replace(' ', '')}.com.br",
                full_name=fake.name(),
                role=UserRole.ADMIN,
                organization_id=org.id
            )
            admin.set_password("Admin@123")  # Secure default password
            admin.preferences = {
                'language': 'pt-BR',
                'timezone': 'America/Sao_Paulo',
                'notifications': {
                    'email': True,
                    'whatsapp': True
                }
            }
            users.append(admin)
            db_session.add(admin)

            # Create additional users with different roles
            roles = [UserRole.MANAGER, UserRole.OPERATOR, UserRole.OPERATOR]
            for role in roles:
                user = User(
                    email=fake.email(),
                    full_name=fake.name(),
                    role=role,
                    organization_id=org.id
                )
                user.set_password(f"Test@{fake.random_number(digits=4)}")
                user.preferences = {
                    'language': 'pt-BR',
                    'timezone': 'America/Sao_Paulo',
                    'notifications': {
                        'email': fake.boolean(),
                        'whatsapp': True
                    }
                }
                users.append(user)
                db_session.add(user)

            # Process in batches
            if len(users) >= BATCH_SIZE:
                await db_session.flush()
                users = []

        if users:
            await db_session.flush()
            
        logger.info(f"Created sample users for {len(organizations)} organizations")
        return users
    
    except Exception as e:
        logger.error(f"Error creating users: {str(e)}")
        raise

async def main():
    """Main seeding function with proper error handling and transactions."""
    try:
        # Initialize database
        await init_db()
        logger.info("Database initialized")

        async with SessionLocal() as session:
            async with session.begin():
                # Create organizations
                organizations = await create_sample_organizations(session)
                
                # Create users
                await create_sample_users(session, organizations)
                
                # Commit transaction
                await session.commit()
                logger.info("Database seeding completed successfully")

    except Exception as e:
        logger.error(f"Database seeding failed: {str(e)}")
        raise
    
if __name__ == "__main__":
    asyncio.run(main())