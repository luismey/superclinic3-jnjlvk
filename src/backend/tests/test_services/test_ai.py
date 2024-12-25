# pytest v7.0.0
# pytest-asyncio v0.21.0
# pytest-benchmark v4.0.0

import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime

from app.services.ai.openai_client import OpenAIClient
from app.services.ai.prompt_templates import PromptTemplate
from app.services.ai.assistant_manager import AssistantManager
from app.core.config import settings
from app.core.exceptions import RateLimitError
from app.models.assistants import Assistant, AssistantType

# Test data constants
TEST_CONVERSATION_HISTORY = [
    {"role": "user", "content": "Olá"},
    {"role": "assistant", "content": "Olá! Como posso ajudar?"}
]
TEST_CURRENT_MESSAGE = "Quero agendar uma consulta"
TEST_ASSISTANT_CONFIG = {
    "type": "scheduling",
    "custom_templates": {},
    "rate_limit": {"requests": 3, "period": 60}
}
TEST_PORTUGUESE_PROMPTS = {
    "greeting": "Olá",
    "scheduling": "Gostaria de agendar",
    "confirmation": "Confirmado"
}

@pytest.fixture
def mock_openai_client():
    """Fixture providing mocked OpenAI client with rate limit simulation."""
    with patch('app.services.ai.openai_client.OpenAIClient') as mock_client:
        # Configure success response
        mock_client.return_value.generate_response = AsyncMock(
            return_value="Claro! Qual seria o melhor horário para você?"
        )
        
        # Configure rate limit simulation
        mock_client.return_value.handle_rate_limit = AsyncMock(
            side_effect=[
                {"allowed": True, "remaining": 2},
                {"allowed": False, "retry_after": 30}
            ]
        )
        
        yield mock_client

@pytest.fixture
def mock_assistant():
    """Fixture providing a mock Assistant instance."""
    assistant = MagicMock(spec=Assistant)
    assistant.id = "test-assistant-id"
    assistant.type = AssistantType.APPOINTMENT
    assistant.config = TEST_ASSISTANT_CONFIG
    assistant.organization_id = "test-org-id"
    return assistant

@pytest.mark.asyncio
class TestOpenAIClient:
    """Test suite for OpenAI client functionality including rate limiting and error handling."""

    async def test_generate_response(self, mock_openai_client, benchmark):
        """
        Test AI response generation with performance monitoring.
        Verifies response content, timing, and Portuguese language quality.
        """
        client = OpenAIClient(PromptTemplate("scheduling"))
        
        # Benchmark response generation
        async def run_benchmark():
            return await client.generate_response(
                TEST_CONVERSATION_HISTORY,
                TEST_CURRENT_MESSAGE
            )
        
        result = benchmark(run_benchmark)
        
        # Verify response content
        assert isinstance(result, str)
        assert len(result) > 0
        assert "horário" in result.lower()  # Verify Portuguese content
        
        # Verify response time is within limits
        assert benchmark.stats["max"] < 0.5  # 500ms max response time
        
        # Verify call parameters
        mock_openai_client.return_value.generate_response.assert_called_once()
        call_args = mock_openai_client.return_value.generate_response.call_args[0]
        assert call_args[0] == TEST_CONVERSATION_HISTORY
        assert call_args[1] == TEST_CURRENT_MESSAGE

    async def test_rate_limit_handling(self, mock_openai_client):
        """
        Test rate limiting mechanism and recovery.
        Verifies proper handling of rate limits and backoff behavior.
        """
        client = OpenAIClient(PromptTemplate("scheduling"))
        
        # First request should succeed
        response1 = await client.generate_response(
            TEST_CONVERSATION_HISTORY,
            TEST_CURRENT_MESSAGE
        )
        assert response1 is not None
        
        # Second request should hit rate limit
        with pytest.raises(RateLimitError) as exc_info:
            await client.generate_response(
                TEST_CONVERSATION_HISTORY,
                TEST_CURRENT_MESSAGE
            )
        
        assert "Rate limit exceeded" in str(exc_info.value)
        assert exc_info.value.details.get("retry_after") == 30

    async def test_error_handling(self, mock_openai_client):
        """
        Test API error handling and retry mechanism.
        Verifies proper handling of various error scenarios.
        """
        # Configure mock to raise errors
        mock_openai_client.return_value.generate_response.side_effect = [
            Exception("API Error"),  # First attempt fails
            "Resposta de sucesso"    # Second attempt succeeds
        ]
        
        client = OpenAIClient(PromptTemplate("scheduling"))
        
        # Should succeed on retry
        response = await client.generate_response(
            TEST_CONVERSATION_HISTORY,
            TEST_CURRENT_MESSAGE
        )
        
        assert response == "Resposta de sucesso"
        assert mock_openai_client.return_value.generate_response.call_count == 2

@pytest.mark.asyncio
class TestAssistantManager:
    """Test suite for AssistantManager functionality."""

    async def test_process_message(self, mock_assistant, mock_openai_client):
        """
        Test message processing with performance monitoring.
        Verifies proper handling of messages and response generation.
        """
        manager = AssistantManager(mock_assistant)
        
        response = await manager.process_message(TEST_CURRENT_MESSAGE)
        
        assert isinstance(response, str)
        assert len(response) > 0
        
        # Verify metrics were updated
        mock_assistant.update_metrics.assert_called_once()
        call_kwargs = mock_assistant.update_metrics.call_args[1]
        assert call_kwargs["new_message_count"] == 1
        assert isinstance(call_kwargs["response_time"], float)

    async def test_concurrent_requests(self, mock_assistant, mock_openai_client):
        """
        Test handling of concurrent message processing.
        Verifies proper handling of multiple simultaneous requests.
        """
        manager = AssistantManager(mock_assistant)
        
        # Process multiple messages concurrently
        tasks = [
            manager.process_message(TEST_CURRENT_MESSAGE)
            for _ in range(3)
        ]
        
        responses = await asyncio.gather(*tasks)
        
        assert len(responses) == 3
        assert all(isinstance(r, str) for r in responses)
        assert mock_assistant.update_metrics.call_count == 3

    async def test_knowledge_update(self, mock_assistant):
        """
        Test knowledge base updates and validation.
        Verifies proper handling of knowledge base modifications.
        """
        manager = AssistantManager(mock_assistant)
        
        new_knowledge = {
            "categories": ["Agendamento", "Horários"],
            "documents": [
                {"title": "Política de Agendamento", "content": "..."}
            ]
        }
        
        result = await manager.update_knowledge(new_knowledge)
        
        assert result["status"] == "success"
        assert "knowledge_base" in result
        assert "timestamp" in result
        
        # Verify assistant knowledge was updated
        mock_assistant.update_knowledge_base.assert_called_once_with(new_knowledge)

@pytest.mark.asyncio
class TestPromptTemplate:
    """Test suite for prompt template functionality."""

    def test_system_prompt_generation(self):
        """
        Test system prompt generation and validation.
        Verifies proper formatting and language quality.
        """
        template = PromptTemplate("scheduling")
        prompt = template.get_system_prompt()
        
        assert isinstance(prompt, str)
        assert len(prompt) > 0
        assert "agendamento" in prompt.lower()
        assert "português" in prompt.lower()

    def test_conversation_prompt_generation(self):
        """
        Test conversation prompt generation with history.
        Verifies proper formatting of conversation context.
        """
        template = PromptTemplate("scheduling")
        prompt = template.get_conversation_prompt(
            TEST_CONVERSATION_HISTORY,
            TEST_CURRENT_MESSAGE
        )
        
        assert isinstance(prompt, str)
        assert "Histórico da conversa" in prompt
        assert "Cliente: " in prompt
        assert "Assistente: " in prompt
        assert TEST_CURRENT_MESSAGE in prompt

    def test_portuguese_validation(self):
        """
        Test Portuguese language validation in prompts.
        Verifies proper handling of language-specific content.
        """
        template = PromptTemplate("scheduling")
        
        # Test with valid Portuguese content
        valid_prompts = template.update_templates({
            "system": "Você é um assistente especializado em agendamentos.",
            "conversation": "Cliente: {current_message}\nHistórico: {conversation_history}"
        })
        
        assert valid_prompts is True
        
        # Test with invalid content should raise error
        with pytest.raises(ValueError):
            template.update_templates({
                "system": "You are an English-speaking assistant",
                "conversation": "Invalid template without required variables"
            })