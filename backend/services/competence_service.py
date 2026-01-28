"""
Competence Service
Business logic for calculating seller performance scores from diagnostics and debriefs.

This service centralizes all competence calculation logic that was previously
scattered across routes. It does NOT know about HTTP - it raises business exceptions
that are handled by the ErrorHandlerMiddleware.
"""
from typing import Dict, List, Optional
import logging

from repositories.diagnostic_repository import DiagnosticRepository
from exceptions.custom_exceptions import BusinessLogicError

logger = logging.getLogger(__name__)


class CompetenceService:
    """
    Service for calculating seller competence scores.
    
    Handles:
    - Calculation from diagnostic answers (0-3 scale → 1-5 scale)
    - Aggregation of scores from diagnostics and debriefs
    - Average calculation across multiple sources
    """
    
    # Mapping of questions to competences (DISC questionnaire)
    COMPETENCE_MAPPING = {
        'accueil': [1, 2, 3],
        'decouverte': [4, 5, 6],
        'argumentation': [7, 8, 9],
        'closing': [10, 11, 12],
        'fidelisation': [13, 14, 15]
    }
    
    # All competences in order
    ALL_COMPETENCES = ['accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation']
    
    def __init__(self, diagnostic_repo: DiagnosticRepository):
        """
        Initialize competence service. Phase 0: repository only, no self.db.

        Args:
            diagnostic_repo: Diagnostic repository for reading answers
        """
        self.diagnostic_repo = diagnostic_repo
    
    def calculate_scores_from_numeric_answers(self, answers: Dict) -> Dict[str, float]:
        """
        Calculate competence scores from numeric answers (0-3 scale).
        
        Converts 0-3 scale to 1-5 scale:
        - 0 → 1.0
        - 1 → 2.33
        - 2 → 3.67
        - 3 → 5.0
        
        Args:
            answers: Dict with keys like "q1", "q2", etc. and values 0-3
            
        Returns:
            Dict with keys like "accueil", "decouverte", etc. and average scores (1-5)
            
        Raises:
            BusinessLogicError: If answers format is invalid
        """
        if not isinstance(answers, dict):
            raise BusinessLogicError("Answers must be a dictionary")
        
        scores = {competence: [] for competence in self.ALL_COMPETENCES}
        
        # Calculate scores for each competence
        for competence, question_ids in self.COMPETENCE_MAPPING.items():
            for q_id in question_ids:
                q_key = f"q{q_id}"
                if q_key in answers:
                    try:
                        numeric_value = answers[q_key]
                        if not isinstance(numeric_value, (int, float)):
                            logger.warning(f"Invalid answer type for {q_key}: {type(numeric_value)}")
                            continue
                        
                        # Validate range (0-3)
                        if numeric_value < 0 or numeric_value > 3:
                            logger.warning(f"Answer {q_key} out of range (0-3): {numeric_value}")
                            continue
                        
                        # Convert 0-3 scale to 1-5 scale: 0->1, 1->2.33, 2->3.67, 3->5
                        scaled_score = 1 + (numeric_value * 4 / 3)
                        scores[competence].append(round(scaled_score, 1))
                    except (ValueError, TypeError) as e:
                        logger.warning(f"Error processing answer {q_key}: {e}")
                        continue
        
        # Calculate averages for each competence
        final_scores = {}
        for competence, score_list in scores.items():
            if score_list:
                final_scores[competence] = round(sum(score_list) / len(score_list), 1)
            else:
                final_scores[competence] = 0.0
        
        return final_scores
    
    def extract_pre_calculated_scores(self, diagnostic: Dict) -> Dict[str, float]:
        """
        Extract pre-calculated scores from diagnostic document.
        
        Args:
            diagnostic: Diagnostic document with score_accueil, score_decouverte, etc.
            
        Returns:
            Dict with competence names as keys and scores as values (only scores > 0)
        """
        scores = {}
        for competence in self.ALL_COMPETENCES:
            score_key = f"score_{competence}"
            score_value = diagnostic.get(score_key)
            if score_value and isinstance(score_value, (int, float)) and score_value > 0:
                scores[competence] = float(score_value)
        
        return scores
    
    def extract_debrief_scores(self, debrief: Dict) -> Dict[str, float]:
        """
        Extract competence scores from a debrief document.
        
        Args:
            debrief: Debrief document with score_accueil, score_decouverte, etc.
            
        Returns:
            Dict with competence names as keys and scores as values (only scores > 0)
        """
        scores = {}
        for competence in self.ALL_COMPETENCES:
            score_key = f"score_{competence}"
            score_value = debrief.get(score_key)
            if score_value and isinstance(score_value, (int, float)) and score_value > 0:
                scores[competence] = float(score_value)
        
        return scores
    
    async def calculate_seller_performance_scores(
        self,
        seller_id: str,
        diagnostic: Optional[Dict] = None,
        debriefs: Optional[List[Dict]] = None
    ) -> Dict[str, float]:
        """
        Calculate average competence scores for a seller from diagnostic and debriefs.
        
        This is the main method that aggregates scores from multiple sources:
        1. Pre-calculated scores from diagnostic (if available)
        2. Calculated scores from diagnostic answers (if pre-calculated not available)
        3. Scores from debriefs
        
        Args:
            seller_id: Seller ID (for logging)
            diagnostic: Optional diagnostic document
            debriefs: Optional list of debrief documents
            
        Returns:
            Dict with competence names as keys and average scores (0-5) as values
            Example: {"accueil": 3.5, "decouverte": 4.0, ...}
        """
        # Initialize result with zeros
        avg_scores = {competence: 0.0 for competence in self.ALL_COMPETENCES}
        
        # Collect all scores from different sources
        all_scores = {competence: [] for competence in self.ALL_COMPETENCES}
        
        # Process diagnostic
        if diagnostic:
            logger.debug(f"[CompetenceService] Processing diagnostic for seller {seller_id}")
            
            # Try pre-calculated scores first
            pre_calculated = self.extract_pre_calculated_scores(diagnostic)
            if pre_calculated:
                logger.debug(f"[CompetenceService] Found pre-calculated scores: {pre_calculated}")
                for competence, score in pre_calculated.items():
                    all_scores[competence].append(score)
            else:
                # Try to calculate from answers
                answers = diagnostic.get('answers', {})
                if answers:
                    logger.debug(f"[CompetenceService] Calculating scores from diagnostic answers")
                    calculated_scores = self.calculate_scores_from_numeric_answers(answers)
                    for competence, score in calculated_scores.items():
                        if score > 0:
                            all_scores[competence].append(score)
                            logger.debug(f"[CompetenceService] Calculated {competence} from answers: {score}")
        
        # Process debriefs
        if debriefs:
            logger.debug(f"[CompetenceService] Processing {len(debriefs)} debriefs for seller {seller_id}")
            for debrief in debriefs:
                debrief_scores = self.extract_debrief_scores(debrief)
                if debrief_scores:
                    for competence, score in debrief_scores.items():
                        all_scores[competence].append(score)
        
        # Calculate averages (filter out zeros)
        for competence in self.ALL_COMPETENCES:
            scores = [s for s in all_scores[competence] if s > 0]
            if scores:
                avg_scores[competence] = round(sum(scores) / len(scores), 1)
                logger.debug(f"[CompetenceService] {competence}: {scores} → avg={avg_scores[competence]}")
            else:
                logger.debug(f"[CompetenceService] {competence}: No valid scores found")
        
        logger.info(f"[CompetenceService] Final scores for seller {seller_id}: {avg_scores}")
        return avg_scores
