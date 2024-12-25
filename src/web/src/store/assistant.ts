// @ts-check
import { create } from 'zustand'; // v4.4.0
import { devtools, persist } from 'zustand/middleware'; // v4.4.0
import { Assistant, AssistantMetrics } from '../types/assistant';
import { assistantService } from '../services/assistant';

// Store state interface
interface AssistantState {
  // Data
  assistants: Assistant[];
  selectedAssistant: Assistant | null;
  metrics: AssistantMetrics | null;
  
  // Loading states
  loading: boolean;
  metricsLoading: boolean;
  
  // Error states
  error: string | null;
  metricsError: string | null;

  // Actions
  fetchAssistants: () => Promise<void>;
  selectAssistant: (id: string) => Promise<void>;
  createAssistant: (assistant: Omit<Assistant, 'id' | 'createdAt' | 'updatedAt' | 'metrics'>) => Promise<void>;
  updateAssistant: (id: string, updates: Partial<Assistant>) => Promise<void>;
  deleteAssistant: (id: string) => Promise<void>;
  fetchMetrics: (assistantId: string, timeRange: { startDate: Date; endDate: Date }) => Promise<void>;
  updateMetrics: (assistantId: string, metrics: Partial<AssistantMetrics>) => Promise<void>;
  clearMetrics: () => void;
}

// Constants
const STORE_NAME = 'assistantStore';
const METRICS_UPDATE_INTERVAL = 60000; // 1 minute
const METRICS_RETRY_ATTEMPTS = 3;

// Create the store with middleware
export const useAssistantStore = create<AssistantState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        assistants: [],
        selectedAssistant: null,
        metrics: null,
        loading: false,
        metricsLoading: false,
        error: null,
        metricsError: null,

        // Fetch all assistants
        fetchAssistants: async () => {
          set({ loading: true, error: null });
          try {
            const response = await assistantService.getAssistants('', { page: 1, pageSize: 100 });
            set({ assistants: response.items, loading: false });
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to fetch assistants',
              loading: false 
            });
          }
        },

        // Select and load a specific assistant
        selectAssistant: async (id: string) => {
          set({ loading: true, error: null });
          try {
            const assistant = await assistantService.getAssistant(id);
            set({ selectedAssistant: assistant, loading: false });
            
            // Start metrics polling for selected assistant
            const state = get();
            if (state.selectedAssistant) {
              const timeRange = {
                startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
                endDate: new Date()
              };
              state.fetchMetrics(id, timeRange);
            }
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to select assistant',
              loading: false 
            });
          }
        },

        // Create new assistant
        createAssistant: async (assistant) => {
          set({ loading: true, error: null });
          try {
            const created = await assistantService.createAssistant(assistant);
            set(state => ({ 
              assistants: [...state.assistants, created],
              loading: false 
            }));
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to create assistant',
              loading: false 
            });
          }
        },

        // Update existing assistant
        updateAssistant: async (id, updates) => {
          set({ loading: true, error: null });
          try {
            const updated = await assistantService.updateAssistant(id, updates);
            set(state => ({
              assistants: state.assistants.map(a => a.id === id ? updated : a),
              selectedAssistant: state.selectedAssistant?.id === id ? updated : state.selectedAssistant,
              loading: false
            }));
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to update assistant',
              loading: false 
            });
          }
        },

        // Delete assistant
        deleteAssistant: async (id) => {
          set({ loading: true, error: null });
          try {
            await assistantService.deleteAssistant(id);
            set(state => ({
              assistants: state.assistants.filter(a => a.id !== id),
              selectedAssistant: state.selectedAssistant?.id === id ? null : state.selectedAssistant,
              loading: false
            }));
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to delete assistant',
              loading: false 
            });
          }
        },

        // Fetch assistant metrics with retry logic
        fetchMetrics: async (assistantId: string, timeRange: { startDate: Date; endDate: Date }) => {
          set({ metricsLoading: true, metricsError: null });
          
          let attempts = 0;
          while (attempts < METRICS_RETRY_ATTEMPTS) {
            try {
              const metrics = await assistantService.getAssistantMetrics(assistantId, timeRange);
              set({ metrics, metricsLoading: false });
              break;
            } catch (error) {
              attempts++;
              if (attempts === METRICS_RETRY_ATTEMPTS) {
                set({ 
                  metricsError: error instanceof Error ? error.message : 'Failed to fetch metrics',
                  metricsLoading: false 
                });
              }
              // Exponential backoff
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
            }
          }
        },

        // Update metrics for real-time monitoring
        updateMetrics: async (assistantId: string, metrics: Partial<AssistantMetrics>) => {
          try {
            set(state => ({
              metrics: state.metrics ? { ...state.metrics, ...metrics } : null
            }));
          } catch (error) {
            set({ 
              metricsError: error instanceof Error ? error.message : 'Failed to update metrics'
            });
          }
        },

        // Clear metrics state
        clearMetrics: () => {
          set({ metrics: null, metricsError: null });
        }
      }),
      {
        name: STORE_NAME,
        partialize: (state) => ({
          assistants: state.assistants,
          selectedAssistant: state.selectedAssistant
        })
      }
    ),
    { name: STORE_NAME }
  )
);

// Export type for type safety
export type AssistantStore = typeof useAssistantStore;