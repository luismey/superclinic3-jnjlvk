# Contributing to Porfin

## Table of Contents
- [Introduction](#introduction)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing Guidelines](#testing-guidelines)
- [Security Guidelines](#security-guidelines)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

## Introduction

Welcome to Porfin - Brazil's leading AI-powered WhatsApp automation platform. We appreciate your interest in contributing to our project. This document provides comprehensive guidelines for contributing to both frontend and backend components while ensuring compliance with Brazilian market requirements and WhatsApp integration standards.

### Project Focus
- 🇧🇷 Brazilian market-first approach
- 💬 WhatsApp-centric communication
- 🤖 AI-powered automation
- 🔒 LGPD compliance

## Getting Started

### Repository Structure
```
porfin/
├── frontend/          # Next.js application
├── backend/           # FastAPI services
├── whatsapp/         # WhatsApp integration services
├── infrastructure/   # Cloud infrastructure code
└── docs/            # Documentation
```

### Development Environment Setup

1. **Required Dependencies**
   - Python 3.11+
   - Node.js 18 LTS
   - Docker
   - Git

2. **Local Development Setup**
```bash
# Clone repository
git clone https://github.com/porfin/porfin.git

# Frontend setup
cd frontend
npm install
cp .env.example .env.local

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
cp .env.example .env
```

3. **Environment Configuration**
   - Configure WhatsApp API credentials
   - Set up Firebase credentials
   - Configure OpenAI API keys
   - Set regional configurations (Brazil/São Paulo timezone)

## Development Workflow

### Branch Naming Convention
```
feature/    # New features
bugfix/     # Bug fixes
hotfix/     # Critical fixes
release/    # Release preparation
```

### Commit Message Guidelines
```
type(scope): description

[optional body]

[optional footer]
```
Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

### Language Requirements
- Code: English
- Comments: English
- Documentation: English and Portuguese (Brazil)
- User-facing content: Portuguese (Brazil)

## Code Standards

### Backend (Python/FastAPI)
- Follow PEP 8 style guide
- Type hints required
- Docstrings in Google format
- Performance requirements:
  - API response time: <200ms
  - Database queries: <100ms
  - Message processing: <500ms

```python
from typing import Optional

def process_message(
    message_id: str,
    content: str,
    *,
    user_id: Optional[str] = None
) -> dict:
    """Process incoming WhatsApp message.

    Args:
        message_id: Unique message identifier
        content: Message content
        user_id: Optional user identifier

    Returns:
        dict: Processed message data
    """
    # Implementation
```

### Frontend (TypeScript/Next.js)
- Follow Airbnb style guide
- Strict TypeScript mode
- Component documentation required
- Performance requirements:
  - Initial load: <3s
  - Interaction time: <100ms
  - Lighthouse score: >90

```typescript
interface MessageProps {
  id: string;
  content: string;
  timestamp: Date;
}

const Message: React.FC<MessageProps> = ({
  id,
  content,
  timestamp
}) => {
  // Implementation
};
```

## Testing Guidelines

### Coverage Requirements
- Minimum coverage: 90%
- Critical paths: 95%
- Integration tests required
- E2E tests for critical flows

### Test Types
1. **Unit Tests**
   - Backend: pytest
   - Frontend: Jest + React Testing Library

2. **Integration Tests**
   - API integration tests
   - WhatsApp API integration tests
   - Database integration tests

3. **Performance Tests**
   - Load testing (Artillery)
   - Regional latency testing
   - WhatsApp message throughput

## Security Guidelines

### Security Requirements
- LGPD compliance mandatory
- WhatsApp data protection
- Regular vulnerability scanning
- Security review for PRs

### Security Checklist
- [ ] No credentials in code
- [ ] Input validation implemented
- [ ] Rate limiting configured
- [ ] Data encryption in transit/rest
- [ ] Audit logging enabled
- [ ] LGPD compliance verified
- [ ] WhatsApp security requirements met

## Pull Request Process

### PR Requirements
1. Fill out PR template completely
2. Pass all automated checks:
   - Test coverage ≥90%
   - Code quality score ≥85%
   - Security scan passed
   - Performance benchmarks met

### Review Process
1. Code review by 2+ developers
2. Security review for sensitive changes
3. Performance impact assessment
4. Regional compliance verification

## Release Process

### Version Numbering
```
MAJOR.MINOR.PATCH
```
Example: `1.2.3`

### Release Checklist
1. Version bump
2. Changelog update
3. Translation verification
4. Performance verification
5. Security review
6. Regional compliance check
7. WhatsApp API compatibility check

### Deployment Process
1. Staging deployment
2. Integration testing
3. Performance verification
4. Production deployment
5. Post-deployment monitoring

## Questions and Support

- 📧 Email: dev@porfin.com.br
- 💬 Discord: [Porfin Developers](https://discord.gg/porfin)
- 📝 Issues: GitHub Issues

---

By contributing to Porfin, you agree to abide by our code of conduct and maintain the high standards of code quality and security that our Brazilian business customers expect.