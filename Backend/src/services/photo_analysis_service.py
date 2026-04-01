"""
Photo Analysis Service for Memory Journal
AI-powered image analysis for therapeutic insights
Extracts emotion, scene context, and meaningful elements from photos
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import numpy as np

# Image processing with graceful fallback
try:
    from PIL import ExifTags, Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    logging.warning("PIL not available - image analysis will use fallback")

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

# Vision AI
try:
    from transformers import AutoImageProcessor, AutoModelForImageClassification, pipeline
    TRANSFORMERS_VISION_AVAILABLE = True
except ImportError:
    TRANSFORMERS_VISION_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class PhotoAnalysisResult:
    """AI analysis of a photo for memory context."""
    photo_id: str
    dominant_emotion: str  # joy, sadness, calm, excitement, etc.
    emotion_confidence: float
    scene_type: str  # nature, urban, indoor, social, etc.
    objects_detected: list[dict[str, Any]]  # [{"label": "dog", "confidence": 0.95}]
    people_count: int
    has_faces: bool
    color_mood: str  # warm, cool, vibrant, muted
    aesthetic_score: float  # 0-1 visual appeal
    suggested_caption: str  # AI-generated caption
    therapeutic_tags: list[str]  # nature, connection, achievement, etc.
    timestamp: datetime
    analysis_method: str  # 'vision_transformer' or 'fallback'


class PhotoAnalysisService:
    """
    Professional photo analysis for memory journal.
    Extracts emotional and contextual information from images.
    """

    # Scene/emotion mappings for therapeutic insights
    THERAPEUTIC_SCENE_MAPPINGS = {
        'nature': ['growth', 'calm', 'connection', 'grounding'],
        'water': ['flow', 'peace', 'emotional_release'],
        'mountain': ['achievement', 'challenge', 'perspective'],
        'sunset': ['closure', 'beauty', 'transitions'],
        'people': ['connection', 'belonging', 'relationship'],
        'pet': ['joy', 'companionship', 'unconditional_love'],
        'food': ['nurturing', 'pleasure', 'social'],
        'city': ['energy', 'opportunity', 'stimulation'],
        'home': ['safety', 'comfort', 'identity']
    }

    # Color psychology mappings
    COLOR_MOOD_MAPPINGS = {
        'warm': ['happiness', 'energy', 'comfort'],
        'cool': ['calm', 'reflection', 'peace'],
        'vibrant': ['excitement', 'vitality', 'joy'],
        'muted': ['nostalgia', 'intimacy', 'contemplation']
    }

    def __init__(self):
        self.vision_pipeline = None
        self.image_processor = None

        if TRANSFORMERS_VISION_AVAILABLE:
            try:
                # Use lightweight model for efficiency
                self.vision_pipeline = pipeline(
                    "image-classification",
                    model="microsoft/resnet-50",
                    device=-1  # CPU
                )
                logger.info("✅ PhotoAnalysisService: Vision transformer loaded")
            except Exception as e:
                logger.warning(f"⚠️ Could not load vision model: {e}")

    def analyze_photo(self, image_bytes: bytes, photo_id: str) -> PhotoAnalysisResult:
        """
        Analyze a photo and extract therapeutic insights.
        
        Args:
            image_bytes: Raw image data
            photo_id: Unique photo identifier
        
        Returns:
            PhotoAnalysisResult with AI insights
        """
        if not PIL_AVAILABLE:
            return self._create_fallback_result(photo_id)

        try:
            # Load image
            image = Image.open(BytesIO(image_bytes))

            # Extract basic metadata
            width, height = image.size
            format_type = image.format

            # Color analysis
            color_mood = self._analyze_color_mood(image)

            # Scene classification
            scene_type, scene_conf = self._classify_scene(image)

            # Detect people/faces
            people_count, has_faces = self._detect_people(image)

            # Emotion inference from scene
            emotion = self._infer_emotion(scene_type, color_mood, has_faces)

            # Generate therapeutic tags
            therapeutic_tags = self._generate_therapeutic_tags(
                scene_type, color_mood, has_faces
            )

            # Generate caption
            caption = self._generate_caption(scene_type, therapeutic_tags, has_faces)

            # Calculate aesthetic score
            aesthetic = self._calculate_aesthetic_score(image, color_mood)

            return PhotoAnalysisResult(
                photo_id=photo_id,
                dominant_emotion=emotion,
                emotion_confidence=0.7 if self.vision_pipeline else 0.5,
                scene_type=scene_type,
                objects_detected=[],  # Would need object detection model
                people_count=people_count,
                has_faces=has_faces,
                color_mood=color_mood,
                aesthetic_score=aesthetic,
                suggested_caption=caption,
                therapeutic_tags=therapeutic_tags,
                timestamp=datetime.now(),
                analysis_method='vision_transformer' if self.vision_pipeline else 'fallback'
            )

        except Exception as e:
            logger.error(f"❌ Photo analysis failed: {e}")
            return self._create_fallback_result(photo_id)

    def _analyze_color_mood(self, image: Image.Image) -> str:
        """Analyze color palette and determine mood."""
        try:
            # Convert to RGB and resize for speed
            rgb_image = image.convert('RGB').resize((100, 100))

            # Get color histogram
            pixels = list(rgb_image.getdata())

            # Calculate warm vs cool
            warm_score = 0
            cool_score = 0

            for r, g, b in pixels:
                # Warm colors: red, orange, yellow
                if r > 150 and g > 100 and b < 100:
                    warm_score += 1
                # Cool colors: blue, purple
                elif b > 100 and r < 150:
                    cool_score += 1

            total = warm_score + cool_score
            if total == 0:
                return 'neutral'

            warm_ratio = warm_score / total

            if warm_ratio > 0.6:
                return 'warm'
            elif warm_ratio < 0.4:
                return 'cool'
            else:
                return 'balanced'

        except Exception:
            return 'neutral'

    def _classify_scene(self, image: Image.Image) -> tuple:
        """Classify scene type using vision model or fallback."""
        if self.vision_pipeline:
            try:
                # Use transformers pipeline
                results = self.vision_pipeline(image)
                top_result = max(results, key=lambda x: x['score'])
                return top_result['label'], top_result['score']
            except Exception:
                pass

        # Fallback: heuristic classification
        return self._heuristic_scene_classification(image)

    def _heuristic_scene_classification(self, image: Image.Image) -> tuple:
        """Fallback scene classification using image properties."""
        # Convert to analyze properties
        gray = image.convert('L')

        # Calculate brightness distribution
        pixels = list(gray.getdata())
        avg_brightness = sum(pixels) / len(pixels)

        # Simple heuristic
        if avg_brightness > 200:
            return 'bright_outdoor', 0.5
        elif avg_brightness < 50:
            return 'dark_indoor', 0.5
        else:
            return 'general', 0.5

    def _detect_people(self, image: Image.Image) -> tuple:
        """Detect if image contains people/faces."""
        has_faces = False
        people_count = 0

        if CV2_AVAILABLE:
            try:
                # Convert PIL to OpenCV format
                cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

                # Load face cascade
                face_cascade = cv2.CascadeClassifier(
                    cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
                )

                # Detect faces
                gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
                faces = face_cascade.detectMultiScale(gray, 1.1, 4)

                people_count = len(faces)
                has_faces = people_count > 0

            except Exception:
                pass

        return people_count, has_faces

    def _infer_emotion(self, scene: str, color_mood: str, has_faces: bool) -> str:
        """Infer emotional tone from scene characteristics."""
        emotion_scores = {
            'joy': 0,
            'calm': 0,
            'nostalgia': 0,
            'excitement': 0,
            'contemplation': 0
        }

        # Scene-based scoring
        if 'nature' in scene.lower() or 'outdoor' in scene.lower():
            emotion_scores['calm'] += 2
            emotion_scores['joy'] += 1

        if has_faces:
            emotion_scores['joy'] += 2
            emotion_scores['excitement'] += 1

        # Color-based scoring
        if color_mood == 'warm':
            emotion_scores['joy'] += 2
            emotion_scores['excitement'] += 1
        elif color_mood == 'cool':
            emotion_scores['calm'] += 2
            emotion_scores['contemplation'] += 1

        # Return highest scoring emotion
        return max(emotion_scores, key=emotion_scores.get)

    def _generate_therapeutic_tags(self, scene: str, color_mood: str, has_faces: bool) -> list[str]:
        """Generate therapeutic tags from photo analysis."""
        tags = []

        # Scene tags
        for scene_type, scene_tags in self.THERAPEUTIC_SCENE_MAPPINGS.items():
            if scene_type in scene.lower():
                tags.extend(scene_tags)

        # Color mood tags
        if color_mood in self.COLOR_MOOD_MAPPINGS:
            tags.extend(self.COLOR_MOOD_MAPPINGS[color_mood])

        # Social tags
        if has_faces:
            tags.extend(['connection', 'belonging', 'shared_moment'])

        return list(set(tags))  # Remove duplicates

    def _generate_caption(self, scene: str, tags: list[str], has_faces: bool) -> str:
        """Generate AI caption for the photo."""
        if has_faces:
            if 'connection' in tags:
                return "Ett ögonblick av samhörighet och närhet"
            elif 'joy' in tags:
                return "Glädje fångad på bild"

        if 'nature' in scene.lower():
            return "Naturens lugn och skönhet"

        if 'calm' in tags:
            return "Ett ögonblick av ro och reflektion"

        return "Ett värdefullt minne sparat"

    def _calculate_aesthetic_score(self, image: Image.Image, color_mood: str) -> float:
        """Calculate aesthetic appeal score."""
        score = 0.5  # Base score

        # Resolution bonus
        width, height = image.size
        if width * height > 2000000:  # > 2MP
            score += 0.1

        # Color mood bonus
        if color_mood in ['warm', 'vibrant']:
            score += 0.1

        # Format bonus
        if image.format in ['JPEG', 'PNG']:
            score += 0.1

        return min(1.0, score)

    def _create_fallback_result(self, photo_id: str) -> PhotoAnalysisResult:
        """Create fallback result when analysis unavailable."""
        return PhotoAnalysisResult(
            photo_id=photo_id,
            dominant_emotion='neutral',
            emotion_confidence=0.3,
            scene_type='unknown',
            objects_detected=[],
            people_count=0,
            has_faces=False,
            color_mood='neutral',
            aesthetic_score=0.5,
            suggested_caption="Ett sparat minne",
            therapeutic_tags=['memory', 'preserved_moment'],
            timestamp=datetime.now(),
            analysis_method='fallback'
        )


# Dependencies for photo analysis
from io import BytesIO

# Global service instance
_photo_service: PhotoAnalysisService | None = None


def get_photo_analysis_service() -> PhotoAnalysisService:
    """Get singleton instance of photo analysis service."""
    global _photo_service
    if _photo_service is None:
        _photo_service = PhotoAnalysisService()
    return _photo_service


def analyze_photo_for_memory(image_bytes: bytes, photo_id: str) -> PhotoAnalysisResult:
    """
    Convenience function for photo analysis.
    
    Args:
        image_bytes: Raw image data
        photo_id: Unique identifier
    
    Returns:
        PhotoAnalysisResult with AI insights
    """
    service = get_photo_analysis_service()
    return service.analyze_photo(image_bytes, photo_id)
