"""
Smart Notifications Service for Lugn & Trygg
Context-aware, personalized notification system
"""

import logging
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta, time
import random
import json

logger = logging.getLogger(__name__)

@dataclass
class NotificationTemplate:
    """Template for notifications"""
    template_id: str
    category: str  # 'mood_check', 'coping_reminder', 'achievement', 'crisis_alert'
    priority: str  # 'low', 'medium', 'high', 'urgent'
    swedish_title: str
    swedish_message: str
    personalization_variables: List[str]
    trigger_conditions: Dict[str, Any]
    cooldown_hours: int
    effectiveness_score: float

@dataclass
class UserNotificationPreferences:
    """User's notification preferences"""
    user_id: str
    enabled_categories: List[str]
    quiet_hours_start: Optional[time]
    quiet_hours_end: Optional[time]
    max_daily_notifications: int
    preferred_times: Dict[str, List[str]]  # category -> list of preferred hours
    language: str
    notification_channels: List[str]  # 'push', 'email', 'sms'

@dataclass
class SmartNotification:
    """Smart notification with context"""
    notification_id: str
    user_id: str
    template_id: str
    title: str
    message: str
    category: str
    priority: str
    scheduled_time: datetime
    context_data: Dict[str, Any]
    personalization_score: float
    expected_engagement: float
    channel: str

class SmartNotificationsService:
    """Intelligent notification system with personalization"""

    def __init__(self):
        self.templates = self._initialize_templates()
        self.notification_history = {}  # user_id -> list of recent notifications

    def _initialize_templates(self) -> Dict[str, NotificationTemplate]:
        """Initialize notification templates"""
        templates = {}

        # Mood Check Templates
        templates['mood_check_morning'] = NotificationTemplate(
            template_id='mood_check_morning',
            category='mood_check',
            priority='medium',
            swedish_title='Godmorgon! Hur mår du idag?',
            swedish_message='Ta en stund att logga ditt humör och starta dagen medvetet. Det tar bara en minut!',
            personalization_variables=['user_name', 'time_of_day'],
            trigger_conditions={
                'time_range': ['06:00', '10:00'],
                'last_mood_check_hours': 24,
                'user_mood_trend': 'any'
            },
            cooldown_hours=12,
            effectiveness_score=0.85
        )

        templates['mood_check_evening'] = NotificationTemplate(
            template_id='mood_check_evening',
            category='mood_check',
            priority='medium',
            swedish_title='Kvällsrutin: Hur har dagen varit?',
            swedish_message='Reflektera över dagen genom att logga ditt humör. Det hjälper dig att förstå dina mönster.',
            personalization_variables=['user_name', 'day_highlights'],
            trigger_conditions={
                'time_range': ['18:00', '22:00'],
                'last_mood_check_hours': 12,
                'user_mood_trend': 'any'
            },
            cooldown_hours=8,
            effectiveness_score=0.82
        )

        # Coping Reminder Templates
        templates['coping_reminder_stress'] = NotificationTemplate(
            template_id='coping_reminder_stress',
            category='coping_reminder',
            priority='high',
            swedish_title='Högt stressnivå upptäckt',
            swedish_message='Vi märker att du kan behöva extra stöd just nu. Här är en enkel teknik: {coping_strategy}',
            personalization_variables=['user_name', 'coping_strategy', 'stress_level'],
            trigger_conditions={
                'stress_indicators': ['high_voice_stress', 'rapid_mood_changes', 'negative_streak'],
                'last_coping_reminder_hours': 4,
                'time_since_last_interaction': 2
            },
            cooldown_hours=4,
            effectiveness_score=0.78
        )

        templates['coping_reminder_pattern'] = NotificationTemplate(
            template_id='coping_reminder_pattern',
            category='coping_reminder',
            priority='medium',
            swedish_title='Vi har lagt märke till ett mönster',
            swedish_message='Du brukar må bättre efter att {successful_strategy}. Vill du prova det idag?',
            personalization_variables=['user_name', 'successful_strategy', 'pattern_description'],
            trigger_conditions={
                'behavioral_pattern': 'identified',
                'last_successful_strategy_days': 7,
                'current_mood': 'low'
            },
            cooldown_hours=24,
            effectiveness_score=0.88
        )

        # Achievement Templates
        templates['achievement_streak'] = NotificationTemplate(
            template_id='achievement_streak',
            category='achievement',
            priority='low',
            swedish_title='🎉 Grattis till {streak_count} dagars streak!',
            swedish_message='Du har konsekvent arbetat med din psykiska hälsa. Var stolt över ditt engagemang!',
            personalization_variables=['user_name', 'streak_count', 'achievement_type'],
            trigger_conditions={
                'streak_milestone': [3, 7, 14, 30, 50, 100],
                'achievement_unlocked': True
            },
            cooldown_hours=168,  # Weekly
            effectiveness_score=0.92
        )

        templates['achievement_progress'] = NotificationTemplate(
            template_id='achievement_progress',
            category='achievement',
            priority='low',
            swedish_title='Framsteg uppmärksammat! 📈',
            swedish_message='Du har gjort betydande framsteg i {skill_area}. Fortsätt så - du är på rätt väg!',
            personalization_variables=['user_name', 'skill_area', 'progress_percentage'],
            trigger_conditions={
                'skill_improvement': 0.2,  # 20% improvement
                'consistent_practice_days': 5
            },
            cooldown_hours=72,
            effectiveness_score=0.85
        )

        # Crisis Alert Templates
        templates['crisis_alert_high_risk'] = NotificationTemplate(
            template_id='crisis_alert_high_risk',
            category='crisis_alert',
            priority='urgent',
            swedish_title='⚠️ Omedelbar uppmärksamhet behövs',
            swedish_message='Vi har upptäckt indikationer på akut behov av stöd. Kontakta omedelbart: {emergency_contact}',
            personalization_variables=['user_name', 'emergency_contact', 'risk_indicators'],
            trigger_conditions={
                'crisis_indicators': ['severe_depression', 'suicidal_ideation', 'acute_anxiety'],
                'immediate_action_required': True
            },
            cooldown_hours=1,
            effectiveness_score=0.95
        )

        templates['crisis_alert_moderate_risk'] = NotificationTemplate(
            template_id='crisis_alert_moderate_risk',
            category='crisis_alert',
            priority='high',
            swedish_title='Du behöver extra stöd just nu',
            swedish_message='Vi rekommenderar att du kontaktar en professionell eller pratar med någon du litar på.',
            personalization_variables=['user_name', 'recommended_actions', 'support_resources'],
            trigger_conditions={
                'crisis_indicators': ['moderate_depression', 'chronic_anxiety', 'isolation'],
                'professional_help_recommended': True
            },
            cooldown_hours=6,
            effectiveness_score=0.87
        )

        # Motivational Templates
        templates['motivation_low_mood'] = NotificationTemplate(
            template_id='motivation_low_mood',
            category='motivation',
            priority='medium',
            swedish_title='Du är starkare än du tror 💪',
            swedish_message='Svåra dagar tillhör livet, men du har övervunnit utmaningar förr. Ett litet steg idag kan förändra mycket.',
            personalization_variables=['user_name', 'past_achievement', 'encouragement_type'],
            trigger_conditions={
                'current_mood': 'very_low',
                'last_motivation_hours': 48,
                'user_resilience_score': 'any'
            },
            cooldown_hours=48,
            effectiveness_score=0.76
        )

        return templates

    def generate_smart_notifications(
        self,
        user_id: str,
        user_context: Dict[str, Any],
        user_preferences: UserNotificationPreferences
    ) -> List[SmartNotification]:
        """
        Generate personalized smart notifications based on user context and preferences

        Args:
            user_id: User identifier
            user_context: Current user context (mood, patterns, time, etc.)
            user_preferences: User's notification preferences

        Returns:
            List of personalized SmartNotification objects
        """
        logger.info(f"Generating smart notifications for user {user_id}")

        notifications = []

        # Check each template against user context and preferences
        for template in self.templates.values():
            if self._should_trigger_notification(template, user_context, user_preferences):
                notification = self._create_personalized_notification(
                    template, user_id, user_context, user_preferences
                )
                if notification:
                    notifications.append(notification)

        # Sort by priority and personalization score
        notifications.sort(key=lambda x: (
            self._priority_score(x.priority),
            x.personalization_score
        ), reverse=True)

        # Apply daily limits and quiet hours
        filtered_notifications = self._apply_user_limits(
            notifications, user_preferences, user_context
        )

        logger.info(f"Generated {len(filtered_notifications)} smart notifications for user {user_id}")

        return filtered_notifications

    def _should_trigger_notification(
        self,
        template: NotificationTemplate,
        user_context: Dict[str, Any],
        user_preferences: UserNotificationPreferences
    ) -> bool:
        """Determine if a notification template should trigger"""

        # Check if category is enabled
        if template.category not in user_preferences.enabled_categories:
            return False

        # Check cooldown period
        last_notification = self._get_last_notification_time(
            user_preferences.user_id, template.template_id
        )
        if last_notification:
            hours_since = (datetime.now() - last_notification).total_seconds() / 3600
            if hours_since < template.cooldown_hours:
                return False

        # Check trigger conditions
        return self._evaluate_trigger_conditions(template.trigger_conditions, user_context)

    def _evaluate_trigger_conditions(self, conditions: Dict[str, Any], user_context: Dict[str, Any]) -> bool:
        """Evaluate if trigger conditions are met"""

        for condition_key, condition_value in conditions.items():
            if condition_key == 'time_range':
                if not self._check_time_range(condition_value, user_context.get('current_time')):
                    return False

            elif condition_key == 'last_mood_check_hours':
                last_check = user_context.get('last_mood_check')
                if last_check:
                    hours_since = (datetime.now() - last_check).total_seconds() / 3600
                    if hours_since < condition_value:
                        return False

            elif condition_key == 'stress_indicators':
                user_stress = user_context.get('stress_indicators', [])
                if not any(indicator in user_stress for indicator in condition_value):
                    return False

            elif condition_key == 'current_mood':
                if user_context.get('current_mood') != condition_value:
                    return False

            elif condition_key == 'crisis_indicators':
                user_crisis = user_context.get('crisis_indicators', [])
                if not any(indicator in user_crisis for indicator in condition_value):
                    return False

            elif condition_key == 'streak_milestone':
                user_streak = user_context.get('current_streak', 0)
                if user_streak not in condition_value:
                    return False

        return True

    def _check_time_range(self, time_range: List[str], current_time: Optional[datetime]) -> bool:
        """Check if current time is within specified range"""
        if not current_time:
            return False

        start_time = datetime.strptime(time_range[0], '%H:%M').time()
        end_time = datetime.strptime(time_range[1], '%H:%M').time()

        current_time_only = current_time.time()

        if start_time <= end_time:
            return start_time <= current_time_only <= end_time
        else:
            # Handle ranges that cross midnight
            return current_time_only >= start_time or current_time_only <= end_time

    def _create_personalized_notification(
        self,
        template: NotificationTemplate,
        user_id: str,
        user_context: Dict[str, Any],
        user_preferences: UserNotificationPreferences
    ) -> Optional[SmartNotification]:
        """Create a personalized notification from template"""

        try:
            # Personalize title and message
            title = self._personalize_text(template.swedish_title, user_context)
            message = self._personalize_text(template.swedish_message, user_context)

            # Calculate personalization score
            personalization_score = self._calculate_personalization_score(
                template, user_context, user_preferences
            )

            # Determine optimal send time
            scheduled_time = self._calculate_optimal_send_time(
                template, user_context, user_preferences
            )

            # Select best channel
            channel = self._select_notification_channel(template, user_preferences)

            # Calculate expected engagement
            expected_engagement = self._calculate_expected_engagement(
                template, personalization_score, user_context
            )

            notification = SmartNotification(
                notification_id=f"{user_id}_{template.template_id}_{int(datetime.now().timestamp())}",
                user_id=user_id,
                template_id=template.template_id,
                title=title,
                message=message,
                category=template.category,
                priority=template.priority,
                scheduled_time=scheduled_time,
                context_data={
                    'template_variables': template.personalization_variables,
                    'user_context': user_context,
                    'trigger_conditions': template.trigger_conditions
                },
                personalization_score=personalization_score,
                expected_engagement=expected_engagement,
                channel=channel
            )

            return notification

        except Exception as e:
            logger.error(f"Error creating personalized notification: {str(e)}")
            return None

    def _personalize_text(self, text: str, user_context: Dict[str, Any]) -> str:
        """Replace personalization variables in text"""

        personalized_text = text

        # Replace known variables
        replacements = {
            '{user_name}': user_context.get('user_name', 'du'),
            '{time_of_day}': self._get_swedish_time_of_day(user_context.get('current_time')),
            '{coping_strategy}': user_context.get('recommended_strategy', 'djupandning'),
            '{stress_level}': user_context.get('stress_level', 'förhöjd'),
            '{successful_strategy}': user_context.get('successful_strategy', 'en promenad'),
            '{streak_count}': str(user_context.get('current_streak', 1)),
            '{skill_area}': user_context.get('improved_skill', 'ångesthantering'),
            '{progress_percentage}': f"{user_context.get('progress_percentage', 25)}%",
            '{emergency_contact}': user_context.get('emergency_contact', '112'),
            '{past_achievement}': user_context.get('past_achievement', 'tidigare utmaningar')
        }

        for placeholder, value in replacements.items():
            personalized_text = personalized_text.replace(placeholder, str(value))

        return personalized_text

    def _get_swedish_time_of_day(self, current_time: Optional[datetime]) -> str:
        """Get Swedish time of day greeting"""
        if not current_time:
            return 'dagen'

        hour = current_time.hour

        if 5 <= hour < 10:
            return 'morgonen'
        elif 10 <= hour < 14:
            return 'förmiddagen'
        elif 14 <= hour < 18:
            return 'eftermiddagen'
        elif 18 <= hour < 22:
            return 'kvällen'
        else:
            return 'natten'

    def _calculate_personalization_score(
        self,
        template: NotificationTemplate,
        user_context: Dict[str, Any],
        user_preferences: UserNotificationPreferences
    ) -> float:
        """Calculate how well the notification is personalized"""

        score = 0.5  # Base score

        # Check if preferred time
        current_time = user_context.get('current_time')
        if current_time:
            preferred_times = user_preferences.preferred_times.get(template.category, [])
            if preferred_times:
                current_hour = current_time.strftime('%H:00')
                if current_hour in preferred_times:
                    score += 0.2

        # Check context relevance
        context_relevance = len([
            var for var in template.personalization_variables
            if var in user_context and user_context[var] is not None
        ]) / max(len(template.personalization_variables), 1)

        score += context_relevance * 0.3

        return min(1.0, score)

    def _calculate_optimal_send_time(
        self,
        template: NotificationTemplate,
        user_context: Dict[str, Any],
        user_preferences: UserNotificationPreferences
    ) -> datetime:
        """Calculate optimal time to send notification"""

        now = datetime.now()

        # Check quiet hours
        if user_preferences.quiet_hours_start and user_preferences.quiet_hours_end:
            if self._is_in_quiet_hours(now, user_preferences):
                # Schedule for after quiet hours
                quiet_end = datetime.combine(now.date(), user_preferences.quiet_hours_end)
                if now.time() > user_preferences.quiet_hours_end:
                    quiet_end += timedelta(days=1)
                return quiet_end

        # Use preferred times for category
        preferred_times = user_preferences.preferred_times.get(template.category, [])
        if preferred_times:
            # Find next preferred time today
            for preferred_time in preferred_times:
                preferred_hour = int(preferred_time.split(':')[0])
                preferred_datetime = now.replace(hour=preferred_hour, minute=0, second=0, microsecond=0)

                if preferred_datetime > now:
                    return preferred_datetime

            # If no preferred time today, use first one tomorrow
            preferred_hour = int(preferred_times[0].split(':')[0])
            tomorrow = now + timedelta(days=1)
            return tomorrow.replace(hour=preferred_hour, minute=0, second=0, microsecond=0)

        # Default: send immediately for high priority, delay for others
        if template.priority in ['urgent', 'high']:
            return now
        elif template.priority == 'medium':
            return now + timedelta(minutes=30)
        else:
            return now + timedelta(hours=2)

    def _is_in_quiet_hours(self, current_time: datetime, preferences: UserNotificationPreferences) -> bool:
        """Check if current time is in user's quiet hours"""
        if not preferences.quiet_hours_start or not preferences.quiet_hours_end:
            return False

        current_time_only = current_time.time()

        if preferences.quiet_hours_start <= preferences.quiet_hours_end:
            return preferences.quiet_hours_start <= current_time_only <= preferences.quiet_hours_end
        else:
            # Crosses midnight
            return current_time_only >= preferences.quiet_hours_start or current_time_only <= preferences.quiet_hours_end

    def _select_notification_channel(
        self,
        template: NotificationTemplate,
        user_preferences: UserNotificationPreferences
    ) -> str:
        """Select best notification channel"""

        available_channels = user_preferences.notification_channels

        # Urgent notifications always go to primary channel
        if template.priority == 'urgent':
            return available_channels[0] if available_channels else 'push'

        # High priority prefers push, others can use email
        if template.priority == 'high' and 'push' in available_channels:
            return 'push'
        elif 'email' in available_channels:
            return 'email'
        elif available_channels:
            return available_channels[0]

        return 'push'  # Default fallback

    def _calculate_expected_engagement(
        self,
        template: NotificationTemplate,
        personalization_score: float,
        user_context: Dict[str, Any]
    ) -> float:
        """Calculate expected user engagement with notification"""

        base_engagement = template.effectiveness_score

        # Adjust for personalization
        engagement_multiplier = 0.8 + (personalization_score * 0.4)
        base_engagement *= engagement_multiplier

        # Adjust for user state
        user_engagement = user_context.get('average_engagement', 0.7)
        base_engagement *= user_engagement

        # Adjust for time sensitivity
        time_sensitivity = user_context.get('time_sensitivity', 1.0)
        base_engagement *= time_sensitivity

        return min(1.0, base_engagement)

    def _apply_user_limits(
        self,
        notifications: List[SmartNotification],
        user_preferences: UserNotificationPreferences,
        user_context: Dict[str, Any]
    ) -> List[SmartNotification]:
        """Apply user limits (daily max, quiet hours, etc.)"""

        filtered_notifications = []

        # Get today's notifications count
        today_count = len([
            n for n in self.notification_history.get(user_preferences.user_id, [])
            if (datetime.now() - n['sent_time']).days == 0
        ])

        for notification in notifications:
            # Check daily limit
            if today_count >= user_preferences.max_daily_notifications:
                break

            # Check quiet hours
            if self._is_in_quiet_hours(notification.scheduled_time, user_preferences):
                continue

            filtered_notifications.append(notification)
            today_count += 1

        return filtered_notifications

    def _priority_score(self, priority: str) -> int:
        """Convert priority to numeric score for sorting"""
        priority_scores = {
            'urgent': 4,
            'high': 3,
            'medium': 2,
            'low': 1
        }
        return priority_scores.get(priority, 1)

    def _get_last_notification_time(self, user_id: str, template_id: str) -> Optional[datetime]:
        """Get last time this template was sent to user"""
        user_history = self.notification_history.get(user_id, [])
        template_notifications = [
            n for n in user_history
            if n.get('template_id') == template_id
        ]

        if template_notifications:
            return template_notifications[-1]['sent_time']

        return None

    def record_notification_sent(self, notification: SmartNotification):
        """Record that a notification was sent"""
        if notification.user_id not in self.notification_history:
            self.notification_history[notification.user_id] = []

        self.notification_history[notification.user_id].append({
            'notification_id': notification.notification_id,
            'template_id': notification.template_id,
            'sent_time': datetime.now(),
            'category': notification.category,
            'priority': notification.priority,
            'channel': notification.channel,
            'personalization_score': notification.personalization_score
        })

        # Keep only last 100 notifications per user
        if len(self.notification_history[notification.user_id]) > 100:
            self.notification_history[notification.user_id] = self.notification_history[notification.user_id][-100:]

    def get_notification_analytics(self, user_id: str) -> Dict[str, Any]:
        """Get analytics about user's notification engagement"""

        user_history = self.notification_history.get(user_id, [])

        if not user_history:
            return {'total_sent': 0, 'engagement_rate': 0, 'preferred_times': []}

        # Calculate engagement rate (simplified - would need actual engagement data)
        total_sent = len(user_history)
        engagement_rate = 0.65  # Placeholder - would calculate from actual opens/clicks

        # Find preferred times
        hour_counts = {}
        for notification in user_history:
            sent_time = notification['sent_time']
            hour = sent_time.strftime('%H:00')
            hour_counts[hour] = hour_counts.get(hour, 0) + 1

        preferred_times = sorted(hour_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        preferred_times = [time for time, count in preferred_times]

        return {
            'total_sent': total_sent,
            'engagement_rate': engagement_rate,
            'preferred_times': preferred_times,
            'category_breakdown': self._get_category_breakdown(user_history)
        }

    def _get_category_breakdown(self, user_history: List[Dict[str, Any]]) -> Dict[str, int]:
        """Get breakdown of notifications by category"""
        categories = {}
        for notification in user_history:
            category = notification.get('category', 'unknown')
            categories[category] = categories.get(category, 0) + 1

        return categories


# Singleton instance
smart_notifications_service = SmartNotificationsService()