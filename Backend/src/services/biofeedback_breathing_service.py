"""
Biofeedback Breathing Service - HRV Resonance Detection
Real-time physiological feedback for guided breathing exercises.

SAFETY NOTICE:
- All exercises are designed for adults in reasonable health
- Users with asthma, COPD, cardiovascular disease, or anxiety
  should consult a physician before extended breathing exercises
- HRV-based feedback is informational only, not medical advice
- Heavy breathing exercises (4-7-8) should start at 2-3 minutes
  and be extended gradually if no side effects occur

Psychological basis:
- HRV (Heart Rate Variability) resonance at ~0.1Hz (6 breaths/min)
- RSA (Respiratory Sinus Arrhythmia) maximization
- Cardiac coherence training (McCraty & Childre, HeartMath Institute)
"""

import logging

# WebSocket support — flask-socketio is a REQUIRED dependency (see requirements.txt)
import os as _os
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any

import numpy as np

try:
    from flask_socketio import SocketIO, emit, join_room, leave_room
    SOCKETIO_AVAILABLE = True
except ImportError:
    SOCKETIO_AVAILABLE = False
    _B2_MSG = (
        "[B2] flask-socketio is not installed — WebSocket biofeedback is DISABLED. "
        "Run: pip install flask-socketio==5.3.7  (or rebuild the Docker image)."
    )
    if _os.getenv('FLASK_ENV', 'development') == 'production':
        logging.critical(_B2_MSG)
    else:
        logging.warning(_B2_MSG)

from src.firebase_config import db
from src.services.audit_service import audit_log

logger = logging.getLogger(__name__)

# Safety thresholds for heart rate monitoring
HEART_RATE_ALERT_THRESHOLD = 120  # BPM - if exceeded, recommend abort
HEART_RATE_CRITICAL_THRESHOLD = 140  # BPM - very high, user should stop
NORMAL_HEART_RATE_RANGE = (40, 100)  # Resting HR range


class BreathingPattern(Enum):
    """Evidence-based breathing patterns for different goals."""
    COHERENCE_6BPM = "coherence_6bpm"  # 0.1Hz - optimal HRV resonance
    RELAX_478 = "relax_478"  # 4-7-8 pattern (Weil) - strong effect, start low
    ENERGIZE_555 = "energize_555"  # Box breathing (Navy SEALs)
    SLEEP_446 = "sleep_446"  # For sleep onset
    CUSTOM = "custom"  # User-defined


@dataclass
class HRVMetrics:
    """Heart Rate Variability metrics from real-time data."""
    timestamp: datetime
    heart_rate: float  # BPM
    rr_intervals: list[float]  # R-R intervals in ms
    sdnn: float  # Standard deviation of NN intervals
    rmssd: float  # Root mean square of successive differences
    coherence_ratio: float  # LF/HF ratio
    resonance_score: float  # 0-100, how close to optimal 0.1Hz
    breath_sync_quality: float  # 0-1, synchronization with guide


@dataclass
class BreathingSession:
    """Biofeedback breathing session data."""
    session_id: str
    user_id: str
    pattern: BreathingPattern
    start_time: datetime
    target_duration: int  # minutes
    hrv_data: list[HRVMetrics] = None
    coherence_score: float = 0.0
    resonance_achieved: bool = False
    end_time: datetime | None = None


@dataclass
class RealTimeFeedback:
    """Real-time feedback for the user."""
    phase: str  # 'inhale', 'hold', 'exhale', 'hold_empty'
    phase_progress: float  # 0.0 - 1.0
    target_breath_rate: float  # breaths per minute
    current_heart_rate: float
    coherence_indicator: float  # 0-100
    resonance_indicator: float  # 0-100
    guidance: str  # "Breathe slower", "Perfect!", "Slightly deeper"
    visualization_data: dict[str, Any]  # For animated circle/ball


class HRVAnalyzer:
    """
    HRV analysis for biofeedback breathing.
    Implements resonance frequency detection (Lehrer et al., 2003).
    """

    # Optimal resonance frequency: ~0.1 Hz (6 breaths/min)
    RESONANCE_FREQ = 0.1  # Hz
    RESONANCE_RANGE = (0.08, 0.12)  # Acceptable resonance band

    def __init__(self):
        self.window_size = 30  # seconds for HRV calculation
        self.sampling_rate = 5  # Hz for interpolation

    def calculate_hrv_metrics(self, rr_intervals: list[float],
                              timestamps: list[datetime]) -> HRVMetrics:
        """
        Calculate HRV metrics from R-R intervals.

        Args:
            rr_intervals: List of R-R intervals in milliseconds
            timestamps: Corresponding timestamps

        Returns:
            HRVMetrics with resonance scoring
        """
        if len(rr_intervals) < 10:
            return self._empty_metrics()

        try:
            # Convert to numpy
            rr = np.array(rr_intervals)

            # Basic time-domain metrics
            sdnn = np.std(rr, ddof=1)

            # RMSSD
            diff_rr = np.diff(rr)
            rmssd = np.sqrt(np.mean(diff_rr ** 2))

            # Heart rate
            heart_rate = 60000 / np.mean(rr)

            # Frequency domain - interpolate for even sampling
            interpolated = self._interpolate_rr(rr, timestamps)

            if len(interpolated) > 10:
                # FFT for frequency analysis
                freqs, power = self._calculate_psd(interpolated)

                # LF (0.04-0.15 Hz) and HF (0.15-0.4 Hz) power
                lf_mask = (freqs >= 0.04) & (freqs <= 0.15)
                hf_mask = (freqs >= 0.15) & (freqs <= 0.4)

                lf_power = np.sum(power[lf_mask])
                hf_power = np.sum(power[hf_mask])

                coherence_ratio = lf_power / hf_power if hf_power > 0 else 0

                # Resonance score: power in 0.08-0.12 Hz band
                resonance_mask = (freqs >= self.RESONANCE_RANGE[0]) & \
                                (freqs <= self.RESONANCE_RANGE[1])
                resonance_power = np.sum(power[resonance_mask])
                total_power = np.sum(power)

                resonance_score = (resonance_power / total_power * 100) \
                                 if total_power > 0 else 0
            else:
                coherence_ratio = 0
                resonance_score = 0

            return HRVMetrics(
                timestamp=datetime.now(),
                heart_rate=heart_rate,
                rr_intervals=rr_intervals,
                sdnn=sdnn,
                rmssd=rmssd,
                coherence_ratio=coherence_ratio,
                resonance_score=min(100, resonance_score),
                breath_sync_quality=0.0  # Calculated separately
            )

        except Exception as e:
            logger.error(f"HRV calculation failed: {e}")
            return self._empty_metrics()

    def _interpolate_rr(self, rr_intervals: np.ndarray,
                       timestamps: list[datetime]) -> np.ndarray:
        """Interpolate R-R intervals to even time grid."""
        try:
            # Convert timestamps to seconds
            [(ts - timestamps[0]).total_seconds()
                    for ts in timestamps]

            # Cumulative time
            cum_time = np.cumsum(rr_intervals) / 1000.0  # Convert to seconds

            # Create even grid
            grid_time = np.arange(0, cum_time[-1], 1.0 / self.sampling_rate)

            # Interpolate
            interpolated = np.interp(grid_time, cum_time, rr_intervals)

            return interpolated

        except Exception:
            return rr_intervals

    def _calculate_psd(self, signal: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Calculate power spectral density."""
        try:
            # Welch's method for PSD
            from scipy import signal as scipy_signal
            freqs, power = scipy_signal.welch(
                signal,
                fs=self.sampling_rate,
                nperseg=min(256, len(signal) // 4)
            )
            return freqs, power
        except ImportError:
            # Fallback: simple FFT
            n = len(signal)
            fft = np.fft.fft(signal)
            power = np.abs(fft) ** 2
            freqs = np.fft.fftfreq(n, 1.0 / self.sampling_rate)

            # Keep positive frequencies only
            pos_mask = freqs > 0
            return freqs[pos_mask], power[pos_mask]
        except Exception:
            return np.array([0]), np.array([0])

    def _empty_metrics(self) -> HRVMetrics:
        """Return empty metrics when calculation fails."""
        return HRVMetrics(
            timestamp=datetime.now(),
            heart_rate=0,
            rr_intervals=[],
            sdnn=0,
            rmssd=0,
            coherence_ratio=0,
            resonance_score=0,
            breath_sync_quality=0
        )

    def detect_resonance_breathing_rate(self, hrv_history: list[HRVMetrics]) -> float:
        """
        Detect user's personal resonance breathing rate.
        Based on maximum HRV amplitude (Lehrer & Gevirtz, 2014).

        Returns:
            Optimal breaths per minute for this user
        """
        if len(hrv_history) < 5:
            return 6.0  # Default 6 breaths/min

        try:
            # Find the breathing rate that maximizes resonance score
            resonance_scores = [m.resonance_score for m in hrv_history]
            breath_rates = [60.0 / (m.heart_rate / 10) for m in hrv_history]  # Approximate

            if not resonance_scores or not breath_rates:
                return 6.0

            # Find rate with max resonance
            max_idx = np.argmax(resonance_scores)
            optimal_rate = breath_rates[max_idx]

            # Constrain to reasonable range (4-8 breaths/min)
            return max(4.0, min(8.0, optimal_rate))

        except Exception:
            return 6.0


class BiofeedbackBreathingService:
    """
    Real-time biofeedback breathing service with WebSocket support.
    Provides HRV-based guidance for optimal breathing.
    """

    def __init__(self, socketio=None):
        self.socketio = socketio
        self.hrv_analyzer = HRVAnalyzer()
        self.active_sessions: dict[str, BreathingSession] = {}
        self.session_data: dict[str, list[HRVMetrics]] = {}

        # Breathing patterns (durations in seconds)
        self.patterns = {
            BreathingPattern.COHERENCE_6BPM: {
                'inhale': 5,
                'hold': 0,
                'exhale': 5,
                'hold_empty': 0,
                'description': 'Cardiac coherence - 6 breaths/min'
            },
            BreathingPattern.RELAX_478: {
                'inhale': 4,
                'hold': 7,
                'exhale': 8,
                'hold_empty': 0,
                'description': '4-7-8 relaxation (Weil)'
            },
            BreathingPattern.ENERGIZE_555: {
                'inhale': 5,
                'hold': 5,
                'exhale': 5,
                'hold_empty': 5,
                'description': 'Box breathing (Navy SEALs)'
            },
            BreathingPattern.SLEEP_446: {
                'inhale': 4,
                'hold': 0,
                'exhale': 6,
                'hold_empty': 0,
                'description': '4-4-6 for sleep onset'
            }
        }

    def start_session(self, user_id: str, pattern_type: str = 'coherence',
                     duration: int = 5) -> BreathingSession:
        """Start a new biofeedback breathing session.

        Args:
            user_id: User ID
            pattern_type: Pattern name - accepts short ('coherence', 'relax', 'energize', 'sleep')
                         or long form ('coherence_6bpm', 'relax_478', etc)
            duration: Target duration in minutes
        """
        # Map short names to enum values
        short_to_enum = {
            'coherence': BreathingPattern.COHERENCE_6BPM,
            'relax': BreathingPattern.RELAX_478,
            'energize': BreathingPattern.ENERGIZE_555,
            'sleep': BreathingPattern.SLEEP_446,
        }

        # Try short name first, then full enum value, then default
        if pattern_type in short_to_enum:
            pattern = short_to_enum[pattern_type]
        else:
            try:
                pattern = BreathingPattern(pattern_type)
            except ValueError:
                pattern = BreathingPattern.COHERENCE_6BPM

        session_id = f"breath_{user_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"

        session = BreathingSession(
            session_id=session_id,
            user_id=user_id,
            pattern=pattern,
            start_time=datetime.now(),
            target_duration=duration,
            hrv_data=[]
        )

        self.active_sessions[session_id] = session
        self.session_data[session_id] = []

        logger.info(f"Started biofeedback session {session_id} for {user_id}")

        return session

    def process_heart_rate_data(self, session_id: str,
                                 rr_intervals: list[float],
                                 timestamps: list[datetime]) -> RealTimeFeedback:
        """
        Process incoming heart rate data and generate real-time feedback.
        Includes safety monitoring for abnormal heart rates.

        This is called when new heart rate data arrives from:
        - Apple Watch (HealthKit)
        - Google Fit
        - Wearable via WebSocket
        """
        if session_id not in self.active_sessions:
            return self._default_feedback()

        session = self.active_sessions[session_id]

        # Calculate HRV metrics
        metrics = self.hrv_analyzer.calculate_hrv_metrics(rr_intervals, timestamps)

        # SAFETY CHECK: Monitor heart rate
        if metrics.heart_rate > HEART_RATE_CRITICAL_THRESHOLD:
            logger.warning(
                f"CRITICAL: Heart rate {metrics.heart_rate} BPM in session "
                f"{session_id} - user should stop immediately"
            )
            # Return feedback with critical warning
            return RealTimeFeedback(
                phase='exhale',
                phase_progress=0.0,
                target_breath_rate=6.0,
                current_heart_rate=metrics.heart_rate,
                coherence_indicator=0,
                resonance_indicator=0,
                guidance=f"🚨 STOPP: Pulsen är {int(metrics.heart_rate)} BPM. Avbryt genast och vila.",
                visualization_data={
                    'circle_scale': 0.5,
                    'color_hue': 0,  # Red
                    'coherence_ring': 0,
                    'phase_indicator': 'critical_stop'
                }
            )

        # Store
        self.session_data[session_id].append(metrics)

        # Calculate session coherence
        if len(self.session_data[session_id]) > 0:
            recent_scores = [m.resonance_score for m in self.session_data[session_id][-5:]]
            session.coherence_score = np.mean(recent_scores)
            session.resonance_achieved = any(s > 60 for s in recent_scores)

        # Generate real-time guidance
        feedback = self._generate_feedback(session, metrics)

        # Broadcast via WebSocket if available
        if self.socketio and SOCKETIO_AVAILABLE:
            self._emit_feedback(session.user_id, feedback)

        return feedback

    def _generate_feedback(self, session: BreathingSession,
                          metrics: HRVMetrics) -> RealTimeFeedback:
        """Generate personalized real-time breathing guidance."""

        pattern_config = self.patterns[session.pattern]

        # Calculate current phase based on time
        elapsed = (datetime.now() - session.start_time).total_seconds()
        # Sum only numeric duration values (exclude 'description')
        cycle_duration = sum(v for v in pattern_config.values() if isinstance(v, (int, float)))
        (elapsed % cycle_duration) / cycle_duration if cycle_duration > 0 else 0

        # Determine phase
        phase, phase_progress = self._get_phase_and_progress(
            pattern_config, elapsed % cycle_duration
        )

        # Calculate resonance quality
        resonance = metrics.resonance_score

        # Generate guidance based on HRV
        if resonance < 30:
            guidance = "Försök slappna av mer i axlar och käke"
        elif resonance < 50:
            guidance = "Bra! Försök andas lite djupare"
        elif resonance < 70:
            guidance = "Utmärkt! Håll denna rytm"
        else:
            guidance = "Perfekt! Du har hittat resonans"

        # Target breath rate
        target_rate = 60.0 / (pattern_config['inhale'] + pattern_config['exhale'])

        # Visualization data for animated circle
        visualization = {
            'circle_scale': 0.5 + 0.5 * phase_progress if phase == 'inhale' else
                           1.0 - 0.5 * phase_progress if phase == 'exhale' else 0.5,
            'color_hue': 120 + (resonance / 100) * 60,  # Green to blue
            'coherence_ring': resonance / 100,
            'phase_indicator': phase
        }

        return RealTimeFeedback(
            phase=phase,
            phase_progress=phase_progress,
            target_breath_rate=target_rate,
            current_heart_rate=metrics.heart_rate,
            coherence_indicator=session.coherence_score,
            resonance_indicator=resonance,
            guidance=guidance,
            visualization_data=visualization
        )

    def _get_phase_and_progress(self, pattern: dict, elapsed_in_cycle: float) -> tuple[str, float]:
        """Determine current breathing phase and progress."""
        phases = [
            ('inhale', pattern.get('inhale', 0)),
            ('hold', pattern.get('hold', 0)),
            ('exhale', pattern.get('exhale', 0)),
            ('hold_empty', pattern.get('hold_empty', 0))
        ]

        cumulative = 0
        for phase_name, duration in phases:
            if duration == 0:
                continue
            if elapsed_in_cycle <= cumulative + duration:
                progress = (elapsed_in_cycle - cumulative) / duration
                return phase_name, progress
            cumulative += duration

        return 'inhale', 0.0

    def _emit_feedback(self, user_id: str, feedback: RealTimeFeedback):
        """Emit real-time feedback via WebSocket."""
        if not SOCKETIO_AVAILABLE:
            return

        try:
            emit('biofeedback_update', {
                'phase': feedback.phase,
                'phase_progress': feedback.phase_progress,
                'target_breath_rate': feedback.target_breath_rate,
                'heart_rate': feedback.current_heart_rate,
                'coherence': feedback.coherence_indicator,
                'resonance': feedback.resonance_indicator,
                'guidance': feedback.guidance,
                'visualization': feedback.visualization_data,
                'timestamp': datetime.now().isoformat()
            }, room=user_id)
        except Exception as e:
            logger.error(f"WebSocket emit failed: {e}")

    def end_session(self, session_id: str) -> dict[str, Any]:
        """End session and return summary."""
        if session_id not in self.active_sessions:
            return {}

        session = self.active_sessions[session_id]
        session.end_time = datetime.now()

        # Calculate summary statistics
        hrv_data = self.session_data.get(session_id, [])

        summary = {
            'session_id': session_id,
            'duration_minutes': (session.end_time - session.start_time).seconds / 60,
            'pattern': session.pattern.value,
            'avg_coherence': session.coherence_score,
            'resonance_achieved': session.resonance_achieved,
            'avg_heart_rate': np.mean([m.heart_rate for m in hrv_data]) if hrv_data else 0,
            'hrv_improvement': self._calculate_hrv_improvement(hrv_data),
            'data_points': len(hrv_data)
        }

        # Save to Firestore
        self._save_session_summary(session, summary)

        # Cleanup
        del self.active_sessions[session_id]
        del self.session_data[session_id]

        return summary

    def _calculate_hrv_improvement(self, hrv_data: list[HRVMetrics]) -> float:
        """Calculate HRV improvement during session."""
        if len(hrv_data) < 4:
            return 0.0

        first_half = hrv_data[:len(hrv_data)//2]
        second_half = hrv_data[len(hrv_data)//2:]

        first_rmssd = np.mean([m.rmssd for m in first_half])
        second_rmssd = np.mean([m.rmssd for m in second_half])

        if first_rmssd == 0:
            return 0.0

        improvement = ((second_rmssd - first_rmssd) / first_rmssd) * 100
        return improvement

    def _save_session_summary(self, session: BreathingSession, summary: dict):
        """Save session to Firestore."""
        try:
            db.collection('breathing_sessions').document(session.session_id).set({
                'user_id': session.user_id,
                'session_id': session.session_id,
                'start_time': session.start_time,
                'end_time': session.end_time,
                'pattern': session.pattern.value,
                'summary': summary,
                'hrv_data_count': len(self.session_data.get(session.session_id, [])),
                'created_at': datetime.now()
            })

            # Audit log
            audit_log(
                event_type="BREATHING_SESSION_COMPLETED",
                user_id=session.user_id,
                details={
                    "session_id": session.session_id,
                    "pattern": session.pattern.value,
                    "coherence": summary['avg_coherence'],
                    "resonance_achieved": summary['resonance_achieved']
                }
            )

        except Exception as e:
            logger.error(f"Failed to save breathing session: {e}")

    def _default_feedback(self) -> RealTimeFeedback:
        """Return default feedback when session not found."""
        return RealTimeFeedback(
            phase='inhale',
            phase_progress=0.0,
            target_breath_rate=6.0,
            current_heart_rate=0,
            coherence_indicator=0,
            resonance_indicator=0,
            guidance='Starta session för biofeedback',
            visualization_data={'circle_scale': 0.5, 'color_hue': 120}
        )


# Singleton instance
_biofeedback_service: BiofeedbackBreathingService | None = None


def get_biofeedback_service(socketio=None) -> BiofeedbackBreathingService:
    """Get singleton instance of biofeedback service."""
    global _biofeedback_service
    if _biofeedback_service is None:
        _biofeedback_service = BiofeedbackBreathingService(socketio)
    return _biofeedback_service
