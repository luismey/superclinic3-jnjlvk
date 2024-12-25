// @testing-library/jest-dom v5.16.5 - Custom Jest matchers for DOM testing
import '@testing-library/jest-dom';

// jest-axe v7.0.0 - Accessibility testing utilities
import { configureAxe, toHaveNoViolations } from 'jest-axe';

// whatwg-fetch v3.6.2 - Fetch API polyfill
import 'whatwg-fetch';

// Extend Jest matchers with DOM and accessibility testing utilities
expect.extend({
  toHaveNoViolations,
});

// Configure axe-core for accessibility testing
const axe = configureAxe({
  rules: [
    // WCAG 2.1 AA Compliance Rules
    { id: 'color-contrast', enabled: true },
    { id: 'aria-required-attr', enabled: true },
    { id: 'aria-valid-attr', enabled: true },
    { id: 'button-name', enabled: true },
    { id: 'document-title', enabled: true },
    { id: 'html-has-lang', enabled: true },
    { id: 'image-alt', enabled: true },
    { id: 'label', enabled: true },
    { id: 'link-name', enabled: true },
    { id: 'list', enabled: true },
    { id: 'listitem', enabled: true },
    { id: 'meta-viewport', enabled: true }
  ],
  reporter: 'v2'
});

// Make axe available globally
(global as any).axe = axe;

// Mock ResizeObserver
class MockResizeObserver {
  private observedElements: Set<Element>;
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.observedElements = new Set();
    this.callback = callback;
  }

  observe(target: Element) {
    if (!(target instanceof Element)) {
      throw new Error('ResizeObserver target must be an Element');
    }
    this.observedElements.add(target);
  }

  unobserve(target: Element) {
    this.observedElements.delete(target);
  }

  disconnect() {
    this.observedElements.clear();
  }

  // Helper method for tests to simulate size changes
  simulateResize(entries: ResizeObserverEntry[]) {
    this.callback(entries, this);
  }
}

global.ResizeObserver = MockResizeObserver;

// Mock IntersectionObserver
class MockIntersectionObserver {
  private callback: IntersectionObserverCallback;
  private options: IntersectionObserverInit;
  private observedElements: Map<Element, IntersectionObserverEntry>;

  constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
    this.callback = callback;
    this.options = options;
    this.observedElements = new Map();
  }

  observe(target: Element) {
    if (!(target instanceof Element)) {
      throw new Error('IntersectionObserver target must be an Element');
    }
    
    const entry: IntersectionObserverEntry = {
      boundingClientRect: target.getBoundingClientRect(),
      intersectionRatio: 0,
      intersectionRect: new DOMRectReadOnly(0, 0, 0, 0),
      isIntersecting: false,
      rootBounds: null,
      target,
      time: Date.now()
    };

    this.observedElements.set(target, entry);
  }

  unobserve(target: Element) {
    this.observedElements.delete(target);
  }

  disconnect() {
    this.observedElements.clear();
  }

  // Helper method for tests to simulate intersection changes
  simulateIntersection(entries: IntersectionObserverEntry[]) {
    this.callback(entries, this);
  }
}

global.IntersectionObserver = MockIntersectionObserver;

// Mock matchMedia
interface MockMediaQueryList {
  matches: boolean;
  media: string;
  onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => any) | null;
  addListener(callback: ((this: MediaQueryList, ev: MediaQueryListEvent) => any)): void;
  removeListener(callback: ((this: MediaQueryList, ev: MediaQueryListEvent) => any)): void;
  addEventListener(type: string, callback: EventListener): void;
  removeEventListener(type: string, callback: EventListener): void;
  dispatchEvent(event: Event): boolean;
}

const mockMatchMedia = (query: string): MockMediaQueryList => {
  const listeners: Set<EventListener> = new Set();
  
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener(callback: EventListener) {
      this.addEventListener('change', callback);
    },
    removeListener(callback: EventListener) {
      this.removeEventListener('change', callback);
    },
    addEventListener(type: string, callback: EventListener) {
      listeners.add(callback);
    },
    removeEventListener(type: string, callback: EventListener) {
      listeners.delete(callback);
    },
    dispatchEvent(event: Event) {
      listeners.forEach(listener => listener(event));
      return true;
    }
  };
};

global.matchMedia = mockMatchMedia;

// Configure test environment
beforeAll(() => {
  // Set up a default test URL
  Object.defineProperty(window, 'location', {
    value: new URL('http://localhost')
  });
});

// Clean up after each test
afterEach(() => {
  // Clean up any mounted components or side effects
  jest.clearAllMocks();
});

// Handle uncaught promise rejections
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Promise Rejection:', reason);
});

// Configure fetch mock defaults
beforeEach(() => {
  global.fetch = jest.fn();
});

// Export types for test files
export type { MockMediaQueryList };