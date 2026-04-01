"""
AI Music Generation Service - Neural Ambient Soundscape Synthesis
Generates real-time adaptive music using procedural algorithms and neural audio synthesis.

Psychological foundations:
- Binaural beats for brainwave entrainment (delta, theta, alpha, beta, gamma)
- Isochronic tones for non-headphone users
- Fractal Brownian Motion (fBM) for natural-sounding textures
- Markov chains for melodic variation
- FFT-based spectral morphing for seamless transitions

References:
- Dr. Gerald Oster (1973) - Binaural beats research
- Dr. Jeffrey Thompson - Clinical applications of sound
- Dr. Alfred Tomatis - Sound therapy principles
"""

import io
import logging
import random
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any

import numpy as np

# Optional: Try to import advanced synthesis libraries
try:
    import soundfile as sf
    SOUNDFILE_AVAILABLE = True
except ImportError:
    SOUNDFILE_AVAILABLE = False
    logging.warning("soundfile not available - using basic wave generation")

try:
    from scipy import signal as scipy_signal
    from scipy.fft import fft, ifft
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    logging.warning("scipy not available - using basic numpy FFT")

from src.firebase_config import db
from src.services.audit_service import audit_log

logger = logging.getLogger(__name__)


class BrainwaveFrequency(Enum):
    """Brainwave frequencies for entrainment (Hz)."""
    DELTA = 2.5      # Deep sleep, healing
    THETA = 6.0      # Meditation, creativity
    ALPHA = 10.0     # Relaxation, focus
    BETA = 20.0      # Alertness, cognition
    GAMMA = 40.0     # Peak concentration


class SoundscapeType(Enum):
    """Types of AI-generated soundscapes."""
    DEEP_SLEEP = "deep_sleep"           # Delta waves + brown noise
    MEDITATION = "meditation"           # Theta waves + ambient drones
    FOCUS = "focus"                     # Alpha/Beta + isochronic
    ANXIETY_RELIEF = "anxiety_relief"   # Theta/alpha + pink noise
    ENERGY_BOOST = "energy_boost"       # Beta/gamma + white noise
    NATURE_SIM = "nature_sim"           # Procedural nature sounds
    COSMIC = "cosmic"                   # Space ambient + binaural


@dataclass
class AudioParameters:
    """Parameters for audio generation."""
    sample_rate: int = 44100
    duration: int = 300  # seconds (5 min default)
    binaural_freq: float = 10.0  # Hz
    carrier_freq: float = 200.0  # Hz base
    volume: float = 0.7
    fade_in: float = 5.0  # seconds
    fade_out: float = 5.0


@dataclass
class GeneratedTrack:
    """AI-generated audio track metadata."""
    track_id: str
    soundscape_type: SoundscapeType
    parameters: AudioParameters
    created_at: datetime
    audio_data: bytes | None = None
    duration_seconds: float = 0.0
    file_format: str = "wav"


class NeuralAmbientSynthesizer:
    """
    Procedural ambient soundscape generator.
    Uses mathematical models to create "infinite" unique ambient music.
    """

    def __init__(self):
        self.sample_rate = 44100
        self.base_freq = 432  # "Healing" frequency (A4)
        self.scale_ratios = [1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8, 2]  # Just intonation

    def generate_binaural_beat(self,
                               duration: float,
                               binaural_freq: float,
                               carrier_freq: float = 200) -> np.ndarray:
        """
        Generate binaural beat audio for brainwave entrainment.
        
        Args:
            duration: Length in seconds
            binaural_freq: Beat frequency (Hz) - determines brainwave state
            carrier_freq: Base frequency for the sound
        
        Returns:
            Stereo audio array (left/right channels)
        """
        t = np.linspace(0, duration, int(self.sample_rate * duration), False)

        # Left ear: carrier frequency
        left = np.sin(2 * np.pi * carrier_freq * t)

        # Right ear: carrier + binaural frequency
        right = np.sin(2 * np.pi * (carrier_freq + binaural_freq) * t)

        # Add harmonic richness
        for harmonic in [2, 3]:
            left += 0.1 * np.sin(2 * np.pi * carrier_freq * harmonic * t) / harmonic
            right += 0.1 * np.sin(2 * np.pi * (carrier_freq + binaural_freq) * harmonic * t) / harmonic

        # Soft envelope to avoid clicking
        envelope = self._create_envelope(len(t), self.sample_rate, 2.0, 2.0)
        left *= envelope
        right *= envelope

        # Combine into stereo
        stereo = np.column_stack((left, right))

        return stereo

    def generate_isochronic_tone(self,
                                duration: float,
                                pulse_freq: float,
                                carrier_freq: float = 200) -> np.ndarray:
        """
        Generate isochronic tones (mono, works without headphones).
        Pulses the carrier frequency on/off at the target brainwave rate.
        """
        t = np.linspace(0, duration, int(self.sample_rate * duration), False)

        # Create pulse envelope (square wave with soft edges)
        pulse_period = 1.0 / pulse_freq
        pulse = (np.sin(2 * np.pi * pulse_freq * t) > 0).astype(float)
        # Soften the edges
        pulse = self._soften_edges(pulse, samples=int(self.sample_rate * 0.01))

        # Carrier tone
        carrier = np.sin(2 * np.pi * carrier_freq * t)

        # Modulate
        audio = carrier * pulse

        # Add harmonics for richness
        for harmonic in [2, 3, 4]:
            audio += 0.05 * np.sin(2 * np.pi * carrier_freq * harmonic * t) / harmonic * pulse

        # Envelope
        envelope = self._create_envelope(len(t), self.sample_rate, 2.0, 2.0)
        audio *= envelope

        # Return as stereo (mono content in both channels)
        return np.column_stack((audio, audio))

    def generate_fractal_ambient(self,
                               duration: float,
                               complexity: int = 4) -> np.ndarray:
        """
        Generate ambient texture using Fractal Brownian Motion (fBM).
        Creates organic, evolving soundscapes.
        """
        samples = int(self.sample_rate * duration)

        # Start with white noise
        noise = np.random.randn(samples)

        # Apply multiple octaves (fractal layering)
        ambient = np.zeros(samples)
        for octave in range(complexity):
            # Low-pass filter each octave
            cutoff = 500 / (2 ** octave)  # Decreasing cutoff
            if SCIPY_AVAILABLE:
                sos = scipy_signal.butter(4, cutoff, btype='low', fs=self.sample_rate, output='sos')
                filtered = scipy_signal.sosfilt(sos, noise)
            else:
                # Basic low-pass using moving average
                window = int(self.sample_rate / cutoff)
                filtered = np.convolve(noise, np.ones(window)/window, mode='same')

            # Add with decreasing amplitude
            ambient += filtered * (0.5 ** octave)

        # Scale to prevent clipping
        ambient = ambient / np.max(np.abs(ambient)) * 0.5

        # Create stereo field with slight phase difference
        left = ambient
        right = np.roll(ambient, int(self.sample_rate * 0.02))  # 20ms delay

        stereo = np.column_stack((left, right))
        return stereo

    def generate_procedural_nature(self,
                                  duration: float,
                                  nature_type: str = "rain") -> np.ndarray:
        """
        Generate procedural nature sounds.
        Uses physical models to simulate natural phenomena.
        """
        samples = int(self.sample_rate * duration)
        t = np.linspace(0, duration, samples, False)

        audio = np.zeros(samples)

        if nature_type == "rain":
            # Brown noise + random impulses
            brown = np.cumsum(np.random.randn(samples))
            brown = brown / np.max(np.abs(brown))

            # Add random drops
            drops = np.zeros(samples)
            for _ in range(int(duration * 10)):  # ~10 drops per second
                pos = random.randint(0, samples - 1000)
                # Create drop sound (filtered noise burst)
                drop_len = random.randint(500, 2000)
                drop = np.random.randn(drop_len) * np.exp(-np.arange(drop_len) / 100)
                if pos + drop_len < samples:
                    drops[pos:pos+drop_len] += drop * 0.3

            audio = brown * 0.5 + drops * 0.3

        elif nature_type == "waves":
            # Modulated brown noise for wave effect
            brown = np.cumsum(np.random.randn(samples))
            brown = brown / np.max(np.abs(brown))

            # Slow modulation (0.1 Hz for wave rhythm)
            modulation = (np.sin(2 * np.pi * 0.1 * t) + 1) / 2
            audio = brown * modulation * 0.7

        elif nature_type == "wind":
            # Filtered white noise with spectral shifting
            white = np.random.randn(samples)
            # Moving bandpass filter simulation
            audio = np.zeros_like(white)
            for i in range(0, samples, 1000):
                center = 200 + 100 * np.sin(2 * np.pi * i / samples * 3)
                # Simple bandpass using IIR
                alpha = 0.1
                filtered = np.zeros(1000)
                for j in range(1, min(1000, samples - i)):
                    filtered[j] = alpha * white[i+j] + (1-alpha) * filtered[j-1]
                end_idx = min(i + 1000, samples)
                audio[i:end_idx] = filtered[:end_idx-i]

        # Normalize
        if np.max(np.abs(audio)) > 0:
            audio = audio / np.max(np.abs(audio)) * 0.6

        # Stereo
        return np.column_stack((audio, audio * 0.9))

    def generate_harmonic_drone(self,
                               duration: float,
                               root_freq: float = 110) -> np.ndarray:
        """
        Generate harmonic drone using just intonation ratios.
        Creates meditative, consonant textures.
        """
        samples = int(self.sample_rate * duration)
        t = np.linspace(0, duration, samples, False)

        drone = np.zeros(samples)

        # Add notes from the scale
        for i, ratio in enumerate(self.scale_ratios[:6]):  # First 6 notes
            freq = root_freq * ratio
            # Slight detuning for richness
            detune = random.uniform(-0.5, 0.5)

            # ADSR envelope for each note (long attack, long release)
            attack = int(self.sample_rate * (2 + i * 0.5))
            release = int(self.sample_rate * 5)

            note = np.sin(2 * np.pi * (freq + detune) * t)

            # Create envelope
            env = np.ones(samples)
            env[:attack] = np.linspace(0, 1, attack)
            env[-release:] = np.linspace(1, 0, release)

            # Decreasing amplitude for higher harmonics
            amplitude = 1.0 / (i + 1)
            drone += note * env * amplitude

        # Add slow filter sweep
        if SCIPY_AVAILABLE:
            for i in range(0, samples, 10000):
                cutoff = 500 + 300 * np.sin(2 * np.pi * i / samples)
                b, a = scipy_signal.butter(2, cutoff / (self.sample_rate/2), btype='low')
                end = min(i + 10000, samples)
                drone[i:end] = scipy_signal.lfilter(b, a, drone[i:end])

        # Stereo width
        left = drone
        right = np.roll(drone, int(self.sample_rate * 0.03))

        return np.column_stack((left, right))

    def _create_envelope(self, samples: int, sample_rate: int,
                        fade_in: float, fade_out: float) -> np.ndarray:
        """Create fade in/out envelope."""
        envelope = np.ones(samples)

        fade_in_samples = int(sample_rate * fade_in)
        fade_out_samples = int(sample_rate * fade_out)

        # Fade in
        if fade_in_samples > 0:
            envelope[:fade_in_samples] = np.linspace(0, 1, fade_in_samples)

        # Fade out
        if fade_out_samples > 0:
            envelope[-fade_out_samples:] = np.linspace(1, 0, fade_out_samples)

        return envelope

    def _soften_edges(self, signal: np.ndarray, samples: int = 100) -> np.ndarray:
        """Apply moving average to soften sharp edges."""
        kernel = np.ones(samples) / samples
        return np.convolve(signal, kernel, mode='same')


class AIMusicGenerationService:
    """
    Service for generating AI-powered adaptive music.
    Combines multiple synthesis techniques based on user needs.
    """

    def __init__(self):
        self.synthesizer = NeuralAmbientSynthesizer()
        self.generated_tracks: dict[str, GeneratedTrack] = {}

    def generate_soundscape(self,
                          user_id: str,
                          soundscape_type: SoundscapeType,
                          duration: int = 300,
                          target_mood: str | None = None) -> GeneratedTrack:
        """
        Generate a personalized AI soundscape.
        
        Args:
            user_id: User identifier
            soundscape_type: Type of soundscape to generate
            duration: Length in seconds
            target_mood: Optional mood target for adaptation
        
        Returns:
            GeneratedTrack with audio data
        """
        track_id = f"ai_{user_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{soundscape_type.value}"

        # Determine parameters based on type and mood
        params = self._get_parameters(soundscape_type, target_mood)
        params.duration = duration

        # Generate audio layers
        audio_layers = []

        if soundscape_type == SoundscapeType.DEEP_SLEEP:
            # Delta binaural + brown noise
            binaural = self.synthesizer.generate_binaural_beat(
                duration, BrainwaveFrequency.DELTA.value, params.carrier_freq
            )
            ambient = self.synthesizer.generate_fractal_ambient(duration, 3)
            audio_layers = [binaural * 0.4, ambient * 0.6]

        elif soundscape_type == SoundscapeType.MEDITATION:
            # Theta binaural + harmonic drone
            binaural = self.synthesizer.generate_binaural_beat(
                duration, BrainwaveFrequency.THETA.value, params.carrier_freq
            )
            drone = self.synthesizer.generate_harmonic_drone(duration, 110)
            audio_layers = [binaural * 0.3, drone * 0.7]

        elif soundscape_type == SoundscapeType.FOCUS:
            # Alpha/Isochronic + nature
            isochronic = self.synthesizer.generate_isochronic_tone(
                duration, BrainwaveFrequency.ALPHA.value, params.carrier_freq
            )
            nature = self.synthesizer.generate_procedural_nature(duration, "wind")
            audio_layers = [isochronic * 0.2, nature * 0.8]

        elif soundscape_type == SoundscapeType.ANXIETY_RELIEF:
            # Theta + pink noise + nature
            binaural = self.synthesizer.generate_binaural_beat(
                duration, BrainwaveFrequency.THETA.value, params.carrier_freq
            )
            ambient = self.synthesizer.generate_fractal_ambient(duration, 4)
            nature = self.synthesizer.generate_procedural_nature(duration, "waves")
            audio_layers = [binaural * 0.3, ambient * 0.4, nature * 0.3]

        elif soundscape_type == SoundscapeType.NATURE_SIM:
            # Procedural nature (rain, waves, wind)
            rain = self.synthesizer.generate_procedural_nature(duration, "rain")
            waves = self.synthesizer.generate_procedural_nature(duration, "waves")
            wind = self.synthesizer.generate_procedural_nature(duration, "wind")
            audio_layers = [rain * 0.4, waves * 0.4, wind * 0.2]

        elif soundscape_type == SoundscapeType.COSMIC:
            # Cosmic ambient + gamma binaural
            ambient = self.synthesizer.generate_fractal_ambient(duration, 6)
            binaural = self.synthesizer.generate_binaural_beat(
                duration, BrainwaveFrequency.GAMMA.value, params.carrier_freq * 2
            )
            audio_layers = [ambient * 0.7, binaural * 0.3]

        # Mix layers
        final_audio = self._mix_layers(audio_layers)

        # Apply master envelope
        envelope = self.synthesizer._create_envelope(
            len(final_audio), self.synthesizer.sample_rate, params.fade_in, params.fade_out
        )
        final_audio = final_audio * envelope[:, np.newaxis]

        # Convert to WAV bytes
        audio_bytes = self._array_to_wav_bytes(final_audio, self.synthesizer.sample_rate)

        track = GeneratedTrack(
            track_id=track_id,
            soundscape_type=soundscape_type,
            parameters=params,
            created_at=datetime.now(),
            audio_data=audio_bytes,
            duration_seconds=duration,
            file_format="wav"
        )

        # Store
        self.generated_tracks[track_id] = track

        # Save to Firestore metadata
        self._save_track_metadata(track, user_id)

        logger.info(f"Generated AI soundscape: {track_id} ({duration}s, {soundscape_type.value})")

        return track

    def _get_parameters(self, soundscape_type: SoundscapeType,
                       target_mood: str | None) -> AudioParameters:
        """Get audio parameters based on soundscape type and mood."""
        params = AudioParameters()

        # Base parameters by type
        type_params = {
            SoundscapeType.DEEP_SLEEP: {
                'binaural_freq': BrainwaveFrequency.DELTA.value,
                'carrier_freq': 150,
                'volume': 0.6
            },
            SoundscapeType.MEDITATION: {
                'binaural_freq': BrainwaveFrequency.THETA.value,
                'carrier_freq': 200,
                'volume': 0.7
            },
            SoundscapeType.FOCUS: {
                'binaural_freq': BrainwaveFrequency.ALPHA.value,
                'carrier_freq': 300,
                'volume': 0.5
            },
            SoundscapeType.ANXIETY_RELIEF: {
                'binaural_freq': BrainwaveFrequency.THETA.value,
                'carrier_freq': 180,
                'volume': 0.6
            },
            SoundscapeType.NATURE_SIM: {
                'binaural_freq': 0,  # No binaural
                'carrier_freq': 0,
                'volume': 0.8
            },
            SoundscapeType.COSMIC: {
                'binaural_freq': BrainwaveFrequency.GAMMA.value,
                'carrier_freq': 250,
                'volume': 0.6
            }
        }

        if soundscape_type in type_params:
            p = type_params[soundscape_type]
            params.binaural_freq = p['binaural_freq']
            params.carrier_freq = p['carrier_freq']
            params.volume = p['volume']

        # Adjust for mood if specified
        if target_mood:
            mood_adjustments = {
                'anxious': {'binaural_freq': BrainwaveFrequency.THETA.value, 'volume': 0.5},
                'stressed': {'binaural_freq': BrainwaveFrequency.ALPHA.value, 'volume': 0.6},
                'tired': {'binaural_freq': BrainwaveFrequency.BETA.value, 'volume': 0.7},
                'depressed': {'binaural_freq': BrainwaveFrequency.ALPHA.value, 'volume': 0.6},
                'agitated': {'binaural_freq': BrainwaveFrequency.DELTA.value, 'volume': 0.4}
            }
            if target_mood.lower() in mood_adjustments:
                adj = mood_adjustments[target_mood.lower()]
                if soundscape_type != SoundscapeType.NATURE_SIM:
                    params.binaural_freq = adj['binaural_freq']
                params.volume = adj['volume']

        return params

    def _mix_layers(self, layers: list[np.ndarray]) -> np.ndarray:
        """Mix multiple audio layers together."""
        if not layers:
            return np.zeros((1, 2))

        # Find minimum length
        min_len = min(len(layer) for layer in layers)

        # Trim all to same length
        trimmed = [layer[:min_len] for layer in layers]

        # Mix
        mixed = np.sum(trimmed, axis=0)

        # Normalize to prevent clipping
        max_val = np.max(np.abs(mixed))
        if max_val > 1.0:
            mixed = mixed / max_val * 0.95

        return mixed

    def _array_to_wav_bytes(self, audio: np.ndarray, sample_rate: int) -> bytes:
        """Convert numpy array to WAV format bytes."""
        # Ensure int16 format
        audio_int = (audio * 32767).astype(np.int16)

        # Create WAV in memory
        buffer = io.BytesIO()

        if SOUNDFILE_AVAILABLE:
            sf.write(buffer, audio_int, sample_rate, format='WAV', subtype='PCM_16')
        else:
            # Manual WAV writing
            buffer.write(b'RIFF')
            buffer.write((36 + audio_int.nbytes).to_bytes(4, 'little'))
            buffer.write(b'WAVE')
            buffer.write(b'fmt ')
            buffer.write((16).to_bytes(4, 'little'))  # Subchunk size
            buffer.write((1).to_bytes(2, 'little'))   # Audio format (PCM)
            buffer.write((2).to_bytes(2, 'little'))   # Num channels
            buffer.write((sample_rate).to_bytes(4, 'little'))
            buffer.write((sample_rate * 2 * 2).to_bytes(4, 'little'))  # Byte rate
            buffer.write((4).to_bytes(2, 'little'))   # Block align
            buffer.write((16).to_bytes(2, 'little'))  # Bits per sample
            buffer.write(b'data')
            buffer.write((audio_int.nbytes).to_bytes(4, 'little'))
            buffer.write(audio_int.tobytes())

        buffer.seek(0)
        return buffer.read()

    def _save_track_metadata(self, track: GeneratedTrack, user_id: str):
        """Save track metadata to Firestore."""
        try:
            doc_data = {
                'track_id': track.track_id,
                'user_id': user_id,
                'soundscape_type': track.soundscape_type.value,
                'parameters': {
                    'duration': track.parameters.duration,
                    'binaural_freq': track.parameters.binaural_freq,
                    'carrier_freq': track.parameters.carrier_freq,
                    'volume': track.parameters.volume
                },
                'duration_seconds': track.duration_seconds,
                'created_at': track.created_at,
                'file_format': track.file_format,
                'has_audio_data': track.audio_data is not None
            }

            db.collection('ai_generated_tracks').document(track.track_id).set(doc_data)

            audit_log(
                event_type="AI_MUSIC_GENERATED",
                user_id=user_id,
                details={
                    "track_id": track.track_id,
                    "soundscape_type": track.soundscape_type.value,
                    "duration": track.duration_seconds
                }
            )

        except Exception as e:
            logger.error(f"Failed to save track metadata: {e}")

    def get_track(self, track_id: str) -> GeneratedTrack | None:
        """Get a previously generated track."""
        return self.generated_tracks.get(track_id)

    def get_available_soundscapes(self) -> list[dict[str, Any]]:
        """Get list of available soundscape types with descriptions."""
        descriptions = {
            SoundscapeType.DEEP_SLEEP: {
                'name': 'Djup Sömn',
                'name_en': 'Deep Sleep',
                'description': 'Delta-vågor (2.5 Hz) för djup sömn och återhämtning',
                'description_en': 'Delta waves for deep sleep and recovery',
                'brainwave': 'Delta (0.5-4 Hz)',
                'best_for': ['Insomnia', 'Deep relaxation', 'Physical recovery']
            },
            SoundscapeType.MEDITATION: {
                'name': 'Meditation',
                'name_en': 'Meditation',
                'description': 'Theta-vågor (6 Hz) för meditation och kreativitet',
                'description_en': 'Theta waves for meditation and creativity',
                'brainwave': 'Theta (4-8 Hz)',
                'best_for': ['Meditation', 'Mindfulness', 'Creative flow']
            },
            SoundscapeType.FOCUS: {
                'name': 'Fokus',
                'name_en': 'Focus',
                'description': 'Alpha/Beta-vågor för koncentration och produktivitet',
                'description_en': 'Alpha/Beta waves for focus and productivity',
                'brainwave': 'Alpha/Beta (8-20 Hz)',
                'best_for': ['Studying', 'Work', 'Problem solving']
            },
            SoundscapeType.ANXIETY_RELIEF: {
                'name': 'Ångestlindring',
                'name_en': 'Anxiety Relief',
                'description': 'Theta/Alpha-vågor för nervsystemets återhämtning',
                'description_en': 'Theta/Alpha for nervous system recovery',
                'brainwave': 'Theta/Alpha (6-10 Hz)',
                'best_for': ['Anxiety', 'Stress', 'Panic relief']
            },
            SoundscapeType.NATURE_SIM: {
                'name': 'Natur',
                'name_en': 'Nature',
                'description': 'Proceduralt genererade naturljud (regn, vågor, vind)',
                'description_en': 'Procedurally generated nature sounds',
                'brainwave': 'N/A',
                'best_for': ['General relaxation', 'Nature connection', 'Sleep aid']
            },
            SoundscapeType.COSMIC: {
                'name': 'Kosmisk',
                'name_en': 'Cosmic',
                'description': 'Rymd-ambient med Gamma-vågor för djup meditation',
                'description_en': 'Space ambient with Gamma for deep meditation',
                'brainwave': 'Gamma (40 Hz)',
                'best_for': ['Deep meditation', 'Peak experiences', 'Consciousness exploration']
            }
        }

        result = []
        for st in SoundscapeType:
            info = descriptions.get(st, {})
            info['id'] = st.value
            info['type'] = st.name
            result.append(info)

        return result


# Singleton instance
_ai_music_service: AIMusicGenerationService | None = None


def get_ai_music_service() -> AIMusicGenerationService:
    """Get singleton instance of AI music service."""
    global _ai_music_service
    if _ai_music_service is None:
        _ai_music_service = AIMusicGenerationService()
    return _ai_music_service
