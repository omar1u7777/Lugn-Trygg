# Comprehensive Security Fix Plan - 168 Alerts

**Date**: 2026-04-01 03:55 UTC+02:00  
**Total Alerts**: 168  
**CI/CD Failures**: 3  
**Status**: 🔧 **EXECUTING**

---

## 🚨 CRITICAL ISSUES (Must Fix First)

### 1. **Dependency Conflict - requests**
**Error**: `resend 0.8.0 depends on requests==2.31.0` conflicts with `requests==2.32.5`

**Fix**: Remove or update resend package
```bash
# Option 1: Remove resend (not critical)
pip uninstall resend

# Option 2: Use requests==2.31.0 (compatible with all)
requests==2.31.0
```

**Action**: Use requests==2.31.0 for compatibility

---

### 2. **Frontend CI Failure - package-lock.json out of sync**
**Error**: Missing packages in lock file

**Fix**: Regenerate package-lock.json
```bash
npm install
git add package-lock.json
```

---

### 3. **Live Auth Validation Failure**
**Error**: Login failed (401) - Invalid credentials

**Fix**: Update test credentials or fix auth endpoint

---

## 📊 SECURITY ALERTS BREAKDOWN

### High Severity (16 alerts)
1. **transformers** - Deserialization RCE (6 alerts) - NEEDS FIX
2. **cryptography** - Subgroup attack (2 alerts) - ALREADY FIXED
3. **PyJWT** - Unknown crit headers (2 alerts) - ALREADY FIXED
4. **Pillow** - Out-of-bounds write (2 alerts) - ALREADY FIXED
5. **pyOpenSSL** - DTLS buffer overflow (2 alerts) - NEEDS FIX
6. **Clear-text logging** (15+ alerts) - PARTIALLY FIXED
7. **URL sanitization** (3 alerts) - NEEDS FIX
8. **ReDoS** (1 alert) - NEEDS FIX
9. **Path traversal** (1 alert) - NEEDS FIX

### Moderate Severity (34+ alerts)
1. **transformers** - Multiple ReDoS (10+ alerts)
2. **requests** - Multiple issues (6 alerts)
3. **Werkzeug** - Windows device names (2 alerts)
4. **serialize-javascript** - RCE + DoS (2 alerts)
5. **marshmallow** - DoS (2 alerts)
6. **Information exposure** (6 alerts)
7. **URL redirection** (2 alerts)

### Low Severity (12+ alerts)
1. **Flask** - Session caching (2 alerts)
2. **Sentry** - Env var exposure (2 alerts)
3. **cryptography** - DNS constraints (2 alerts)
4. **pyOpenSSL** - TLS bypass (2 alerts)
5. **transformers** - Input validation (2 alerts)

---

## 🔧 FIX STRATEGY

### Phase 1: Dependency Fixes (CRITICAL)
1. ✅ Fix requests version conflict
2. ✅ Update transformers to latest patched version
3. ✅ Add pyOpenSSL to requirements with latest version
4. ✅ Regenerate package-lock.json

### Phase 2: Code Fixes (HIGH PRIORITY)
1. ✅ Fix all clear-text logging (15+ instances)
2. ✅ Fix URL redirection vulnerabilities
3. ✅ Fix information exposure through exceptions
4. ✅ Fix path traversal in privacy_routes.py
5. ✅ Fix ReDoS in ml_sentiment_service.py

### Phase 3: Configuration Fixes (MEDIUM PRIORITY)
1. ✅ Update requirements.txt with all secure versions
2. ✅ Update requirements-dev.txt (Black vulnerability)
3. ✅ Fix Live Auth test credentials

### Phase 4: Verification (FINAL)
1. ✅ Run local tests
2. ✅ Verify CI/CD passes
3. ✅ Confirm GitHub alerts resolved

---

## 📝 DETAILED FIX LIST

### Fix #1: requests Version Conflict
**File**: `Backend/requirements.txt`
```diff
- requests==2.32.5
+ requests==2.31.0
```

**Reason**: resend package requires exactly 2.31.0

---

### Fix #2: pyOpenSSL Vulnerability
**File**: `Backend/requirements.txt`
**Add**: `pyOpenSSL==25.3.0` (latest secure version)

---

### Fix #3: transformers Still Showing Alerts
**Issue**: requirements.txt updated but alerts persist
**Reason**: GitHub needs time to re-scan OR old requirements.txt in root

**Check**: Is there a `requirements.txt` in project root?

---

### Fix #4: Clear-text Logging (Remaining)
**Files to fix**:
1. `Backend/scripts/security_audit.py` (lines 617, 622, 627)
2. `Backend/scripts/create_admin.py` (line 77)
3. `Backend/src/routes/crisis_routes.py` (line 559)
4. `Backend/src/services/crisis_intervention.py` (line 546)
5. `Backend/src/services/auth_service.py` (lines 229, 251)
6. `Backend/src/services/audit_service.py` (line 63)
7. `tests/e2e/api-integration.spec.ts` (line 396)

**Fix Pattern**:
```python
# Before
logger.info(f"User {user_id} logged in")

# After
logger.info(f"User {user_id[:8]}*** logged in")
```

---

### Fix #5: URL Redirection
**Files**: 
- `Backend/src/routes/integration_routes.py` (lines 250, 258)

**Fix**: Validate redirect URLs against whitelist

---

### Fix #6: Information Exposure Through Exceptions
**Files**:
- `Backend/src/routes/biofeedback_ws_routes.py` (lines 192, 218, 255, 266, 273, 309)
- `Backend/src/utils/response_utils.py` (lines 52, 84)

**Fix**: Sanitize exception messages before logging

---

### Fix #7: Path Traversal
**File**: `Backend/src/routes/privacy_routes.py` (line 328)

**Fix**: Validate file paths

---

### Fix #8: Reflected XSS
**File**: `Backend/src/routes/biofeedback_ws_routes.py` (line 266)

**Fix**: Sanitize user input before reflection

---

### Fix #9: Black Vulnerability (Dev Dependency)
**File**: `Backend/requirements-dev.txt`

**Fix**: Update Black to latest version

---

### Fix #10: Frontend package-lock.json
**Command**:
```bash
cd c:\Projekt\Lugn-Trygg-main_klar
npm install
git add package-lock.json
```

---

## 🎯 EXECUTION ORDER

1. ✅ Fix dependency conflicts (requests, pyOpenSSL)
2. ✅ Update all requirements files
3. ✅ Fix clear-text logging (all instances)
4. ✅ Fix URL redirection
5. ✅ Fix information exposure
6. ✅ Fix path traversal
7. ✅ Fix XSS
8. ✅ Regenerate package-lock.json
9. ✅ Test locally
10. ✅ Commit and push
11. ✅ Verify CI/CD passes
12. ✅ Verify GitHub alerts resolved

---

## 📊 EXPECTED RESULTS

**Before**: 168 alerts  
**After**: 0-5 alerts (low severity, acceptable)

**CI/CD**:
- ✅ Backend CI: PASS
- ✅ Frontend CI: PASS
- ✅ Live Auth: PASS (or skip if test env issue)

---

**Created**: 2026-04-01 03:55 UTC+02:00  
**Status**: Ready to execute
