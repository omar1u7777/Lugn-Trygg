"""
Unified Memory Routes - Multi-modal memory creation
Supports text, audio, and photos in a single memory entry
"""

import logging
import os
from datetime import UTC, datetime, timedelta
from io import BytesIO

from firebase_admin import storage
from flask import Blueprint, g, request
from werkzeug.utils import secure_filename

_IS_PRODUCTION = os.getenv('FLASK_ENV', 'development').lower() == 'production'

try:
    from PIL import Image as PilImage
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    if _IS_PRODUCTION:
        import logging as _log
        _log.getLogger(__name__).warning(
            "[F2] Pillow (PIL) is not installed — image compression and thumbnail "
            "generation are DISABLED. Photos will be stored at original size without "
            "thumbnails. Add 'Pillow' to requirements.txt and rebuild the Docker image."
        )
    else:
        import logging as _log
        _log.getLogger(__name__).warning(
            "⚠️  Pillow not installed — image resize/thumbnails disabled (pip install Pillow)"
        )

from src.firebase_config import db
from src.services.audit_service import audit_log
from src.services.auth_service import AuthService
from src.services.memory_analysis_service import get_memory_analysis_service
from src.services.photo_analysis_service import get_photo_analysis_service
from src.services.rate_limiting import rate_limit_by_endpoint
from src.utils.response_utils import APIResponse

logger = logging.getLogger(__name__)

multimedia_memory_bp = Blueprint("multimedia_memory", __name__)

# Supported file types
ALLOWED_AUDIO = {"mp3", "wav", "m4a", "webm"}
ALLOWED_IMAGES = {"jpg", "jpeg", "png", "gif", "webp", "heic"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_PHOTOS_PER_MEMORY = 10


def allowed_audio(filename: str) -> bool:
    """Check if file is allowed audio format."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_AUDIO


def allowed_image(filename: str) -> bool:
    """Check if file is allowed image format."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_IMAGES


def _get_storage_url(blob) -> str:
    """
    Get a publicly accessible URL for a Firebase Storage blob.

    Strategy:
    1. Try generate_signed_url() — works when the service account has
       roles/iam.serviceAccountTokenCreator.
    2. Fall back to make_public() + blob.public_url — works when the Storage
       bucket/object allows public access (e.g. allUsers has Storage Object Viewer).
    3. Last resort: return the gs:// path so callers know where the file is.
    """
    try:
        return blob.generate_signed_url(expiration=timedelta(hours=24), method='GET')
    except Exception as sign_err:
        logger.warning(f"Signed URL failed ({sign_err}), trying make_public fallback")
        try:
            blob.make_public()
            return blob.public_url
        except Exception as pub_err:
            if _IS_PRODUCTION:
                logger.warning(
                    f"[F2] Firebase Storage URL generation failed — neither signed URL "
                    f"nor public URL could be created for {blob.name}. "
                    f"The stored gs:// path is NOT usable by frontend clients. "
                    f"Fix: grant the backend service account ONE of: "
                    f"(a) roles/iam.serviceAccountTokenCreator for signed URLs, OR "
                    f"(b) roles/storage.objectCreator + allUsers Storage Object Viewer "
                    f"for public URLs. Signed URL error: {sign_err}. Public error: {pub_err}"
                )
            else:
                logger.warning(f"make_public failed ({pub_err}), returning gs:// path")
            return f"gs://{blob.bucket.name}/{blob.name}"


@multimedia_memory_bp.route("/create", methods=["POST"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def create_multimedia_memory():
    """
    Create a unified memory with text, audio, AND photos.

    This is the main endpoint for rich memory creation.
    Supports:
    - Text content (journal-style)
    - Voice/audio recording
    - Multiple photos (up to 10)
    - Combined AI analysis of all modalities

    Request: multipart/form-data
    - content: text content (optional)
    - audio: audio file (optional)
    - photos[]: multiple image files (optional)
    - mood: mood score 1-10 (optional)
    - tags: comma-separated tags (optional)
    - location: location string (optional)
    """
    try:
        user_id = g.get('user_id')
        if not user_id:
            return APIResponse.unauthorized("Authentication required")

        # Get text content
        content = request.form.get('content', '').strip()

        # Get metadata
        mood = request.form.get('mood', type=int)
        tags_str = request.form.get('tags', '')
        location = request.form.get('location', '').strip()

        tags = [t.strip() for t in tags_str.split(',') if t.strip()] if tags_str else []

        # Validate mood
        if mood is not None and not (1 <= mood <= 10):
            return APIResponse.bad_request("Mood must be between 1 and 10")

        # Process files
        uploaded_files = {
            'audio': None,
            'photos': [],
            'errors': []
        }

        # 1. Process audio file
        if 'audio' in request.files:
            audio_file = request.files['audio']
            if audio_file and audio_file.filename:
                result = _process_audio_file(audio_file, user_id)
                if result['success']:
                    uploaded_files['audio'] = result
                else:
                    uploaded_files['errors'].append(f"Audio: {result['error']}")

        # 2. Process photo files
        photos = request.files.getlist('photos[]')
        if len(photos) > MAX_PHOTOS_PER_MEMORY:
            return APIResponse.bad_request(f"Maximum {MAX_PHOTOS_PER_MEMORY} photos allowed")

        for photo in photos:
            if photo and photo.filename:
                result = _process_photo_file(photo, user_id)
                if result['success']:
                    uploaded_files['photos'].append(result)
                else:
                    uploaded_files['errors'].append(f"Photo {photo.filename}: {result['error']}")

        # Validate: must have at least one of content/audio/photos
        if not content and not uploaded_files['audio'] and not uploaded_files['photos']:
            return APIResponse.bad_request("Memory must include text, audio, or photos")

        # 3. AI Analysis of all modalities
        ai_analysis = _analyze_multimodal_memory(
            content=content,
            audio_data=uploaded_files['audio'],
            photos=uploaded_files['photos']
        )

        # 4. Save to Firestore
        memory_id = f"{user_id}_{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}"

        memory_data = {
            'user_id': user_id,
            'memory_id': memory_id,
            'content': content,
            'mood': mood,
            'tags': tags,
            'location': location,
            'created_at': datetime.now(UTC),
            'photo_count': len(uploaded_files['photos']),
            'media': {
                'audio': uploaded_files['audio']['storage_path'] if uploaded_files['audio'] else None,
                'photos': [p['storage_path'] for p in uploaded_files['photos']],
                'photo_count': len(uploaded_files['photos'])
            },
            'ai_analysis': ai_analysis,
            'has_text': bool(content),
            'has_audio': uploaded_files['audio'] is not None,
            'has_photos': len(uploaded_files['photos']) > 0,
            'multimodal': bool(uploaded_files['audio']) or bool(uploaded_files['photos'])
        }

        db.collection('memories').document(memory_id).set(memory_data)

        # 5. Audit logging
        audit_log(
            event_type="MULTIMEDIA_MEMORY_CREATED",
            user_id=user_id,
            details={
                "memory_id": memory_id,
                "has_text": bool(content),
                "has_audio": uploaded_files['audio'] is not None,
                "photo_count": len(uploaded_files['photos']),
                "ai_analysis": ai_analysis['primary_emotion'] if ai_analysis else None
            }
        )

        # Build response
        response_data = {
            'memoryId': memory_id,
            'content': content,
            'mood': mood,
            'tags': tags,
            'media': {
                'audioUrl': uploaded_files['audio']['public_url'] if uploaded_files['audio'] else None,
                'photos': [
                    {
                        'url': p['public_url'],
                        'thumbnail': p['thumbnail_url'],
                        'analysis': p['analysis']
                    }
                    for p in uploaded_files['photos']
                ]
            },
            'aiAnalysis': ai_analysis,
            'createdAt': memory_data['created_at'].isoformat()
        }

        logger.info(
            f"✅ Multimedia memory created: {memory_id} "
            f"(text={bool(content)}, audio={uploaded_files['audio'] is not None}, "
            f"photos={len(uploaded_files['photos'])})"
        )

        return APIResponse.success(
            data=response_data,
            message=f"Memory saved with {len(uploaded_files['photos'])} photos"
        )

    except Exception as e:
        logger.exception(f"❌ Error creating multimedia memory: {e}")
        return APIResponse.error("Failed to save memory", "MEMORY_SAVE_ERROR", 500)


def _process_audio_file(audio_file, user_id: str) -> dict:
    """Process and upload audio file to Firebase Storage."""
    try:
        # Validate
        if not allowed_audio(audio_file.filename):
            return {'success': False, 'error': 'Invalid audio format'}

        # Check size
        audio_file.seek(0, os.SEEK_END)
        size = audio_file.tell()
        audio_file.seek(0)

        if size > MAX_FILE_SIZE:
            return {'success': False, 'error': 'Audio file too large (max 10MB)'}

        # Generate filename — only secure the basename, not the full storage path
        timestamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
        ext = audio_file.filename.rsplit(".", 1)[1].lower()
        safe_basename = secure_filename(f"audio_{timestamp}.{ext}")
        storage_path = f"memories/{user_id}/{safe_basename}"

        # Upload
        bucket = storage.bucket()
        blob = bucket.blob(storage_path)
        content_type = "audio/webm" if ext == "webm" else f"audio/{ext}"
        blob.upload_from_file(audio_file, content_type=content_type)

        # Get URL — signed with fallback to public
        public_url = _get_storage_url(blob)

        return {
            'success': True,
            'storage_path': storage_path,
            'public_url': public_url,
            'size': size,
            'format': ext
        }

    except Exception as e:
        logger.error(f"Audio processing failed: {e}")
        return {'success': False, 'error': str(e)}


def _process_photo_file(photo_file, user_id: str) -> dict:
    """Process, analyze, and upload photo to Firebase Storage."""
    try:
        # Validate
        if not allowed_image(photo_file.filename):
            return {'success': False, 'error': 'Invalid image format'}

        # Check size
        photo_file.seek(0, os.SEEK_END)
        size = photo_file.tell()
        photo_file.seek(0)

        if size > MAX_FILE_SIZE:
            return {'success': False, 'error': 'Photo too large (max 10MB)'}

        # Read for analysis
        photo_bytes = photo_file.read()
        photo_file.seek(0)  # Reset for upload

        # AI Analysis
        photo_service = get_photo_analysis_service()
        analysis = photo_service.analyze_photo(photo_bytes, "temp")

        # Generate filename — only secure the basename, not the full storage path
        timestamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
        ext = photo_file.filename.rsplit(".", 1)[1].lower()
        photo_id = f"photo_{timestamp}_{os.urandom(4).hex()}"
        safe_basename = secure_filename(f"{photo_id}.{ext}")
        storage_path = f"memories/{user_id}/{safe_basename}"

        # Upload original
        bucket = storage.bucket()
        blob = bucket.blob(storage_path)
        blob.upload_from_string(photo_bytes, content_type=f"image/{ext}")
        public_url = _get_storage_url(blob)

        # Generate and upload real thumbnail (400px wide) using Pillow
        thumbnail_url = public_url  # default: same as original
        if PIL_AVAILABLE:
            try:
                thumb_img = PilImage.open(BytesIO(photo_bytes))
                thumb_img.thumbnail((400, 400), PilImage.LANCZOS)
                # Always save thumbnail as JPEG for universality
                thumb_buf = BytesIO()
                thumb_img.convert('RGB').save(thumb_buf, format='JPEG', quality=75, optimize=True)
                thumb_buf.seek(0)
                thumb_basename = secure_filename(f"{photo_id}_thumb.jpg")
                thumb_path = f"memories/{user_id}/{thumb_basename}"
                thumb_blob = bucket.blob(thumb_path)
                thumb_blob.upload_from_file(thumb_buf, content_type='image/jpeg')
                thumbnail_url = _get_storage_url(thumb_blob)
                logger.debug(f"Thumbnail uploaded: {thumb_path} ({thumb_img.size})")
            except Exception as thumb_err:
                logger.warning(f"Thumbnail generation failed: {thumb_err}")

        return {
            'success': True,
            'storage_path': storage_path,
            'public_url': public_url,
            'thumbnail_url': thumbnail_url,
            'size': size,
            'format': ext,
            'analysis': {
                'emotion': analysis.dominant_emotion,
                'scene': analysis.scene_type,
                'hasFaces': analysis.has_faces,
                'tags': analysis.therapeutic_tags,
                'caption': analysis.suggested_caption
            }
        }

    except Exception as e:
        logger.error(f"Photo processing failed: {e}")
        return {'success': False, 'error': str(e)}


def _analyze_multimodal_memory(content: str, audio_data: dict, photos: list) -> dict:
    """Analyze combined content from all modalities."""
    analysis_result = {
        'primary_emotion': 'neutral',
        'emotions': {},
        'themes': [],
        'sentiment_score': 0,
        'significance': 0.5,
        'photo_insights': []
    }

    try:
        # Analyze text
        if content:
            memory_service = get_memory_analysis_service()
            text_analysis = memory_service.analyze_text_memory(content)

            analysis_result['emotions'].update(text_analysis.emotions)
            analysis_result['themes'].extend(text_analysis.themes)
            analysis_result['sentiment_score'] = text_analysis.sentiment_score
            analysis_result['significance'] = text_analysis.significance_score

        # Analyze audio
        if audio_data:
            # Would need to fetch and analyze audio bytes
            pass

        # Analyze photos
        for photo in photos:
            if 'analysis' in photo:
                analysis_result['photo_insights'].append(photo['analysis'])

                # Aggregate emotions from photos
                photo_emotion = photo['analysis'].get('emotion', 'neutral')
                if photo_emotion in analysis_result['emotions']:
                    analysis_result['emotions'][photo_emotion] += 0.5
                else:
                    analysis_result['emotions'][photo_emotion] = 0.5

        # Determine primary emotion
        if analysis_result['emotions']:
            analysis_result['primary_emotion'] = max(
                analysis_result['emotions'],
                key=analysis_result['emotions'].get
            )

        return analysis_result

    except Exception as e:
        logger.error(f"Multimodal analysis failed: {e}")
        return analysis_result


@multimedia_memory_bp.route("/list/<user_id>", methods=["GET"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def list_multimedia_memories(user_id: str):
    """List all multimedia memories for a user."""
    try:
        current_user = g.get('user_id')
        if user_id != current_user:
            return APIResponse.forbidden("Unauthorized access")

        # Query Firestore
        from google.cloud.firestore import FieldFilter

        memories_query = db.collection('memories').where(
            filter=FieldFilter('user_id', '==', user_id)
        ).order_by('created_at', direction='DESCENDING').limit(50)

        memories = []
        for doc in memories_query.stream():
            data = doc.to_dict()
            memories.append({
                'id': doc.id,
                'contentPreview': data.get('content', '')[:100],
                'hasAudio': data.get('has_audio', False),
                'photoCount': data.get('photo_count') or data.get('media', {}).get('photo_count', 0),
                'mood': data.get('mood'),
                'tags': data.get('tags', []),
                'aiEmotion': data.get('ai_analysis', {}).get('primary_emotion'),
                'createdAt': data.get('created_at', datetime.now(UTC)).isoformat()
            })

        return APIResponse.success({
            'memories': memories,
            'total': len(memories)
        }, f"Found {len(memories)} memories")

    except Exception as e:
        logger.exception(f"Error listing memories: {e}")
        return APIResponse.error("Failed to load memories", "LIST_ERROR", 500)


@multimedia_memory_bp.route("/<memory_id>", methods=["GET"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_memory_detail(memory_id: str):
    """Get full details of a multimedia memory."""
    try:
        user_id = g.get('user_id')

        # Fetch from Firestore
        memory_doc = db.collection('memories').document(memory_id).get()

        if not memory_doc.exists:
            return APIResponse.not_found("Memory not found")

        data = memory_doc.to_dict()

        # Verify ownership
        if data.get('user_id') != user_id:
            return APIResponse.forbidden("Unauthorized access")

        # Get signed URLs for media (if needed)
        media = data.get('media', {})

        response = {
            'id': memory_id,
            'content': data.get('content'),
            'mood': data.get('mood'),
            'tags': data.get('tags', []),
            'location': data.get('location'),
            'media': media,
            'aiAnalysis': data.get('ai_analysis'),
            'createdAt': data.get('created_at', datetime.now(UTC)).isoformat()
        }

        return APIResponse.success(response, "Memory retrieved")

    except Exception as e:
        logger.exception(f"Error fetching memory: {e}")
        return APIResponse.error("Failed to load memory", "FETCH_ERROR", 500)
