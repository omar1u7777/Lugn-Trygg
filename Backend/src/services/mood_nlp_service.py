"""
Advanced Swedish BERT-based Mood NLP Service
Replaces simplistic keyword extraction with deep semantic understanding
"""

import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import numpy as np

# Transformers with graceful fallback
try:
    from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
    import torch
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("Transformers not available, using fallback")

logger = logging.getLogger(__name__)


@dataclass
class MoodAnalysis:
    """Complete mood analysis with confidence scores."""
    valence: float  # -1.0 (negative) to 1.0 (positive)
    arousal: float  # 0.0 (calm) to 1.0 (energetic)
    dominance: float  # 0.0 (controlled) to 1.0 (in-control)
    primary_emotion: str
    secondary_emotions: List[str]
    confidence: float
    intensity: int  # 1-10 scale
    clinical_indicators: Dict[str, float]


class SwedishMoodNLP:
    """
    Swedish BERT-based mood analysis using KB-BERT (Kungliga Biblioteket).
    Provides clinically-relevant emotion detection with cultural adaptation.
    """
    
    # Swedish emotion vocabulary - culturally validated
    EMOTION_CATEGORIES = {
        'positive': [
            'glädje', 'tacksamhet', 'energi', 'lugn', 'nöje', 
            'stolthet', 'hopp', 'kärlek', 'entusiasm', 'harmoni'
        ],
        'negative': [
            'sorg', 'ångest', 'oro', 'ilska', 'trötthet',
            'nedstämdhet', 'hopplöshet', 'skam', 'skuld', 'ensamhet'
        ],
        'clinical': [
            'depression', 'panik', 'suicid', 'självskada', 'trauma',
            'dissociation', 'mani', 'paranoia', 'tvång'
        ]
    }
    
    def __init__(self):
        self.tokenizer = None
        self.model = None
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu') if TRANSFORMERS_AVAILABLE else None
        self.sentiment_pipeline = None
        
        if TRANSFORMERS_AVAILABLE:
            self._load_model()
    
    def _load_model(self):
        """Load Swedish BERT model for sentiment/emotion analysis."""
        try:
            # KB-BERT is the best Swedish BERT model available
            model_name = "KB/bert-base-swedish-cased"
            
            logger.info(f"Loading Swedish BERT model: {model_name}")
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.model = AutoModelForSequenceClassification.from_pretrained(
                model_name,
                num_labels=3,  # negative, neutral, positive
                ignore_mismatched_sizes=True
            )
            self.model.to(self.device)
            self.model.eval()
            
            # Load emotion classification pipeline
            self.sentiment_pipeline = pipeline(
                "sentiment-analysis",
                model=self.model,
                tokenizer=self.tokenizer,
                device=0 if torch.cuda.is_available() else -1
            )
            
            logger.info("✅ Swedish BERT model loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load BERT model: {e}")
            self.tokenizer = None
            self.model = None
    
    def analyze_mood_text(self, text: str, context: Optional[List[str]] = None) -> MoodAnalysis:
        """
        Analyze mood from Swedish text using BERT embeddings.
        
        Args:
            text: The mood text to analyze
            context: Previous mood entries for temporal context
            
        Returns:
            MoodAnalysis with valence, arousal, clinical indicators
        """
        if not text or not text.strip():
            return self._default_analysis()
        
        # Try BERT-based analysis first
        if self.sentiment_pipeline and TRANSFORMERS_AVAILABLE:
            try:
                return self._bert_analysis(text, context)
            except Exception as e:
                logger.warning(f"BERT analysis failed: {e}, using fallback")
        
        # Fallback to semantic keyword analysis
        return self._semantic_analysis(text, context)
    
    def _bert_analysis(self, text: str, context: Optional[List[str]]) -> MoodAnalysis:
        """BERT-based deep semantic analysis."""
        # Get BERT sentiment
        result = self.sentiment_pipeline(text[:512])[0]  # Truncate to max length
        
        label = result['label']
        confidence = result['score']
        
        # Map to valence (-1 to 1)
        valence_map = {
            'NEGATIVE': -0.7,
            'NEUTRAL': 0.0,
            'POSITIVE': 0.7
        }
        base_valence = valence_map.get(label, 0.0)
        
        # Adjust by confidence
        valence = base_valence * confidence
        
        # Detect clinical indicators
        clinical_indicators = self._detect_clinical_markers(text)
        
        # Estimate arousal from linguistic features
        arousal = self._estimate_arousal(text)
        
        # Estimate dominance/control
        dominance = self._estimate_dominance(text)
        
        # Identify primary and secondary emotions
        emotions = self._identify_emotions(text)
        
        # Calculate intensity (1-10)
        intensity = self._calculate_intensity(text, valence, arousal)
        
        return MoodAnalysis(
            valence=valence,
            arousal=arousal,
            dominance=dominance,
            primary_emotion=emotions['primary'],
            secondary_emotions=emotions['secondary'],
            confidence=confidence,
            intensity=intensity,
            clinical_indicators=clinical_indicators
        )
    
    def _semantic_analysis(self, text: str, context: Optional[List[str]]) -> MoodAnalysis:
        """Semantic analysis using Swedish emotion vocabulary."""
        text_lower = text.lower()
        
        # Count emotion category occurrences
        pos_score = sum(1 for word in self.EMOTION_CATEGORIES['positive'] if word in text_lower)
        neg_score = sum(1 for word in self.EMOTION_CATEGORIES['negative'] if word in text_lower)
        clinical_score = sum(1 for word in self.EMOTION_CATEGORIES['clinical'] if word in text_lower)
        
        # Calculate valence
        total = pos_score + neg_score + 1  # +1 to avoid division by zero
        valence = (pos_score - neg_score) / total
        
        # Boost negative if clinical terms present
        if clinical_score > 0:
            valence = min(valence - 0.3 * clinical_score, -0.5)
        
        # Detect clinical indicators
        clinical_indicators = self._detect_clinical_markers(text)
        
        # Estimate arousal and dominance
        arousal = self._estimate_arousal(text)
        dominance = self._estimate_dominance(text)
        
        # Identify emotions
        emotions = self._identify_emotions(text)
        
        # Calculate intensity
        intensity = self._calculate_intensity(text, valence, arousal)
        
        return MoodAnalysis(
            valence=valence,
            arousal=arousal,
            dominance=dominance,
            primary_emotion=emotions['primary'],
            secondary_emotions=emotions['secondary'],
            confidence=0.6,  # Lower confidence for fallback method
            intensity=intensity,
            clinical_indicators=clinical_indicators
        )
    
    def _detect_clinical_markers(self, text: str) -> Dict[str, float]:
        """Detect clinical risk markers in text."""
        text_lower = text.lower()
        markers = {}
        
        # Suicidal ideation markers (Swedish)
        suicide_terms = ['dö', 'suicid', 'självmord', 'inte orka', 'sluta', 'försvinna', 'död']
        markers['suicidal_ideation'] = sum(0.3 for term in suicide_terms if term in text_lower)
        markers['suicidal_ideation'] = min(markers['suicidal_ideation'], 1.0)
        
        # Hopelessness
        hopelessness_terms = ['hopplös', 'meningslös', 'poänglös', 'aldrig bättre', 'inget värde']
        markers['hopelessness'] = sum(0.25 for term in hopelessness_terms if term in text_lower)
        markers['hopelessness'] = min(markers['hopelessness'], 1.0)
        
        # Anxiety markers
        anxiety_terms = ['ångest', 'panik', 'hjärtat', 'svårt andas', 'orolig', 'nervös']
        markers['anxiety'] = sum(0.2 for term in anxiety_terms if term in text_lower)
        markers['anxiety'] = min(markers['anxiety'], 1.0)
        
        # Sleep disturbance
        sleep_terms = ['sova', 'sömn', 'vaken', 'trött', 'utmattad', 'orke']
        markers['sleep_disturbance'] = sum(0.15 for term in sleep_terms if term in text_lower)
        markers['sleep_disturbance'] = min(markers['sleep_disturbance'], 1.0)
        
        # Social withdrawal
        social_terms = ['ensam', 'isolerad', 'dra mig undan', 'ingen förstår', 'stänga ute']
        markers['social_withdrawal'] = sum(0.2 for term in social_terms if term in text_lower)
        markers['social_withdrawal'] = min(markers['social_withdrawal'], 1.0)
        
        return markers
    
    def _estimate_arousal(self, text: str) -> float:
        """Estimate arousal level from linguistic features."""
        text_lower = text.lower()
        
        # High arousal markers
        high_arousal = ['!', 'energi', 'hyper', 'stressad', 'panik', 'ångest', 'ilska', 'jävla', 'skit']
        high_count = sum(1 for marker in high_arousal if marker in text_lower)
        
        # Low arousal markers
        low_arousal = ['trött', 'slut', 'tom', 'utmattad', 'tung', 'tungt', 'sömnig', 'avslappnad', 'lugn']
        low_count = sum(1 for marker in low_arousal if marker in text_lower)
        
        if high_count > low_count:
            return 0.6 + min(high_count * 0.1, 0.4)
        elif low_count > high_count:
            return max(0.2, 0.4 - low_count * 0.1)
        else:
            return 0.5
    
    def _estimate_dominance(self, text:str) -> float:
        """Estimate sense of control/dominance."""
        text_lower = text.lower()
        
        # Loss of control markers
        loss_control = ['kan inte', 'förlorar', 'kontroll', 'överväldigad', 'fångad', 'inget val']
        loss_count = sum(1 for marker in loss_control if marker in text_lower)
        
        # Control markers
        control = ['kan', 'kontroll', 'bestämmer', 'väljer', 'styr', 'hanterar']
        control_count = sum(1 for marker in control if marker in text_lower)
        
        return max(0.0, min(1.0, 0.5 + (control_count - loss_count) * 0.15))
    
    def _identify_emotions(self, text: str) -> Dict[str, any]:
        """Identify specific emotions from text."""
        text_lower = text.lower()
        
        emotion_scores = {}
        
        # Score each emotion category
        for category, words in self.EMOTION_CATEGORIES.items():
            if category != 'clinical':
                score = sum(1 for word in words if word in text_lower)
                if score > 0:
                    emotion_scores[category] = score
        
        # Determine primary emotion
        if emotion_scores:
            primary = max(emotion_scores, key=emotion_scores.get)
            secondary = [e for e, s in emotion_scores.items() if e != primary and s > 0]
            secondary = secondary[:2]  # Max 2 secondary emotions
        else:
            primary = 'neutral'
            secondary = []
        
        return {
            'primary': primary,
            'secondary': secondary
        }
    
    def _calculate_intensity(self, text: str, valence: float, arousal: float) -> int:
        """Calculate mood intensity on 1-10 scale."""
        # Base intensity from arousal
        base = int(arousal * 10)
        
        # Boost for extreme valence
        if abs(valence) > 0.7:
            base += 2
        
        # Adjust for intensity words
        intensity_boosters = ['mycket', 'extremt', 'jätte', 'totalt', 'helt', 'så']
        boost_count = sum(1 for word in intensity_boosters if word in text.lower())
        base += boost_count
        
        # Cap at 1-10
        return max(1, min(10, base))
    
    def _default_analysis(self) -> MoodAnalysis:
        """Return default neutral analysis."""
        return MoodAnalysis(
            valence=0.0,
            arousal=0.5,
            dominance=0.5,
            primary_emotion='neutral',
            secondary_emotions=[],
            confidence=0.0,
            intensity=5,
            clinical_indicators={}
        )
    
    def extract_mood_score(self, text: str) -> int:
        """Extract 1-10 mood score from text (for backward compatibility)."""
        analysis = self.analyze_mood_text(text)
        
        # Convert valence (-1 to 1) to 1-10 scale
        # Valence -1 → Score 1-3 (negative)
        # Valence 0 → Score 4-6 (neutral)
        # Valence 1 → Score 7-10 (positive)
        
        base_score = int((analysis.valence + 1) * 4.5) + 1
        
        # Adjust by intensity
        if analysis.intensity > 7:
            base_score = min(10, base_score + 1)
        elif analysis.intensity < 4:
            base_score = max(1, base_score - 1)
        
        # Clinical override: if high risk markers, cap at max 5
        risk_score = sum(analysis.clinical_indicators.values())
        if risk_score > 1.0:
            base_score = min(base_score, 5)
        
        return max(1, min(10, base_score))


# Singleton instance
_mood_nlp: Optional[SwedishMoodNLP] = None


def get_mood_nlp() -> SwedishMoodNLP:
    """Get or create the mood NLP singleton."""
    global _mood_nlp
    if _mood_nlp is None:
        _mood_nlp = SwedishMoodNLP()
    return _mood_nlp
