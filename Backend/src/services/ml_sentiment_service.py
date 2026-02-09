"""
ML-based Sentiment Analysis Service for Lugn & Trygg
Uses scikit-learn TF-IDF + Logistic Regression for Swedish text analysis.

This replaces the primitive keyword_fallback with a trained ML model that:
  - Handles Swedish text natively with bilingual training data
  - Provides calibrated confidence scores via predict_proba
  - Detects 8 emotion categories
  - Falls back gracefully if sklearn isn't available
"""

import hashlib
import hmac
import logging
import os
import pickle
import re
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Training corpus — Swedish + English phrases with sentiment labels
# In production this would be loaded from a file / Firestore, but embedding
# a sizeable corpus here ensures the model works out-of-the-box.
# ---------------------------------------------------------------------------

_TRAINING_DATA: list[tuple[str, str]] = [
    # ── POSITIVE (Swedish) ──
    ("Jag mår jättebra idag", "POSITIVE"),
    ("Jag är så glad och lycklig", "POSITIVE"),
    ("Det var en fantastisk dag", "POSITIVE"),
    ("Jag känner mig avslappnad och lugn", "POSITIVE"),
    ("Livet känns underbart just nu", "POSITIVE"),
    ("Jag är tacksam för allt jag har", "POSITIVE"),
    ("Jag älskar mitt liv", "POSITIVE"),
    ("Allt går bra för mig", "POSITIVE"),
    ("Jag är nöjd med mitt arbete", "POSITIVE"),
    ("Jag har energi och motivation", "POSITIVE"),
    ("Jag känner mig harmonisk", "POSITIVE"),
    ("Det var kul att träffa vänner", "POSITIVE"),
    ("Jag njuter av livet", "POSITIVE"),
    ("Jag känner hopp inför framtiden", "POSITIVE"),
    ("Solen skiner och jag mår bra", "POSITIVE"),
    ("Jag har haft en produktiv dag", "POSITIVE"),
    ("Jag känner mig stärkt och positiv", "POSITIVE"),
    ("Jag uppskattar de små sakerna i livet", "POSITIVE"),
    ("Det känns bra att vara vid liv", "POSITIVE"),
    ("Min familj gör mig lycklig", "POSITIVE"),
    ("Jag vaknade utvilad och pigg", "POSITIVE"),
    ("Träningen idag var fantastisk", "POSITIVE"),
    ("Jag fick beröm på jobbet", "POSITIVE"),
    ("Jag klarade provet med toppbetyg", "POSITIVE"),
    ("Kärleken i mitt liv ger mig styrka", "POSITIVE"),
    ("Jag känner mig fri och lättad", "POSITIVE"),
    ("Det är en vacker dag ute", "POSITIVE"),
    ("Jag är stolt över mig själv", "POSITIVE"),
    ("Musiken gör mig glad idag", "POSITIVE"),
    ("Jag har bra relationer", "POSITIVE"),
    ("Maten var utsökt", "POSITIVE"),
    ("Jag mår bra tack", "POSITIVE"),
    ("Jag är nöjd och belåten", "POSITIVE"),
    ("Idag var en bra dag", "POSITIVE"),
    ("Jag skrattar mycket idag", "POSITIVE"),

    # ── NEGATIVE (Swedish) ──
    ("Jag mår dåligt och är ledsen", "NEGATIVE"),
    ("Jag känner mig deprimerad", "NEGATIVE"),
    ("Allt känns hopplöst", "NEGATIVE"),
    ("Jag är arg och frustrerad", "NEGATIVE"),
    ("Jag har ångest och är orolig", "NEGATIVE"),
    ("Jag vill inte leva längre", "NEGATIVE"),
    ("Jag är så trött på allt", "NEGATIVE"),
    ("Inget spelar någon roll", "NEGATIVE"),
    ("Jag känner mig ensam och övergiven", "NEGATIVE"),
    ("Jag hatar mitt liv", "NEGATIVE"),
    ("Jag är utmattad och utbränd", "NEGATIVE"),
    ("Jag kan inte sova på nätterna", "NEGATIVE"),
    ("Jag gråter hela tiden", "NEGATIVE"),
    ("Allt går fel för mig", "NEGATIVE"),
    ("Jag känner mig värdelös", "NEGATIVE"),
    ("Ingen bryr sig om mig", "NEGATIVE"),
    ("Jag orkar inte mer", "NEGATIVE"),
    ("Jag är rädd och nervös hela tiden", "NEGATIVE"),
    ("Jag har ont i hela kroppen av stress", "NEGATIVE"),
    ("Jag känner mig förtvivlad", "NEGATIVE"),
    ("Jag är besviken på mig själv", "NEGATIVE"),
    ("Min ångest tar över mitt liv", "NEGATIVE"),
    ("Jag sover dåligt och har mardrömmar", "NEGATIVE"),
    ("Jag har ingen motivation kvar", "NEGATIVE"),
    ("Jag känner mig tom inuti", "NEGATIVE"),
    ("Jag har haft panikångest idag", "NEGATIVE"),
    ("Jag saknar glädje i mitt liv", "NEGATIVE"),
    ("Jag har tappat allt hopp", "NEGATIVE"),
    ("Det känns som världen är emot mig", "NEGATIVE"),
    ("Jag mår psykiskt dåligt", "NEGATIVE"),
    ("Jag vill bara försvinna", "NEGATIVE"),
    ("Jag känner mig nedstämd och sorgsen", "NEGATIVE"),
    ("Stressad och irriterad", "NEGATIVE"),
    ("Jag gråter mig till sömns", "NEGATIVE"),
    ("Jag är ledsen och uppgiven", "NEGATIVE"),

    # ── NEUTRAL (Swedish) ──
    ("Jag mår okej idag", "NEUTRAL"),
    ("Det var en vanlig dag", "NEUTRAL"),
    ("Inget speciellt hände", "NEUTRAL"),
    ("Jag vet inte riktigt hur jag mår", "NEUTRAL"),
    ("Det är varken bra eller dåligt", "NEUTRAL"),
    ("Jag är neutral till det hela", "NEUTRAL"),
    ("Dagen var helt okej", "NEUTRAL"),
    ("Jag har inget speciellt att säga", "NEUTRAL"),
    ("Det går sådär", "NEUTRAL"),
    ("Jag gick till jobbet som vanligt", "NEUTRAL"),
    ("Jag åt lunch och sedan jobbade jag", "NEUTRAL"),
    ("Vädret är molnigt idag", "NEUTRAL"),
    ("Jag har inte bestämt mig än", "NEUTRAL"),
    ("Det var en ganska normal dag", "NEUTRAL"),
    ("Jag kollade på tv i kväll", "NEUTRAL"),
    ("Jag handlade mat efter jobbet", "NEUTRAL"),
    ("Jag har inga starka känslor just nu", "NEUTRAL"),
    ("Det är som det är", "NEUTRAL"),
    ("Jag mår sådär", "NEUTRAL"),
    ("Inget att klaga på", "NEUTRAL"),

    # ── POSITIVE (English) ──
    ("I feel great today", "POSITIVE"),
    ("I am so happy and grateful", "POSITIVE"),
    ("Everything is wonderful", "POSITIVE"),
    ("I love my life", "POSITIVE"),
    ("I feel relaxed and calm", "POSITIVE"),
    ("Today was an amazing day", "POSITIVE"),
    ("I am proud of myself", "POSITIVE"),
    ("I feel hopeful about the future", "POSITIVE"),
    ("Life is beautiful", "POSITIVE"),
    ("I enjoyed spending time with friends", "POSITIVE"),

    # ── NEGATIVE (English) ──
    ("I feel terrible today", "NEGATIVE"),
    ("I am so sad and lonely", "NEGATIVE"),
    ("Everything feels hopeless", "NEGATIVE"),
    ("I am stressed and anxious", "NEGATIVE"),
    ("I can't stop crying", "NEGATIVE"),
    ("I hate everything", "NEGATIVE"),
    ("I feel worthless", "NEGATIVE"),
    ("Nothing matters anymore", "NEGATIVE"),
    ("I want to give up", "NEGATIVE"),
    ("I am exhausted and burned out", "NEGATIVE"),

    # ── NEUTRAL (English) ──
    ("I feel okay today", "NEUTRAL"),
    ("Nothing special happened", "NEUTRAL"),
    ("It was a regular day", "NEUTRAL"),
    ("I'm not sure how I feel", "NEUTRAL"),
    ("Everything is fine", "NEUTRAL"),
]

# Emotion keywords — used after sentiment classification for fine-grained labeling
_EMOTION_LEXICON: dict[str, list[str]] = {
    "joy": [
        "glad", "lycklig", "glädje", "nöjd", "fantastisk", "underbart",
        "härligt", "kul", "skratt", "njuter", "stolt", "happy", "love",
        "wonderful", "amazing", "grateful", "tacksam", "pigg", "energisk",
    ],
    "sadness": [
        "ledsen", "sorgsen", "gråter", "nedstämd", "deprimerad", "sorg",
        "tårar", "saknar", "sad", "crying", "depressed", "grief", "lonely",
        "ensam", "uppgiven", "tom",
    ],
    "anger": [
        "arg", "rasande", "irriterad", "frustrerad", "ilska", "sur",
        "angry", "furious", "frustrated", "annoyed", "hat", "hatar",
    ],
    "fear": [
        "rädd", "orolig", "ängslig", "nervös", "skräck", "panik",
        "ångest", "afraid", "anxious", "worried", "scared", "panic",
        "panikångest",
    ],
    "surprise": [
        "förvånad", "chockad", "överraskad", "wow", "surprised", "shocked",
    ],
    "disgust": [
        "äcklad", "avsky", "motvilja", "disgusted", "repulsed",
    ],
    "trust": [
        "förtroende", "tillit", "trygg", "säker", "trust", "safe",
        "harmonisk", "lugn",
    ],
    "anticipation": [
        "spänning", "förväntan", "hopp", "excited", "looking forward",
        "hoppas", "längtar",
    ],
}


class MLSentimentService:
    """Scikit-learn-based sentiment analysis for Swedish + English text."""

    MODEL_VERSION = "1.0.0"

    _HMAC_KEY = (os.getenv("ENCRYPTION_KEY", "").encode() or os.urandom(32))

    def __init__(self):
        self._pipeline = None
        self._is_trained = False
        self._model_path = Path(__file__).parent.parent / "models" / "sentiment_model.pkl"
        self._train_or_load()

    # ------------------------------------------------------------------
    # Model lifecycle
    # ------------------------------------------------------------------

    def _train_or_load(self):
        """Load a cached model from disk, or train a fresh one."""
        try:
            from sklearn.calibration import CalibratedClassifierCV
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.linear_model import LogisticRegression
            from sklearn.pipeline import Pipeline
        except ImportError:
            logger.warning("scikit-learn not installed — ML sentiment analysis unavailable")
            return

        # Try loading a previously trained model (with HMAC integrity check)
        if self._model_path.exists():
            try:
                raw_bytes = self._model_path.read_bytes()
                # Verify HMAC-SHA256 signature (last 32 bytes)
                if len(raw_bytes) > 32:
                    payload, stored_sig = raw_bytes[:-32], raw_bytes[-32:]
                    expected_sig = hmac.new(self._HMAC_KEY, payload, hashlib.sha256).digest()
                    if not hmac.compare_digest(stored_sig, expected_sig):
                        logger.warning("⚠️ ML model file failed integrity check — retraining")
                        raise ValueError("HMAC mismatch")
                    saved = pickle.loads(payload)  # noqa: S301
                else:
                    raise ValueError("Model file too small")
                if saved.get("version") == self.MODEL_VERSION:
                    self._pipeline = saved["pipeline"]
                    self._is_trained = True
                    logger.info("✅ ML sentiment model loaded from disk (integrity verified)")
                    return
            except Exception as exc:
                logger.warning(f"Failed to load cached model, retraining: {exc}")

        # ---------- train from scratch ----------
        texts = [t for t, _ in _TRAINING_DATA]
        labels = [label for _, label in _TRAINING_DATA]

        self._pipeline = Pipeline([
            ("tfidf", TfidfVectorizer(
                analyzer="char_wb",      # character n-grams (handles Swedish morphology)
                ngram_range=(2, 5),       # bigrams to 5-grams
                max_features=8000,
                sublinear_tf=True,
                min_df=1,
            )),
            ("clf", CalibratedClassifierCV(
                LogisticRegression(
                    C=1.0,
                    max_iter=1000,
                    solver="lbfgs",
                    class_weight="balanced",
                ),
                cv=3,                    # 3-fold calibration for proper probabilities
                method="sigmoid",
            )),
        ])

        self._pipeline.fit(texts, labels)
        self._is_trained = True
        logger.info(f"✅ ML sentiment model trained on {len(texts)} samples")

        # Persist to disk with HMAC signature so next boot is instant
        try:
            self._model_path.parent.mkdir(parents=True, exist_ok=True)
            payload = pickle.dumps({"version": self.MODEL_VERSION, "pipeline": self._pipeline})
            sig = hmac.new(self._HMAC_KEY, payload, hashlib.sha256).digest()
            self._model_path.write_bytes(payload + sig)
            logger.info(f"💾 ML model saved to {self._model_path} (HMAC signed)")
        except Exception as exc:
            logger.warning(f"Could not cache model to disk: {exc}")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def available(self) -> bool:
        return self._is_trained and self._pipeline is not None

    def analyze(self, text: str) -> dict[str, Any]:
        """
        Analyze text and return sentiment dict compatible with ai_service format.

        Returns dict with keys:
            sentiment, score, magnitude, confidence, emotions, intensity, method
        """
        if not self.available:
            return self._keyword_fallback(text)

        text_clean = self._preprocess(text)
        if not text_clean:
            return self._neutral_result()

        # Predict
        label = str(self._pipeline.predict([text_clean])[0])
        probas = self._pipeline.predict_proba([text_clean])[0]
        classes = list(self._pipeline.classes_)

        # Extract per-class probabilities (convert numpy types to plain Python)
        prob_map = {str(cls): float(p) for cls, p in zip(classes, probas, strict=False)}
        confidence = float(max(probas))

        # Compute a continuous score in [-1, 1]
        pos_prob = prob_map.get("POSITIVE", 0.0)
        neg_prob = prob_map.get("NEGATIVE", 0.0)
        score = pos_prob - neg_prob  # ranges from -1 to 1

        # Detect emotions from text
        emotions = self._detect_emotions(text_clean)

        return {
            "sentiment": label,
            "score": round(score, 4),
            "magnitude": round(confidence * (1 + abs(score)), 4),
            "confidence": round(confidence, 4),
            "emotions": emotions,
            "intensity": round(abs(score), 4),
            "method": "ml_tfidf_logistic",
            "probabilities": {k: round(v, 4) for k, v in prob_map.items()},
        }

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    @staticmethod
    def _preprocess(text: str) -> str:
        """Lowercase, strip excess whitespace, remove URLs / emails."""
        text = text.lower().strip()
        text = re.sub(r"https?://\S+", "", text)
        text = re.sub(r"\S+@\S+", "", text)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    @staticmethod
    def _detect_emotions(text: str) -> list[str]:
        """Detect emotions using the lexicon."""
        text_lower = text.lower()
        found: list[str] = []
        for emotion, keywords in _EMOTION_LEXICON.items():
            if any(kw in text_lower for kw in keywords):
                found.append(emotion)
        return found[:3] if found else ["neutral"]

    @staticmethod
    def _neutral_result() -> dict[str, Any]:
        return {
            "sentiment": "NEUTRAL",
            "score": 0.0,
            "magnitude": 0.5,
            "confidence": 0.5,
            "emotions": ["neutral"],
            "intensity": 0.0,
            "method": "ml_tfidf_logistic",
        }

    @staticmethod
    def _keyword_fallback(text: str) -> dict[str, Any]:
        """Ultra-simple fallback if sklearn is unavailable."""
        positive = ["glad", "bra", "lycklig", "fantastisk", "nöjd", "tacksam", "happy", "great", "love"]
        negative = ["ledsen", "arg", "stressad", "deppig", "frustrerad", "dålig", "trött", "sad", "angry"]
        t = text.lower()
        p = sum(1 for w in positive if w in t)
        n = sum(1 for w in negative if w in t)
        if p > n:
            sentiment, score = "POSITIVE", min(p * 0.25, 1.0)
        elif n > p:
            sentiment, score = "NEGATIVE", -min(n * 0.25, 1.0)
        else:
            sentiment, score = "NEUTRAL", 0.0
        return {
            "sentiment": sentiment,
            "score": score,
            "magnitude": max(p + n, 1.0),
            "confidence": 0.4,
            "emotions": MLSentimentService._detect_emotions(t),
            "intensity": abs(score),
            "method": "keyword_fallback",
        }


# Module-level singleton — trained once at import time
ml_sentiment = MLSentimentService()
