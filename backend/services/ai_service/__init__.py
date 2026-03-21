"""AI Service Package."""
from services.ai_service._prompts import (
    LEGAL_DISCLAIMER_BLOCK,
    DISC_ADAPTATION_INSTRUCTIONS,
    TEAM_ANALYSIS_SYSTEM_PROMPT,
    DEBRIEF_SYSTEM_PROMPT,
    DIAGNOSTIC_SYSTEM_PROMPT,
    CHALLENGE_SYSTEM_PROMPT,
    SELLER_STRICT_SYSTEM_PROMPT,
    SELLER_BILAN_SYSTEM_PROMPT,
    anonymize_name_for_ai,
    clean_json_response,
    parse_json_safely,
)
from services.ai_service._core_mixin import CoreMixin
from services.ai_service._analysis_mixin import AnalysisMixin
from services.ai_service._seller_mixin import SellerMixin
from services.ai_service._brief_mixin import BriefMixin
from services.ai_service._data_service import AIDataService
from services.ai_service._evaluation_service import EvaluationGuideService

# AIService assembles all mixins
class AIService(CoreMixin, AnalysisMixin, SellerMixin, BriefMixin):
    pass  # __init__ is defined in CoreMixin

__all__ = [
    "AIService", "AIDataService", "EvaluationGuideService",
    "LEGAL_DISCLAIMER_BLOCK", "DISC_ADAPTATION_INSTRUCTIONS",
    "TEAM_ANALYSIS_SYSTEM_PROMPT", "DEBRIEF_SYSTEM_PROMPT",
    "DIAGNOSTIC_SYSTEM_PROMPT", "CHALLENGE_SYSTEM_PROMPT",
    "SELLER_STRICT_SYSTEM_PROMPT", "SELLER_BILAN_SYSTEM_PROMPT",
    "anonymize_name_for_ai", "clean_json_response", "parse_json_safely",
]
