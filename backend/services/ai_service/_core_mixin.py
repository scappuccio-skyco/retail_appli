"""
CoreMixin - Core AIService functionality: init, circuit breaker, send_message, admin_response.
"""

import asyncio
import logging
import os
from typing import Optional
from datetime import datetime, timezone, timedelta

from services.ai_service._prompts import (
    AsyncOpenAI,
    RateLimitError,
    APIConnectionError,
    APITimeoutError,
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    RetryError,
    settings,
)

logger = logging.getLogger(__name__)


class CoreMixin:
    """
    Core mixin for AIService: initialization, circuit breaker, message sending,
    and admin response generation.
    """

    def __init__(self):
        # Lire la clé au runtime (pas au import-time)
        self.api_key = getattr(settings, "OPENAI_API_KEY", "") or os.environ.get("OPENAI_API_KEY", "")
        self.available = bool(self.api_key) and AsyncOpenAI is not None

        if self.available:
            self.client = AsyncOpenAI(api_key=self.api_key)
        else:
            self.client = None
            if not self.api_key:
                logger.warning("⚠️ OpenAI unavailable (missing OPENAI_API_KEY)")
            elif AsyncOpenAI is None:
                logger.warning("⚠️ OpenAI unavailable (OpenAI SDK import failed: AsyncOpenAI missing)")

        # Circuit Breaker State
        self._error_count = 0
        self._circuit_open = False
        self._circuit_open_until = None
        self._last_success_time = None

        # Constants
        self.MAX_CONSECUTIVE_ERRORS = 5
        self.CIRCUIT_BREAKER_DURATION = 300  # 5 minutes en secondes
        self.DEFAULT_TIMEOUT = 30.0  # 30 secondes

    def _check_circuit_breaker(self) -> bool:
        """
        Check if circuit breaker is open (blocking requests)

        Returns:
            True if circuit is open (should block), False if closed (allow requests)
        """
        if not self._circuit_open:
            return False

        # Check if we should reset the circuit breaker
        if self._circuit_open_until:
            if datetime.now(timezone.utc) >= self._circuit_open_until:
                logger.info("🔄 Circuit breaker: Resetting after cooldown period")
                self._circuit_open = False
                self._circuit_open_until = None
                self._error_count = 0
                return False

        return True

    def _record_success(self):
        """Record a successful API call (reset error count)"""
        self._error_count = 0
        self._last_success_time = datetime.now(timezone.utc)
        if self._circuit_open:
            logger.info("✅ Circuit breaker: Success after errors, resetting")
            self._circuit_open = False
            self._circuit_open_until = None

    def _record_error(self):
        """Record an error and check if circuit breaker should open"""
        self._error_count += 1
        logger.warning(f"⚠️ OpenAI error count: {self._error_count}/{self.MAX_CONSECUTIVE_ERRORS}")

        if self._error_count >= self.MAX_CONSECUTIVE_ERRORS:
            self._circuit_open = True
            self._circuit_open_until = datetime.now(timezone.utc) + timedelta(seconds=self.CIRCUIT_BREAKER_DURATION)
            logger.error(
                f"🔴 Circuit breaker OPENED: {self._error_count} consecutive errors. "
                f"Blocking OpenAI calls for {self.CIRCUIT_BREAKER_DURATION}s until {self._circuit_open_until.isoformat()}"
            )

    def _get_max_tokens(self, model: str) -> int:
        """
        Get max_tokens limit based on model

        Args:
            model: Model name (gpt-4o, gpt-4o-mini, etc.)

        Returns:
            Max tokens limit
        """
        if "mini" in model.lower():
            return 2000  # gpt-4o-mini: smaller limit
        elif "gpt-4o" in model.lower():
            return 4000  # gpt-4o: larger limit
        else:
            return 2000  # Default fallback

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((RateLimitError, APIConnectionError, APITimeoutError)) if RateLimitError else None,
        reraise=True
    )
    async def _send_message_with_retry(
        self,
        system_message: str,
        user_prompt: str,
        model: str,
        temperature: float,
        max_tokens: int
    ) -> Optional[str]:
        """
        Internal method that performs the actual API call with retry logic

        This method is wrapped by @retry decorator for automatic retries
        """
        response = await self.client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_prompt}
            ],
            temperature=temperature,
            timeout=self.DEFAULT_TIMEOUT,  # ⚠️ CRITICAL: Timeout protection
            max_tokens=max_tokens  # ⚠️ CRITICAL: Cost control
        )

        # Log token usage for cost tracking
        if hasattr(response, 'usage') and response.usage:
            usage = response.usage
            total_tokens = usage.total_tokens if hasattr(usage, 'total_tokens') else 0
            prompt_tokens = usage.prompt_tokens if hasattr(usage, 'prompt_tokens') else 0
            completion_tokens = usage.completion_tokens if hasattr(usage, 'completion_tokens') else 0

            logger.info(
                f"💰 OpenAI tokens used (model={model}): "
                f"Total={total_tokens}, Input={prompt_tokens}, Output={completion_tokens}"
            )

        if response.choices and len(response.choices) > 0:
            return response.choices[0].message.content
        return None

    async def _send_message(
        self,
        system_message: str,
        user_prompt: str,
        model: str = "gpt-4o-mini",
        temperature: float = 0.7
    ) -> Optional[str]:
        """
        Send a message to OpenAI and get response

        Features:
        - Timeout protection (30s)
        - Token limits (cost control)
        - Retry logic with exponential backoff (max 3 attempts)
        - Circuit breaker (blocks after 5 consecutive errors)
        - Token usage logging

        Args:
            system_message: System prompt for the AI
            user_prompt: User prompt
            model: Model to use (gpt-4o or gpt-4o-mini)
            temperature: Temperature for generation (0.0-2.0)

        Returns:
            AI response text or None
        """
        if not self.available or not self.client:
            return None

        # Check circuit breaker
        if self._check_circuit_breaker():
            logger.warning(
                f"🔴 Circuit breaker: OpenAI calls blocked until {self._circuit_open_until.isoformat()}"
            )
            return None

        # Get max_tokens based on model
        max_tokens = self._get_max_tokens(model)

        try:
            response = await self._send_message_with_retry(
                system_message=system_message,
                user_prompt=user_prompt,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens
            )

            # Success: reset error count
            if response:
                self._record_success()

            return response

        except asyncio.TimeoutError:
            logger.error(f"⏱️ OpenAI timeout after {self.DEFAULT_TIMEOUT}s (model={model})")
            self._record_error()
            return None

        except RateLimitError as e:
            logger.warning(f"🚦 OpenAI rate limit hit (model={model}): {str(e)}")
            # RateLimitError is retried by tenacity, but we still record it
            self._record_error()
            raise  # Re-raise for tenacity to handle retry

        except (APIConnectionError, APITimeoutError) as e:
            logger.warning(f"🔌 OpenAI connection error (model={model}): {str(e)}")
            # Connection errors are retried by tenacity
            self._record_error()
            raise  # Re-raise for tenacity to handle retry

        except Exception as e:
            msg = str(e)
            if "sk-" in msg or "api_key" in msg.lower():
                logger.error("OpenAI API error (details hidden)")
            else:
                logger.error(f"OpenAI API error (model={model}): {e}")
            self._record_error()
            return None

    async def generate_admin_response(
        self,
        system_prompt: str,
        user_message: str,
        model: str = "gpt-4o",
        temperature: float = 0.7
    ) -> str:
        """
        Public method for admin chat usage.
        Returns a non-empty string (fallback if OpenAI unavailable / empty response).
        """
        response = await self._send_message(
            system_message=system_prompt,
            user_prompt=user_message,
            model=model,
            temperature=temperature,
        )

        if response and response.strip():
            return response.strip()

        return "Désolé, je n'ai pas pu générer une réponse. Le service IA est temporairement indisponible."
