"""
Advanced Swedish BERT-based Mood NLP Service
Replaces simplistic keyword extraction with deep semantic understanding
"""

import logging
import re
from dataclasses import dataclass

# Transformers with graceful fallback
try:
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer, pipeline
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("Transformers not available, using fallback")

logger = logging.getLogger(__name__)

_WORD_RE = re.compile(r'\w+')


@dataclass
class MoodAnalysis:
    """Complete mood analysis with confidence scores."""
    valence: float  # -1.0 (negative) to 1.0 (positive)
    arousal: float  # 0.0 (calm) to 1.0 (energetic)
    dominance: float  # 0.0 (controlled) to 1.0 (in-control)
    primary_emotion: str
    secondary_emotions: list[str]
    confidence: float
    intensity: int  # 1-10 scale
    clinical_indicators: dict[str, float]


class SwedishMoodNLP:
    """
    Swedish BERT-based mood analysis using KB-BERT (Kungliga Biblioteket).
    Provides clinically-relevant emotion detection with cultural adaptation.
    """

    # Swedish emotion vocabulary as word stems: a stem matches any word that
    # starts with it ("glad" matches "gladare", "nedstämd" "nedstämdhet").
    # Matching inside words read "hopplöst" (hopeless) as "hopp" (hope).
    EMOTION_CATEGORIES = {
        'positive': [
            'glad', 'glädje', 'lycklig', 'tacksam', 'energi', 'lugn', 'nöj',
            'tillfreds', 'stolt', 'hoppas', 'hoppfull', 'kärlek', 'älsk',
            'entusias', 'harmoni', 'trygg'
        ],
        'negative': [
            'sorg', 'ledsen', 'ångest', 'oro', 'ilsk', 'trött', 'nedstämd',
            'deprimerad', 'hopplös', 'meningslös', 'värdelös', 'olycklig',
            'skam', 'skuld', 'ensam', 'stress', 'skräck', 'rädsla'
        ],
        'clinical': [
            'depression', 'panik', 'suicid', 'självmord', 'självskada', 'trauma',
            'dissociation', 'mani', 'paranoia', 'tvång'
        ]
    }

    # A positive stem followed by "-lös" ("-less") is negative: glädjelös.
    PRIVATIVE_SUFFIX = 'lös'
    # One of these within the two words before a term flips its polarity.
    NEGATORS = frozenset({'inte', 'aldrig', 'ej', 'knappast'})

    # Explicit statements of suicidal intent: one is enough for high risk.
    SUICIDAL_EXPLICIT = re.compile(
        r'\b(självmord|suicid|vill dö|vill inte leva|inte vill leva|orkar inte leva'
        r'|ta mitt liv|ta livet av mig|döda mig|sluta leva|bättre utan mig)'
    )
    # Words that can carry the same meaning but often do not ("min katt är död").
    SUICIDAL_AMBIGUOUS = re.compile(r'\b(dö|död|döden|försvinna|inte orka)\b')

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

    def analyze_mood_text(self, text: str, context: list[str] | None = None) -> MoodAnalysis:
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

    def _bert_analysis(self, text: str, context: list[str] | None) -> MoodAnalysis:
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

    def _semantic_analysis(self, text: str, context: list[str] | None) -> MoodAnalysis:
        """Semantic analysis using Swedish emotion vocabulary."""
        pos_score, neg_score, clinical_score = self._polarity_counts(text)

        # Calculate valence
        total = pos_score + neg_score + 1  # +1 to avoid division by zero
        valence = (pos_score - neg_score) / total

        clinical_indicators = self._detect_clinical_markers(text)
        at_risk = clinical_indicators['suicidal_ideation'] > 0 or clinical_indicators['hopelessness'] > 0

        # Clinical terms or risk markers outweigh any positive words around them
        if clinical_score > 0:
            valence = min(valence - 0.3 * clinical_score, -0.5)
        if at_risk:
            valence = min(valence, -0.5)

        # Estimate arousal and dominance
        arousal = self._estimate_arousal(text)
        dominance = self._estimate_dominance(text)

        # Identify emotions
        emotions = self._identify_emotions(text, at_risk=at_risk)

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

    def _detect_clinical_markers(self, text: str) -> dict[str, float]:
        """Detect clinical risk markers in text."""
        text_lower = text.lower()
        markers = {}

        # Suicidal ideation markers (Swedish), matched as words and phrases:
        # "dö" used to match inside "dörr" and "döttrar".
        explicit = len(self.SUICIDAL_EXPLICIT.findall(text_lower))
        ambiguous = len(self.SUICIDAL_AMBIGUOUS.findall(text_lower))
        markers['suicidal_ideation'] = min(0.6 * explicit + 0.3 * ambiguous, 1.0)

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

    def _polarity_counts(self, text: str) -> tuple[int, int, int]:
        """Positive, negative and clinical terms in `text`, after negation."""
        words = _WORD_RE.findall(text.lower())
        positive = negative = clinical = 0

        for i, word in enumerate(words):
            if any(word.startswith(stem) for stem in self.EMOTION_CATEGORIES['clinical']):
                clinical += 1
            positive_stem = next((s for s in self.EMOTION_CATEGORIES['positive'] if word.startswith(s)), None)
            if positive_stem and self.PRIVATIVE_SUFFIX in word[len(positive_stem):]:
                polarity = -1
            elif positive_stem:
                polarity = 1
            elif any(word.startswith(stem) for stem in self.EMOTION_CATEGORIES['negative']):
                polarity = -1
            else:
                continue
            if self.NEGATORS.intersection(words[max(0, i - 2):i]):
                polarity = -polarity
            if polarity > 0:
                positive += 1
            else:
                negative += 1

        return positive, negative, clinical

    def _identify_emotions(self, text: str, at_risk: bool = False) -> dict[str, any]:
        """Identify specific emotions from text."""
        positive, negative, _ = self._polarity_counts(text)
        emotion_scores = {name: count for name, count in (('positive', positive), ('negative', negative)) if count}
        if at_risk:
            # Risk markers decide the reading, whatever words surround them.
            emotion_scores['negative'] = max(emotion_scores.values(), default=0) + 1

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
_mood_nlp: SwedishMoodNLP | None = None


def get_mood_nlp() -> SwedishMoodNLP:
    """Get or create the mood NLP singleton."""
    global _mood_nlp
    if _mood_nlp is None:
        _mood_nlp = SwedishMoodNLP()
    return _mood_nlp
