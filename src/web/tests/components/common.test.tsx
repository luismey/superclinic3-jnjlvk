import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import Button from '../../src/components/common/Button';
import Input from '../../src/components/common/Input';
import { theme } from '../../src/config/theme';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock handlers
const mockClick = jest.fn();
const mockChange = jest.fn();
const mockBlur = jest.fn();

// Test setup and cleanup
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('Button Component', () => {
  describe('Rendering and Styling', () => {
    it('renders with correct variant styles', () => {
      const { rerender } = render(<Button>Test Button</Button>);
      
      // Test primary variant (default)
      expect(screen.getByRole('button')).toHaveClass('bg-primary-600');
      
      // Test secondary variant
      rerender(<Button variant="secondary">Test Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-secondary-600');
      
      // Test outline variant
      rerender(<Button variant="outline">Test Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('border-2', 'border-primary-600');
      
      // Test ghost variant
      rerender(<Button variant="ghost">Test Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('text-primary-600');
    });

    it('applies correct size classes', () => {
      const { rerender } = render(<Button>Test Button</Button>);
      
      // Test medium size (default)
      expect(screen.getByRole('button')).toHaveClass('px-4', 'py-2');
      
      // Test small size
      rerender(<Button size="sm">Test Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('px-3', 'py-2');
      
      // Test large size
      rerender(<Button size="lg">Test Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('px-6', 'py-3');
    });

    it('displays loading spinner correctly', () => {
      render(<Button loading>Test Button</Button>);
      
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.getByRole('button')).toHaveClass('cursor-wait');
    });
  });

  describe('Interaction and Behavior', () => {
    it('handles click events properly', async () => {
      render(<Button onClick={mockClick}>Click Me</Button>);
      
      await userEvent.click(screen.getByRole('button'));
      expect(mockClick).toHaveBeenCalledTimes(1);
    });

    it('prevents click when disabled or loading', async () => {
      const { rerender } = render(
        <Button onClick={mockClick} disabled>Disabled Button</Button>
      );
      
      await userEvent.click(screen.getByRole('button'));
      expect(mockClick).not.toHaveBeenCalled();
      
      rerender(<Button onClick={mockClick} loading>Loading Button</Button>);
      await userEvent.click(screen.getByRole('button'));
      expect(mockClick).not.toHaveBeenCalled();
    });

    it('supports keyboard navigation', async () => {
      render(<Button onClick={mockClick}>Keyboard Button</Button>);
      
      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();
      
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(mockClick).toHaveBeenCalled();
      
      fireEvent.keyDown(button, { key: ' ' });
      expect(mockClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG accessibility standards', async () => {
      const { container } = render(<Button>Accessible Button</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('maintains proper ARIA attributes', () => {
      render(
        <Button 
          disabled 
          loading 
          aria-label="Test Button"
        >
          Button Text
        </Button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveAttribute('aria-label', 'Test Button');
    });
  });
});

describe('Input Component', () => {
  describe('Rendering and Styling', () => {
    it('renders with proper base styling', () => {
      render(
        <Input
          id="test-input"
          name="test"
          placeholder="Test Input"
        />
      );
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass(
        'w-full',
        'px-3',
        'py-2',
        'rounded-md',
        'border'
      );
    });

    it('displays error states properly', () => {
      render(
        <Input
          id="test-input"
          name="test"
          error="This is an error message"
        />
      );
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-error-500');
      expect(screen.getByRole('alert')).toHaveTextContent('This is an error message');
    });

    it('applies disabled styles correctly', () => {
      render(
        <Input
          id="test-input"
          name="test"
          disabled
        />
      );
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('bg-gray-100', 'cursor-not-allowed', 'opacity-75');
      expect(input).toBeDisabled();
    });
  });

  describe('Form Integration', () => {
    it('handles value changes correctly', async () => {
      render(
        <Input
          id="test-input"
          name="test"
          onChange={mockChange}
        />
      );
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'test value');
      
      expect(mockChange).toHaveBeenCalledTimes(10); // One call per character
      expect(input).toHaveValue('test value');
    });

    it('handles blur events properly', async () => {
      render(
        <Input
          id="test-input"
          name="test"
          onBlur={mockBlur}
        />
      );
      
      const input = screen.getByRole('textbox');
      input.focus();
      expect(input).toHaveFocus();
      
      input.blur();
      expect(mockBlur).toHaveBeenCalledTimes(1);
    });

    it('supports required field validation', () => {
      render(
        <Input
          id="test-input"
          name="test"
          required
        />
      );
      
      const input = screen.getByRole('textbox');
      expect(input).toBeRequired();
      expect(input).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG accessibility standards', async () => {
      const { container } = render(
        <Input
          id="test-input"
          name="test"
          aria-label="Test Input"
        />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper screen reader support', () => {
      render(
        <Input
          id="test-input"
          name="test"
          aria-label="Test Input"
          error="Error message"
          required
        />
      );
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});