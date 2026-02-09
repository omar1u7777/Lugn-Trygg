"""
Routes Package - Flask Blueprints
All API route blueprints are registered here for easy importing
"""

# Import all blueprints for easy access
from .admin_routes import admin_bp
from .ai_helpers_routes import ai_helpers_bp
from .ai_routes import ai_bp
from .audio_routes import audio_bp
from .auth_routes import auth_bp
from .cbt_routes import cbt_bp
from .challenges_routes import challenges_bp, init_challenges_defaults
from .chatbot_routes import chatbot_bp
from .consent_routes import consent_bp
from .crisis_routes import crisis_bp
from .dashboard_routes import dashboard_bp
from .docs_routes import docs_bp
from .feedback_routes import feedback_bp
from .health_routes import health_bp
from .integration_routes import integration_bp
from .journal_routes import journal_bp
from .leaderboard_routes import leaderboard_bp
from .memory_routes import memory_bp
from .metrics_routes import metrics_bp
from .mood_routes import mood_bp
from .mood_stats_routes import mood_stats_bp
from .notifications_routes import notifications_bp
from .onboarding_routes import onboarding_bp
from .peer_chat_routes import peer_chat_bp
from .predictive_routes import predictive_bp
from .privacy_routes import privacy_bp
from .rate_limit_routes import rate_limit_bp
from .referral_routes import referral_bp
from .rewards_routes import rewards_bp
from .security_routes import security_bp
from .subscription_routes import subscription_bp
from .sync_history_routes import sync_history_bp
from .users_routes import users_bp
from .voice_routes import voice_bp

__all__ = [
    # Authentication & User Management
    'auth_bp',
    'users_bp',
    'onboarding_bp',
    'privacy_routes',
    'consent_bp',

    # Core Features
    'mood_bp',
    'mood_stats_bp',
    'memory_bp',
    'journal_routes',
    'audio_routes',
    'voice_routes',

    # AI & Chat
    'ai_bp',
    'ai_helpers_bp',
    'chatbot_bp',

    # Analytics & Insights
    'dashboard_bp',
    'metrics_bp',
    'predictive_bp',

    # Gamification
    'rewards_bp',
    'challenges_bp',
    'init_challenges_defaults',
    'leaderboard_bp',

    # Social Features
    'peer_chat_bp',
    'referral_bp',

    # Integration & Sync
    'integration_routes',
    'sync_history_routes',

    # Notifications & Feedback
    'notifications_bp',
    'feedback_bp',

    # Crisis & Health
    'crisis_bp',
    'health_bp',
    'cbt_bp',

    # Subscription & Payment
    'subscription_bp',

    # Admin & Security
    'admin_bp',
    'security_bp',
    'rate_limit_bp',

    # Documentation
    'docs_bp',
]

