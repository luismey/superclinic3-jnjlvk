# Porfin Web Frontend

A production-ready WhatsApp automation platform built with Next.js 14, TypeScript, and Tailwind CSS, enabling businesses to streamline customer communication through AI-powered virtual assistants.

## 🚀 Features

- **Real-time WhatsApp Integration**: Seamless messaging experience with WebSocket support
- **AI Virtual Assistants**: Intelligent automated responses powered by advanced language models
- **Campaign Management**: Bulk messaging and automated campaign tools
- **Analytics Dashboard**: Real-time insights and performance metrics
- **Responsive Design**: WCAG 2.1 AA compliant interface that works across all devices

## 📋 Prerequisites

- Node.js >= 18.0.0 LTS
- Docker >= 20.10.0
- Docker Compose >= 2.0.0
- Git >= 2.30.0
- VSCode (recommended)

### Recommended VSCode Extensions

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript + JavaScript
- Docker

## 🛠️ Setup & Development

### Environment Configuration

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8001
NEXT_PUBLIC_AI_ENABLED=true
```

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test:ci
```

### Docker Development Environment

```bash
# Start development containers
docker-compose up -d

# Stop containers
docker-compose down
```

## 📁 Project Structure

```
src/
├── app/                 # Next.js 14 app router pages
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Home page
│   └── [...routes]     # Application routes
├── features/           # Feature-based components
│   ├── chat/          # Chat functionality
│   ├── assistant/     # AI assistant features
│   └── campaign/      # Campaign management
└── shared/            # Shared utilities
    ├── components/    # Common UI components
    ├── hooks/         # Custom React hooks
    └── utils/         # Helper functions
```

## 🔧 Development Guidelines

### Component Architecture

- Use functional components with TypeScript
- Implement proper prop typing and validation
- Follow atomic design principles
- Maintain single responsibility principle

### State Management

```typescript
// Example Zustand store
import create from 'zustand';

interface ChatStore {
  messages: Message[];
  addMessage: (message: Message) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  addMessage: (message) => 
    set((state) => ({ 
      messages: [...state.messages, message] 
    })),
}));
```

### Real-time Integration

- Use WebSocket for real-time messaging
- Implement reconnection strategies
- Handle connection state management
- Maintain message queue for offline support

### Accessibility

- Follow WCAG 2.1 AA guidelines
- Implement proper ARIA attributes
- Ensure keyboard navigation
- Maintain sufficient color contrast
- Support screen readers

### Performance Optimization

- Implement code splitting
- Use image optimization
- Enable proper caching
- Minimize bundle size
- Optimize for Core Web Vitals

### Security Best Practices

- Implement proper CSP headers
- Sanitize user inputs
- Use secure HTTP headers
- Follow OWASP guidelines
- Enable rate limiting

## 🚢 Deployment

### Production Build

```bash
# Create production build
npm run build

# Start production server
npm start
```

### Docker Production Deployment

```bash
# Build production image
docker build -t porfin-web:latest .

# Run production container
docker run -p 3000:3000 porfin-web:latest
```

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:ci

# Run e2e tests
npm run test:e2e
```

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Radix UI Components](https://www.radix-ui.com/docs/primitives)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## 📄 License

This project is proprietary and confidential. All rights reserved.

## 🆘 Support

For support and questions, please contact the development team through:

- Issue Tracker: [GitHub Issues](https://github.com/your-repo/issues)
- Email: support@porfin.com
- Slack: #porfin-dev channel

---

Built with ❤️ by the Porfin Team