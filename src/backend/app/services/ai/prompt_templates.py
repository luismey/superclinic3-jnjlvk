# jinja2 v3.0.0
from jinja2 import Environment, Template, TemplateError
from app.core.config import settings

# Default system prompt template in Portuguese
DEFAULT_SYSTEM_TEMPLATE = """
Você é um assistente virtual profissional que ajuda clientes em português. {role_description}
Mantenha suas respostas claras, profissionais e culturalmente apropriadas para o mercado brasileiro.
Sempre mantenha um tom cordial e use português brasileiro formal.
"""

# Default conversation template with history and current context
DEFAULT_CONVERSATION_TEMPLATE = """
Histórico da conversa:
{conversation_history}

Contexto atual:
Cliente: {current_message}
Assistente:
"""

# Predefined assistant roles with specialized descriptions in Portuguese
ASSISTANT_ROLES = {
    'sales': 'Você é especializado em vendas e atendimento ao cliente, focando em converter leads e maximizar satisfação. '
            'Utilize técnicas de vendas consultivas e mantenha um tom persuasivo mas não agressivo.',
    
    'support': 'Você é especializado em suporte técnico e resolução de problemas, priorizando soluções eficientes e claras. '
               'Mantenha um tom prestativo e técnico, mas sempre acessível ao público geral.',
    
    'scheduling': 'Você é especializado em agendamento de compromissos e gerenciamento de calendário, garantindo organização e pontualidade. '
                 'Seja preciso com horários e confirme sempre os detalhes importantes do agendamento.'
}

# Cache TTL for compiled templates (1 hour)
TEMPLATE_CACHE_TTL = 3600

class PromptTemplate:
    """
    Manages and generates structured prompts for AI assistant conversations with caching and validation.
    Handles template compilation, caching, and proper Portuguese language formatting.
    """
    
    def __init__(self, assistant_type: str, custom_templates: dict = None, cache_ttl: int = TEMPLATE_CACHE_TTL):
        """
        Initialize prompt template manager with specific assistant type and optional custom templates.
        
        Args:
            assistant_type (str): Type of assistant ('sales', 'support', 'scheduling')
            custom_templates (dict, optional): Custom template overrides
            cache_ttl (int, optional): Cache time-to-live in seconds
        
        Raises:
            ValueError: If assistant_type is invalid or templates are malformed
        """
        if assistant_type not in ASSISTANT_ROLES:
            raise ValueError(f"Invalid assistant_type. Must be one of: {', '.join(ASSISTANT_ROLES.keys())}")
        
        self._assistant_type = assistant_type
        self._cache_ttl = cache_ttl
        self._template_cache = {}
        
        # Initialize Jinja2 environment with caching
        self._jinja_env = Environment(
            trim_blocks=True,
            lstrip_blocks=True,
            keep_trailing_newline=True
        )
        
        # Set up default templates
        self._custom_templates = {
            'system': DEFAULT_SYSTEM_TEMPLATE,
            'conversation': DEFAULT_CONVERSATION_TEMPLATE
        }
        
        # Merge custom templates if provided
        if custom_templates:
            self.update_templates(custom_templates)

    def get_system_prompt(self) -> str:
        """
        Generate system prompt for AI model with role-specific context in Portuguese.
        
        Returns:
            str: Formatted system prompt with role context
        
        Raises:
            TemplateError: If template rendering fails
        """
        cache_key = f"system_{self._assistant_type}"
        
        if cache_key in self._template_cache:
            return self._template_cache[cache_key]
        
        try:
            template = self._jinja_env.from_string(self._custom_templates['system'])
            prompt = template.render(
                role_description=ASSISTANT_ROLES[self._assistant_type]
            ).strip()
            
            self._template_cache[cache_key] = prompt
            return prompt
            
        except TemplateError as e:
            raise TemplateError(f"Error rendering system prompt: {str(e)}")

    def get_conversation_prompt(self, conversation_history: list, current_message: str) -> str:
        """
        Generate conversation prompt with formatted history and current context.
        
        Args:
            conversation_history (list): List of previous conversation messages
            current_message (str): Current user message to process
        
        Returns:
            str: Formatted conversation prompt with history
        
        Raises:
            ValueError: If conversation history or message format is invalid
            TemplateError: If template rendering fails
        """
        if not isinstance(conversation_history, list):
            raise ValueError("conversation_history must be a list")
        
        if not current_message or not isinstance(current_message, str):
            raise ValueError("current_message must be a non-empty string")
        
        try:
            formatted_history = self._format_conversation_history(conversation_history)
            template = self._jinja_env.from_string(self._custom_templates['conversation'])
            
            prompt = template.render(
                conversation_history=formatted_history,
                current_message=current_message.strip()
            ).strip()
            
            return prompt
            
        except TemplateError as e:
            raise TemplateError(f"Error rendering conversation prompt: {str(e)}")

    def update_templates(self, new_templates: dict) -> bool:
        """
        Update custom templates with validation and cache refresh.
        
        Args:
            new_templates (dict): New template definitions to merge
        
        Returns:
            bool: Success status of template update
        
        Raises:
            ValueError: If template format is invalid
        """
        required_vars = {
            'system': {'role_description'},
            'conversation': {'conversation_history', 'current_message'}
        }
        
        for template_type, template in new_templates.items():
            if template_type not in self._custom_templates:
                raise ValueError(f"Invalid template type: {template_type}")
            
            if not isinstance(template, str):
                raise ValueError(f"Template must be a string: {template_type}")
            
            # Validate template variables
            try:
                test_template = self._jinja_env.from_string(template)
                template_vars = {name for name in test_template.environment.globals}
                
                if not required_vars[template_type].issubset(template_vars):
                    missing_vars = required_vars[template_type] - template_vars
                    raise ValueError(f"Missing required variables in {template_type} template: {missing_vars}")
                
            except TemplateError as e:
                raise ValueError(f"Invalid template format for {template_type}: {str(e)}")
        
        # Update templates and clear cache
        self._custom_templates.update(new_templates)
        self._template_cache.clear()
        return True

    def _format_conversation_history(self, history: list) -> str:
        """
        Format conversation history with proper roles and structure in Portuguese.
        
        Args:
            history (list): List of conversation entries
        
        Returns:
            str: Formatted conversation history with roles
        
        Raises:
            ValueError: If history entry format is invalid
        """
        formatted_messages = []
        
        for entry in history:
            if not isinstance(entry, dict) or 'role' not in entry or 'content' not in entry:
                raise ValueError("Invalid history entry format")
            
            role = 'Cliente' if entry['role'] == 'user' else 'Assistente'
            content = entry['content'].strip()
            
            formatted_messages.append(f"{role}: {content}")
        
        return "\n".join(formatted_messages)