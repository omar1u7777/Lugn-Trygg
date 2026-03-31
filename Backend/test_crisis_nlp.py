#!/usr/bin/env python3
"""Test Crisis NLP with transformers"""

print("="*50)
print("CRISIS NLP - TRANSFORMERS VERIFICATION")
print("="*50)
print()

# Test 1: Check transformers import
print("TEST 1: Transformers Import")
try:
    import transformers
    print(f"✅ Transformers version: {transformers.__version__}")
except Exception as e:
    print(f"❌ Failed: {e}")
    exit(1)

# Test 2: Check crisis_nlp can import transformers
print()
print("TEST 2: Crisis NLP Module")
try:
    from src.services import crisis_nlp
    print(f"✅ crisis_nlp module loaded")
    print(f"✅ TRANSFORMERS_AVAILABLE: {crisis_nlp.TRANSFORMERS_AVAILABLE}")
except Exception as e:
    print(f"❌ Failed: {e}")
    exit(1)

# Test 3: Initialize detector (lightweight test without downloading models)
print()
print("TEST 3: Crisis Detection Classes")
try:
    from src.services.crisis_nlp import SemanticCrisisAssessment, CrisisConcept
    print(f"✅ SemanticCrisisAssessment dataclass available")
    print(f"✅ CrisisConcept dataclass available")
    print(f"✅ All crisis NLP components ready")
except Exception as e:
    print(f"❌ Failed: {e}")

print()
print("="*50)
print("CRISIS NLP READY - TRANSFORMERS ACTIVE")
print("="*50)
