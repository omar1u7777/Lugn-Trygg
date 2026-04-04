"""
Live HTTP endpoint test for Voice Emotion Analysis.
Tests the full Flask pipeline: POST /api/v1/voice/analyze-emotion + GET /status
"""
import sys
import io
import base64
import os
import functools

import numpy as np
import soundfile as sf

sys.path.insert(0, '.')

# Minimal env so Flask starts without real Firebase
os.environ.setdefault('GOOGLE_CLOUD_PROJECT', 'test-project')
os.environ.setdefault('TESTING', '1')
os.environ.setdefault('JWT_SECRET_KEY', 'test-secret-key-voice-128bit-xx')
os.environ.setdefault('CSRF_SECRET_KEY', 'test-csrf-key-voice-128bit-xxxx')

# ── Create synthetic speech WAV ──────────────────────────────────────────────
sr = 16000
duration = 3.0
t = np.linspace(0, duration, int(sr * duration))
# Simulate anxious/fast speech: raised pitch, moderate amplitude
f0 = 240.0
sig = (
    0.5 * np.sin(2 * np.pi * f0 * t) +
    0.3 * np.sin(2 * np.pi * 2 * f0 * t) +
    0.15 * np.sin(2 * np.pi * 3 * f0 * t) +
    0.02 * np.random.randn(len(t))
) * (0.4 + 0.6 * np.sin(2 * np.pi * 5.5 * t))  # fast 5.5 Hz modulation

buf = io.BytesIO()
sf.write(buf, sig.astype(np.float32), sr, format='WAV', subtype='PCM_16')
AUDIO_B64 = base64.b64encode(buf.getvalue()).decode()

print(f"Generated WAV: {len(buf.getvalue())} bytes  ({duration}s @ {sr}Hz)")

# ── Flask test client ────────────────────────────────────────────────────────
from unittest.mock import patch
from flask import g

# Fake JWT decorator (bypasses real Firebase auth in tests)
def fake_jwt_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        g.user_id = 'test-user-voice-001'
        g.user_email = 'voice-test@lugntrygg.se'
        return f(*args, **kwargs)
    return decorated

# Fake rate limiter (no-op)
def fake_rate_limiter(f):
    return f

# Fake audit_log (no-op)
def fake_audit_log(**kwargs):
    pass

with (
    patch('src.services.auth_service.AuthService.jwt_required', fake_jwt_required),
    patch('src.routes.voice_routes.rate_limit_by_endpoint', fake_rate_limiter),
    patch('src.routes.voice_routes.audit_log', fake_audit_log),
):
    from main import create_app
    app = create_app()
    app.config['TESTING'] = True
    client = app.test_client()

    print()
    print("=" * 60)
    print("  LIVE HTTP ENDPOINT TESTS — Voice Emotion Analysis")
    print("=" * 60)
    passed = 0
    failed = 0

    with app.app_context():

        # ── Test 1: GET /status (public, no auth) ────────────────────────
        print()
        resp = client.get('/api/v1/voice/status')
        print(f"[T1] GET /api/v1/voice/status → HTTP {resp.status_code}")
        if resp.status_code == 200:
            data = resp.get_json()
            d = data.get('data', data)
            wsf = d.get('webSpeechFallback')
            ea  = d.get('emotionAnalysis')
            gs  = d.get('googleSpeech')
            print(f"     webSpeechFallback: {wsf}")
            print(f"     emotionAnalysis:   {ea}")
            print(f"     googleSpeech:      {gs}")
            assert wsf is True, "webSpeechFallback should be True"
            assert ea  is True, "emotionAnalysis should be True"
            print("     → PASS ✓")
            passed += 1
        else:
            print(f"     → FAIL ✗ (status {resp.status_code})")
            failed += 1

        # ── Test 2: POST /analyze-emotion — audio only ───────────────────
        print()
        resp2 = client.post(
            '/api/v1/voice/analyze-emotion',
            json={'audio_data': AUDIO_B64},
            content_type='application/json',
        )
        print(f"[T2] POST /analyze-emotion (audio only) → HTTP {resp2.status_code}")
        if resp2.status_code == 200:
            d2 = resp2.get_json().get('data', resp2.get_json())
            primary  = d2.get('primaryEmotion', 'N/A')
            conf     = d2.get('confidence', 0)
            method   = d2.get('analysisMethod', 'N/A')
            energy   = d2.get('energyLevel', 'N/A')
            pace     = d2.get('speakingPace', 'N/A')
            valence  = d2.get('valence', None)
            emotions = d2.get('emotions', {})
            top3 = sorted(emotions.items(), key=lambda x: -x[1])[:3]
            print(f"     primaryEmotion:  {primary}")
            print(f"     confidence:      {conf:.3f}")
            print(f"     analysisMethod:  {method}")
            print(f"     energyLevel:     {energy}")
            print(f"     speakingPace:    {pace}")
            print(f"     valence:         {valence}")
            print(f"     top3 emotions:   {top3}")
            assert primary != '', "primaryEmotion must not be empty"
            assert conf > 0, "confidence must be positive"
            assert 'librosa' in method, f"expected librosa method, got: {method}"
            print("     → PASS ✓")
            passed += 1
        else:
            body = resp2.get_data(as_text=True)
            print(f"     → FAIL ✗  body: {body[:200]}")
            failed += 1

        # ── Test 3: POST /analyze-emotion — with transcript (fusion) ─────
        print()
        transcript_text = "Jag är väldigt orolig och nervös för det som händer"
        resp3 = client.post(
            '/api/v1/voice/analyze-emotion',
            json={'audio_data': AUDIO_B64, 'transcript': transcript_text},
            content_type='application/json',
        )
        print(f"[T3] POST /analyze-emotion (audio+text fusion) → HTTP {resp3.status_code}")
        if resp3.status_code == 200:
            d3 = resp3.get_json().get('data', resp3.get_json())
            primary3  = d3.get('primaryEmotion', 'N/A')
            method3   = d3.get('analysisMethod', 'N/A')
            valence3  = d3.get('valence', None)
            conf3     = d3.get('confidence', 0)
            emotions3 = d3.get('emotions', {})
            top3b = sorted(emotions3.items(), key=lambda x: -x[1])[:3]
            print(f"     primaryEmotion:  {primary3}")
            print(f"     confidence:      {conf3:.3f}")
            print(f"     analysisMethod:  {method3}")
            print(f"     valence:         {valence3}")
            print(f"     top3 emotions:   {top3b}")
            assert 'text_fusion' in method3, f"Expected text_fusion in method, got: {method3}"
            # With 'orolig' and 'nervös', anxious should be high
            anxious_score = emotions3.get('anxious', 0)
            print(f"     anxious score:   {anxious_score:.3f}")
            assert anxious_score > 0.1, f"anxious score too low: {anxious_score}"
            print("     → PASS ✓")
            passed += 1
        else:
            body = resp3.get_data(as_text=True)
            print(f"     → FAIL ✗  body: {body[:200]}")
            failed += 1

        # ── Test 4: POST /analyze-emotion — invalid base64 ───────────────
        print()
        resp4 = client.post(
            '/api/v1/voice/analyze-emotion',
            json={'audio_data': 'not-valid-base64!!!'},
            content_type='application/json',
        )
        print(f"[T4] POST /analyze-emotion (invalid base64) → HTTP {resp4.status_code}")
        if resp4.status_code == 400:
            print("     → PASS ✓ (correctly rejected)")
            passed += 1
        else:
            print(f"     → FAIL ✗ (expected 400, got {resp4.status_code})")
            failed += 1

        # ── Test 5: POST /analyze-emotion — missing audio_data ───────────
        print()
        resp5 = client.post(
            '/api/v1/voice/analyze-emotion',
            json={'transcript': 'bara text, inget ljud'},
            content_type='application/json',
        )
        print(f"[T5] POST /analyze-emotion (missing audio_data) → HTTP {resp5.status_code}")
        if resp5.status_code == 400:
            print("     → PASS ✓ (correctly rejected)")
            passed += 1
        else:
            print(f"     → FAIL ✗ (expected 400, got {resp5.status_code})")
            failed += 1

        # ── Test 6: Crisis keyword in transcript ─────────────────────────
        print()
        crisis_transcript = "jag vill inte leva längre, jag känner att jag vill dö"
        resp6 = client.post(
            '/api/v1/voice/analyze-emotion',
            json={'audio_data': AUDIO_B64, 'transcript': crisis_transcript},
            content_type='application/json',
        )
        print(f"[T6] POST /analyze-emotion (crisis text) → HTTP {resp6.status_code}")
        if resp6.status_code == 200:
            d6 = resp6.get_json().get('data', resp6.get_json())
            primary6 = d6.get('primaryEmotion', 'N/A')
            valence6 = d6.get('valence', None)
            conf6    = d6.get('confidence', 0)
            emotions6 = d6.get('emotions', {})
            fearful_score = emotions6.get('fearful', 0)
            print(f"     primaryEmotion:  {primary6}")
            print(f"     confidence:      {conf6:.3f}")
            print(f"     valence:         {valence6:.3f}")
            print(f"     fearful score:   {fearful_score:.3f}")
            # Crisis keywords should push fearful high and valence negative
            assert valence6 < -0.3, f"Valence should be very negative for crisis text, got {valence6}"
            assert fearful_score > 0.1, f"fearful should be elevated, got {fearful_score}"
            print("     → PASS ✓ (crisis text correctly detected)")
            passed += 1
        else:
            body = resp6.get_data(as_text=True)
            print(f"     → FAIL ✗  body: {body[:200]}")
            failed += 1

    print()
    print("=" * 60)
    print(f"  RESULTS: {passed} PASSED, {failed} FAILED")
    print("=" * 60)
    if failed > 0:
        sys.exit(1)
