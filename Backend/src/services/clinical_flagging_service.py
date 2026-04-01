"""
Clinical Flagging Service
Detects concerning mood patterns and triggers professional support recommendations
Implements evidence-based thresholds for mental health risk assessment
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ClinicalFlaggingService:
    """
    Production-ready clinical flagging system.
    
    Monitors mood patterns and triggers interventions based on:
    - Consecutive low mood days (< 3 for 5+ days)
    - Rapid mood decline
    - Persistent negative patterns
    """
    
    # Clinical thresholds based on evidence-based practice
    LOW_MOOD_THRESHOLD = 3  # Score below this is considered "low mood"
    CONSECUTIVE_DAYS_THRESHOLD = 5  # Number of consecutive low days to trigger flag
    RAPID_DECLINE_THRESHOLD = -3  # Drop of 3+ points in 3 days
    PERSISTENT_LOW_THRESHOLD = 7  # 7+ low mood days in 14 days
    
    def __init__(self):
        self.logger = logger
    
    def check_mood_flags(
        self, 
        mood_entries: List[Dict[str, Any]],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Check for clinical flags in mood data.
        
        Args:
            mood_entries: List of mood entries sorted by timestamp (newest first)
            user_id: User ID for logging
            
        Returns:
            Dict with flag status, risk level, and recommendations
        """
        if not mood_entries:
            return {
                'flagged': False,
                'risk_level': 'none',
                'flags': [],
                'recommendations': []
            }
        
        # Sort by timestamp (newest first)
        sorted_entries = sorted(
            mood_entries,
            key=lambda x: self._parse_timestamp(x.get('timestamp')),
            reverse=True
        )
        
        flags = []
        risk_level = 'none'
        
        # Check 1: Consecutive low mood days
        consecutive_flag = self._check_consecutive_low_mood(sorted_entries)
        if consecutive_flag:
            flags.append(consecutive_flag)
            risk_level = self._escalate_risk(risk_level, 'high')
        
        # Check 2: Rapid mood decline
        decline_flag = self._check_rapid_decline(sorted_entries)
        if decline_flag:
            flags.append(decline_flag)
            risk_level = self._escalate_risk(risk_level, 'medium')
        
        # Check 3: Persistent low mood over 2 weeks
        persistent_flag = self._check_persistent_low_mood(sorted_entries)
        if persistent_flag:
            flags.append(persistent_flag)
            risk_level = self._escalate_risk(risk_level, 'high')
        
        # Generate recommendations based on flags
        recommendations = self._generate_recommendations(flags, risk_level)
        
        # Log flagging event
        if flags:
            self.logger.warning(
                f"Clinical flags detected for user {user_id[:8]}...: "
                f"{len(flags)} flags, risk level: {risk_level}"
            )
        
        return {
            'flagged': len(flags) > 0,
            'risk_level': risk_level,
            'flags': flags,
            'recommendations': recommendations,
            'checked_at': datetime.utcnow().isoformat()
        }
    
    def _check_consecutive_low_mood(
        self, 
        sorted_entries: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        Check for consecutive days with mood < 3.
        
        Returns flag if 5+ consecutive days detected.
        """
        if len(sorted_entries) < self.CONSECUTIVE_DAYS_THRESHOLD:
            return None
        
        # Group entries by calendar day
        daily_moods = self._group_by_day(sorted_entries)
        
        # Check for consecutive low mood days
        consecutive_count = 0
        consecutive_dates = []
        
        # Sort days chronologically
        sorted_days = sorted(daily_moods.keys(), reverse=True)
        
        for i, day in enumerate(sorted_days):
            avg_mood = daily_moods[day]['average']
            
            if avg_mood < self.LOW_MOOD_THRESHOLD:
                consecutive_count += 1
                consecutive_dates.append(day)
                
                # Check if this is truly consecutive (no gaps)
                if i > 0:
                    prev_day = sorted_days[i - 1]
                    day_diff = (prev_day - day).days
                    if day_diff > 1:
                        # Gap detected, reset counter
                        if consecutive_count < self.CONSECUTIVE_DAYS_THRESHOLD:
                            consecutive_count = 1
                            consecutive_dates = [day]
            else:
                # Reset counter if mood is not low
                if consecutive_count >= self.CONSECUTIVE_DAYS_THRESHOLD:
                    break
                consecutive_count = 0
                consecutive_dates = []
        
        if consecutive_count >= self.CONSECUTIVE_DAYS_THRESHOLD:
            return {
                'type': 'consecutive_low_mood',
                'severity': 'high',
                'title': 'Persistent Low Mood Detected',
                'description': (
                    f"You've logged low mood (< 3/10) for {consecutive_count} consecutive days. "
                    f"This pattern suggests you may benefit from professional support."
                ),
                'days_count': consecutive_count,
                'date_range': {
                    'start': consecutive_dates[-1].isoformat(),
                    'end': consecutive_dates[0].isoformat()
                },
                'clinical_significance': True
            }
        
        return None
    
    def _check_rapid_decline(
        self, 
        sorted_entries: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Check for rapid mood decline (3+ points drop in 3 days)."""
        if len(sorted_entries) < 2:
            return None
        
        # Get mood from last 3 days
        three_days_ago = datetime.utcnow() - timedelta(days=3)
        recent_entries = [
            e for e in sorted_entries
            if self._parse_timestamp(e.get('timestamp')) >= three_days_ago
        ]
        
        if len(recent_entries) < 2:
            return None
        
        # Calculate mood change
        latest_mood = recent_entries[0].get('score', 5)
        earliest_mood = recent_entries[-1].get('score', 5)
        mood_change = latest_mood - earliest_mood
        
        if mood_change <= self.RAPID_DECLINE_THRESHOLD:
            return {
                'type': 'rapid_decline',
                'severity': 'medium',
                'title': 'Rapid Mood Decline',
                'description': (
                    f"Your mood has dropped {abs(mood_change):.1f} points in the last 3 days "
                    f"(from {earliest_mood}/10 to {latest_mood}/10). "
                    f"Consider reaching out for support."
                ),
                'mood_change': round(mood_change, 1),
                'days': 3,
                'clinical_significance': True
            }
        
        return None
    
    def _check_persistent_low_mood(
        self, 
        sorted_entries: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Check for persistent low mood over 2 weeks (7+ low days in 14 days)."""
        two_weeks_ago = datetime.utcnow() - timedelta(days=14)
        recent_entries = [
            e for e in sorted_entries
            if self._parse_timestamp(e.get('timestamp')) >= two_weeks_ago
        ]
        
        if not recent_entries:
            return None
        
        # Count low mood days
        daily_moods = self._group_by_day(recent_entries)
        low_mood_days = sum(
            1 for day_data in daily_moods.values()
            if day_data['average'] < self.LOW_MOOD_THRESHOLD
        )
        
        if low_mood_days >= self.PERSISTENT_LOW_THRESHOLD:
            return {
                'type': 'persistent_low_mood',
                'severity': 'high',
                'title': 'Persistent Low Mood Pattern',
                'description': (
                    f"You've had {low_mood_days} days with low mood in the past 2 weeks. "
                    f"This persistent pattern may indicate depression or burnout. "
                    f"Professional support is recommended."
                ),
                'low_mood_days': low_mood_days,
                'total_days': 14,
                'clinical_significance': True
            }
        
        return None
    
    def _group_by_day(
        self, 
        entries: List[Dict[str, Any]]
    ) -> Dict[datetime, Dict[str, Any]]:
        """Group mood entries by calendar day and calculate daily averages."""
        daily_moods = {}
        
        for entry in entries:
            timestamp = self._parse_timestamp(entry.get('timestamp'))
            day = timestamp.date()
            score = entry.get('score', 5)
            
            if day not in daily_moods:
                daily_moods[day] = {'scores': [], 'entries': []}
            
            daily_moods[day]['scores'].append(score)
            daily_moods[day]['entries'].append(entry)
        
        # Calculate averages
        for day in daily_moods:
            scores = daily_moods[day]['scores']
            daily_moods[day]['average'] = sum(scores) / len(scores)
            daily_moods[day]['count'] = len(scores)
        
        return daily_moods
    
    def _parse_timestamp(self, timestamp: Any) -> datetime:
        """Parse timestamp from various formats."""
        if isinstance(timestamp, datetime):
            return timestamp
        elif isinstance(timestamp, str):
            try:
                return datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            except Exception:
                return datetime.utcnow()
        else:
            return datetime.utcnow()
    
    def _escalate_risk(self, current: str, new: str) -> str:
        """Escalate risk level if new level is higher."""
        risk_levels = {'none': 0, 'low': 1, 'medium': 2, 'high': 3, 'critical': 4}
        current_level = risk_levels.get(current, 0)
        new_level = risk_levels.get(new, 0)
        
        if new_level > current_level:
            return new
        return current
    
    def _generate_recommendations(
        self, 
        flags: List[Dict[str, Any]], 
        risk_level: str
    ) -> List[Dict[str, str]]:
        """Generate actionable recommendations based on flags."""
        recommendations = []
        
        if not flags:
            return recommendations
        
        # High-risk recommendations
        if risk_level in ['high', 'critical']:
            recommendations.append({
                'priority': 'high',
                'title': 'Kontakta professionell hjälp',
                'description': (
                    'Dina humörmönster visar tecken på ihållande lågt mående. '
                    'Vi rekommenderar starkt att du kontaktar en läkare, psykolog eller kurator.'
                ),
                'action': 'contact_professional',
                'resources': [
                    {'name': '1177 Vårdguiden', 'phone': '1177', 'available': '24/7'},
                    {'name': 'Mind Självmordslinjen', 'phone': '90101', 'available': '24/7'},
                    {'name': 'Jourhavande präst', 'phone': '112', 'available': '24/7'}
                ]
            })
        
        # Medium-risk recommendations
        if risk_level == 'medium':
            recommendations.append({
                'priority': 'medium',
                'title': 'Överväg att söka stöd',
                'description': (
                    'Din humörförändring kan vara ett tecken på stress eller övergående svårigheter. '
                    'Prata med någon du litar på eller överväg professionell rådgivning.'
                ),
                'action': 'seek_support',
                'resources': []
            })
        
        # Self-care recommendations (always include)
        recommendations.append({
            'priority': 'low',
            'title': 'Självomsorgsstrategier',
            'description': (
                'Fokusera på grundläggande självom sorg: regelbunden sömn, fysisk aktivitet, '
                'social kontakt och näringsrik mat. Dessa kan ha stor påverkan på ditt mående.'
            ),
            'action': 'self_care',
            'resources': []
        })
        
        return recommendations


# Global instance
clinical_flagging_service = ClinicalFlaggingService()
