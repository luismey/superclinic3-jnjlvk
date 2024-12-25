import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Node,
  NodeChange,
  NodeTypes,
  Panel,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from 'reactflow';
import classNames from 'classnames';
import { shallow } from 'zustand/shallow';
import NodeEditor from './NodeEditor';
import { AssistantType } from '../../types/assistant';
import { useAssistant } from '../../hooks/useAssistant';
import 'reactflow/dist/style.css';

// Performance optimization thresholds
const PERFORMANCE_THRESHOLDS = {
  RENDER_TIME_MS: 100,
  INTERACTION_DELAY_MS: 50,
  MAX_NODES_BEFORE_VIRTUALIZATION: 50,
} as const;

// Validation rules for the flow diagram
const VALIDATION_RULES = {
  MAX_NODES: 100,
  MAX_EDGES: 200,
  MAX_DEPTH: 10,
  REQUIRED_NODES: ['START', 'END'],
} as const;

// Accessibility configuration
const ACCESSIBILITY_CONFIG = {
  ARIA_LABELS: {
    canvas: 'Assistant Flow Builder Canvas',
    node: 'Flow Node',
    edge: 'Flow Connection',
  },
  KEYBOARD_SHORTCUTS: {
    addNode: 'Ctrl+N',
    deleteNode: 'Delete',
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Y',
  },
} as const;

// Props interface with accessibility support
interface FlowCanvasProps {
  assistantId: string;
  className?: string;
  readOnly?: boolean;
  onValidationError?: (errors: ValidationError[]) => void;
  autoSave?: boolean;
  initialZoom?: number;
  'aria-label'?: string;
}

// Interface for validation errors
interface ValidationError {
  nodeId?: string;
  type: 'node' | 'edge' | 'flow';
  message: string;
  severity: 'error' | 'warning';
}

// Custom node data interface
interface NodeData {
  label: string;
  type: string;
  config: Record<string, unknown>;
  isValid: boolean;
  validationErrors: ValidationError[];
}

/**
 * FlowCanvas component for building and editing AI assistant conversation flows
 * with performance optimizations and accessibility features
 */
const FlowCanvas = React.memo<FlowCanvasProps>(({
  assistantId,
  className,
  readOnly = false,
  onValidationError,
  autoSave = true,
  initialZoom = 1,
  'aria-label': ariaLabel,
}) => {
  // State management
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const { updateAssistant } = useAssistant();

  // Performance optimization refs
  const renderTimeRef = useRef<number>(0);
  const debouncedSaveRef = useRef<NodeJS.Timeout>();
  const flowInstanceRef = useRef<any>(null);

  // ReactFlow instance
  const { project, getNodes, getEdges } = useReactFlow();

  // Memoized node types configuration
  const nodeTypes = useMemo(() => ({
    start: StartNode,
    message: MessageNode,
    question: QuestionNode,
    condition: ConditionNode,
    action: ActionNode,
    end: EndNode,
  }), []);

  /**
   * Validates the entire flow diagram
   */
  const validateFlow = useCallback(() => {
    const errors: ValidationError[] = [];
    const allNodes = getNodes();
    const allEdges = getEdges();

    // Check node count
    if (allNodes.length > VALIDATION_RULES.MAX_NODES) {
      errors.push({
        type: 'flow',
        message: `Maximum node limit (${VALIDATION_RULES.MAX_NODES}) exceeded`,
        severity: 'error',
      });
    }

    // Check edge count
    if (allEdges.length > VALIDATION_RULES.MAX_EDGES) {
      errors.push({
        type: 'flow',
        message: `Maximum connection limit (${VALIDATION_RULES.MAX_EDGES}) exceeded`,
        severity: 'error',
      });
    }

    // Check required nodes
    VALIDATION_RULES.REQUIRED_NODES.forEach(requiredType => {
      if (!allNodes.some(node => node.type === requiredType)) {
        errors.push({
          type: 'flow',
          message: `Missing required node type: ${requiredType}`,
          severity: 'error',
        });
      }
    });

    // Check flow depth
    const checkDepth = (nodeId: string, visited: Set<string> = new Set()): number => {
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);

      const outgoingEdges = allEdges.filter(edge => edge.source === nodeId);
      if (outgoingEdges.length === 0) return 1;

      return 1 + Math.max(...outgoingEdges.map(edge => 
        checkDepth(edge.target, new Set(visited))
      ));
    };

    const startNode = allNodes.find(node => node.type === 'start');
    if (startNode && checkDepth(startNode.id) > VALIDATION_RULES.MAX_DEPTH) {
      errors.push({
        type: 'flow',
        message: `Flow depth exceeds maximum (${VALIDATION_RULES.MAX_DEPTH})`,
        severity: 'error',
      });
    }

    onValidationError?.(errors);
    return errors.length === 0;
  }, [getNodes, getEdges, onValidationError]);

  /**
   * Handles node selection with performance optimization
   */
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node<NodeData>) => {
    const startTime = performance.now();
    
    setSelectedNode(prevNode => 
      prevNode?.id === node.id ? null : node
    );

    const renderTime = performance.now() - startTime;
    if (renderTime > PERFORMANCE_THRESHOLDS.RENDER_TIME_MS) {
      console.warn(`Node selection render time exceeded threshold: ${renderTime}ms`);
    }
  }, []);

  /**
   * Saves flow state with debouncing
   */
  const saveFlow = useCallback(async () => {
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current);
    }

    debouncedSaveRef.current = setTimeout(async () => {
      if (!validateFlow()) return;

      try {
        await updateAssistant(assistantId, {
          config: {
            flow: {
              nodes: getNodes(),
              edges: getEdges(),
            },
          },
        });
      } catch (error) {
        console.error('Error saving flow:', error);
      }
    }, PERFORMANCE_THRESHOLDS.INTERACTION_DELAY_MS);
  }, [assistantId, updateAssistant, getNodes, getEdges, validateFlow]);

  /**
   * Handles node updates with validation
   */
  const handleNodeUpdate = useCallback((nodeId: string, data: NodeData) => {
    setNodes(nodes => 
      nodes.map(node => 
        node.id === nodeId 
          ? { ...node, data: { ...data, isValid: true } }
          : node
      )
    );

    if (autoSave) {
      saveFlow();
    }
  }, [setNodes, autoSave, saveFlow]);

  /**
   * Initializes keyboard shortcuts
   */
  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (readOnly) return;

      if (event.ctrlKey && event.key === 'z') {
        // Implement undo
      } else if (event.ctrlKey && event.key === 'y') {
        // Implement redo
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [readOnly]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current);
      }
    };
  }, []);

  return (
    <div 
      className={classNames(
        'w-full',
        'h-full',
        'min-h-[600px]',
        'bg-white',
        'rounded-lg',
        'shadow-md',
        className
      )}
      role="application"
      aria-label={ariaLabel || ACCESSIBILITY_CONFIG.ARIA_LABELS.canvas}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        defaultZoom={initialZoom}
        minZoom={0.5}
        maxZoom={2}
        fitView
        attributionPosition="bottom-right"
        proOptions={{ hideAttribution: true }}
        ref={flowInstanceRef}
      >
        <Background />
        <Controls />
        
        {selectedNode && !readOnly && (
          <Panel position="top-right" className="bg-white p-4 rounded-lg shadow-lg">
            <NodeEditor
              node={selectedNode.data}
              assistantType={AssistantType.CUSTOMER_SERVICE}
              onUpdate={(data) => handleNodeUpdate(selectedNode.id, data)}
              aria-label={ACCESSIBILITY_CONFIG.ARIA_LABELS.node}
            />
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
});

FlowCanvas.displayName = 'FlowCanvas';

export default FlowCanvas;