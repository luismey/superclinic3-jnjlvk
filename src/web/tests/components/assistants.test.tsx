import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { I18nextProvider } from 'react-i18next';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import i18n from 'i18next-test-utils';

// Components under test
import AssistantCard from '../../src/components/assistants/AssistantCard';
import AssistantBuilder from '../../src/components/assistants/AssistantBuilder';
import AssistantList from '../../src/components/assistants/AssistantList';

// Types and mocks
import { Assistant, AssistantType } from '../../src/types/assistant';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock server setup
const server = setupServer(
  rest.get('/api/v1/assistants', (req, res, ctx) => {
    return res(ctx.json({ items: mockAssistants, total: mockAssistants.length }));
  }),
  rest.post('/api/v1/assistants', (req, res, ctx) => {
    return res(ctx.json(mockAssistant));
  }),
  rest.put('/api/v1/assistants/:id', (req, res, ctx) => {
    return res(ctx.json(mockAssistant));
  })
);

// Test data
const mockAssistant: Assistant = {
  id: 'test-id',
  name: 'Test Assistant',
  type: AssistantType.CUSTOMER_SERVICE,
  description: 'Test description',
  isActive: true,
  metrics: {
    totalMessages: 100,
    avgResponseTime: 1500,
    successRate: 95,
    intentDistribution: {},
    sentimentScores: {},
    costMetrics: {},
    latencyDistribution: {}
  },
  config: {
    promptTemplate: 'Test template',
    temperature: 0.7,
    maxTokens: 150,
    modelName: 'gpt-3.5-turbo',
    contextWindow: 4096,
    fallbackBehavior: 'retry',
    stopSequences: [],
    responseFormat: 'text'
  },
  knowledgeBase: {
    documents: [],
    rules: [],
    intents: [],
    vectorStore: 'pinecone',
    updateFrequency: 'daily'
  },
  version: '1.0',
  lastTrainingDate: new Date(),
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockAssistants = Array.from({ length: 100 }, (_, i) => ({
  ...mockAssistant,
  id: `test-id-${i}`,
  name: `Test Assistant ${i}`
}));

// Test suite setup
beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe('AssistantCard', () => {
  it('renders assistant information correctly', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <AssistantCard assistant={mockAssistant} />
      </I18nextProvider>
    );

    expect(screen.getByText(mockAssistant.name)).toBeInTheDocument();
    expect(screen.getByText(/Atendimento ao Cliente/i)).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText(/1.5s/i)).toBeInTheDocument();
  });

  it('handles click events correctly', async () => {
    const onSelect = jest.fn();
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    render(
      <I18nextProvider i18n={i18n}>
        <AssistantCard
          assistant={mockAssistant}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </I18nextProvider>
    );

    await userEvent.click(screen.getByRole('article'));
    expect(onSelect).toHaveBeenCalledWith(mockAssistant);

    await userEvent.click(screen.getByText(/editar/i));
    expect(onEdit).toHaveBeenCalledWith(mockAssistant);

    await userEvent.click(screen.getByText(/excluir/i));
    expect(onDelete).toHaveBeenCalledWith(mockAssistant);
  });

  it('meets accessibility standards', async () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <AssistantCard assistant={mockAssistant} />
      </I18nextProvider>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders loading state correctly', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <AssistantCard assistant={mockAssistant} isLoading />
      </I18nextProvider>
    );

    expect(screen.getByRole('article')).toHaveClass('animate-pulse');
  });
});

describe('AssistantBuilder', () => {
  it('validates form inputs correctly', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <AssistantBuilder />
      </I18nextProvider>
    );

    await userEvent.type(screen.getByLabelText(/nome/i), 'a');
    await userEvent.tab();

    expect(screen.getByText(/mínimo 2 caracteres/i)).toBeInTheDocument();
  });

  it('handles flow builder operations', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <AssistantBuilder />
      </I18nextProvider>
    );

    const canvas = screen.getByRole('application');
    expect(canvas).toBeInTheDocument();

    // Test node addition
    await userEvent.click(screen.getByText(/adicionar nó/i));
    expect(screen.getByText(/mensagem/i)).toBeInTheDocument();
  });

  it('submits configuration successfully', async () => {
    const onSave = jest.fn();

    render(
      <I18nextProvider i18n={i18n}>
        <AssistantBuilder onSave={onSave} />
      </I18nextProvider>
    );

    await userEvent.type(screen.getByLabelText(/nome/i), 'Test Assistant');
    await userEvent.selectOptions(screen.getByLabelText(/tipo/i), AssistantType.CUSTOMER_SERVICE);
    await userEvent.type(screen.getByLabelText(/modelo de mensagem/i), 'Test template');

    await userEvent.click(screen.getByText(/salvar/i));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
  });

  it('meets accessibility standards', async () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <AssistantBuilder />
      </I18nextProvider>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('AssistantList', () => {
  it('renders virtualized list correctly', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <AssistantList />
      </I18nextProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
    });
  });

  it('handles empty state', async () => {
    server.use(
      rest.get('/api/v1/assistants', (req, res, ctx) => {
        return res(ctx.json({ items: [], total: 0 }));
      })
    );

    render(
      <I18nextProvider i18n={i18n}>
        <AssistantList />
      </I18nextProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/nenhum assistente encontrado/i)).toBeInTheDocument();
    });
  });

  it('handles error state', async () => {
    server.use(
      rest.get('/api/v1/assistants', (req, res, ctx) => {
        return res(ctx.status(500));
      })
    );

    render(
      <I18nextProvider i18n={i18n}>
        <AssistantList />
      </I18nextProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/erro ao carregar/i)).toBeInTheDocument();
    });
  });

  it('meets accessibility standards', async () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <AssistantList />
      </I18nextProvider>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('maintains performance with large lists', async () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <AssistantList />
      </I18nextProvider>
    );

    // Measure initial render time
    performance.mark('start-render');
    await waitFor(() => {
      expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
    });
    performance.mark('end-render');
    performance.measure('render-time', 'start-render', 'end-render');

    const renderTime = performance.getEntriesByName('render-time')[0].duration;
    expect(renderTime).toBeLessThan(200); // 200ms threshold
  });
});