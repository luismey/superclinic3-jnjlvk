# Porfin - AI-Powered WhatsApp Automation Platform

[![CI/CD Status](https://github.com/porfin/porfin/workflows/CI/CD/badge.svg)](https://github.com/porfin/porfin/actions)
[![Test Coverage](https://codecov.io/gh/porfin/porfin/branch/main/graph/badge.svg)](https://codecov.io/gh/porfin/porfin)
[![License](https://img.shields.io/github/license/porfin/porfin.svg)](LICENSE)
[![Documentation Status](https://readthedocs.org/projects/porfin/badge/?version=latest)](https://docs.porfin.io)

## Project Overview

Porfin is Brazil's first-to-market AI-powered WhatsApp automation platform designed specifically for small and medium businesses (SMBs). Our platform enables businesses to create, deploy, and manage intelligent virtual assistants that handle customer communications at scale while maintaining personalized service quality.

### Key Features

- 🤖 AI-powered virtual assistants with natural language understanding
- 📱 Seamless WhatsApp integration (Web & Business API)
- 📊 No-code assistant builder with visual flow editor
- 📈 Advanced analytics and performance tracking
- 🚀 Campaign management and automation
- 🔒 Enterprise-grade security and compliance

### Target Market

- Small and medium businesses in Brazil
- Healthcare clinics and medical practices
- Service providers and professionals
- Customer service teams
- Sales organizations

### System Requirements

- **Performance**: API response < 200ms, Message processing < 500ms
- **Scalability**: Support for 1000+ active businesses
- **Reliability**: 99.9% system uptime
- **Compliance**: LGPD, PCI DSS, and WhatsApp Business Policy

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18 LTS
- Docker 24+
- Git 2.40+
- pnpm 8+

### Installation

```bash
# Clone the repository
git clone https://github.com/porfin/porfin.git
cd porfin

# Install dependencies
pnpm install
python -m pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your credentials
```

### Configuration

Required environment variables:

```env
DATABASE_URL=<firestore-connection-string>
REDIS_URL=<redis-connection-string>
OPENAI_API_KEY=<openai-api-key>
WHATSAPP_API_KEY=<whatsapp-business-api-key>
```

### First Assistant

1. Access the platform at `http://localhost:3000`
2. Navigate to Assistant Builder
3. Create a new assistant using the visual editor
4. Configure responses and flows
5. Test and deploy

### Example Usage

```typescript
// Creating a simple greeting flow
const assistant = new Assistant({
  name: "Welcome Bot",
  language: "pt-BR",
  greeting: "Olá! Como posso ajudar?"
});

assistant.addFlow("appointment", {
  trigger: "consulta|agendar|horário",
  action: "scheduleAppointment"
});
```

## Development Setup

### Required Tools

- VS Code or preferred IDE
- Docker Desktop 4.20+
- Terraform 1.5+ (for deployment)
- Google Cloud SDK

### Local Development

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Run tests
pnpm test
python -m pytest

# Lint code
pnpm lint
python -m black .
```

### Testing

- Unit tests: `pnpm test:unit`
- Integration tests: `pnpm test:integration`
- E2E tests: `pnpm test:e2e`
- Coverage report: `pnpm test:coverage`

## Architecture

### System Overview

Porfin follows a microservices architecture with the following key components:

- Next.js Frontend (TypeScript)
- FastAPI Backend (Python)
- WhatsApp Service (Node.js)
- Firestore Database
- Redis Cache
- OpenAI Integration

### Technology Stack

#### Backend
- Python 3.11+ with FastAPI ^0.100.0
- Pydantic ^2.0.0
- Firebase Admin ^6.0.0
- Redis ^4.0.0

#### Frontend
- TypeScript 5.0+ with Next.js ^14.0.0
- Tailwind CSS ^3.0.0
- Radix UI ^2.0.0

#### WhatsApp Service
- Node.js ^18.0.0
- Baileys ^6.0.0

## Deployment

### Development
- Local Docker environment
- Configuration: `docker-compose.dev.yml`
- Hot reloading enabled

### Staging
- GCP Cloud Run deployment
- Terraform configuration: `terraform/staging`
- Automated CI/CD pipeline

### Production
- GCP Cloud Run deployment
- Terraform configuration: `terraform/production`
- Blue/Green deployment strategy

## Security

### Authentication
- JWT-based authentication
- Role-based access control (RBAC)
- Multi-factor authentication support

### Data Protection
- End-to-end encryption for messages
- AES-256 encryption at rest
- TLS 1.3 for data in transit

### Compliance
- LGPD (Brazilian Data Protection Law) compliant
- WhatsApp Business Policy adherent
- Regular security audits

## Contributing

Please read our [Contributing Guidelines](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Support

### Documentation
- [Official Documentation](https://docs.porfin.io)
- [API Reference](https://api.porfin.io)
- [Developer Guide](https://docs.porfin.io/dev)

### Community
- [Discord Community](https://discord.gg/porfin)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/porfin)
- [GitHub Discussions](https://github.com/porfin/porfin/discussions)

### Professional Support
- [Enterprise Support Plans](https://porfin.io/enterprise)
- [Training & Workshops](https://porfin.io/training)
- Email: support@porfin.io

## License

This project is licensed under the terms of the [MIT license](LICENSE).