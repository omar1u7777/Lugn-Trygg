"""
Therapeutic Progress Tracking Service
Evidence-based outcome monitoring and session effectiveness tracking
Implements CORE-OM inspired metrics and therapeutic alliance measurement
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum

import numpy as np

logger = logging.getLogger(__name__)


class OutcomeDomain(Enum):
    """Domains for outcome measurement (CORE-OM inspired)"""
    SUBJECTIVE_WELLBEING = "subjective_wellbeing"
    SYMPTOMS = "symptoms"  # Anxiety, depression, etc.
    FUNCTIONING = "functioning"  # Daily life functioning
    PROBLEMS = "problems"  # Specific issues
    RISK = "risk"  # Self-harm, suicide risk


class AllianceDimension(Enum):
    """Working Alliance Inventory dimensions"""
    BOND = "bond"  # Emotional connection
    TASKS = "tasks"  # Agreement on what to do
    GOALS = "goals"  # Agreement on desired outcomes


@dataclass
class SessionOutcome:
    """Outcome measurement for a single session"""
    session_id: str
    timestamp: datetime
    wellbeing_score: float  # 0-10 scale
    symptom_reduction: float  # 0-1 scale
    functioning_improvement: float  # 0-1 scale
    risk_level: str  # 'none', 'low', 'moderate', 'high'
    
    # Qualitative
    key_insights: List[str]
    action_items_completed: int
    action_items_total: int
    user_satisfaction: float  # 1-5 scale


@dataclass
class TherapeuticAlliance:
    """Working alliance measurement"""
    session_id: str
    bond_score: float  # 0-1 scale
    tasks_score: float  # 0-1 scale
    goals_score: float  # 0-1 scale
    overall_alliance: float  # Composite score
    rupture_detected: bool
    repair_attempted: bool


@dataclass
class ProgressTrajectory:
    """Long-term progress tracking"""
    user_id: str
    start_date: datetime
    total_sessions: int
    
    # Trajectory metrics
    slope_wellbeing: float  # Rate of improvement
    slope_symptoms: float
    slope_functioning: float
    
    # Reliability of change
    reliable_change_index: float
    clinically_significant_change: bool
    
    # Pattern detection
    plateau_detected: bool
    deterioration_detected: bool
    sudden_gain_detected: bool
    
    # Predictions
    predicted_sessions_to_goal: Optional[int]
    risk_of_dropout: float  # 0-1 scale


@dataclass
class HomeworkAdherence:
    """Track homework/practice adherence"""
    assignment_id: str
    task_description: str
    assigned_date: datetime
    due_date: datetime
    completed_date: Optional[datetime]
    completion_rate: float  # 0-1 scale
    difficulty_rating: float  # 1-5 scale
    usefulness_rating: float  # 1-5 scale
    barriers_encountered: List[str]


class TherapeuticProgressTracker:
    """
    Professional therapeutic progress tracking
    
    Implements:
    - Reliable Change Index (Jacobson & Truax, 1991)
    - Clinical Significance methodology
    - Working Alliance Inventory principles
    - Session-by-session outcome monitoring (CORE-OM style)
    """
    
    def __init__(self, user_id: str):
        self.user_id = user_id
        
        # Population norms for reliable change calculation
        # CORE-OM population norms (approximate)
        self.population_mean = 10.0  # CORE-OM total score
        self.population_std = 5.0
        self.measurement_error = 2.0  # Test-retest reliability
        
        # Calculate reliable change index
        self.reliable_change_threshold = 1.96 * np.sqrt(2) * self.measurement_error
    
    def calculate_reliable_change(
        self,
        baseline_score: float,
        current_score: float
    ) -> Dict[str, Any]:
        """
        Calculate Reliable Change Index (RCI)
        
        RCI determines if change is statistically reliable vs. measurement error
        """
        change = current_score - baseline_score
        rci = change / (self.population_std * np.sqrt(2 * (1 - 0.85)))  # 0.85 = reliability
        
        # Determine change category
        if abs(rci) < 1.96:
            change_status = "no_reliable_change"
        elif rci < -1.96:
            change_status = "reliable_improvement"
        else:
            change_status = "reliable_deterioration"
        
        # Clinical significance (Jacobson methodology)
        # A = more functional than 95% of clinical population
        # B = moved from clinical to functional distribution
        # C = no change in distribution
        cutoff = self.population_mean - 2 * self.population_std
        
        if baseline_score > cutoff and current_score <= cutoff:
            clinical_significance = "recovered"
        elif baseline_score > cutoff and current_score > cutoff and change < -self.reliable_change_threshold:
            clinical_significance = "improved"
        elif baseline_score <= cutoff and current_score <= cutoff:
            clinical_significance = "functional"
        else:
            clinical_significance = "unchanged"
        
        return {
            'reliable_change_index': float(rci),
            'raw_change': float(change),
            'change_status': change_status,
            'clinical_significance': clinical_significance,
            'reliable_change_threshold': float(self.reliable_change_threshold)
        }
    
    def assess_session_outcome(
        self,
        session_id: str,
        pre_session_scores: Dict[str, float],
        post_session_scores: Dict[str, float],
        session_content: Dict
    ) -> SessionOutcome:
        """
        Assess outcome of a single session
        
        Pre/post session measurement using validated scales
        """
        # Calculate wellbeing change (0-10 scale, higher is better)
        wellbeing_change = post_session_scores.get('wellbeing', 5) - pre_session_scores.get('wellbeing', 5)
        
        # Calculate symptom reduction (0-1 scale)
        pre_symptoms = pre_session_scores.get('symptoms', 0.5)
        post_symptoms = post_session_scores.get('symptoms', 0.5)
        symptom_reduction = max(0, pre_symptoms - post_symptoms)
        
        # Calculate functioning improvement
        functioning_change = post_session_scores.get('functioning', 0.5) - pre_session_scores.get('functioning', 0.5)
        
        # Determine risk level
        risk_score = post_session_scores.get('risk', 0)
        if risk_score > 0.7:
            risk_level = 'high'
        elif risk_score > 0.4:
            risk_level = 'moderate'
        elif risk_score > 0.1:
            risk_level = 'low'
        else:
            risk_level = 'none'
        
        # Extract key insights from session content
        key_insights = self._extract_insights(session_content.get('messages', []))
        
        # Track action items
        action_items = session_content.get('action_items', [])
        completed = sum(1 for item in action_items if item.get('completed', False))
        
        return SessionOutcome(
            session_id=session_id,
            timestamp=datetime.now(),
            wellbeing_score=post_session_scores.get('wellbeing', 5),
            symptom_reduction=symptom_reduction,
            functioning_improvement=max(0, functioning_change),
            risk_level=risk_level,
            key_insights=key_insights,
            action_items_completed=completed,
            action_items_total=len(action_items),
            user_satisfaction=post_session_scores.get('satisfaction', 3)
        )
    
    def _extract_insights(self, messages: List[Dict]) -> List[str]:
        """Extract key insights from conversation"""
        insights = []
        
        # Look for "aha moments" and realizations
        insight_markers = [
            "aha", "insikt", "förstår nu", "nu ser jag", "det är därför",
            "realize", "insight", "now I see", "that's why", "I understand now"
        ]
        
        for msg in messages:
            content = msg.get('content', '').lower()
            for marker in insight_markers:
                if marker in content:
                    # Extract the sentence containing the insight
                    sentences = content.split('.')
                    for sentence in sentences:
                        if marker in sentence.lower() and len(sentence) > 20:
                            insights.append(sentence.strip())
                            break
        
        return list(set(insights))[:5]  # Remove duplicates, limit to 5
    
    def measure_working_alliance(
        self,
        session_id: str,
        messages: List[Dict],
        user_ratings: Optional[Dict] = None
    ) -> TherapeuticAlliance:
        """
        Estimate working alliance from conversation patterns
        
        Based on Bordin's Working Alliance Inventory:
        - Bond: emotional connection
        - Tasks: agreement on methods
        - Goals: agreement on outcomes
        """
        ai_messages = [m for m in messages if m.get('role') == 'assistant']
        user_messages = [m for m in messages if m.get('role') == 'user']
        
        # 1. Bond score - emotional connection markers
        bond_markers = [
            "förtroende", "förstår", "finns här", "stödja", "tillsammans",
            "trust", "understand", "here for you", "support", "together"
        ]
        bond_mentions = sum(1 for msg in ai_messages
                         for marker in bond_markers
                         if marker in msg.get('content', '').lower())
        bond_score = min(bond_mentions / max(len(ai_messages) * 0.3, 1), 1.0)
        
        # 2. Tasks score - agreement on methods
        task_markers = [
            "låt oss", "föreslår", "försök", "öva", "göra tillsammans",
            "let's", "suggest", "try", "practice", "do together"
        ]
        task_mentions = sum(1 for msg in ai_messages
                           for marker in task_markers
                           if marker in msg.get('content', '').lower())
        tasks_score = min(task_mentions / max(len(ai_messages) * 0.25, 1), 1.0)
        
        # 3. Goals score - agreement on outcomes
        goal_markers = [
            "mål", "strävar mot", "önskar", "vill uppnå",
            "goal", "working toward", "want to achieve", "aspire"
        ]
        goal_mentions = sum(1 for msg in ai_messages
                           for marker in goal_markers
                           if marker in msg.get('content', '').lower())
        goals_score = min(goal_mentions / max(len(ai_messages) * 0.2, 1), 1.0)
        
        # Detect alliance ruptures
        rupture_indicators = [
            "don't understand", "not helpful", "not listening", "you don't get it",
            "förstår inte", "inte hjälpsam", "lyssnar inte", "fattar inte"
        ]
        rupture_count = sum(1 for msg in user_messages
                          for indicator in rupture_indicators
                          if indicator in msg.get('content', '').lower())
        rupture_detected = rupture_count > 0
        
        # Detect repair attempts
        repair_markers = [
            "tack för att du säger det", "låt mig förklara", "förlåt",
            "thank you for saying that", "let me clarify", "sorry", "I hear you"
        ]
        repair_count = sum(1 for msg in ai_messages
                         for marker in repair_markers
                         if marker in msg.get('content', '').lower())
        repair_attempted = repair_count > 0 and rupture_detected
        
        # Calculate overall alliance
        overall = (bond_score * 0.4 + tasks_score * 0.3 + goals_score * 0.3)
        
        # Adjust for rupture/repair
        if rupture_detected and not repair_attempted:
            overall *= 0.7
        elif rupture_detected and repair_attempted:
            overall = min(overall * 1.1, 1.0)  # Successful repair strengthens alliance
        
        return TherapeuticAlliance(
            session_id=session_id,
            bond_score=bond_score,
            tasks_score=tasks_score,
            goals_score=goals_score,
            overall_alliance=overall,
            rupture_detected=rupture_detected,
            repair_attempted=repair_attempted
        )
    
    def analyze_progress_trajectory(
        self,
        session_outcomes: List[SessionOutcome]
    ) -> ProgressTrajectory:
        """
        Analyze long-term progress trajectory
        
        Detects:
        - Linear improvement trends
        - Plateaus
        - Sudden gains
        - Deterioration
        - Dropout risk
        """
        if len(session_outcomes) < 3:
            return ProgressTrajectory(
                user_id=self.user_id,
                start_date=session_outcomes[0].timestamp if session_outcomes else datetime.now(),
                total_sessions=len(session_outcomes),
                slope_wellbeing=0.0,
                slope_symptoms=0.0,
                slope_functioning=0.0,
                reliable_change_index=0.0,
                clinically_significant_change=False,
                plateau_detected=False,
                deterioration_detected=False,
                sudden_gain_detected=False,
                predicted_sessions_to_goal=None,
                risk_of_dropout=0.5
            )
        
        # Extract time series data
        sessions_nums = np.arange(len(session_outcomes))
        wellbeing_scores = np.array([s.wellbeing_score for s in session_outcomes])
        symptom_scores = 1 - np.array([s.symptom_reduction for s in session_outcomes])  # Invert
        functioning_scores = np.array([s.functioning_improvement for s in session_outcomes])
        
        # Calculate slopes using linear regression
        slope_wellbeing = np.polyfit(sessions_nums, wellbeing_scores, 1)[0]
        slope_symptoms = np.polyfit(sessions_nums, symptom_scores, 1)[0]
        slope_functioning = np.polyfit(sessions_nums, functioning_scores, 1)[0]
        
        # Detect plateau (3+ sessions with < 0.5 change)
        recent_changes = np.diff(wellbeing_scores[-4:])
        plateau_detected = len(recent_changes) >= 3 and all(abs(c) < 0.5 for c in recent_changes)
        
        # Detect deterioration
        deterioration_detected = slope_wellbeing < -0.3 and slope_symptoms > 0.2
        
        # Detect sudden gain (large improvement between 2 consecutive sessions)
        changes = np.diff(wellbeing_scores)
        sudden_gain_threshold = np.std(changes) * 2 if len(changes) > 1 else 2.0
        sudden_gain_detected = any(c > sudden_gain_threshold for c in changes)
        
        # Calculate reliable change index
        baseline = wellbeing_scores[0]
        current = wellbeing_scores[-1]
        rci_result = self.calculate_reliable_change(baseline, current)
        
        # Predict sessions to goal (simple linear extrapolation)
        goal_score = 8.0  # Target wellbeing score
        if slope_wellbeing > 0.1:
            sessions_needed = (goal_score - current) / slope_wellbeing
            predicted_sessions = max(1, int(sessions_needed))
        else:
            predicted_sessions = None
        
        # Calculate dropout risk
        dropout_risk = self._calculate_dropout_risk(
            session_outcomes,
            slope_wellbeing,
            rci_result['change_status']
        )
        
        return ProgressTrajectory(
            user_id=self.user_id,
            start_date=session_outcomes[0].timestamp,
            total_sessions=len(session_outcomes),
            slope_wellbeing=float(slope_wellbeing),
            slope_symptoms=float(slope_symptoms),
            slope_functioning=float(slope_functioning),
            reliable_change_index=float(rci_result['reliable_change_index']),
            clinically_significant_change=rci_result['clinical_significance'] in ['recovered', 'improved'],
            plateau_detected=plateau_detected,
            deterioration_detected=deterioration_detected,
            sudden_gain_detected=sudden_gain_detected,
            predicted_sessions_to_goal=predicted_sessions,
            risk_of_dropout=dropout_risk
        )
    
    def _calculate_dropout_risk(
        self,
        outcomes: List[SessionOutcome],
        wellbeing_slope: float,
        change_status: str
    ) -> float:
        """
        Predict risk of therapy dropout
        
        Based on research on dropout predictors:
        - Slow progress
        - Early plateau
        - Low alliance
        - Missed sessions
        """
        risk_factors = 0.0
        
        # Factor 1: No improvement (highest risk)
        if change_status == "no_reliable_change":
            risk_factors += 0.3
        elif change_status == "reliable_deterioration":
            risk_factors += 0.4
        
        # Factor 2: Slow progress
        if wellbeing_slope < 0.1:
            risk_factors += 0.2
        
        # Factor 3: Low session satisfaction
        recent_satisfaction = np.mean([o.user_satisfaction for o in outcomes[-3:]])
        if recent_satisfaction < 3.0:
            risk_factors += 0.2
        
        # Factor 4: Incomplete homework
        completion_rates = [o.action_items_completed / max(o.action_items_total, 1) 
                          for o in outcomes[-3:]]
        avg_completion = np.mean(completion_rates) if completion_rates else 0.5
        if avg_completion < 0.3:
            risk_factors += 0.15
        
        # Base risk + accumulated factors, capped at 0.9
        return min(0.9, 0.2 + risk_factors)
    
    def track_homework_adherence(
        self,
        assignments: List[Dict]
    ) -> Dict[str, Any]:
        """Track and analyze homework adherence"""
        if not assignments:
            return {'overall_adherence': 0.0, 'pattern': 'none'}
        
        adherence_scores = []
        difficulty_ratings = []
        usefulness_ratings = []
        
        for assignment in assignments:
            if assignment.get('completed_date'):
                adherence_scores.append(1.0)
                difficulty_ratings.append(assignment.get('difficulty_rating', 3))
                usefulness_ratings.append(assignment.get('usefulness_rating', 3))
            else:
                adherence_scores.append(0.0)
        
        overall_adherence = np.mean(adherence_scores) if adherence_scores else 0.0
        
        # Detect patterns
        if overall_adherence > 0.8:
            pattern = "excellent"
        elif overall_adherence > 0.5:
            pattern = "moderate"
        elif overall_adherence > 0.2:
            pattern = "struggling"
        else:
            pattern = "poor"
        
        # Identify barriers
        all_barriers = []
        for assignment in assignments:
            all_barriers.extend(assignment.get('barriers', []))
        
        barrier_counts = {}
        for barrier in all_barriers:
            barrier_counts[barrier] = barrier_counts.get(barrier, 0) + 1
        
        return {
            'overall_adherence': float(overall_adherence),
            'pattern': pattern,
            'average_difficulty': float(np.mean(difficulty_ratings)) if difficulty_ratings else 3.0,
            'average_usefulness': float(np.mean(usefulness_ratings)) if usefulness_ratings else 3.0,
            'common_barriers': barrier_counts,
            'recommendation': self._generate_adherence_recommendation(pattern, barrier_counts)
        }
    
    def _generate_adherence_recommendation(
        self,
        pattern: str,
        barriers: Dict[str, int]
    ) -> str:
        """Generate evidence-based adherence recommendations"""
        if pattern == "excellent":
            return "Continue current approach. Consider increasing challenge level."
        elif pattern == "moderate":
            return "Review barriers. Consider simplifying tasks or increasing support."
        elif pattern == "struggling":
            # Check specific barriers
            if "time" in str(barriers).lower():
                return "Tasks may be too time-consuming. Consider shorter, more frequent practices."
            elif "difficult" in str(barriers).lower() or "hard" in str(barriers).lower():
                return "Tasks may be too difficult. Break into smaller steps and provide more guidance."
            else:
                return "Review motivation and barriers. Consider motivational interviewing techniques."
        else:
            return "Significant adherence issues. Reassess goals and consider alternative approaches."
    
    def generate_progress_report(
        self,
        session_outcomes: List[SessionOutcome],
        alliances: List[TherapeuticAlliance],
        trajectory: ProgressTrajectory
    ) -> Dict[str, Any]:
        """
        Generate comprehensive progress report for user and therapist
        """
        if not session_outcomes:
            return {'error': 'No session data available'}
        
        latest = session_outcomes[-1]
        baseline = session_outcomes[0]
        
        # Calculate improvements
        wellbeing_change = latest.wellbeing_score - baseline.wellbeing_score
        symptom_change = latest.symptom_reduction - baseline.symptom_reduction
        
        # Alliance trend
        if alliances:
            alliance_trend = alliances[-1].overall_alliance - alliances[0].overall_alliance
            latest_alliance = alliances[-1]
        else:
            alliance_trend = 0.0
            latest_alliance = None
        
        report = {
            'summary': {
                'total_sessions': len(session_outcomes),
                'duration_days': (latest.timestamp - baseline.timestamp).days,
                'overall_improvement': 'significant' if wellbeing_change > 2 else 'moderate' if wellbeing_change > 0.5 else 'minimal',
                'reliable_change': trajectory.clinically_significant_change,
            },
            'wellbeing': {
                'baseline': baseline.wellbeing_score,
                'current': latest.wellbeing_score,
                'change': wellbeing_change,
                'trend': 'improving' if trajectory.slope_wellbeing > 0.1 else 'stable' if trajectory.slope_wellbeing > -0.1 else 'declining'
            },
            'symptoms': {
                'baseline_reduction': baseline.symptom_reduction,
                'current_reduction': latest.symptom_reduction,
                'change': symptom_change,
                'trend': 'improving' if trajectory.slope_symptoms < -0.05 else 'stable'
            },
            'alliance': {
                'current_score': latest_alliance.overall_alliance if latest_alliance else None,
                'trend': 'strengthening' if alliance_trend > 0.1 else 'stable',
                'ruptures': sum(1 for a in alliances if a.rupture_detected),
                'successful_repairs': sum(1 for a in alliances if a.rupture_detected and a.repair_attempted)
            },
            'engagement': {
                'homework_completion_rate': sum(o.action_items_completed for o in session_outcomes) / 
                                           max(sum(o.action_items_total for o in session_outcomes), 1),
                'satisfaction_average': np.mean([o.user_satisfaction for o in session_outcomes]),
                'dropout_risk': trajectory.risk_of_dropout
            },
            'concerns': [],
            'strengths': []
        }
        
        # Identify concerns
        if trajectory.deterioration_detected:
            report['concerns'].append("Wellbeing scores declining - immediate attention needed")
        if trajectory.plateau_detected:
            report['concerns'].append("Progress plateau detected - consider intervention change")
        if trajectory.risk_of_dropout > 0.6:
            report['concerns'].append("High dropout risk - increase engagement strategies")
        if latest.risk_level in ['moderate', 'high']:
            report['concerns'].append(f"{latest.risk_level.capitalize()} risk level detected")
        
        # Identify strengths
        if trajectory.sudden_gain_detected:
            report['strengths'].append("Sudden gain occurred - breakthrough moment")
        if trajectory.clinically_significant_change:
            report['strengths'].append("Clinically significant improvement achieved")
        if report['engagement']['homework_completion_rate'] > 0.7:
            report['strengths'].append("Excellent homework adherence")
        
        return report


# Global tracker cache
_progress_trackers: Dict[str, TherapeuticProgressTracker] = {}


def get_progress_tracker(user_id: str) -> TherapeuticProgressTracker:
    """Get or create progress tracker for user"""
    if user_id not in _progress_trackers:
        _progress_trackers[user_id] = TherapeuticProgressTracker(user_id)
    return _progress_trackers[user_id]
