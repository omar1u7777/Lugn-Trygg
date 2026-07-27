"""
Real-time Crisis Monitoring via WebSockets.
Monitors active chat sessions for immediate crisis intervention.
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

# Flask-SocketIO integration
try:
    from flask_socketio import SocketIO, emit, join_room, leave_room
    SOCKETIO_AVAILABLE = True
except ImportError:
    SOCKETIO_AVAILABLE = False
    SocketIO = None

logger = logging.getLogger(__name__)


@dataclass
class SessionContext:
    """Context for an active monitoring session."""
    user_id: str
    session_id: str
    started_at: datetime
    messages: list
    risk_accumulator: float = 0.0
    last_intervention: datetime | None = None


class CrisisMonitorWebSocket:
    """
    Real-time WebSocket monitoring during chat sessions.
    Detects crisis patterns and triggers immediate interventions.
    """

    def __init__(self, socketio: Optional['SocketIO'] = None):
        logger.info("📡 Initializing Crisis Monitor WebSocket...")

        self.socketio = socketio
        self.active_sessions: dict[str, SessionContext] = {}

        # Initialize semantic crisis detector
        try:
            from ..services.crisis_nlp import get_semantic_crisis_detector
            self.crisis_detector = get_semantic_crisis_detector()
        except Exception as e:
            logger.warning(f"Could not load semantic detector: {e}")
            self.crisis_detector = None

        logger.info("✅ Crisis Monitor WebSocket initialized")

    def register_handlers(self):
        """Register SocketIO event handlers."""
        if not self.socketio or not SOCKETIO_AVAILABLE:
            logger.warning("SocketIO not available, skipping handler registration")
            return

        @self.socketio.on('connect', namespace='/crisis-monitor')
        def handle_connect():
            logger.info(f"Client connected to crisis monitor: {asyncio.current_task()}")

        @self.socketio.on('start_session', namespace='/crisis-monitor')
        def handle_start_session(data):
            user_id = data.get('user_id')
            session_id = data.get('session_id')

            if user_id and session_id:
                self._start_session(user_id, session_id)
                join_room(session_id)
                emit('session_started', {'status': 'monitoring_active'})

        @self.socketio.on('user_message', namespace='/crisis-monitor')
        def handle_user_message(data):
            session_id = data.get('session_id')
            message = data.get('message')

            if session_id and message:
                # Flask-SocketIO's async_mode='threading' runs this handler in
                # a plain OS thread with no running asyncio event loop, so
                # asyncio.create_task() here would raise "no running event
                # loop" immediately and _process_message (which contains all
                # crisis detection/escalation) would never execute. Run it to
                # completion via a dedicated loop instead — the same pattern
                # crisis_task_queue.py uses to call async escalation code from
                # a sync worker thread. Nested awaits/create_task calls further
                # down the stack (e.g. _trigger_immediate_intervention) are
                # fine because a loop is running for the duration of this call.
                loop = asyncio.new_event_loop()
                try:
                    asyncio.set_event_loop(loop)
                    loop.run_until_complete(self._process_message(session_id, message))
                finally:
                    loop.close()

        @self.socketio.on('disconnect', namespace='/crisis-monitor')
        def handle_disconnect():
            # Clean up session
            for session_id, _context in list(self.active_sessions.items()):
                leave_room(session_id)
                self._end_session(session_id)

    def _start_session(self, user_id: str, session_id: str):
        """Start monitoring a new session."""
        self.active_sessions[session_id] = SessionContext(
            user_id=user_id,
            session_id=session_id,
            started_at=datetime.now(),
            messages=[]
        )
        logger.info(f"Started crisis monitoring for user {user_id[:8]}...")

    def _end_session(self, session_id: str):
        """End monitoring for a session."""
        if session_id in self.active_sessions:
            del self.active_sessions[session_id]
            logger.info(f"Ended crisis monitoring for session {session_id[:8]}...")

    async def _process_message(self, session_id: str, message: str):
        """Process incoming message for crisis detection."""
        session = self.active_sessions.get(session_id)
        if not session:
            return

        # Add to session context
        session.messages.append({
            'role': 'user',
            'content': message,
            'timestamp': datetime.now()
        })

        # Real-time crisis detection
        if self.crisis_detector:
            try:
                # Get recent context
                recent_context = session.messages[-5:]

                risk = self.crisis_detector.detect(message, recent_context)

                # Accumulate risk score
                session.risk_accumulator = (
                    session.risk_accumulator * 0.7 + risk.semantic_score * 0.3
                )

                # Check for immediate intervention
                if risk.requires_immediate_attention:
                    await self._trigger_immediate_intervention(session, risk)

                # Check for escalating pattern
                elif session.risk_accumulator > 0.6:
                    await self._trigger_early_intervention(session)

                # Send risk update to frontend
                if self.socketio:
                    self.socketio.emit(
                        'risk_update',
                        {
                            'risk_level': risk.risk_level,
                            'accumulator': session.risk_accumulator,
                            'timestamp': datetime.now().isoformat()
                        },
                        room=session_id,
                        namespace='/crisis-monitor'
                    )

            except Exception as e:
                logger.error(f"Crisis detection failed: {e}")

    async def _trigger_immediate_intervention(self, session: SessionContext, risk):
        """Trigger immediate intervention during active session."""
        now = datetime.now()

        # Prevent spam - max 1 intervention per 5 minutes
        if session.last_intervention and (now - session.last_intervention).seconds < 300:
            return

        session.last_intervention = now

        # Select appropriate intervention based on risk
        if risk.risk_level == 'critical':
            intervention = self._get_critical_intervention()
        else:
            intervention = self._get_high_risk_intervention()

        # Send to client
        if self.socketio:
            self.socketio.emit(
                'immediate_intervention',
                {
                    'type': intervention['type'],
                    'content': intervention['content'],
                    'actions': intervention['actions'],
                    'risk_level': risk.risk_level
                },
                room=session.session_id,
                namespace='/crisis-monitor'
            )

        # Trigger backend escalation (async, non-blocking)
        asyncio.create_task(self._escalate_crisis(session, risk))

    async def _trigger_early_intervention(self, session: SessionContext):
        """Trigger early intervention before crisis escalates."""
        now = datetime.now()

        # Prevent spam
        if session.last_intervention and (now - session.last_intervention).seconds < 600:
            return

        session.last_intervention = now

        intervention = {
            'type': 'grounding_offer',
            'content': 'Jag märker att du verkar ha det tufft. Vill du prova en snabb grounding-övning?',
            'actions': [
                {'id': 'grounding_5_4_3_2_1', 'label': 'Ja, 5-4-3-2-1', 'type': 'exercise'},
                {'id': 'breathing', 'label': 'Andningsövning', 'type': 'exercise'},
                {'id': 'continue_chat', 'label': 'Fortsätt prata', 'type': 'chat'}
            ]
        }

        if self.socketio:
            self.socketio.emit(
                'early_intervention',
                intervention,
                room=session.session_id,
                namespace='/crisis-monitor'
            )

    def _get_critical_intervention(self) -> dict:
        """Get intervention for critical risk level."""
        return {
            'type': 'critical_crisis',
            'content': (
                'Vi ser att du har det mycket svårt just nu. '
                'Du är inte ensam. Vill du ha omedelbar hjälp?'
            ),
            'actions': [
                {
                    'id': 'call_112',
                    'label': '🚨 Ring 112 (akut)',
                    'type': 'phone',
                    'number': '112'
                },
                {
                    'id': 'call_crisis',
                    'label': '📞 Krisjouren 90101',
                    'type': 'phone',
                    'number': '90101'
                },
                {
                    'id': 'grounding',
                    'label': '🧘 Snabb grounding',
                    'type': 'exercise'
                }
            ]
        }

    def _get_high_risk_intervention(self) -> dict:
        """Get intervention for high risk level."""
        return {
            'type': 'high_risk',
            'content': (
                'Jag märker att du har det tufft. '
                'Det finns hjälp tillgänglig. Vill du prova något?'
            ),
            'actions': [
                {
                    'id': 'safety_plan',
                    'label': '📋 Min säkerhetsplan',
                    'type': 'navigation'
                },
                {
                    'id': 'breathing',
                    'label': '🫁 Andning',
                    'type': 'exercise'
                },
                {
                    'id': 'call_support',
                    'label': '📞 Prata med någon',
                    'type': 'phone',
                    'number': '90101'
                }
            ]
        }

    async def _escalate_crisis(self, session: SessionContext, risk):
        """Escalate crisis detected over the WebSocket biofeedback/session
        monitor to the durable crisis queue.

        Previously called escalation_service.escalate(alert) directly and
        discarded the result — the exact loss mode the durable
        /crisis_tasks queue was built to eliminate (a worker recycle mid-call
        loses the alert with no retry and no telemetry.critical) was still
        live on this second path. Routed through enqueue_crisis_escalation()
        now so this path gets the same at-least-once delivery, exponential
        backoff and exhausted-retry alerting as the /chat and /chat/stream
        entry points.
        """
        try:
            from datetime import UTC

            from .crisis_escalation import CrisisAlert
            from .crisis_task_queue import (
                CrisisQueueUnavailableError,
                enqueue_crisis_escalation,
            )

            alert = CrisisAlert(
                user_id=session.user_id,
                risk_level=risk.risk_level,
                risk_score=risk.semantic_score,
                detected_indicators=risk.semantic_indicators,
                text_snippet=session.messages[-1]['content'][:200] if session.messages else "",
                timestamp=datetime.now(UTC),
                requires_immediate_action=risk.risk_level == 'critical'
            )

            try:
                enqueue_crisis_escalation(alert)
            except CrisisQueueUnavailableError:
                logger.critical(
                    "🚨 WebSocket crisis escalation could not be queued for user=%s. "
                    "REQUIRES MANUAL REVIEW.", session.user_id,
                )

        except Exception as e:
            logger.error(f"Crisis escalation failed: {e}")


# Singleton
_crisis_monitor: CrisisMonitorWebSocket | None = None


def get_crisis_monitor(socketio=None) -> CrisisMonitorWebSocket:
    """Get or create crisis monitor."""
    global _crisis_monitor
    if _crisis_monitor is None:
        _crisis_monitor = CrisisMonitorWebSocket(socketio)
    return _crisis_monitor
