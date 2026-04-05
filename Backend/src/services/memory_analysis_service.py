"""
AI-Powered Memory Analysis Service
Provides intelligent analysis of multi-modal memories for therapeutic insights

Features:
- Text sentiment and theme extraction
- Audio emotion analysis integration
- Image content analysis (if available)
- Memory clustering and pattern detection
- Therapeutic insight generation
- Life narrative construction
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

# AI/ML imports with graceful fallback
try:
    from transformers import AutoModelForSequenceClassification, AutoTokenizer, pipeline
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    logging.warning("transformers not available - memory analysis will use fallback")

# Import existing services
try:
    from .mood_nlp_service import SwedishMoodNLP, get_mood_nlp
    from .voice_emotion_service import get_voice_emotion_analyzer
    NLP_AVAILABLE = True
except ImportError:
    NLP_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class MemoryAnalysisResult:
    """AI analysis result for a memory entry"""
    memory_id: str
    sentiment_score: float  # -1 to 1
    emotions: dict[str, float]  # emotion -> confidence
    themes: list[str]  # extracted themes
    significance_score: float  # 0-1 importance
    narrative_connection: str | None  # connection to life story
    therapeutic_insights: list[str]
    suggested_reflections: list[str]
    timestamp: datetime


@dataclass
class MemoryPattern:
    """Detected pattern across multiple memories"""
    pattern_type: str  # 'recurring_theme', 'emotional_arc', 'milestone'
    description: str
    memory_ids: list[str]
    confidence: float
    time_span: timedelta
    psychological_significance: str


class MemoryAnalysisService:
    """
    Professional AI service for memory analysis and therapeutic insights

    Implements:
    - Swedish BERT-based text analysis
    - Multi-modal fusion (text + audio + metadata)
    - Memory pattern detection
    - Therapeutic narrative construction
    - Life milestone identification
    """

    def __init__(self):
        self.nlp = get_mood_nlp() if NLP_AVAILABLE else None
        self.voice_analyzer = get_voice_emotion_analyzer() if NLP_AVAILABLE else None

        # Initialize sentiment analysis pipeline
        self.sentiment_pipeline = None
        if TRANSFORMERS_AVAILABLE:
            try:
                # Use multilingual model for Swedish support
                self.sentiment_pipeline = pipeline(
                    "sentiment-analysis",
                    model="cardiffnlp/twitter-xlm-roberta-base-sentiment",
                    tokenizer="cardiffnlp/twitter-xlm-roberta-base-sentiment"
                )
                logger.info("Memory analysis: Loaded multilingual sentiment model")
            except Exception as e:
                logger.warning(f"Could not load sentiment model: {e}")

        # Therapeutic themes and keywords (Swedish)
        self.therapeutic_themes = {
            'growth': ['växt', 'utveckling', 'lärde mig', 'insikt', 'förståelse', 'mognad'],
            'connection': ['kärlek', 'vänskap', 'närhet', 'stöd', 'gemenskap', 'familj'],
            'achievement': ['lyckades', 'prestation', 'mål', 'framgång', 'klarade', 'vann'],
            'healing': ['läkning', 'förlåtelse', 'acceptera', 'släppte', 'frid', 'lugn'],
            'challenge': ['svårt', 'utmaning', 'kämpade', 'överlevde', 'stark', 'mod'],
            'joy': ['glädje', 'lycka', 'skratt', 'nöje', 'underbart', 'fantastiskt'],
            'loss': ['sorg', 'förlust', 'saknar', 'tårar', 'ont', 'smärta'],
            'change': ['förändring', 'nytt', 'övergång', 'början', 'slut', 'kapitel']
        }

    def analyze_text_memory(self, text: str, context: dict | None = None) -> MemoryAnalysisResult:
        """
        Analyze a text-based memory entry

        Args:
            text: Memory content
            context: Additional context (date, location, associated mood)

        Returns:
            MemoryAnalysisResult with AI insights
        """
        if not text or len(text.strip()) < 10:
            return self._create_empty_analysis()

        # 1. Sentiment Analysis
        sentiment_score = self._analyze_sentiment(text)

        # 2. Emotion Detection
        emotions = self._detect_emotions(text)

        # 3. Theme Extraction
        themes = self._extract_themes(text)

        # 4. Significance Scoring
        significance = self._calculate_significance(text, emotions)

        # 5. Generate Insights
        insights = self._generate_therapeutic_insights(text, themes, emotions)

        # 6. Suggested Reflections
        reflections = self._suggest_reflections(text, themes, sentiment_score)

        return MemoryAnalysisResult(
            memory_id=context.get('memory_id', 'unknown') if context else 'unknown',
            sentiment_score=sentiment_score,
            emotions=emotions,
            themes=themes,
            significance_score=significance,
            narrative_connection=None,  # Would need memory history
            therapeutic_insights=insights,
            suggested_reflections=reflections,
            timestamp=datetime.now()
        )

    def analyze_multimodal_memory(
        self,
        text: str | None = None,
        audio_bytes: bytes | None = None,
        metadata: dict | None = None
    ) -> MemoryAnalysisResult:
        """
        Analyze memory with multiple modalities (text + audio)

        Implements fusion of text sentiment and audio emotion
        """
        results = []

        # Analyze text if available
        if text:
            text_analysis = self.analyze_text_memory(text, metadata)
            results.append(('text', text_analysis))

        # Analyze audio if available
        if audio_bytes and self.voice_analyzer:
            try:
                voice_result = self.voice_analyzer.analyze_audio(audio_bytes)
                audio_analysis = MemoryAnalysisResult(
                    memory_id=metadata.get('memory_id', 'unknown') if metadata else 'unknown',
                    sentiment_score=voice_result.valence,
                    emotions=voice_result.emotion_confidences,
                    themes=[],  # Would need transcription
                    significance_score=0.6,  # Voice adds significance
                    narrative_connection=None,
                    therapeutic_insights=[f"Röstanalys indikerar: {voice_result.primary_emotion}"],
                    suggested_reflections=["Hur kändes det att höra din röst från detta ögonblick?"],
                    timestamp=datetime.now()
                )
                results.append(('audio', audio_analysis))
            except Exception as e:
                logger.warning(f"Audio analysis failed: {e}")

        # Fuse results
        if len(results) == 1:
            return results[0][1]
        elif len(results) > 1:
            return self._fuse_multimodal_results(results, metadata)
        else:
            return self._create_empty_analysis()

    def detect_memory_patterns(self, memories: list[dict]) -> list[MemoryPattern]:
        """
        Detect patterns across multiple memories

        Identifies:
        - Recurring themes
        - Emotional arcs
        - Life milestones
        - Growth trajectories
        """
        if len(memories) < 3:
            return []

        patterns = []

        # Sort by date
        sorted_memories = sorted(memories, key=lambda x: x.get('timestamp', ''))

        # 1. Detect recurring themes
        all_themes = []
        for memory in sorted_memories:
            text = memory.get('content', '') + ' ' + memory.get('title', '')
            themes = self._extract_themes(text)
            all_themes.extend(themes)

        from collections import Counter
        theme_counts = Counter(all_themes)
        recurring = [(theme, count) for theme, count in theme_counts.items() if count >= 3]

        if recurring:
            top_theme = max(recurring, key=lambda x: x[1])
            patterns.append(MemoryPattern(
                pattern_type='recurring_theme',
                description=f"Återkommande tema: '{top_theme[0]}' förekommer i {top_theme[1]} minnen",
                memory_ids=[m.get('id') for m in sorted_memories],
                confidence=min(0.9, top_theme[1] / len(memories)),
                time_span=self._calculate_time_span(sorted_memories),
                psychological_significance="Detta tema verkar ha betydelse för din livsberättelse"
            ))

        # 2. Detect emotional arcs
        sentiments = []
        for memory in sorted_memories:
            text = memory.get('content', '')
            if text:
                sentiments.append(self._analyze_sentiment(text))

        if len(sentiments) >= 3:
            # Check for improvement arc
            if sentiments[-1] > sentiments[0] + 0.3:
                patterns.append(MemoryPattern(
                    pattern_type='emotional_arc',
                    description="Positiv utveckling: Dina minnen visar en uppåtgående trend",
                    memory_ids=[m.get('id') for m in sorted_memories],
                    confidence=0.7,
                    time_span=self._calculate_time_span(sorted_memories),
                    psychological_significance="Indikerar personlig tillväxt och positiv förändring"
                ))
            # Check for difficult period
            elif min(sentiments) < -0.3 and max(sentiments) > 0.3:
                patterns.append(MemoryPattern(
                    pattern_type='emotional_arc',
                    description="Återhämtning: En svår period följt av förbättring",
                    memory_ids=[m.get('id') for m in sorted_memories],
                    confidence=0.75,
                    time_span=self._calculate_time_span(sorted_memories),
                    psychological_significance="Visar resiliens och återhämtningsförmåga"
                ))

        # 3. Detect milestones
        milestone_keywords = ['exam', 'jobb', 'flytt', 'bröllop', 'förlossning', 'examen', 'begravning', 'separation']
        for memory in sorted_memories:
            text = memory.get('content', '').lower()
            if any(kw in text for kw in milestone_keywords):
                patterns.append(MemoryPattern(
                    pattern_type='milestone',
                    description=f"Livshändelse upptäckt: {memory.get('title', 'Okänd händelse')}",
                    memory_ids=[memory.get('id')],
                    confidence=0.8,
                    time_span=timedelta(days=1),
                    psychological_significance="Viktig livsövergång som formar din berättelse"
                ))
                break  # One milestone is enough

        return patterns

    def generate_life_narrative(self, memories: list[dict]) -> dict[str, Any]:
        """
        Generate a coherent life narrative from memory collection

        Creates therapeutic story arcs and identifies key chapters
        """
        if len(memories) < 5:
            return {
                'narrative': 'För få minnen för livsberättelse (minst 5 behövs)',
                'chapters': [],
                'themes': [],
                'growth_areas': []
            }

        # Sort chronologically
        sorted_memories = sorted(memories, key=lambda x: x.get('timestamp', ''))

        # Detect patterns
        patterns = self.detect_memory_patterns(sorted_memories)

        # Extract dominant themes
        all_themes = []
        for memory in sorted_memories:
            text = memory.get('content', '')
            all_themes.extend(self._extract_themes(text))

        from collections import Counter
        top_themes = [t for t, c in Counter(all_themes).most_common(5)]

        # Generate narrative summary
        narrative = self._construct_narrative_summary(sorted_memories, patterns, top_themes)

        # Identify chapters
        chapters = self._identify_life_chapters(sorted_memories)

        return {
            'narrative': narrative,
            'chapters': chapters,
            'themes': top_themes,
            'patterns': [
                {
                    'type': p.pattern_type,
                    'description': p.description,
                    'significance': p.psychological_significance
                }
                for p in patterns
            ],
            'growth_areas': self._identify_growth_areas(sorted_memories)
        }

    def _analyze_sentiment(self, text: str) -> float:
        """Analyze sentiment score from -1 (negative) to 1 (positive)"""
        if self.sentiment_pipeline:
            try:
                result = self.sentiment_pipeline(text[:512])[0]  # Truncate for model
                label = result['label']
                score = result['score']

                # Map to -1 to 1 scale
                if label == 'positive':
                    return score
                elif label == 'negative':
                    return -score
                else:
                    return 0.0
            except Exception as e:
                logger.warning(f"Sentiment pipeline failed: {e}")

        # Fallback: keyword-based
        positive_words = ['glad', 'lycklig', 'bra', 'fantastisk', 'underbart', 'kärlek', 'vänner']
        negative_words = ['ledsen', 'arg', 'trött', 'deppig', 'orolig', 'stressad', 'dåligt']

        text_lower = text.lower()
        pos_count = sum(1 for w in positive_words if w in text_lower)
        neg_count = sum(1 for w in negative_words if w in text_lower)

        if pos_count + neg_count == 0:
            return 0.0
        return (pos_count - neg_count) / (pos_count + neg_count)

    def _detect_emotions(self, text: str) -> dict[str, float]:
        """Detect emotions and their intensities"""
        emotion_keywords = {
            'joy': ['glad', 'lycklig', 'skratt', 'nöjd', 'fantastiskt', 'underbart'],
            'sadness': ['ledsen', 'sorgsen', 'gråter', 'deppig', 'nedstämd'],
            'anger': ['arg', 'ilsken', 'frustrerad', 'irriterad', 'upprörd'],
            'fear': ['rädd', 'orolig', 'ångest', 'nervös', 'panik'],
            'love': ['kärlek', 'älskar', 'nära', 'intim', 'förtrolighet'],
            'gratitude': ['tacksam', 'uppskattar', 'tacksamhet', 'välsignelse']
        }

        text_lower = text.lower()
        emotions = {}

        for emotion, keywords in emotion_keywords.items():
            count = sum(1 for kw in keywords if kw in text_lower)
            emotions[emotion] = min(1.0, count / 3)  # Cap at 1.0

        # Normalize
        total = sum(emotions.values())
        if total > 0:
            emotions = {k: v/total for k, v in emotions.items()}
        else:
            emotions = {'neutral': 1.0}

        return emotions

    def _extract_themes(self, text: str) -> list[str]:
        """Extract therapeutic themes from text"""
        text_lower = text.lower()
        found_themes = []

        for theme, keywords in self.therapeutic_themes.items():
            if any(kw in text_lower for kw in keywords):
                found_themes.append(theme)

        return found_themes if found_themes else ['general']

    def _calculate_significance(self, text: str, emotions: dict[str, float]) -> float:
        """Calculate memory significance score 0-1"""
        significance = 0.5  # Base

        # Length factor (longer often = more significant)
        if len(text) > 200:
            significance += 0.1

        # Emotional intensity
        max_emotion = max(emotions.values())
        significance += max_emotion * 0.2

        # Specific indicators
        indicators = ['alltid', 'aldrig', 'första', 'sista', 'viktigast', 'meningsfull']
        if any(ind in text.lower() for ind in indicators):
            significance += 0.2

        return min(1.0, significance)

    def _generate_therapeutic_insights(self, text: str, themes: list[str], emotions: dict[str, float]) -> list[str]:
        """Generate AI therapeutic insights"""
        insights = []

        # Theme-based insights
        if 'growth' in themes:
            insights.append("Detta minne visar på personlig utveckling och lärande.")

        if 'connection' in themes:
            insights.append("Relationer och nära kontakter verkar ha varit viktiga här.")

        if 'healing' in themes:
            insights.append("Ett minne av läkning och återhämtning.")

        if 'challenge' in themes:
            insights.append("Du visade styrka och mod i en svår situation.")

        # Emotion-based insights
        primary_emotion = max(emotions, key=emotions.get)
        if primary_emotion == 'joy':
            insights.append("Glädje och positiva upplevelser stärker välmående.")
        elif primary_emotion == 'sadness':
            insights.append("Sorg är en naturlig del av livet och visar att något betydde mycket.")

        # Generic insight if none specific
        if not insights:
            insights.append("Detta minne bidrar till din unika livsberättelse.")

        return insights

    def _suggest_reflections(self, text: str, themes: list[str], sentiment: float) -> list[str]:
        """Suggest therapeutic reflection prompts"""
        reflections = []

        if sentiment < -0.3:
            reflections.append("Vad hjälpte dig genom denna svåra tid?")
            reflections.append("Vad skulle du säga till ditt tidigare jag?")
        elif sentiment > 0.3:
            reflections.append("Vad gjorde detta ögonblick särskilt?")
            reflections.append("Hur kan du skapa fler sådana upplevelser?")
        else:
            reflections.append("Vad lärde du dig av denna erfarenhet?")

        if 'growth' in themes:
            reflections.append("Hur har du förändrats sedan dess?")

        return reflections

    def _fuse_multimodal_results(
        self,
        results: list[tuple[str, MemoryAnalysisResult]],
        metadata: dict | None
    ) -> MemoryAnalysisResult:
        """Fuse text and audio analysis results"""
        # Average sentiment
        sentiments = [r.sentiment_score for _, r in results]
        avg_sentiment = sum(sentiments) / len(sentiments)

        # Combine emotions (weighted average)
        all_emotions = {}
        for modality, result in results:
            weight = 0.6 if modality == 'text' else 0.4  # Text slightly more reliable
            for emotion, score in result.emotions.items():
                all_emotions[emotion] = all_emotions.get(emotion, 0) + score * weight

        # Combine themes
        all_themes = []
        for _, r in results:
            all_themes.extend(r.themes)

        # Combine insights
        all_insights = []
        for _, r in results:
            all_insights.extend(r.therapeutic_insights)

        return MemoryAnalysisResult(
            memory_id=metadata.get('memory_id', 'fused') if metadata else 'fused',
            sentiment_score=avg_sentiment,
            emotions=all_emotions,
            themes=list(set(all_themes)),
            significance_score=0.7,  # Multi-modal adds significance
            narrative_connection=None,
            therapeutic_insights=all_insights[:3],  # Limit to top 3
            suggested_reflections=results[0][1].suggested_reflections,
            timestamp=datetime.now()
        )

    def _calculate_time_span(self, memories: list[dict]) -> timedelta:
        """Calculate time span of memories"""
        if len(memories) < 2:
            return timedelta(days=1)

        try:
            from dateutil import parser
            dates = [parser.parse(m.get('timestamp', '')) for m in memories if m.get('timestamp')]
            if len(dates) >= 2:
                return max(dates) - min(dates)
        except Exception:
            pass

        return timedelta(days=30)  # Default

    def _construct_narrative_summary(self, memories: list[dict], patterns: list[MemoryPattern], themes: list[str]) -> str:
        """Construct a therapeutic narrative summary"""
        narrative = "Dina minnen berättar en historia av"

        if 'growth' in themes:
            narrative += " personlig utveckling och lärande."
        elif 'connection' in themes:
            narrative += " meningsfulla relationer och nära kontakter."
        elif 'challenge' in themes:
            narrative += " styrka och övervinna svårigheter."
        else:
            narrative += " unika upplevelser och viktiga ögonblick."

        if patterns:
            narrative += f" {patterns[0].description}"

        return narrative

    def _identify_life_chapters(self, memories: list[dict]) -> list[dict]:
        """Identify distinct life chapters from memory timeline"""
        # Simple chapter detection based on time gaps
        chapters = []

        if len(memories) < 5:
            return chapters

        try:
            from dateutil import parser
            dates = [(m, parser.parse(m.get('timestamp', ''))) for m in memories if m.get('timestamp')]
            dates.sort(key=lambda x: x[1])

            # Detect gaps > 3 months
            chapter_start = 0
            for i in range(1, len(dates)):
                gap = dates[i][1] - dates[i-1][1]
                if gap.days > 90:  # 3 months
                    chapter_memories = dates[chapter_start:i]
                    chapters.append({
                        'period': f"{dates[chapter_start][1].strftime('%Y-%m')} till {dates[i-1][1].strftime('%Y-%m')}",
                        'memory_count': len(chapter_memories),
                        'description': f"En period med {len(chapter_memories)} sparade minnen"
                    })
                    chapter_start = i

            # Add final chapter
            if chapter_start < len(dates):
                final_memories = dates[chapter_start:]
                chapters.append({
                    'period': f"{dates[chapter_start][1].strftime('%Y-%m')} till {dates[-1][1].strftime('%Y-%m')}",
                    'memory_count': len(final_memories),
                    'description': f"Senaste perioden med {len(final_memories)} minnen"
                })
        except Exception as e:
            logger.warning(f"Chapter identification failed: {e}")

        return chapters

    def _identify_growth_areas(self, memories: list[dict]) -> list[str]:
        """Identify areas of personal growth from memories"""
        growth_indicators = []

        for memory in memories:
            text = memory.get('content', '').lower()
            if any(w in text for w in ['övervann', 'klarade', 'lyckades', 'starkare']):
                growth_indicators.append('resilience')
            if any(w in text for w in ['förstod', 'insikt', 'lärde', 'växte']):
                growth_indicators.append('self_awareness')
            if any(w in text for w in ['förlät', 'släppte', 'accepterade']):
                growth_indicators.append('emotional_maturity')

        return list(set(growth_indicators)) if growth_indicators else ['general_growth']

    def _create_empty_analysis(self) -> MemoryAnalysisResult:
        """Create empty analysis for invalid input"""
        return MemoryAnalysisResult(
            memory_id='empty',
            sentiment_score=0.0,
            emotions={'neutral': 1.0},
            themes=[],
            significance_score=0.0,
            narrative_connection=None,
            therapeutic_insights=["Ingen analys tillgänglig för detta minne."],
            suggested_reflections=["Försök lägga till mer detaljer för bättre analys."],
            timestamp=datetime.now()
        )


# Global service instance
_memory_analysis_service: MemoryAnalysisService | None = None


def get_memory_analysis_service() -> MemoryAnalysisService:
    """Get singleton instance of memory analysis service"""
    global _memory_analysis_service
    if _memory_analysis_service is None:
        _memory_analysis_service = MemoryAnalysisService()
    return _memory_analysis_service


def analyze_memory_entry(
    text: str | None = None,
    audio_bytes: bytes | None = None,
    metadata: dict | None = None
) -> MemoryAnalysisResult:
    """
    Convenience function for memory analysis

    Args:
        text: Memory text content
        audio_bytes: Audio recording (optional)
        metadata: Additional context

    Returns:
        MemoryAnalysisResult with AI insights
    """
    service = get_memory_analysis_service()
    return service.analyze_multimodal_memory(text, audio_bytes, metadata)


def analyze_memory_collection(memories: list[dict]) -> dict[str, Any]:
    """
    Analyze a collection of memories for patterns and narrative

    Args:
        memories: List of memory entries

    Returns:
        Dictionary with patterns, narrative, and insights
    """
    service = get_memory_analysis_service()

    # Detect patterns
    patterns = service.detect_memory_patterns(memories)

    # Generate narrative
    narrative = service.generate_life_narrative(memories)

    return {
        'patterns': [
            {
                'type': p.pattern_type,
                'description': p.description,
                'confidence': p.confidence,
                'significance': p.psychological_significance
            }
            for p in patterns
        ],
        'narrative': narrative,
        'analysis_count': len(memories),
        'timestamp': datetime.now().isoformat()
    }
