"""
Minimal voice emotion test - no Flask server, pure service-layer test
"""
import sys, io, base64
sys.path.insert(0, '.')

import numpy as np
import soundfile as sf
from src.services.voice_emotion_service import analyze_voice_emotion_professional

sr = 16000
t = np.linspace(0, 3.0, int(sr * 3.0))

def make_wav(f0, amp, rate):
    s = amp * (0.5*np.sin(2*np.pi*f0*t) + 0.3*np.sin(2*np.pi*2*f0*t) + 0.15*np.sin(2*np.pi*3*f0*t) + 0.01*np.random.randn(len(t)))
    s = s * (0.4 + 0.6*np.sin(2*np.pi*rate*t))
    buf = io.BytesIO()
    sf.write(buf, s.astype(np.float32), sr, format='WAV', subtype='PCM_16')
    return buf.getvalue()

tests = [
    ("happy audio + text", make_wav(280, 0.8, 5.5), "Jag är glad och lycklig idag!"),
    ("sad audio + text", make_wav(120, 0.2, 2.5), "Jag känner mig ledsen och ensam"),
    ("anxious audio + text", make_wav(240, 0.5, 6.0), "Jag är orolig och nervös"),
    ("crisis text only", make_wav(150, 0.3, 3.5), "jag vill inte leva längre"),
    ("neutral no text", make_wav(175, 0.4, 4.5), ""),
]

print("=" * 55)
print("  VOICE EMOTION SERVICE - LIVE TESTS")
print("=" * 55)

passed = 0
failed = 0

for label, wav, transcript in tests:
    r = analyze_voice_emotion_professional(wav, transcript if transcript else None)
    conf = r.emotion_confidences.get(r.primary_emotion, 0)
    print(f"\n[{label}]")
    print(f"  primary={r.primary_emotion}  conf={conf:.3f}  valence={r.valence:+.3f}")
    print(f"  method={r.analysis_method}")
    top3 = sorted(r.emotion_confidences.items(), key=lambda x: -x[1])[:3]
    print(f"  top3={top3}")

    ok = True
    if "happy" in label and r.primary_emotion not in ("happy", "anxious", "neutral"):
        print(f"  WARN: expected happy-ish, got {r.primary_emotion}")
    if "sad" in label and r.primary_emotion not in ("sad", "neutral", "calm"):
        print(f"  WARN: expected sad-ish, got {r.primary_emotion}")
    if "anxious" in label:
        anx = r.emotion_confidences.get("anxious", 0)
        if anx < 0.05:
            print(f"  FAIL: anxious too low ({anx:.3f})")
            ok = False
    if "crisis" in label:
        if r.valence > -0.2:
            print(f"  FAIL: crisis valence should be < -0.2, got {r.valence:.3f}")
            ok = False
        fearful = r.emotion_confidences.get("fearful", 0)
        if fearful < 0.1:
            print(f"  FAIL: fearful too low ({fearful:.3f})")
            ok = False
    if "text_fusion" not in r.analysis_method and transcript:
        print(f"  FAIL: expected text_fusion method, got {r.analysis_method}")
        ok = False

    if ok:
        print("  PASS ✓")
        passed += 1
    else:
        print("  FAIL ✗")
        failed += 1

print()
print("=" * 55)
print(f"  RESULTS: {passed}/{len(tests)} PASSED, {failed} FAILED")
print("=" * 55)
if failed > 0:
    sys.exit(1)
