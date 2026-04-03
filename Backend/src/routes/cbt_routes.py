"""
CBT (Cognitive Behavioral Therapy) routes for Lugn & Trygg.

This module provides Flask routes for CBT modules, exercises,
personalized sessions, and user progress tracking.
"""

import logging
from datetime import UTC, datetime
from typing import Any

from flask import Blueprint, g, request

from src.firebase_config import db
from src.services.audit_service import audit_log
from src.services.auth_service import AuthService
from src.services.cbt_engine import (
    CBTExercise,
    CBTModule,
    PersonalizedCBTSession,
    UserCBTProgress,
    cbt_engine,
)
from src.services.rate_limiting import rate_limit_by_endpoint
from src.services.subscription_service import SubscriptionService
from src.utils.response_utils import APIResponse

logger = logging.getLogger(__name__)

# Blueprint definition
cbt_bp = Blueprint("cbt", __name__)


def _check_cbt_access(user_id: str) -> tuple[bool, str]:
    """Check if user has premium access to CBT modules."""
    try:
        user_doc = db.collection("users").document(user_id).get()
        user_data = user_doc.to_dict() if user_doc.exists else {}

        plan_context = SubscriptionService.get_plan_context(user_data, user_id=user_id)
        plan_type = plan_context.get("plan", "free")

        # CBT is premium feature - require premium, trial, or enterprise
        allowed_plans = ["premium", "trial", "enterprise"]
        if plan_type.lower() not in allowed_plans:
            return False, f"CBT modules require premium subscription. Current plan: {plan_type}"

        return True, ""

    except Exception as e:
        logger.error(f"Failed to check CBT access for {user_id}: {e}")
        return False, "Unable to verify subscription status"


def _module_to_dict(module: CBTModule) -> dict[str, Any]:
    """Convert CBTModule dataclass to API response dict."""
    return {
        "moduleId": module.module_id,
        "title": module.title,
        "description": module.description,
        "category": module.category,
        "difficultyLevel": module.difficulty_level,
        "estimatedDuration": module.estimated_duration,
        "prerequisites": module.prerequisites,
        "learningObjectives": module.learning_objectives,
        "completionCriteria": module.completion_criteria,
    }


def _exercise_to_dict(exercise: CBTExercise) -> dict[str, Any]:
    """Convert CBTExercise dataclass to API response dict."""
    return {
        "exerciseId": exercise.exercise_id,
        "moduleId": exercise.module_id,
        "title": exercise.title,
        "type": exercise.type,
        "difficulty": exercise.difficulty,
        "duration": exercise.duration,
        "instructions": exercise.swedish_instructions,
        "prompts": exercise.prompts,
        "successMetrics": exercise.success_metrics,
    }


def _session_to_dict(session: PersonalizedCBTSession) -> dict[str, Any]:
    """Convert PersonalizedCBTSession dataclass to API response dict."""
    return {
        "exercises": [_exercise_to_dict(ex) for ex in session.exercises],
        "sessionTheme": session.session_theme,
        "estimatedDuration": session.estimated_duration,
        "difficultyProgression": session.difficulty_progression,
        "motivationalElements": session.motivational_elements,
        "guidance": session.swedish_guidance,
    }


def _get_user_progress(user_id: str) -> UserCBTProgress:
    """Fetch user's CBT progress from Firestore."""
    try:
        doc = db.collection("cbt_progress").document(user_id).get()
        if doc.exists:
            data = doc.to_dict()
            if data:
                return UserCBTProgress(
                    user_id=user_id,
                    current_module=data.get("currentModule"),
                    completed_modules=data.get("completedModules", []),
                    exercise_history=data.get("exerciseHistory", []),
                    skill_mastery=data.get("skillMastery", {}),
                    adaptive_parameters=data.get("adaptiveParameters", {}),
                    last_session_date=data.get("lastSessionDate"),
                    streak_count=data.get("streakCount", 0),
                )
    except Exception as e:
        logger.warning(f"Failed to fetch CBT progress for user {user_id}: {e}")

    # Return default progress for new users
    return UserCBTProgress(
        user_id=user_id,
        current_module=None,
        completed_modules=[],
        exercise_history=[],
        skill_mastery={},
        adaptive_parameters={},
        last_session_date=None,
        streak_count=0,
    )


def _save_user_progress(progress: UserCBTProgress) -> bool:
    """Save user's CBT progress to Firestore."""
    try:
        db.collection("cbt_progress").document(progress.user_id).set(
            {
                "currentModule": progress.current_module,
                "completedModules": progress.completed_modules,
                "exerciseHistory": progress.exercise_history,
                "skillMastery": progress.skill_mastery,
                "adaptiveParameters": progress.adaptive_parameters,
                "lastSessionDate": progress.last_session_date,
                "streakCount": progress.streak_count,
                "updatedAt": datetime.now(UTC),
            },
            merge=True,
        )
        return True
    except Exception as e:
        logger.error(f"Failed to save CBT progress for user {progress.user_id}: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/cbt/modules - List available CBT modules
# ─────────────────────────────────────────────────────────────────────────────
@cbt_bp.route("/modules", methods=["GET"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_modules():
    """
    Get all available CBT modules.

    Returns:
        List of CBT modules with metadata.
    """
    user_id = g.user_id
    logger.info(f"📚 User {user_id} fetching CBT modules")

    try:
        # Check premium subscription access
        has_access, error_message = _check_cbt_access(user_id)
        if not has_access:
            logger.warning(f"⛔ User {user_id} denied CBT access: {error_message}")
            return APIResponse.error(
                message=error_message,
                error_code="PREMIUM_REQUIRED",
                status_code=403
            )

        # Get user progress to show completion status
        user_progress = _get_user_progress(user_id)

        modules_list = []
        for module_id, module in cbt_engine.modules.items():
            module_dict = _module_to_dict(module)
            module_dict["isCompleted"] = module_id in user_progress.completed_modules
            module_dict["isLocked"] = any(
                prereq not in user_progress.completed_modules
                for prereq in module.prerequisites
            )
            modules_list.append(module_dict)

        audit_log("CBT_MODULES_VIEWED", user_id, {"moduleCount": len(modules_list)})

        return APIResponse.success(
            data={"modules": modules_list},
            message="CBT modules retrieved successfully",
        )

    except Exception as e:
        logger.error(f"❌ Error fetching CBT modules for user {user_id}: {e}")
        return APIResponse.error(
            message="Failed to retrieve CBT modules",
            status_code=500,
        )


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/cbt/modules/<module_id> - Get specific module details
# ─────────────────────────────────────────────────────────────────────────────
@cbt_bp.route("/modules/<module_id>", methods=["GET"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_module_detail(module_id: str):
    """
    Get detailed information about a specific CBT module.

    Args:
        module_id: The module identifier.

    Returns:
        Module details including Swedish content.
    """
    user_id = g.user_id
    logger.info(f"📖 User {user_id} fetching module: {module_id}")

    try:
        # Check premium subscription access
        has_access, error_message = _check_cbt_access(user_id)
        if not has_access:
            logger.warning(f"⛔ User {user_id} denied CBT access: {error_message}")
            return APIResponse.error(
                message=error_message,
                error_code="PREMIUM_REQUIRED",
                status_code=403
            )

        if module_id not in cbt_engine.modules:
            return APIResponse.error(
                message="Module not found",
                status_code=404,
            )

        module = cbt_engine.modules[module_id]
        user_progress = _get_user_progress(user_id)

        # Check prerequisites
        is_locked = any(
            prereq not in user_progress.completed_modules
            for prereq in module.prerequisites
        )

        if is_locked:
            return APIResponse.error(
                message="Complete prerequisites first",
                status_code=403,
                details={"missingPrerequisites": [
                    p for p in module.prerequisites
                    if p not in user_progress.completed_modules
                ]},
            )

        module_dict = _module_to_dict(module)
        module_dict["swedishContent"] = module.swedish_content
        module_dict["isCompleted"] = module_id in user_progress.completed_modules

        # Get exercises for this module
        module_exercises = [
            _exercise_to_dict(ex)
            for ex in cbt_engine.exercises.values()
            if ex.module_id == module_id
        ]
        module_dict["exercises"] = module_exercises

        audit_log("CBT_MODULE_VIEWED", user_id, {"moduleId": module_id})

        return APIResponse.success(
            data={"module": module_dict},
            message="Module retrieved successfully",
        )

    except Exception as e:
        logger.error(f"❌ Error fetching module {module_id} for user {user_id}: {e}")
        return APIResponse.error(
            message="Failed to retrieve module",
            status_code=500,
        )


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/cbt/session - Generate personalized CBT session
# ─────────────────────────────────────────────────────────────────────────────
@cbt_bp.route("/session", methods=["GET"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_personalized_session():
    """
    Generate a personalized CBT session based on user progress and mood.

    Query params:
        mood: Current mood state (optional)

    Returns:
        Personalized session with exercises and guidance.
    """
    user_id = g.user_id
    current_mood = request.args.get("mood", "neutral")
    logger.info(f"🎯 Generating CBT session for user {user_id}, mood: {current_mood}")

    try:
        # Check premium subscription access
        has_access, error_message = _check_cbt_access(user_id)
        if not has_access:
            logger.warning(f"⛔ User {user_id} denied CBT access: {error_message}")
            return APIResponse.error(
                message=error_message,
                error_code="PREMIUM_REQUIRED",
                status_code=403
            )

        # Get user progress
        user_progress = _get_user_progress(user_id)

        # Build context
        context = {
            "time_of_day": _get_time_of_day(),
            "mood_intensity": _mood_to_intensity(current_mood),
        }

        # Generate personalized session
        session = cbt_engine.generate_personalized_session(
            user_progress=user_progress,
            current_mood=current_mood,
            context=context,
        )

        session_dict = _session_to_dict(session)

        audit_log("CBT_SESSION_GENERATED", user_id, {
            "theme": session.session_theme,
            "exerciseCount": len(session.exercises),
            "mood": current_mood,
        })

        return APIResponse.success(
            data={"session": session_dict},
            message="Personalized session generated",
        )

    except Exception as e:
        logger.error(f"❌ Error generating session for user {user_id}: {e}")
        return APIResponse.error(
            message="Failed to generate session",
            status_code=500,
        )


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/cbt/progress - Update user CBT progress
# ─────────────────────────────────────────────────────────────────────────────
@cbt_bp.route("/progress", methods=["POST"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def update_progress():
    """
    Update user's CBT progress after completing an exercise.

    Request body:
        exerciseId: ID of completed exercise
        successRate: 0.0-1.0 success rating
        timeSpent: Time spent in minutes
        difficultyRating: 1-5 difficulty rating
        notes: Optional user notes

    Returns:
        Updated progress and any unlocked achievements.
    """
    user_id = g.user_id
    logger.info(f"📝 Updating CBT progress for user {user_id}")

    try:
        # Check premium subscription access
        has_access, error_message = _check_cbt_access(user_id)
        if not has_access:
            logger.warning(f"⛔ User {user_id} denied CBT access: {error_message}")
            return APIResponse.error(
                message=error_message,
                error_code="PREMIUM_REQUIRED",
                status_code=403
            )

        data = request.get_json(force=True, silent=True)
        if not data:
            return APIResponse.error(
                message="Request body required",
                status_code=400,
            )

        exercise_id = data.get("exerciseId")
        if not exercise_id:
            return APIResponse.error(
                message="exerciseId is required",
                status_code=400,
            )

        if exercise_id not in cbt_engine.exercises:
            return APIResponse.error(
                message="Exercise not found",
                status_code=404,
            )

        # Get current progress
        user_progress = _get_user_progress(user_id)

        # Update exercise history
        exercise_entry = {
            "exerciseId": exercise_id,
            "completedAt": datetime.now(UTC).isoformat(),
            "successRate": min(1.0, max(0.0, float(data.get("successRate", 0.5)))),
            "timeSpent": int(data.get("timeSpent", 0)),
            "difficultyRating": min(5, max(1, int(data.get("difficultyRating", 3)))),
            "notes": data.get("notes", ""),
        }
        user_progress.exercise_history.append(exercise_entry)

        # Update skill mastery
        exercise = cbt_engine.exercises[exercise_id]
        skill_type = exercise.type
        current_mastery = user_progress.skill_mastery.get(skill_type, 0.5)
        mastery_adjustment = (exercise_entry["successRate"] - 0.5) * 0.1
        new_mastery = min(1.0, max(0.0, current_mastery + mastery_adjustment))
        user_progress.skill_mastery[skill_type] = new_mastery

        # Update streak — only increment once per calendar day
        now_utc = datetime.now(UTC)
        last_date = user_progress.last_session_date
        if last_date is None:
            # First ever session
            user_progress.streak_count = 1
        else:
            # Normalize to UTC date for comparison
            if hasattr(last_date, 'tzinfo') and last_date.tzinfo is None:
                last_date = last_date.replace(tzinfo=UTC)
            days_since_last = (now_utc.date() - last_date.date()).days
            if days_since_last == 0:
                # Same calendar day — do not change streak
                pass
            elif days_since_last == 1:
                # Consecutive day — extend streak
                user_progress.streak_count += 1
            else:
                # Streak broken — reset to 1
                user_progress.streak_count = 1
        user_progress.last_session_date = now_utc

        # Check module completion
        module_id = exercise.module_id
        module = cbt_engine.modules.get(module_id)
        achievements: list[str] = []

        if module:
            module_exercises = [
                ex_id for ex_id, ex in cbt_engine.exercises.items()
                if ex.module_id == module_id
            ]
            completed_exercises = {
                entry["exerciseId"]
                for entry in user_progress.exercise_history
            }

            if all(ex_id in completed_exercises for ex_id in module_exercises):
                if module_id not in user_progress.completed_modules:
                    user_progress.completed_modules.append(module_id)
                    achievements.append(f"module_completed:{module_id}")
                    logger.info(f"🏆 User {user_id} completed module: {module_id}")

        # Save progress
        if not _save_user_progress(user_progress):
            return APIResponse.error(
                message="Failed to save progress",
                status_code=500,
            )

        # Update engine's internal tracking
        cbt_engine.update_user_progress(
            user_id=user_id,
            exercise_id=exercise_id,
            completion_data={
                "success_rate": exercise_entry["successRate"],
                "time_spent": exercise_entry["timeSpent"],
                "difficulty_rating": exercise_entry["difficultyRating"],
                "current_skill_mastery": user_progress.skill_mastery,
            },
        )

        audit_log("CBT_EXERCISE_COMPLETED", user_id, {
            "exerciseId": exercise_id,
            "successRate": exercise_entry["successRate"],
            "newMastery": new_mastery,
            "achievements": achievements,
        })

        return APIResponse.success(
            data={
                "skillMastery": user_progress.skill_mastery,
                "streakCount": user_progress.streak_count,
                "completedModules": user_progress.completed_modules,
                "achievements": achievements,
            },
            message="Progress updated successfully",
        )

    except ValueError as e:
        logger.warning(f"Invalid progress data from user {user_id}: {e}")
        return APIResponse.error(
            message="Invalid data format",
            status_code=400,
        )
    except Exception as e:
        logger.error(f"❌ Error updating progress for user {user_id}: {e}")
        return APIResponse.error(
            message="Failed to update progress",
            status_code=500,
        )


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/cbt/insights - Get user CBT insights
# ─────────────────────────────────────────────────────────────────────────────
@cbt_bp.route("/insights", methods=["GET"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_insights():
    """
    Get insights about user's CBT journey and progress.

    Returns:
        Progress statistics, strengths, improvement areas, and recommendations.
    """
    user_id = g.user_id
    logger.info(f"📊 Fetching CBT insights for user {user_id}")

    try:
        has_access, error_message = _check_cbt_access(user_id)
        if not has_access:
            logger.warning(f"⛔ User {user_id} denied CBT access: {error_message}")
            return APIResponse.error(
                message=error_message,
                error_code="PREMIUM_REQUIRED",
                status_code=403,
            )

        user_progress = _get_user_progress(user_id)
        insights = cbt_engine.get_user_insights(user_progress)

        # Convert to camelCase for frontend
        response_data = {
            "overallProgress": insights["overall_progress"],
            "strengthAreas": insights["strength_areas"],
            "improvementAreas": insights["improvement_areas"],
            "recommendedNextSteps": insights["recommended_next_steps"],
            "streak": {
                "current": insights["streak_info"]["current_streak"],
                "longest": insights["streak_info"]["longest_streak"],
                "consistencyRating": insights["streak_info"]["consistency_rating"],
            },
            "exercisesCompleted": len(user_progress.exercise_history),
            "modulesCompleted": len(user_progress.completed_modules),
        }

        audit_log("CBT_INSIGHTS_VIEWED", user_id, {
            "overallProgress": insights["overall_progress"],
        })

        return APIResponse.success(
            data={"insights": response_data},
            message="Insights retrieved successfully",
        )

    except Exception as e:
        logger.error(f"❌ Error fetching insights for user {user_id}: {e}")
        return APIResponse.error(
            message="Failed to retrieve insights",
            status_code=500,
        )


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/cbt/exercises - List all exercises
# ─────────────────────────────────────────────────────────────────────────────
@cbt_bp.route("/exercises", methods=["GET"])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_exercises():
    """
    Get all available CBT exercises.

    Query params:
        module: Filter by module ID (optional)
        type: Filter by exercise type (optional)

    Returns:
        List of CBT exercises.
    """
    user_id = g.user_id
    module_filter = request.args.get("module")
    type_filter = request.args.get("type")

    logger.info(f"📋 User {user_id} fetching exercises (module={module_filter}, type={type_filter})")

    try:
        has_access, error_message = _check_cbt_access(user_id)
        if not has_access:
            logger.warning(f"⛔ User {user_id} denied CBT access: {error_message}")
            return APIResponse.error(
                message=error_message,
                error_code="PREMIUM_REQUIRED",
                status_code=403,
            )

        exercises_list = []
        for exercise in cbt_engine.exercises.values():
            if module_filter and exercise.module_id != module_filter:
                continue
            if type_filter and exercise.type != type_filter:
                continue
            exercises_list.append(_exercise_to_dict(exercise))

        return APIResponse.success(
            data={"exercises": exercises_list},
            message="Exercises retrieved successfully",
        )

    except Exception as e:
        logger.error(f"❌ Error fetching exercises for user {user_id}: {e}")
        return APIResponse.error(
            message="Failed to retrieve exercises",
            status_code=500,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Helper functions
# ─────────────────────────────────────────────────────────────────────────────
def _get_time_of_day() -> str:
    """Get current time of day category."""
    hour = datetime.now(UTC).hour
    if 5 <= hour < 12:
        return "morning"
    elif 12 <= hour < 17:
        return "afternoon"
    elif 17 <= hour < 21:
        return "evening"
    else:
        return "night"


def _mood_to_intensity(mood: str) -> float:
    """Convert mood string to intensity value."""
    intensity_map = {
        "very_bad": 0.9,
        "bad": 0.7,
        "low_mood": 0.6,
        "neutral": 0.5,
        "good": 0.3,
        "great": 0.1,
        "high_anxiety": 0.9,
        "stress": 0.7,
        "depression": 0.8,
    }
    return intensity_map.get(mood, 0.5)
