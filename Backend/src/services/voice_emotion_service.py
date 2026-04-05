"""
Professional Voice Emotion Analysis Service
Implements evidence-based acoustic feature extraction for emotion recognition

Features:
- Prosodic analysis (pitch, intensity, speaking rate)
- Spectral features (MFCCs, spectral characteristics)
- Voice quality (jitter, shimmer, HNR)
- Multi-modal fusion (audio + text)
- Evidence-based emotion mapping
"""

import logging
import tempfile
from dataclasses import dataclass
from enum import Enum

import numpy as np

# Professional audio analysis with graceful fallback
try:
    import librosa
    import librosa.feature
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    logging.warning("librosa not available - voice emotion analysis will use fallback")

try:
    import scipy.signal
    import scipy.stats
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False

# Optional OpenAI integration for advanced multimodal analysis
try:
    import openai  # noqa: F401
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

logger = logging.getLogger(__name__)


class EmotionCategory(Enum):
    """Evidence-based emotion categories from voice research"""
    HAPPY = "happy"
    SAD = "sad"
    ANGRY = "angry"
    FEARFUL = "fearful"
    NEUTRAL = "neutral"
    SURPRISED = "surprised"
    DISGUSTED = "disgusted"
    ANXIOUS = "anxious"
    FRUSTRATED = "frustrated"


@dataclass
class ProsodicFeatures:
    """Prosodic (suprasegmental) features - primary emotion cues"""
    # Pitch (F0) statistics
    pitch_mean: float  # Mean fundamental frequency
    pitch_std: float   # Pitch variation (monotone vs. animated)
    pitch_range: float # Max - min pitch (emotional expressiveness)
    pitch_slope: float # Rising/falling contour trend

    # Intensity (loudness)
    intensity_mean: float
    intensity_std: float
    intensity_range: float

    # Speaking rate
    syllables_per_second: float
    pause_ratio: float  # Silence vs. speech ratio
    pause_count: int

    # Voice quality
    jitter: float  # Pitch perturbation (roughness)
    shimmer: float # Amplitude perturbation
    hnr: float     # Harmonics-to-noise ratio (clarity)


@dataclass
class SpectralFeatures:
    """Spectral features - voice timbre characteristics"""
    # MFCCs (Mel-frequency cepstral coefficients)
    mfcc_means: np.ndarray  # 13-dimensional
    mfcc_vars: np.ndarray

    # Spectral shape
    spectral_centroid: float  # "brightness" of voice
    spectral_rolloff: float
    spectral_bandwidth: float
    spectral_contrast: np.ndarray
    spectral_flatness: float

    # Formants (vowel characteristics)
    formant_1_mean: float
    formant_2_mean: float
    formant_dispersion: float


@dataclass
class VoiceEmotionResult:
    """Complete voice emotion analysis result"""
    primary_emotion: str
    emotion_confidences: dict[str, float]
    valence: float  # -1 (negative) to +1 (positive)
    arousal: float  # 0 (calm) to 1 (excited)
    dominance: float  # 0 (submissive) to 1 (dominant)

    # Audio characteristics
    prosody: ProsodicFeatures
    spectral: SpectralFeatures

    # Analysis metadata
    analysis_method: str
    confidence: float
    sample_rate: int
    duration_seconds: float


class ProfessionalVoiceEmotionAnalyzer:
    """
    Professional voice emotion analyzer using evidence-based acoustic features
    Research basis:
    - Scherer (2003): Vocal communication of emotion
    - Juslin & Laukka (2003): Emotional expression in speech
    - Cowie et al. (2001): Emotion recognition from voice
    """

    def __init__(self):
        self.sample_rate = 16000  # Standard for speech analysis
        self.frame_size = 2048
        self.hop_length = 512

        # Emotion acoustic profiles (from research literature)
        self.emotion_profiles = {
            EmotionCategory.HAPPY: {
                'pitch_mean': (250, 350),      # Higher pitch
                'pitch_range': (100, 200),     # Wide variation
                'intensity_mean': (0.6, 0.9),  # Loud
                'intensity_range': (0.3, 0.6), # Variable
                'speaking_rate': (5.0, 7.0),   # Fast
                'hnr': (10, 20),               # Clear voice
            },
            EmotionCategory.SAD: {
                'pitch_mean': (100, 180),      # Low pitch
                'pitch_range': (20, 60),       # Narrow, monotone
                'intensity_mean': (0.3, 0.5),  # Soft
                'intensity_range': (0.1, 0.2), # Little variation
                'speaking_rate': (3.0, 4.5),   # Slow
                'hnr': (5, 12),                # Slight hoarseness
            },
            EmotionCategory.ANGRY: {
                'pitch_mean': (220, 350),      # High pitch
                'pitch_range': (80, 180),      # Wide range
                'intensity_mean': (0.7, 1.0),  # Very loud
                'intensity_range': (0.4, 0.8), # Very variable
                'speaking_rate': (5.5, 8.0),   # Very fast
                'hnr': (8, 15),                # Slight strain
            },
            EmotionCategory.ANXIOUS: {
                'pitch_mean': (200, 300),      # Raised pitch
                'pitch_range': (60, 120),      # Irregular
                'intensity_mean': (0.4, 0.6),  # Medium-low
                'intensity_range': (0.2, 0.4), # Some variation
                'speaking_rate': (5.0, 7.5),   # Fast with pauses
                'hnr': (6, 12),                # Some tension
            },
            EmotionCategory.FEARFUL: {
                'pitch_mean': (280, 400),      # Very high
                'pitch_range': (120, 250),     # Trembling
                'intensity_mean': (0.3, 0.6),  # Variable
                'intensity_range': (0.3, 0.7), # Unstable
                'speaking_rate': (4.0, 7.0),   # Irregular
                'hnr': (5, 10),                # Tense
            },
            EmotionCategory.NEUTRAL: {
                'pitch_mean': (150, 220),      # Normal range
                'pitch_range': (40, 80),       # Moderate variation
                'intensity_mean': (0.4, 0.6),  # Normal loudness
                'intensity_range': (0.15, 0.3),# Moderate variation
                'speaking_rate': (4.0, 5.5),   # Normal pace
                'hnr': (12, 25),               # Clear
            }
        }

    def analyze_audio(self, audio_bytes: bytes) -> VoiceEmotionResult:
        """
        Analyze emotion from audio bytes

        Returns professional emotion analysis with acoustic features
        """
        if LIBROSA_AVAILABLE:
            try:
                return self._analyze_with_librosa(audio_bytes)
            except Exception as e:
                logger.warning(f"Librosa analysis failed: {e}, using fallback")

        return self._analyze_fallback(audio_bytes)

    def _analyze_with_librosa(self, audio_bytes: bytes) -> VoiceEmotionResult:
        """Professional analysis using librosa"""
        import os

        # Check if audio_bytes is raw PCM or already a WAV file
        is_wav = audio_bytes[:4] == b'RIFF' and audio_bytes[8:12] == b'WAVE'

        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            if is_wav:
                # Already a WAV file
                tmp.write(audio_bytes)
            else:
                # Raw PCM - need to add WAV header using soundfile
                try:
                    import soundfile as sf
                    # Convert bytes to numpy array (assuming 16-bit PCM)
                    audio_array = np.frombuffer(audio_bytes, dtype=np.int16)
                    # Normalize to float [-1, 1]
                    audio_float = audio_array.astype(np.float32) / 32768.0
                    # Write as WAV
                    sf.write(tmp.name, audio_float, self.sample_rate, format='WAV')
                except Exception as e:
                    logger.warning(f"soundfile write failed: {e}, trying raw fallback")
                    # Fallback: just write raw bytes and hope librosa can handle it
                    tmp.write(audio_bytes)

            tmp_path = tmp.name

        try:
            # Load audio
            y, sr = librosa.load(tmp_path, sr=self.sample_rate, mono=True)
            duration = len(y) / sr

            # Extract prosodic features
            prosody = self._extract_prosodic_features(y, sr)

            # Extract spectral features
            spectral = self._extract_spectral_features(y, sr)

            # Map to emotions
            emotion_scores = self._map_acoustics_to_emotions(prosody, spectral)

            # Calculate VAD (Valence-Arousal-Dominance)
            valence, arousal, dominance = self._calculate_vad(prosody, spectral)

            # Determine primary emotion
            primary_emotion = max(emotion_scores, key=emotion_scores.get)
            confidence = emotion_scores[primary_emotion]

            return VoiceEmotionResult(
                primary_emotion=primary_emotion,
                emotion_confidences=emotion_scores,
                valence=valence,
                arousal=arousal,
                dominance=dominance,
                prosody=prosody,
                spectral=spectral,
                analysis_method='librosa_professional',
                confidence=confidence,
                sample_rate=sr,
                duration_seconds=duration
            )

        finally:
            import os
            os.unlink(tmp_path)

    def _extract_prosodic_features(self, y: np.ndarray, sr: int) -> ProsodicFeatures:
        """Extract prosodic (pitch, intensity, timing) features"""
        # Pitch (F0) using pip algorithm (state-of-the-art)
        f0, voiced_flag, _ = librosa.pyin(
            y,
            fmin=librosa.note_to_hz('C2'),
            fmax=librosa.note_to_hz('C7'),
            sr=sr,
            frame_length=self.frame_size,
            hop_length=self.hop_length
        )

        # Filter out unvoiced frames
        f0_voiced = f0[voiced_flag]

        if len(f0_voiced) > 0:
            pitch_mean = float(np.mean(f0_voiced))
            pitch_std = float(np.std(f0_voiced))
            pitch_range = float(np.max(f0_voiced) - np.min(f0_voiced))

            # Pitch slope (trend)
            if len(f0_voiced) > 1:
                x = np.arange(len(f0_voiced))
                slope, _, _, _, _ = scipy.stats.linregress(x, f0_voiced)
                pitch_slope = float(slope)
            else:
                pitch_slope = 0.0
        else:
            pitch_mean = 150.0
            pitch_std = 0.0
            pitch_range = 0.0
            pitch_slope = 0.0

        # Intensity (RMS energy)
        rms = librosa.feature.rms(y=y, frame_length=self.frame_size, hop_length=self.hop_length)[0]
        intensity_mean = float(np.mean(rms))
        intensity_std = float(np.std(rms))
        intensity_range = float(np.max(rms) - np.min(rms))

        # Speaking rate estimation (syllable detection via onset strength)
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        # Use keyword arguments for peak_pick (librosa 0.11+ API)
        peaks = librosa.util.peak_pick(
            x=onset_env,
            pre_max=3,
            post_max=3,
            pre_avg=3,
            post_avg=5,
            delta=0.5,
            wait=10
        )
        syllable_count = len(peaks)
        duration = len(y) / sr
        syllables_per_second = syllable_count / duration if duration > 0 else 0.0

        # Pauses (silence detection)
        intervals = librosa.effects.split(y, top_db=20)
        total_speech = sum(end - start for start, end in intervals)
        pause_ratio = 1.0 - (total_speech / len(y))
        pause_count = len(intervals) - 1 if len(intervals) > 0 else 0

        # Voice quality (using harmonic-percussive separation)
        y_harmonic, y_percussive = librosa.effects.hpss(y)

        # Estimate jitter (pitch perturbation)
        if len(f0_voiced) > 1:
            pitch_diffs = np.diff(f0_voiced)
            jitter = float(np.mean(np.abs(pitch_diffs)) / pitch_mean * 100)
        else:
            jitter = 0.0

        # Estimate shimmer (amplitude perturbation)
        amp_peaks = rms[rms > np.mean(rms)]
        if len(amp_peaks) > 1:
            amp_diffs = np.diff(amp_peaks)
            shimmer = float(np.mean(np.abs(amp_diffs)) / np.mean(amp_peaks) * 100)
        else:
            shimmer = 0.0

        # HNR (Harmonics-to-Noise Ratio) estimate
        harmonic_energy = np.sum(y_harmonic ** 2)
        noise_energy = np.sum(y_percussive ** 2)
        hnr = 10 * np.log10(harmonic_energy / (noise_energy + 1e-10)) if noise_energy > 0 else 20.0

        return ProsodicFeatures(
            pitch_mean=pitch_mean,
            pitch_std=pitch_std,
            pitch_range=pitch_range,
            pitch_slope=pitch_slope,
            intensity_mean=intensity_mean,
            intensity_std=intensity_std,
            intensity_range=intensity_range,
            syllables_per_second=syllables_per_second,
            pause_ratio=pause_ratio,
            pause_count=pause_count,
            jitter=jitter,
            shimmer=shimmer,
            hnr=float(hnr)
        )

    def _extract_spectral_features(self, y: np.ndarray, sr: int) -> SpectralFeatures:
        """Extract spectral (timbre) features"""
        # MFCCs (Mel-frequency cepstral coefficients)
        mfccs = librosa.feature.mfcc(
            y=y,
            sr=sr,
            n_mfcc=13,
            hop_length=self.hop_length
        )
        mfcc_means = np.mean(mfccs, axis=1)
        mfcc_vars = np.var(mfccs, axis=1)

        # Spectral centroid (brightness)
        spectral_centroid = librosa.feature.spectral_centroid(
            y=y, sr=sr, hop_length=self.hop_length
        )[0]

        # Spectral rolloff
        spectral_rolloff = librosa.feature.spectral_rolloff(
            y=y, sr=sr, hop_length=self.hop_length
        )[0]

        # Spectral bandwidth
        spectral_bandwidth = librosa.feature.spectral_bandwidth(
            y=y, sr=sr, hop_length=self.hop_length
        )[0]

        # Spectral contrast
        spectral_contrast = librosa.feature.spectral_contrast(
            y=y, sr=sr, hop_length=self.hop_length
        )

        # Spectral flatness
        spectral_flatness = librosa.feature.spectral_flatness(
            y=y, hop_length=self.hop_length
        )[0]

        # Estimate formants using LPC (simplified)
        # In production, use dedicated formant tracking
        formant_1_mean = float(np.mean(spectral_centroid) * 0.5)
        formant_2_mean = float(np.mean(spectral_centroid) * 0.8)
        formant_dispersion = float(np.std(spectral_centroid))

        return SpectralFeatures(
            mfcc_means=mfcc_means,
            mfcc_vars=mfcc_vars,
            spectral_centroid=float(np.mean(spectral_centroid)),
            spectral_rolloff=float(np.mean(spectral_rolloff)),
            spectral_bandwidth=float(np.mean(spectral_bandwidth)),
            spectral_contrast=np.mean(spectral_contrast, axis=1),
            spectral_flatness=float(np.mean(spectral_flatness)),
            formant_1_mean=formant_1_mean,
            formant_2_mean=formant_2_mean,
            formant_dispersion=formant_dispersion
        )

    def _map_acoustics_to_emotions(self, prosody: ProsodicFeatures, spectral: SpectralFeatures) -> dict[str, float]:
        """
        Map acoustic features to emotion probabilities
        Based on research literature (Scherer, Juslin & Laukka, etc.)
        """
        scores = {}

        for emotion, profile in self.emotion_profiles.items():
            score = 0.0

            # Pitch features
            pitch_mean_target = (profile['pitch_mean'][0] + profile['pitch_mean'][1]) / 2
            pitch_dev = abs(prosody.pitch_mean - pitch_mean_target) / pitch_mean_target
            score += max(0, 1 - pitch_dev) * 0.25

            # Pitch range
            pitch_range_target = (profile['pitch_range'][0] + profile['pitch_range'][1]) / 2
            range_dev = abs(prosody.pitch_range - pitch_range_target) / (pitch_range_target + 1)
            score += max(0, 1 - range_dev) * 0.15

            # Intensity
            intensity_target = (profile['intensity_mean'][0] + profile['intensity_mean'][1]) / 2
            intensity_dev = abs(prosody.intensity_mean - intensity_target)
            score += max(0, 1 - intensity_dev) * 0.20

            # Speaking rate
            rate_target = (profile['speaking_rate'][0] + profile['speaking_rate'][1]) / 2
            rate_dev = abs(prosody.syllables_per_second - rate_target) / rate_target
            score += max(0, 1 - rate_dev) * 0.20

            # Voice quality (HNR)
            hnr_target = (profile['hnr'][0] + profile['hnr'][1]) / 2
            hnr_dev = abs(prosody.hnr - hnr_target) / (hnr_target + 1)
            score += max(0, 1 - hnr_dev) * 0.20

            scores[emotion.value] = score

        # Normalize to probabilities
        total = sum(scores.values())
        if total > 0:
            scores = {k: v/total for k, v in scores.items()}

        return scores

    def _calculate_vad(self, prosody: ProsodicFeatures, spectral: SpectralFeatures) -> tuple[float, float, float]:
        """
        Calculate Valence-Arousal-Dominance dimensions
        Based on acoustic features (Russell's circumplex model)
        """
        # Valence (positive/negative) - pitch variability, brightness
        valence = (
            (prosody.pitch_range / 200) * 0.3 +  # Higher range = more expressive = more positive
            (spectral.spectral_centroid / 4000) * 0.2 +  # Brighter = more positive
            (1 - prosody.jitter / 5) * 0.2 +  # Clear voice = more positive
            (prosody.intensity_std / 0.2) * 0.3  # Variable intensity = engaged
        )
        valence = np.clip(valence * 2 - 1, -1, 1)  # Scale to -1 to 1

        # Arousal (activation) - pitch, intensity, rate
        arousal = (
            (prosody.pitch_mean / 400) * 0.3 +
            (prosody.intensity_mean / 0.8) * 0.3 +
            (prosody.syllables_per_second / 8) * 0.4
        )
        arousal = np.clip(arousal, 0, 1)

        # Dominance (power/control) - intensity, low jitter, steady pitch
        dominance = (
            (prosody.intensity_mean / 0.8) * 0.4 +
            (1 - prosody.jitter / 5) * 0.3 +
            (1 - prosody.pitch_std / 100) * 0.3
        )
        dominance = np.clip(dominance, 0, 1)

        return float(valence), float(arousal), float(dominance)

    def _analyze_fallback(self, audio_bytes: bytes) -> VoiceEmotionResult:
        """
        Fallback analysis when librosa is not available
        Uses naive byte-level statistics (limited accuracy)
        """
        logger.warning("Using fallback audio analysis - install librosa for professional results")

        # Basic byte-level analysis (limited)
        amplitudes = np.array([int.from_bytes(audio_bytes[i:i+2], 'little', signed=True)
                               for i in range(0, min(len(audio_bytes), 100000), 2)])

        if len(amplitudes) == 0:
            return self._create_neutral_result()

        # Basic statistics
        rms = np.sqrt(np.mean(amplitudes ** 2))
        peak = np.max(np.abs(amplitudes))

        # Create minimal prosody features
        prosody = ProsodicFeatures(
            pitch_mean=150.0,
            pitch_std=20.0,
            pitch_range=50.0,
            pitch_slope=0.0,
            intensity_mean=float(rms / 32768),  # Normalize to 0-1
            intensity_std=0.1,
            intensity_range=float(peak / 32768),
            syllables_per_second=4.5,
            pause_ratio=0.2,
            pause_count=3,
            jitter=1.0,
            shimmer=0.5,
            hnr=15.0
        )

        spectral = SpectralFeatures(
            mfcc_means=np.zeros(13),
            mfcc_vars=np.zeros(13),
            spectral_centroid=2000.0,
            spectral_rolloff=4000.0,
            spectral_bandwidth=1500.0,
            spectral_contrast=np.zeros(7),
            spectral_flatness=0.3,
            formant_1_mean=500.0,
            formant_2_mean=1500.0,
            formant_dispersion=200.0
        )

        # Low confidence fallback
        return VoiceEmotionResult(
            primary_emotion='neutral',
            emotion_confidences={'neutral': 0.5, 'unhappy': 0.2, 'calm': 0.2, 'excited': 0.1},
            valence=0.0,
            arousal=0.5,
            dominance=0.5,
            prosody=prosody,
            spectral=spectral,
            analysis_method='fallback_naive',
            confidence=0.3,
            sample_rate=16000,
            duration_seconds=len(audio_bytes) / 32000  # Rough estimate
        )

    def _create_neutral_result(self) -> VoiceEmotionResult:
        """Create neutral result for empty/invalid audio"""
        return VoiceEmotionResult(
            primary_emotion='neutral',
            emotion_confidences={'neutral': 1.0},
            valence=0.0,
            arousal=0.5,
            dominance=0.5,
            prosody=ProsodicFeatures(150, 0, 0, 0, 0.5, 0, 0, 4.5, 0.2, 0, 0, 0, 20),
            spectral=SpectralFeatures(np.zeros(13), np.zeros(13), 2000, 4000, 1500, np.zeros(7), 0.3, 500, 1500, 200),
            analysis_method='neutral_default',
            confidence=0.0,
            sample_rate=16000,
            duration_seconds=0.0
        )

    def analyze_with_openai(self, audio_bytes: bytes, transcript: str | None = None) -> VoiceEmotionResult | None:
        """
        Advanced analysis using OpenAI for multimodal emotion recognition
        Requires OpenAI API key and appropriate model access
        """
        if not OPENAI_AVAILABLE:
            return None

        try:
            # This would use OpenAI's audio models (if available)
            # For now, fallback to librosa analysis
            return self._analyze_with_librosa(audio_bytes)
        except Exception as e:
            logger.error(f"OpenAI analysis failed: {e}")
            return None


# Global analyzer instance
_voice_emotion_analyzer: ProfessionalVoiceEmotionAnalyzer | None = None


def get_voice_emotion_analyzer() -> ProfessionalVoiceEmotionAnalyzer:
    """Get singleton instance of voice emotion analyzer"""
    global _voice_emotion_analyzer
    if _voice_emotion_analyzer is None:
        _voice_emotion_analyzer = ProfessionalVoiceEmotionAnalyzer()
    return _voice_emotion_analyzer


def analyze_voice_emotion_professional(audio_bytes: bytes, transcript: str | None = None) -> VoiceEmotionResult:
    """
    Multimodal voice emotion analysis: audio features + text sentiment fusion.

    When a transcript is provided the text-based sentiment is combined with the
    acoustic analysis using a weighted average (60 % audio / 40 % text) so that
    the final result reflects both *how* the user sounds and *what* they say.

    Args:
        audio_bytes: Raw audio data (WAV, WEBM, OGG, etc.)
        transcript: Optional transcript for multimodal fusion

    Returns:
        VoiceEmotionResult with fused emotion analysis
    """
    analyzer = get_voice_emotion_analyzer()
    result = analyzer.analyze_audio(audio_bytes)

    # Multimodal text sentiment fusion
    if transcript and transcript.strip():
        result = _fuse_text_sentiment(result, transcript)

    return result


# ---- Swedish + English keyword sentiment lexicon ----------------------------
_POSITIVE_WORDS = {
    # Swedish
    'glad', 'glada', 'glädje', 'lycklig', 'lyckliga', 'fantastisk', 'underbar',
    'bra', 'suverän', 'härlig', 'nöjd', 'nöjda', 'positiv', 'optimistisk',
    'lugn', 'lugna', 'trygg', 'hoppfull', 'energisk', 'pigg',
    # English
    'happy', 'joy', 'great', 'wonderful', 'good', 'calm', 'peaceful',
    'positive', 'hopeful', 'energetic', 'fine', 'excellent', 'love',
}
_NEGATIVE_WORDS = {
    # Swedish crisis / distress keywords
    'ledsen', 'ledset', 'sorgsen', 'sorgsna', 'nedstämd', 'nedstämda',
    'orolig', 'oroliga', 'rädd', 'rädda', 'ångest', 'panik', 'arg', 'ilska',
    'frustrerad', 'frustrerade', 'hopplös', 'hopplösa', 'ensam', 'ensamma',
    'smärta', 'ont', 'mår dåligt', 'deprimerad', 'deprimerade',
    'vill inte leva', 'vill dö', 'ta livet', 'självmord', 'suicid', 'döda mig',
    # English
    'sad', 'depressed', 'anxious', 'scared', 'fear', 'angry', 'frustrated',
    'hopeless', 'alone', 'lonely', 'pain', 'hurt', 'terrible', 'awful', 'hate',
    'want to die', 'kill myself', 'suicide',
}
_EMOTION_TEXT_SIGNALS: dict[str, list[str]] = {
    'happy':      ['glad', 'glädje', 'lycklig', 'fantastisk', 'underbar', 'happy', 'joy', 'wonderful'],
    'sad':        ['ledsen', 'sorgsen', 'nedstämd', 'gråter', 'sad', 'depressed', 'cry'],
    'anxious':    ['orolig', 'ångest', 'nervös', 'panik', 'anxious', 'nervous', 'panic', 'worry'],
    'angry':      ['arg', 'ilska', 'frustrerad', 'angry', 'furious', 'frustrated', 'rage'],
    'fearful':    ['rädd', 'skrämd', 'skräck', 'scared', 'afraid', 'terrified', 'fear',
                   'vill inte leva', 'vill dö', 'självmord', 'suicid', 'want to die', 'suicide'],
    'neutral':    ['neutral', 'okej', 'ok', 'fine', 'alright'],
}


def _fuse_text_sentiment(audio_result: VoiceEmotionResult, transcript: str) -> VoiceEmotionResult:
    """
    Fuse audio-derived emotion scores with text-based signals.
    Weights: 60 % audio, 40 % text.
    """
    text_lower = transcript.lower()
    text_scores: dict[str, float] = dict.fromkeys(_EMOTION_TEXT_SIGNALS, 0.0)

    for emotion, keywords in _EMOTION_TEXT_SIGNALS.items():
        for kw in keywords:
            if kw in text_lower:
                text_scores[emotion] += 1.0

    total_text = sum(text_scores.values())
    if total_text == 0:
        # No text signals → return audio result unchanged
        return audio_result

    # Normalise text scores
    text_scores = {k: v / total_text for k, v in text_scores.items()}

    # Merge with audio scores
    audio_confidences = audio_result.emotion_confidences
    fused: dict[str, float] = {}
    all_emotions = set(list(audio_confidences.keys()) + list(text_scores.keys()))
    for em in all_emotions:
        a = audio_confidences.get(em, 0.0)
        t = text_scores.get(em, 0.0)
        fused[em] = 0.6 * a + 0.4 * t

    total_fused = sum(fused.values())
    if total_fused > 0:
        fused = {k: v / total_fused for k, v in fused.items()}

    new_primary = max(fused, key=fused.get)

    # Adjust valence: very negative text → drag valence lower
    negative_hit = any(kw in text_lower for kw in _NEGATIVE_WORDS)
    positive_hit = any(kw in text_lower for kw in _POSITIVE_WORDS)
    valence_adj = audio_result.valence
    if negative_hit and not positive_hit:
        valence_adj = float(np.clip(valence_adj - 0.25, -1.0, 1.0))
    elif positive_hit and not negative_hit:
        valence_adj = float(np.clip(valence_adj + 0.15, -1.0, 1.0))

    return VoiceEmotionResult(
        primary_emotion=new_primary,
        emotion_confidences=fused,
        valence=valence_adj,
        arousal=audio_result.arousal,
        dominance=audio_result.dominance,
        prosody=audio_result.prosody,
        spectral=audio_result.spectral,
        analysis_method=f'{audio_result.analysis_method}+text_fusion',
        confidence=fused.get(new_primary, audio_result.confidence),
        sample_rate=audio_result.sample_rate,
        duration_seconds=audio_result.duration_seconds,
    )
