import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';
import Input from '../common/Input';
import { AssistantType } from '../../types/assistant';

// Node types supported in the flow builder
export enum NodeType {
  START = 'START',
  MESSAGE = 'MESSAGE',
  QUESTION = 'QUESTION',
  CONDITION = 'CONDITION',
  ACTION = 'ACTION',
  END = 'END'
}

// Interface for flow node data
interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  message?: string;
  condition?: string;
  action?: string;
  options?: string[];
  assistantTypeConfig?: Record<string, unknown>;
}

// Props interface with accessibility support
interface NodeEditorProps {
  node: FlowNode;
  assistantType: AssistantType;
  onUpdate: (nodeData: FlowNode) => void;
  className?: string;
  'aria-label'?: string;
  testId?: string;
}

// Validation rules by node type
const getValidationRules = (type: NodeType, assistantType: AssistantType) => {
  const baseRules = {
    label: { required: 'Campo obrigatório', maxLength: { value: 50, message: 'Máximo de 50 caracteres' } }
  };

  const typeRules = {
    [NodeType.MESSAGE]: {
      message: { required: 'Mensagem obrigatória', maxLength: { value: 500, message: 'Máximo de 500 caracteres' } }
    },
    [NodeType.QUESTION]: {
      message: { required: 'Pergunta obrigatória', maxLength: { value: 200, message: 'Máximo de 200 caracteres' } },
      options: { required: 'Adicione pelo menos uma opção' }
    },
    [NodeType.CONDITION]: {
      condition: { required: 'Condição obrigatória' }
    },
    [NodeType.ACTION]: {
      action: { required: 'Ação obrigatória' }
    }
  };

  // Additional validation based on assistant type
  const assistantTypeRules = {
    [AssistantType.SALES]: {
      message: { pattern: { value: /\{price\}|\{product\}/g, message: 'Inclua variáveis de produto/preço' } }
    },
    [AssistantType.APPOINTMENT]: {
      message: { pattern: { value: /\{date\}|\{time\}/g, message: 'Inclua variáveis de data/hora' } }
    }
  };

  return {
    ...baseRules,
    ...(typeRules[type] || {}),
    ...(assistantTypeRules[assistantType] || {})
  };
};

/**
 * NodeEditor component for editing flow node properties with accessibility and i18n support
 */
export const NodeEditor = React.memo<NodeEditorProps>(({
  node,
  assistantType,
  onUpdate,
  className,
  'aria-label': ariaLabel,
  testId
}) => {
  const { t } = useTranslation('assistants');
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch
  } = useForm<FlowNode>({
    defaultValues: node,
    mode: 'onChange'
  });

  const validationRules = React.useMemo(
    () => getValidationRules(node.type, assistantType),
    [node.type, assistantType]
  );

  // Handle form submission
  const onSubmit = (data: FlowNode) => {
    onUpdate({
      ...node,
      ...data
    });
  };

  // Watch form values for real-time validation
  const formValues = watch();

  return (
    <div
      className={classNames(
        'p-4',
        'bg-white',
        'rounded-lg',
        'shadow-md',
        'border',
        'border-semantic-border',
        className
      )}
      data-testid={testId}
      role="region"
      aria-label={ariaLabel || t('nodeEditor.title')}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        aria-label={t('nodeEditor.form')}
      >
        {/* Label field - common to all node types */}
        <Input
          id="label"
          {...register('label', validationRules.label)}
          aria-label={t('nodeEditor.labelField')}
          placeholder={t('nodeEditor.labelPlaceholder')}
          error={errors.label?.message}
        />

        {/* Message field for MESSAGE and QUESTION nodes */}
        {(node.type === NodeType.MESSAGE || node.type === NodeType.QUESTION) && (
          <Input
            id="message"
            {...register('message', validationRules.message)}
            aria-label={t('nodeEditor.messageField')}
            placeholder={t('nodeEditor.messagePlaceholder')}
            error={errors.message?.message}
          />
        )}

        {/* Condition field for CONDITION nodes */}
        {node.type === NodeType.CONDITION && (
          <Input
            id="condition"
            {...register('condition', validationRules.condition)}
            aria-label={t('nodeEditor.conditionField')}
            placeholder={t('nodeEditor.conditionPlaceholder')}
            error={errors.condition?.message}
          />
        )}

        {/* Action field for ACTION nodes */}
        {node.type === NodeType.ACTION && (
          <Input
            id="action"
            {...register('action', validationRules.action)}
            aria-label={t('nodeEditor.actionField')}
            placeholder={t('nodeEditor.actionPlaceholder')}
            error={errors.action?.message}
          />
        )}

        {/* Options field for QUESTION nodes */}
        {node.type === NodeType.QUESTION && (
          <div role="group" aria-label={t('nodeEditor.optionsGroup')}>
            {formValues.options?.map((_, index) => (
              <Input
                key={index}
                id={`options.${index}`}
                {...register(`options.${index}`)}
                aria-label={t('nodeEditor.optionField', { index: index + 1 })}
                placeholder={t('nodeEditor.optionPlaceholder')}
                error={errors.options?.[index]?.message}
              />
            ))}
          </div>
        )}

        <button
          type="submit"
          className={classNames(
            'w-full',
            'px-4',
            'py-2',
            'bg-primary-600',
            'text-white',
            'rounded-md',
            'hover:bg-primary-700',
            'focus:outline-none',
            'focus:ring-2',
            'focus:ring-primary-500',
            'focus:ring-offset-2',
            'transition-colors',
            'disabled:opacity-50',
            'disabled:cursor-not-allowed'
          )}
          aria-label={t('nodeEditor.updateButton')}
        >
          {t('nodeEditor.update')}
        </button>
      </form>
    </div>
  );
});

NodeEditor.displayName = 'NodeEditor';

export default NodeEditor;