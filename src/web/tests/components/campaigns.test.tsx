import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import axe from '@testing-library/jest-dom';

import CampaignCard from '../../src/components/campaigns/CampaignCard';
import CampaignList from '../../src/components/campaigns/CampaignList';
import CampaignForm from '../../src/components/campaigns/CampaignForm';
import { Campaign, CampaignStatus, CampaignType } from '../../src/types/campaign';

// Mock campaign data
const mockCampaign: Campaign = {
  id: 'test-id',
  name: 'Test Campaign',
  description: 'Test campaign description',
  type: CampaignType.SCHEDULED,
  status: CampaignStatus.DRAFT,
  messageTemplate: {
    content: 'Test message template',
    variables: []
  },
  targetFilters: {
    segments: ['all'],
    customFilters: {}
  },
  scheduleConfig: {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
    timezone: 'America/Sao_Paulo',
    dailyStartHour: 9,
    dailyEndHour: 18,
    activeDays: [1, 2, 3, 4, 5]
  },
  rateLimit: 30,
  analytics: {
    totalRecipients: 1000,
    messagesSent: 500,
    messagesDelivered: 450,
    messagesFailed: 50,
    messagesPending: 500,
    deliveryRate: 90,
    failureRate: 10,
    averageDeliveryTime: 250
  },
  organizationId: 'org-id',
  createdAt: new Date('2023-12-01'),
  updatedAt: new Date('2023-12-01')
};

// Mock handlers
const mockHandlers = {
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onStatusChange: vi.fn(),
  onSubmit: vi.fn(),
  onSort: vi.fn()
};

// Mock WebSocket for real-time updates
const mockWebSocket = vi.fn();
vi.mock('../../src/lib/websocket', () => ({
  useWebSocket: () => mockWebSocket
}));

// Mock performance.now() for timing tests
const mockPerformanceNow = vi.fn();
vi.spyOn(performance, 'now').mockImplementation(mockPerformanceNow);

describe('CampaignCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders campaign card with correct information', () => {
    render(
      <CampaignCard
        campaign={mockCampaign}
        onEdit={mockHandlers.onEdit}
        onDelete={mockHandlers.onDelete}
        onStatusChange={mockHandlers.onStatusChange}
      />
    );

    expect(screen.getByText(mockCampaign.name)).toBeInTheDocument();
    expect(screen.getByText(mockCampaign.description)).toBeInTheDocument();
    expect(screen.getByText(/Draft/i)).toBeInTheDocument();
  });

  it('handles status badge variants correctly', () => {
    const statuses = [
      { status: CampaignStatus.DRAFT, text: 'Draft', variant: 'secondary' },
      { status: CampaignStatus.RUNNING, text: 'Running', variant: 'success' },
      { status: CampaignStatus.PAUSED, text: 'Paused', variant: 'warning' },
      { status: CampaignStatus.COMPLETED, text: 'Completed', variant: 'secondary' }
    ];

    statuses.forEach(({ status, text, variant }) => {
      const campaign = { ...mockCampaign, status };
      const { container } = render(
        <CampaignCard campaign={campaign} />
      );

      const badge = screen.getByText(text);
      expect(badge).toHaveClass(`badge-${variant}`);
    });
  });

  it('disables action buttons when loading', () => {
    render(
      <CampaignCard
        campaign={mockCampaign}
        isLoading={true}
        onEdit={mockHandlers.onEdit}
        onDelete={mockHandlers.onDelete}
      />
    );

    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('calls appropriate handlers on button clicks', async () => {
    render(
      <CampaignCard
        campaign={mockCampaign}
        onEdit={mockHandlers.onEdit}
        onDelete={mockHandlers.onDelete}
        onStatusChange={mockHandlers.onStatusChange}
      />
    );

    fireEvent.click(screen.getByText(/Edit/i));
    expect(mockHandlers.onEdit).toHaveBeenCalledWith(mockCampaign.id);

    fireEvent.click(screen.getByText(/Delete/i));
    expect(mockHandlers.onDelete).toHaveBeenCalledWith(mockCampaign.id);
  });

  it('meets accessibility requirements', async () => {
    const { container } = render(
      <CampaignCard campaign={mockCampaign} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('CampaignList', () => {
  const mockCampaigns = [mockCampaign, { ...mockCampaign, id: 'test-id-2', name: 'Test Campaign 2' }];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders campaign list with correct grid layout', () => {
    render(
      <CampaignList
        campaigns={mockCampaigns}
        onSort={mockHandlers.onSort}
      />
    );

    const list = screen.getByRole('region', { name: /Marketing Campaigns/i });
    expect(list).toHaveClass('grid');
    expect(screen.getAllByRole('article')).toHaveLength(mockCampaigns.length);
  });

  it('handles empty state correctly', () => {
    render(
      <CampaignList
        campaigns={[]}
        onSort={mockHandlers.onSort}
      />
    );

    expect(screen.getByText(/No campaigns found/i)).toBeInTheDocument();
  });

  it('handles loading state with skeleton UI', () => {
    render(
      <CampaignList
        campaigns={[]}
        isLoading={true}
        onSort={mockHandlers.onSort}
      />
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('supports infinite scroll with virtualization', async () => {
    const largeCampaignList = Array(50).fill(null).map((_, index) => ({
      ...mockCampaign,
      id: `test-id-${index}`,
      name: `Test Campaign ${index}`
    }));

    render(
      <CampaignList
        campaigns={largeCampaignList}
        enableVirtualization={true}
        onSort={mockHandlers.onSort}
      />
    );

    // Verify only visible items are rendered
    const visibleItems = screen.getAllByRole('article');
    expect(visibleItems.length).toBeLessThan(largeCampaignList.length);
  });

  it('applies correct sorting and filtering', async () => {
    render(
      <CampaignList
        campaigns={mockCampaigns}
        sortConfig={{ field: 'name', direction: 'asc' }}
        filterConfig={{ status: [CampaignStatus.DRAFT] }}
        onSort={mockHandlers.onSort}
      />
    );

    const items = screen.getAllByRole('article');
    const firstItem = within(items[0]).getByText(/Test Campaign/i);
    expect(firstItem).toBeInTheDocument();
  });
});

describe('CampaignForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form with initial values', () => {
    render(
      <CampaignForm
        initialData={mockCampaign}
        onSubmit={mockHandlers.onSubmit}
        onCancel={() => {}}
      />
    );

    expect(screen.getByLabelText(/Campaign Name/i)).toHaveValue(mockCampaign.name);
    expect(screen.getByLabelText(/Message Content/i)).toHaveValue(mockCampaign.messageTemplate.content);
  });

  it('validates required fields', async () => {
    render(
      <CampaignForm
        onSubmit={mockHandlers.onSubmit}
        onCancel={() => {}}
      />
    );

    fireEvent.click(screen.getByText(/Create Campaign/i));

    await waitFor(() => {
      expect(screen.getByText(/Name must be at least 3 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/Message content is required/i)).toBeInTheDocument();
    });
  });

  it('validates rate limit constraints', async () => {
    render(
      <CampaignForm
        onSubmit={mockHandlers.onSubmit}
        onCancel={() => {}}
      />
    );

    const rateInput = screen.getByLabelText(/Rate Limit/i);
    fireEvent.change(rateInput, { target: { value: '100' } });
    fireEvent.click(screen.getByText(/Create Campaign/i));

    await waitFor(() => {
      expect(screen.getByText(/Rate limit cannot exceed/i)).toBeInTheDocument();
    });
  });

  it('handles form submission with valid data', async () => {
    render(
      <CampaignForm
        initialData={mockCampaign}
        onSubmit={mockHandlers.onSubmit}
        onCancel={() => {}}
      />
    );

    fireEvent.change(screen.getByLabelText(/Campaign Name/i), {
      target: { value: 'Updated Campaign' }
    });

    fireEvent.click(screen.getByText(/Update Campaign/i));

    await waitFor(() => {
      expect(mockHandlers.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Campaign'
        })
      );
    });
  });

  it('disables submit button while submitting', async () => {
    render(
      <CampaignForm
        onSubmit={async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }}
        onCancel={() => {}}
      />
    );

    const submitButton = screen.getByText(/Create Campaign/i);
    fireEvent.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});