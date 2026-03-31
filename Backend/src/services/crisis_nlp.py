"""
Semantic Crisis Detection using Swedish BERT embeddings and classifiers.
Replaces keyword-based detection with deep semantic understanding.
"""

import logging
import numpy as np
from typing import Any, Optional
from dataclasses import dataclass
from datetime import datetime

try:
    from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
    from sentence_transformers import SentenceTransformer
    import torch
    import torch.nn.functional as F
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class SemanticCrisisAssessment:
    """Result from semantic crisis detection."""
    risk_level: str  # 'none', 'low', 'medium', 'high', 'critical'
    confidence: float
    semantic_score: float
    semantic_indicators: list[str]
    requires_immediate_attention: bool
    detected_concepts: list[dict[str, Any]]
    embedding_similarity: dict[str, float]


@dataclass
class CrisisConcept:
    """A crisis-related concept with embeddings."""
    name: str
    description: str
    category: str  # 'suicidal', 'self_harm', 'hopelessness', 'severe_distress', 'trauma'
    examples: list[str]
    weight: float


class SemanticCrisisDetector:
    """
    Swedish BERT-based semantic crisis detection.
    Uses KB-BERT or KBLab sentence transformers for Swedish semantic understanding.
    Captures intention and hopelessness even when specific keywords are absent.
    """
    
    # Crisis concepts with semantic embeddings (populated on init)
    CRISIS_CONCEPTS = [
        CrisisConcept(
            name="suicidal_ideation",
            description="Tankar på att ta sitt liv eller dö",
            category="suicidal",
            examples=[
                "jag orkar inte leva längre",
                "det hade varit bättre om jag inte fanns",
                "jag tänker på att försvinna",
                "livet känns meningslöst, varför ens fortsätta",
                "jag vill inte vakna imorgon",
                "det är bättre för alla om jag är borta"
            ],
            weight=1.0
        ),
        CrisisConcept(
            name="hopelessness",
            description="Upplevelse av hopplöshet och meningslöshet",
            category="hopelessness",
            examples=[
                "det finns ingen utväg",
                "det kommer aldrig att bli bättre",
                "jag har gett upp",
                "det spelar ingen roll vad jag gör",
                "allt känns meningslöst",
                "jag ser ingen framtid"
            ],
            weight=0.9
        ),
        CrisisConcept(
            name="self_harm",
            description="Tankar på eller intention att skada sig själv",
            category="self_harm",
            examples=[
                "jag vill skada mig själv",
                "jag förtjänar smärta",
                "jag behöver känna något annat",
                "jag vill straffa mig själv",
                "det skulle vara skönt att skära sig"
            ],
            weight=0.95
        ),
        CrisisConcept(
            name="severe_distress",
            description="Akut psykisk smärta eller sammanbrott",
            category="severe_distress",
            examples=[
                "jag håller på att bryta ihop",
                "jag kan inte hantera detta längre",
                "det gör för ont",
                "jag mår så dåligt att jag inte vet vad jag ska göra",
                "hjälp mig någon snälla",
                "jag orkar inte mer"
            ],
            weight=0.85
        ),
        CrisisConcept(
            name="isolation_withdrawal",
            description="Extrem isolering och tillbakadragande",
            category="behavioral",
            examples=[
                "jag har inte pratat med någon på veckor",
                "jag vill inte träffa någon",
                "ingen skulle sakna mig",
                "jag är helt ensam",
                "jag stänger in mig själv"
            ],
            weight=0.7
        ),
        CrisisConcept(
            name="trauma_response",
            description="Trauma-relaterade tankar och flashbacks",
            category="trauma",
            examples=[
                "jag kan inte sluta se det framför mig",
                "det händer om och om igen i mitt huvud",
                "jag känner mig som ett barn igen",
                "jag är tillbaka där",
                "inget känns säkert längre"
            ],
            weight=0.8
        ),
        CrisisConcept(
            name="substance_abuse",
            description="Tankar om eller riskbeteende med alkohol/droger",
            category="behavioral",
            examples=[
                "jag behöver dricka för att klara mig",
                "jag vill bara döva smärtan",
                "jag tar mer och mer",
                "jag kan inte sluta",
                "ingenting hjälper utan alkohol"
            ],
            weight=0.75
        )
    ]
    
    # Swedish urgency patterns (regex for immediate flagging)
    URGENCY_PATTERNS = [
        r"hjälp.*?nu|akut|omedelbart|snarast",
        r"kan inte.*?längre|orkar inte mer",
        r"håll.*?inte.*?ut|ger snart upp",
        r"vill.*?dö|döda mig själv|slutar leva",
        r"självmord|ta livet av mig",
    ]
    
    def __init__(self, use_gpu: bool = False):
        logger.info("🔬 Initializing Semantic Crisis Detector...")
        
        self.device = "cuda" if (use_gpu and torch.cuda.is_available()) else "cpu"
        self.transformers_available = TRANSFORMERS_AVAILABLE
        
        if not TRANSFORMERS_AVAILABLE:
            logger.warning("⚠️ Transformers not available, falling back to keyword detection")
            self._init_fallback()
            return
        
        try:
            # Swedish BERT for embeddings (semantic similarity)
            logger.info("📥 Loading Swedish sentence transformer...")
            self.embedding_model = SentenceTransformer('KBLab/sentence-bert-swedish-cased')
            
            # Pre-compute embeddings for crisis concepts
            self._precompute_concept_embeddings()
            
            # Load fine-tuned classifier if available, else use zero-shot
            self._load_classifier()
            
            logger.info(f"✅ Semantic Crisis Detector initialized (device: {self.device})")
            
        except Exception as e:
            logger.error(f"❌ Failed to load semantic models: {e}")
            self._init_fallback()
    
    def _init_fallback(self):
        """Initialize fallback keyword-based detection."""
        logger.warning("Using fallback keyword-based detection")
        self.fallback_mode = True
        self.embedding_model = None
        self.concept_embeddings = {}
    
    def _precompute_concept_embeddings(self):
        """Pre-compute embeddings for all crisis concepts."""
        logger.info("🧮 Pre-computing concept embeddings...")
        
        self.concept_embeddings = {}
        for concept in self.CRISIS_CONCEPTS:
            # Embed concept description and all examples
            texts = [concept.description] + concept.examples
            embeddings = self.embedding_model.encode(texts, convert_to_tensor=True)
            
            # Store mean embedding for the concept
            self.concept_embeddings[concept.name] = {
                'mean_embedding': embeddings.mean(dim=0),
                'individual_embeddings': embeddings,
                'concept': concept
            }
        
        logger.info(f"✅ Pre-computed {len(self.concept_embeddings)} concept embeddings")
    
    def _load_classifier(self):
        """Load or initialize crisis classifier."""
        # In production, load fine-tuned model
        # For now, use zero-shot with embeddings
        self.classifier = None
        self.fallback_mode = False
    
    def detect(self, text: str, conversation_context: Optional[list[dict]] = None) -> SemanticCrisisAssessment:
        """
        Perform semantic crisis detection on text.
        
        Args:
            text: The message to analyze
            conversation_context: Optional list of recent conversation messages
            
        Returns:
            SemanticCrisisAssessment with risk level and confidence
        """
        if self.fallback_mode or not TRANSFORMERS_AVAILABLE:
            return self._fallback_detection(text, conversation_context)
        
        try:
            # 1. Semantic embedding of input text
            text_embedding = self.embedding_model.encode(text, convert_to_tensor=True)
            
            # 2. Calculate similarity to each crisis concept
            concept_scores = self._calculate_concept_similarities(text_embedding)
            
            # 3. Detect urgency patterns (immediate escalation)
            urgency_detected = self._detect_urgency(text)
            
            # 4. Consider conversation context
            context_score = self._analyze_context(conversation_context) if conversation_context else 0.0
            
            # 5. Calculate overall risk score
            semantic_score = self._calculate_semantic_risk(concept_scores, urgency_detected, context_score)
            
            # 6. Determine risk level
            risk_level = self._score_to_level(semantic_score)
            
            # 7. Extract semantic indicators
            indicators = self._extract_semantic_indicators(concept_scores, text)
            
            # 8. Get detailed concept matches
            detected_concepts = self._get_detected_concepts(concept_scores)
            
            return SemanticCrisisAssessment(
                risk_level=risk_level,
                confidence=self._calculate_confidence(concept_scores, semantic_score),
                semantic_score=semantic_score,
                semantic_indicators=indicators,
                requires_immediate_attention=risk_level in ['high', 'critical'] or urgency_detected,
                detected_concepts=detected_concepts,
                embedding_similarity={name: score for name, score in concept_scores.items()}
            )
            
        except Exception as e:
            logger.error(f"❌ Semantic detection failed: {e}, using fallback")
            return self._fallback_detection(text, conversation_context)
    
    def _calculate_concept_similarities(self, text_embedding) -> dict[str, float]:
        """Calculate cosine similarity between text and all crisis concepts."""
        similarities = {}
        
        for concept_name, concept_data in self.concept_embeddings.items():
            # Cosine similarity with mean embedding
            mean_sim = F.cosine_similarity(
                text_embedding.unsqueeze(0),
                concept_data['mean_embedding'].unsqueeze(0)
            ).item()
            
            # Also check max similarity with any individual example
            individual_sims = F.cosine_similarity(
                text_embedding.unsqueeze(0),
                concept_data['individual_embeddings']
            )
            max_sim = individual_sims.max().item()
            
            # Weighted combination
            final_score = 0.6 * mean_sim + 0.4 * max_sim
            
            # Apply concept weight
            weighted_score = final_score * concept_data['concept'].weight
            
            similarities[concept_name] = weighted_score
        
        return similarities
    
    def _detect_urgency(self, text: str) -> bool:
        """Detect urgency patterns requiring immediate attention."""
        import re
        
        text_lower = text.lower()
        for pattern in self.URGENCY_PATTERNS:
            if re.search(pattern, text_lower):
                return True
        return False
    
    def _analyze_context(self, conversation_context: list[dict]) -> float:
        """Analyze conversation history for escalation patterns."""
        if not conversation_context or len(conversation_context) < 2:
            return 0.0
        
        # Check for deteriorating sentiment across recent messages
        recent_messages = conversation_context[-5:]  # Last 5 exchanges
        
        # Simple heuristic: if multiple recent messages show distress, increase risk
        distress_count = 0
        for msg in recent_messages:
            if msg.get('role') == 'user':
                msg_text = msg.get('content', '')
                # Quick embedding check
                if self.embedding_model:
                    msg_emb = self.embedding_model.encode(msg_text, convert_to_tensor=True)
                    # Check similarity to severe_distress concept
                    distress_sim = F.cosine_similarity(
                        msg_emb.unsqueeze(0),
                        self.concept_embeddings['severe_distress']['mean_embedding'].unsqueeze(0)
                    ).item()
                    if distress_sim > 0.5:
                        distress_count += 1
        
        # Return context escalation score
        return min(0.3, distress_count * 0.1)
    
    def _calculate_semantic_risk(self, concept_scores: dict, urgency: bool, context_score: float) -> float:
        """Calculate overall semantic risk score (0-1)."""
        # Get highest concept score
        max_concept_score = max(concept_scores.values()) if concept_scores else 0.0
        
        # Base score from semantic similarity
        base_score = max_concept_score
        
        # Urgency boost
        if urgency:
            base_score = min(1.0, base_score + 0.3)
        
        # Context escalation
        final_score = min(1.0, base_score + context_score)
        
        return final_score
    
    def _score_to_level(self, score: float) -> str:
        """Convert risk score to risk level."""
        if score >= 0.85:
            return 'critical'
        elif score >= 0.70:
            return 'high'
        elif score >= 0.50:
            return 'medium'
        elif score >= 0.30:
            return 'low'
        else:
            return 'none'
    
    def _extract_semantic_indicators(self, concept_scores: dict, text: str) -> list[str]:
        """Extract specific semantic indicators present in text."""
        indicators = []
        
        # Add high-scoring concepts as indicators
        for concept_name, score in concept_scores.items():
            if score > 0.5:
                concept = next(c for c in self.CRISIS_CONCEPTS if c.name == concept_name)
                indicators.append(f"{concept.description} (konfidens: {score:.2f})")
        
        return indicators
    
    def _get_detected_concepts(self, concept_scores: dict) -> list[dict[str, Any]]:
        """Get detailed info about detected concepts."""
        detected = []
        
        for concept_name, score in concept_scores.items():
            if score > 0.4:  # Threshold for reporting
                concept = next(c for c in self.CRISIS_CONCEPTS if c.name == concept_name)
                detected.append({
                    'name': concept.name,
                    'category': concept.category,
                    'score': score,
                    'description': concept.description,
                    'weight': concept.weight
                })
        
        # Sort by score descending
        detected.sort(key=lambda x: x['score'], reverse=True)
        return detected
    
    def _calculate_confidence(self, concept_scores: dict, semantic_score: float) -> float:
        """Calculate confidence in the assessment."""
        # More high-scoring concepts = higher confidence
        significant_concepts = sum(1 for s in concept_scores.values() if s > 0.4)
        
        # Base confidence on semantic score strength
        if semantic_score > 0.8:
            base_confidence = 0.9
        elif semantic_score > 0.5:
            base_confidence = 0.7
        else:
            base_confidence = 0.5
        
        # Adjust by number of supporting concepts
        concept_boost = min(0.1, significant_concepts * 0.02)
        
        return min(0.98, base_confidence + concept_boost)
    
    def _fallback_detection(self, text: str, conversation_context: Optional[list] = None) -> SemanticCrisisAssessment:
        """Fallback to enhanced keyword-based detection."""
        import re
        
        text_lower = text.lower()
        
        # Enhanced keyword matching (from original system but expanded)
        crisis_keywords = {
            'suicidal': [
                'döda mig', 'ta livet av mig', 'självmord', 'inte orka längre',
                'sluta leva', 'vill dö', 'inte vilja leva', 'hellre död'
            ],
            'self_harm': [
                'skada mig själv', 'skära mig', 'göra illa mig', 'självskada',
                'straffa mig själv', 'förtjänar smärta'
            ],
            'hopelessness': [
                'hopplöst', 'ingen mening', 'allt är meningslöst', 'ge upp',
                'ingen utväg', 'inget hopp', 'kommer aldrig bli bättre'
            ],
            'severe_distress': [
                'kan inte fortsätta', 'håller på att bryta ihop', 
                'psykiskt sammanbrott', 'mår för jävligt', 'orkar inte mer',
                'hjälp mig', 'vet inte vad jag ska göra'
            ]
        }
        
        detected_indicators = []
        max_severity = 0
        
        for category, keywords in crisis_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    detected_indicators.append(f"Nyckelord: '{keyword}' ({category})")
                    if category == 'suicidal':
                        max_severity = max(max_severity, 0.9)
                    elif category == 'self_harm':
                        max_severity = max(max_severity, 0.85)
                    elif category == 'hopelessness':
                        max_severity = max(max_severity, 0.7)
                    else:
                        max_severity = max(max_severity, 0.6)
        
        # Check urgency patterns
        urgency_detected = self._detect_urgency(text) if hasattr(self, '_detect_urgency') else False
        if urgency_detected:
            max_severity = min(1.0, max_severity + 0.2)
        
        risk_level = self._score_to_level(max_severity)
        
        return SemanticCrisisAssessment(
            risk_level=risk_level,
            confidence=0.6 if detected_indicators else 0.3,
            semantic_score=max_severity,
            semantic_indicators=detected_indicators,
            requires_immediate_attention=risk_level in ['high', 'critical'],
            detected_concepts=[{'name': 'keyword_fallback', 'category': 'fallback', 'score': max_severity}],
            embedding_similarity={'fallback': max_severity}
        )


# Singleton instance for reuse
_semantic_detector: Optional[SemanticCrisisDetector] = None


def get_semantic_crisis_detector() -> SemanticCrisisDetector:
    """Get or create the semantic crisis detector singleton."""
    global _semantic_detector
    if _semantic_detector is None:
        _semantic_detector = SemanticCrisisDetector()
    return _semantic_detector
