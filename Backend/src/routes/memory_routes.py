"""
Memory Routes - Audio memory management system
Allows users to upload, list, retrieve, and delete audio memories
Uses Firebase Storage for file storage and Firestore for metadata
"""

from __future__ import annotations

import os
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from flask import Blueprint, request as flask_request, g, Response
from werkzeug.utils import secure_filename
from firebase_admin import storage

# Absolute imports (project standard)
from src.firebase_config import db
from src.services.auth_service import AuthService
from src.services.rate_limiting import rate_limit_by_endpoint
from src.services.audit_service import audit_log
from src.utils.input_sanitization import input_sanitizer
from src.utils.response_utils import APIResponse

logger = logging.getLogger(__name__)

# Validation patterns
USER_ID_PATTERN = re.compile(r'^[a-zA-Z0-9]{20,128}$')
MEMORY_ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{10,100}$')
FILE_PATH_PATTERN = re.compile(r'^memories/[a-zA-Z0-9]{20,128}/\d{14}\.(mp3|wav|m4a)$')

memory_bp = Blueprint("memory", __name__)


def _validate_user_id(user_id: str) -> bool:
    """Validate user_id format"""
    return bool(USER_ID_PATTERN.match(user_id)) if user_id else False


def _validate_memory_id(memory_id: str) -> bool:
    """Validate memory_id format"""
    return bool(MEMORY_ID_PATTERN.match(memory_id)) if memory_id else False


def _validate_file_path(file_path: str) -> bool:
    """Validate file_path format to prevent path traversal"""
    if not file_path:
        return False
    # Normalize path and check for traversal attempts
    normalized = file_path.replace('\\', '/')
    if '..' in normalized or normalized.startswith('/'):
        return False
    return bool(FILE_PATH_PATTERN.match(normalized))


# ============================================================================
# File validation
# ============================================================================

ALLOWED_EXTENSIONS = {"mp3", "wav", "m4a"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def allowed_file(filename: str) -> bool:
    """Check if file has an allowed extension"""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ============================================================================
# OPTIONS Handlers (CORS preflight)
# ============================================================================

@memory_bp.route('', methods=['OPTIONS'])
@memory_bp.route('/upload', methods=['OPTIONS'])
def memory_base_options() -> Response | Tuple[Response, int]:
    """Handle CORS preflight for base memory endpoints"""
    return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')


@memory_bp.route('/list/<user_id>', methods=['OPTIONS'])
def memory_list_options(user_id: str) -> Response | Tuple[Response, int]:
    """Handle CORS preflight for list memories endpoint"""
    return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')


@memory_bp.route('/get/<memory_id>', methods=['OPTIONS'])
def memory_get_options(memory_id: str) -> Response | Tuple[Response, int]:
    """Handle CORS preflight for get memory endpoint"""
    return APIResponse.success(data={'status': 'ok'}, message='CORS preflight')


@memory_bp.route('', methods=['GET'])
@rate_limit_by_endpoint
def memory_root_placeholder() -> Response | Tuple[Response, int]:
    """Return 404 for the legacy /api/memory endpoint used in integration smoke tests."""
    return APIResponse.not_found("Endpoint not available at this path")


# ============================================================================
# Upload Memory (requires auth)
# ============================================================================

@memory_bp.route("/upload", methods=["POST"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def upload_memory() -> Response | Tuple[Response, int]:
    """Upload audio memory to Firebase Storage"""
    try:
        current_user_id: Optional[str] = g.get('user_id')
        
        if "audio" not in flask_request.files:
            return APIResponse.bad_request("Audio file required")

        file = flask_request.files["audio"]
        
        # Get user_id from form or use authenticated user
        form_user_id = flask_request.form.get("user_id", "").strip()
        if form_user_id:
            form_user_id = input_sanitizer.sanitize(form_user_id, 'text', 100)
            # User can only upload to their own account
            if form_user_id != current_user_id:
                audit_log(
                    event_type="UNAUTHORIZED_MEMORY_UPLOAD",
                    user_id=current_user_id or "unknown",
                    details={"attempted_user_id": form_user_id}
                )
                return APIResponse.forbidden("You can only upload to your own account")
            user_id = form_user_id
        else:
            user_id = current_user_id
        
        if not user_id or not _validate_user_id(user_id):
            return APIResponse.bad_request("Invalid user ID")

        # Validate filename (handle None case)
        original_filename = file.filename or ""
        if not original_filename or not allowed_file(original_filename):
            return APIResponse.bad_request("Only MP3, WAV and M4A files are allowed")

        file.seek(0, os.SEEK_END)
        file_length = file.tell()
        file.seek(0)
        if file_length > MAX_FILE_SIZE:
            return APIResponse.bad_request("File too large. Max 10MB allowed")

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        extension = original_filename.rsplit(".", 1)[1].lower() if "." in original_filename else "mp3"
        filename = f"memories/{user_id}/{timestamp}.{extension}"
        secure_name = secure_filename(filename)

        # Upload to Firebase Storage
        bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET", "lugn-trygg-53d75.appspot.com")
        bucket = storage.bucket(bucket_name)

        # Try to create bucket if it doesn't exist
        try:
            if not bucket.exists():
                logger.info(f"📦 Creating storage bucket: {bucket_name}")
                bucket.create()
        except Exception as bucket_error:
            logger.warning(f"⚠️ Could not create bucket (might already exist): {bucket_error}")

        blob = bucket.blob(secure_name)
        blob.upload_from_file(file, content_type="audio/mpeg")

        # Save metadata to Firestore (using direct db import)
        memory_id = f"{user_id}_{timestamp}"
        memory_ref = db.collection("memories").document(memory_id)
        memory_ref.set({
            "user_id": user_id,
            "file_path": secure_name,
            "timestamp": timestamp,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        # Generate secure temporary URL (1 hour validity)
        signed_url = blob.generate_signed_url(expiration=timedelta(hours=1))

        audit_log(
            event_type="MEMORY_UPLOADED",
            user_id=user_id,
            details={"memory_id": memory_id, "file_path": secure_name}
        )

        return APIResponse.success({
            "fileUrl": signed_url,
            "memoryId": memory_id
        }, "Memory uploaded successfully")

    except Exception as e:
        logger.exception(f"🔥 Error uploading memory: {e}")
        return APIResponse.error("Failed to upload memory")

# ============================================================================
# List Memories (requires auth)
# Frontend: GET /api/memory/list/{userId}
# ============================================================================

@memory_bp.route("/list/<user_id>", methods=["GET"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def list_memories(user_id: str) -> Response | Tuple[Response, int]:
    """List all memories for a user"""
    logger.info(f"📸 MEMORY - LIST memories for user: {user_id}")
    try:
        current_user_id: Optional[str] = g.get('user_id')
        
        # Sanitize and validate user_id
        user_id = input_sanitizer.sanitize(user_id, 'text', 100)
        if not user_id or not _validate_user_id(user_id):
            return APIResponse.bad_request("Invalid user ID")

        # Authorization check: user can only access their own memories
        if user_id != current_user_id:
            audit_log(
                event_type="UNAUTHORIZED_MEMORY_ACCESS",
                user_id=current_user_id or "unknown",
                details={"attempted_user_id": user_id}
            )
            return APIResponse.forbidden("You can only view your own memories")

        # Query Firestore with FieldFilter (production) or fallback (test)
        try:
            from google.cloud.firestore import FieldFilter
            memories_ref = list(
                db.collection("memories")
                .where(filter=FieldFilter("user_id", "==", user_id))
                .limit(100)
                .stream()
            )
        except (TypeError, ImportError):
            # Fallback for test environments
            memories_ref = list(
                db.collection("memories")
                .where("user_id", "==", user_id)
                .limit(100)
                .stream()
            )

        # Build memory list and sort by timestamp descending
        memory_list = []
        for mem in memories_ref:
            data = mem.to_dict()
            memory_list.append({
                "id": mem.id,
                "filePath": data.get("file_path"),
                "timestamp": data.get("timestamp"),
                "createdAt": data.get("created_at")
            })
        memory_list.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
        logger.info(f"✅ MEMORY - Retrieved {len(memory_list)} memories for user {user_id}")
        return APIResponse.success({"memories": memory_list}, f"Retrieved {len(memory_list)} memories")

    except Exception as e:
        logger.exception(f"🔥 Error fetching memories: {e}")
        return APIResponse.error("Failed to fetch memories")


# ============================================================================
# Get Memory URL (requires auth)
# Frontend: GET /api/memory/get/{memoryId}
# ============================================================================

@memory_bp.route("/get/<memory_id>", methods=["GET"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_memory(memory_id: str) -> Response | Tuple[Response, int]:
    """Get signed URL for a specific memory"""
    try:
        current_user_id: Optional[str] = g.get('user_id')
        
        # Sanitize and validate memory_id
        memory_id = input_sanitizer.sanitize(memory_id, 'text', 100)
        if not memory_id or not _validate_memory_id(memory_id):
            return APIResponse.bad_request("Invalid memory ID")

        # Fetch memory from Firestore
        memory_doc = db.collection("memories").document(memory_id).get()
        if not memory_doc.exists:
            return APIResponse.not_found("Memory not found")

        memory_data = memory_doc.to_dict()
        memory_user_id = memory_data.get("user_id")
        file_path = memory_data.get("file_path")

        # Authorization check: user can only access their own memories
        if memory_user_id != current_user_id:
            audit_log(
                event_type="UNAUTHORIZED_MEMORY_ACCESS",
                user_id=current_user_id or "unknown",
                details={"memory_id": memory_id, "memory_owner": memory_user_id}
            )
            return APIResponse.forbidden("You can only view your own memories")

        if not file_path:
            return APIResponse.not_found("File path missing")

        # Validate file_path format
        if not _validate_file_path(file_path):
            return APIResponse.bad_request("Invalid file path")

        # Get file from Firebase Storage
        bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET", "lugn-trygg-53d75.appspot.com")
        bucket = storage.bucket(bucket_name)
        blob = bucket.blob(file_path)

        if not blob.exists():
            return APIResponse.not_found("File not found in storage")

        # Generate signed URL (1 hour validity)
        signed_url = blob.generate_signed_url(expiration=timedelta(hours=1))

        return APIResponse.success({
            "url": signed_url,
            "memoryId": memory_id,
            "filePath": file_path
        }, "Signed URL generated")

    except Exception as e:
        logger.exception(f"🔥 Error fetching memory: {e}")
        return APIResponse.error("Failed to fetch memory")


# ============================================================================
# Delete Memory (requires auth)
# Frontend: DELETE /api/memory/list/{memoryId}
# ============================================================================

@memory_bp.route("/list/<memory_id>", methods=["DELETE"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def delete_memory(memory_id: str) -> Response | Tuple[Response, int]:
    """Delete a specific memory"""
    try:
        current_user_id: Optional[str] = g.get('user_id')
        
        # Sanitize and validate memory_id
        memory_id = input_sanitizer.sanitize(memory_id, 'text', 100)
        if not memory_id or not _validate_memory_id(memory_id):
            return APIResponse.bad_request("Invalid memory ID")

        # Fetch memory from Firestore
        memory_doc = db.collection("memories").document(memory_id).get()
        if not memory_doc.exists:
            return APIResponse.not_found("Memory not found")

        memory_data = memory_doc.to_dict()
        memory_user_id = memory_data.get("user_id")
        file_path = memory_data.get("file_path")

        # Authorization check: user can only delete their own memories
        if memory_user_id != current_user_id:
            audit_log(
                event_type="UNAUTHORIZED_MEMORY_DELETE",
                user_id=current_user_id or "unknown",
                details={"memory_id": memory_id, "memory_owner": memory_user_id}
            )
            return APIResponse.forbidden("You can only delete your own memories")

        # Delete from Firebase Storage if file exists
        if file_path:
            try:
                bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET", "lugn-trygg-53d75.appspot.com")
                bucket = storage.bucket(bucket_name)
                blob = bucket.blob(file_path)
                if blob.exists():
                    blob.delete()
                    logger.info(f"✅ Deleted file from storage: {file_path}")
            except Exception as storage_error:
                logger.warning(f"⚠️ Could not delete file from storage: {storage_error}")

        # Delete from Firestore
        db.collection("memories").document(memory_id).delete()

        audit_log(
            event_type="MEMORY_DELETED",
            user_id=current_user_id or "unknown",
            details={"memory_id": memory_id, "file_path": file_path}
        )

        logger.info(f"✅ MEMORY - Deleted memory {memory_id} for user {current_user_id}")
        return APIResponse.success({"deleted": memory_id}, "Memory deleted successfully")

    except Exception as e:
        logger.exception(f"🔥 Error deleting memory: {e}")
        return APIResponse.error("Failed to delete memory")


# ============================================================================
# Path Traversal Protection
# ============================================================================

@memory_bp.route('/<path:unsafe_path>', methods=['GET', 'POST', 'PUT', 'PATCH'])
@rate_limit_by_endpoint
def block_memory_path_traversal(unsafe_path: str) -> Response | Tuple[Response, int]:
    """Return 404 for any unexpected deep paths (prevents path traversal attacks).
    Note: DELETE is excluded as it's handled by delete_memory for valid paths."""
    normalized = unsafe_path.replace('\\', '/').split('/')
    if '..' in normalized:
        logger.warning(f"⚠️ Path traversal attempt blocked: {unsafe_path}")
        return APIResponse.not_found("Unauthorized path")
    return APIResponse.not_found("Path not found")
