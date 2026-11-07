"""Voice emotion analysis: audio features fused with the transcript.

The route is covered in test_voice_routes.py. librosa is not installed in
production or CI, so the audio side takes its fallback; these checks hold
either way.
"""

import io
import wave

import numpy as np
import pytest

from src.services.voice_emotion_service import analyze_voice_emotion_professional


def _speech_like_wav(pitch_hz, amplitude, syllables_per_second, seconds=3.0, rate=16000):
    """A voiced tone with harmonics, pulsed like syllables."""
    t = np.linspace(0, seconds, int(rate * seconds))
    tone = 0.5 * np.sin(2 * np.pi * pitch_hz * t) + 0.3 * np.sin(4 * np.pi * pitch_hz * t)
    signal = amplitude * tone * (0.4 + 0.6 * np.sin(2 * np.pi * syllables_per_second * t))
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(rate)
        out.writeframes((np.clip(signal, -1, 1) * 32767).astype('<i2').tobytes())
    return buffer.getvalue()


def _top_two(result):
    return sorted(result.emotion_confidences, key=result.emotion_confidences.get, reverse=True)[:2]


@pytest.mark.parametrize('transcript, emotion, sign', [
    ('Jag är glad och lycklig idag!', 'happy', 1),
    ('Jag känner mig ledsen och ensam', 'sad', -1),
    ('jag vill inte leva längre', 'fearful', -1),
])
def test_transcript_is_fused_with_the_audio(transcript, emotion, sign):
    result = analyze_voice_emotion_professional(_speech_like_wav(180, 0.4, 4.5), transcript)

    assert 'text_fusion' in result.analysis_method
    assert emotion in _top_two(result)
    assert sign * result.valence > 0


def test_audio_without_transcript():
    result = analyze_voice_emotion_professional(_speech_like_wav(175, 0.4, 4.5), None)

    assert 'text_fusion' not in result.analysis_method
    assert result.primary_emotion in result.emotion_confidences
    assert sum(result.emotion_confidences.values()) == pytest.approx(1.0, abs=0.05)
