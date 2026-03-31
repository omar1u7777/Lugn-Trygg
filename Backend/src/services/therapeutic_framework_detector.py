"""
Therapeutic Framework Detection Service
Detects and tracks evidence-based therapeutic approaches in conversations
Implements CBT, ACT, DBT, and Person-Centered therapy pattern recognition
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Tuple, Any
import re

import numpy as np

logger = logging.getLogger(__name__)


class TherapeuticFramework(Enum):
    """Evidence-based therapeutic frameworks"""
    CBT = "cognitive_behavioral_therapy"
    ACT = "acceptance_commitment_therapy"
    DBT = "dialectical_behavior_therapy"
    PST = "problem_solving_therapy"
    SFT = "solution_focused_therapy"
    PERSON_CENTERED = "person_centered"
    MOTIVATIONAL_INTERVIEWING = "motivational_interviewing"
    UNKNOWN = "unknown"


class CBTTTechnique(Enum):
    """CBT-specific techniques"""
    COGNITIVE_RESTRUCTURING = "cognitive_restructuring"
    BEHAVIORAL_ACTIVATION = "behavioral_activation"
    THOUGHT_RECORDING = "thought_recording"
    BEHAVIORAL_EXPERIMENT = "behavioral_experiment"
    SITUATIONAL_EXPOSURE = "situational_exposure"
    PROBLEM_SOLVING = "problem_solving"
    ACTIVATION_SCHEDULING = "activation_scheduling"


class ACTTechnique(Enum):
    """ACT-specific techniques"""
    COGNITIVE_DEFUSION = "cognitive_defusion"
    ACCEPTANCE = "acceptance"
    VALUES_CLARIFICATION = "values_clarification"
    COMMITTED_ACTION = "committed_action"
    PRESENT_MOMENT = "present_moment"
    SELF_AS_CONTEXT = "self_as_context"


class DBTTechnique(Enum):
    """DBT-specific techniques"""
    MINDFULNESS = "mindfulness"
    DISTRESS_TOLERANCE = "distress_tolerance"
    EMOTION_REGULATION = "emotion_regulation"
    INTERPERSONAL_EFFECTIVENESS = "interpersonal_effectiveness"
    DISTRACTION = "distraction"
    SELF_SOOTHING = "self_soothing"
    IMPROVE = "improve"


@dataclass
class TechniqueDetection:
    """Detected therapeutic technique"""
    framework: TherapeuticFramework
    technique: str
    confidence: float
    evidence: str
    timestamp: datetime


@dataclass
class ConversationQualityMetrics:
    """Evidence-based quality metrics for therapeutic conversations"""
    empathy_score: float  # 0-1 scale
    specificity_score: float  # How specific are suggestions
    collaboration_score: float  # Degree of collaboration
    structure_score: float  # Structured vs unstructured
    technique_usage: Dict[str, int]  # Count of techniques used
    overall_quality: float  # Composite score
    
    # Clinical indicators
    safety_assessment: float  # Crisis/safety assessment quality
    goal_alignment: float  # Alignment with user's goals
    cultural_sensitivity: float  # Cultural awareness


@dataclass
class TherapeuticSession:
    """Complete therapeutic session tracking"""
    session_id: str
    user_id: str
    start_time: datetime
    end_time: Optional[datetime]
    framework: TherapeuticFramework
    techniques_used: List[TechniqueDetection]
    quality_metrics: ConversationQualityMetrics
    emotional_progression: List[Dict]
    key_moments: List[Dict]
    homework_assigned: List[Dict]
    insights_gained: List[str]


class TherapeuticFrameworkDetector:
    """
    Professional therapeutic framework detector using pattern matching
    and semantic analysis to identify evidence-based approaches
    """
    
    def __init__(self):
        self.confidence_threshold = 0.6
        
        # CBT patterns
        self.cbt_patterns = {
            CBTTTechnique.COGNITIVE_RESTRUCTURING: [
                r"tänk.*?annorlunda|omvärdera|utmana.*?tank.*?|bevis.*?eller.*?bevis",
                r"cognitive|reframe|challenge.*?thought|evidence.*?against",
            ],
            CBTTTechnique.BEHAVIORAL_ACTIVATION: [
                r"aktivitet.*?plan|göra.*?något|beteende.*?experiment",
                r"behavioral activation|activity schedule|pleasant events",
            ],
            CBTTTechnique.THOUGHT_RECORDING: [
                r"tank.*?dagbok|skriv.*?ner.*?tank|logga.*?tank",
                r"thought record|thought diary|automatic thoughts",
            ],
            CBTTTechnique.SITUATIONAL_EXPOSURE: [
                r"exponering|gradvis.*?närma|konfrontera.*?rädsl",
                r"exposure|gradual approach|face.*?fear|hierarchy",
            ],
            CBTTTechnique.BEHAVIORAL_EXPERIMENT: [
                r"test.*?hypotes|experiment|pröva.*?beteende",
                r"behavioral experiment|test.*?hypothesis|try.*?behavior",
            ],
        }
        
        # ACT patterns
        self.act_patterns = {
            ACTTechnique.COGNITIVE_DEFUSION: [
                r"defusion|tank.*?buss|molntank|tack.*?hjärnan",
                r"cognitive defusion|thoughts are just|leaves on a stream",
            ],
            ACTTechnique.ACCEPTANCE: [
                r"acceptera|tillåta|välkomna.*?känsl|opening up",
                r"acceptance|allow.*?feeling|make room for|open up",
            ],
            ACTTechnique.VALUES_CLARIFICATION: [
                r"värdering.*?|vad.*?viktigt.*?för dig|liv.*?riktning",
                r"values|what matters|life direction|valued living",
            ],
            ACTTechnique.COMMITTED_ACTION: [
                r"åtagande|handling|commitment|konkret.*?steg",
                r"committed action|concrete step|do what matters",
            ],
            ACTTechnique.PRESENT_MOMENT: [
                r"närvaro|här och nu|mindfulness|förankring",
                r"present moment|here and now|grounding|anchor",
            ],
        }
        
        # DBT patterns
        self.dbt_patterns = {
            DBTTechnique.MINDFULNESS: [
                r"mindfulness|medveten.*?närvaro|observera|beskriva|delta",
                r"wise mind|observe describe participate|non-judgmental",
            ],
            DBTTechnique.DISTRESS_TOLERANCE: [
                r"distress tolerance|crisis survival|distrahera|self-soothe",
                r"kris.*?överlevnad|akut.*?ångest|distraktion|lindra.*?(smärta|ångest)",
            ],
            DBTTechnique.EMOTION_REGULATION: [
                r"emotion regulation|opposite action|check facts|emotional mind",
                r"känsloreglering|motsatt.*?handling|faktagranskning",
            ],
            DBTTechnique.INTERPERSONAL_EFFECTIVENESS: [
                r"interpersonal|DEAR MAN|GIVE|FAST|relationship",
                r"mellanmänsklig|kommunikation.*?färdighet|snälla.*?(bestämd|tuff)",
            ],
            DBTTechnique.DISTRACTION: [
                r" Wise mind ACCEPTS|activities|contributing|comparisons",
                r"accepterar|aktiviteter|bidra|jämförelser|jämnar ut",
            ],
            DBTTechnique.IMPROVE: [
                r"IMPROVE|imagery|meaning|prayer|relaxation|vacation|encouragement",
                r"förbättra|inre.*?bilder|betydelse|avslappning|semester",
            ],
        }
    
    def detect_framework(self, message: str) -> Tuple[TherapeuticFramework, float]:
        """
        Detect the primary therapeutic framework used in a message
        
        Returns:
            Tuple of (framework, confidence_score)
        """
        message_lower = message.lower()
        
        framework_scores: Dict[TherapeuticFramework, float] = {
            TherapeuticFramework.CBT: 0.0,
            TherapeuticFramework.ACT: 0.0,
            TherapeuticFramework.DBT: 0.0,
        }
        
        # Check CBT patterns
        cbt_score = 0.0
        cbt_matches = 0
        for technique, patterns in self.cbt_patterns.items():
            for pattern in patterns:
                if re.search(pattern, message_lower, re.IGNORECASE):
                    cbt_score += 0.3
                    cbt_matches += 1
        framework_scores[TherapeuticFramework.CBT] = min(cbt_score, 1.0)
        
        # Check ACT patterns
        act_score = 0.0
        act_matches = 0
        for technique, patterns in self.act_patterns.items():
            for pattern in patterns:
                if re.search(pattern, message_lower, re.IGNORECASE):
                    act_score += 0.3
                    act_matches += 1
        framework_scores[TherapeuticFramework.ACT] = min(act_score, 1.0)
        
        # Check DBT patterns
        dbt_score = 0.0
        dbt_matches = 0
        for technique, patterns in self.dbt_patterns.items():
            for pattern in patterns:
                if re.search(pattern, message_lower, re.IGNORECASE):
                    dbt_score += 0.3
                    dbt_matches += 1
        framework_scores[TherapeuticFramework.DBT] = min(dbt_score, 1.0)
        
        # Determine primary framework
        if not any(framework_scores.values()):
            return TherapeuticFramework.PERSON_CENTERED, 0.5
        
        primary_framework = max(framework_scores, key=framework_scores.get)
        confidence = framework_scores[primary_framework]
        
        return primary_framework, confidence
    
    def detect_techniques(self, message: str) -> List[TechniqueDetection]:
        """Detect specific therapeutic techniques used"""
        detected = []
        message_lower = message.lower()
        
        # Check all technique patterns
        all_patterns = [
            (TherapeuticFramework.CBT, self.cbt_patterns),
            (TherapeuticFramework.ACT, self.act_patterns),
            (TherapeuticFramework.DBT, self.dbt_patterns),
        ]
        
        for framework, patterns in all_patterns:
            for technique, pattern_list in patterns.items():
                for pattern in pattern_list:
                    match = re.search(pattern, message_lower, re.IGNORECASE)
                    if match:
                        # Calculate confidence based on match quality
                        confidence = 0.7 + (0.3 * (len(match.group()) / len(message_lower)))
                        
                        detected.append(TechniqueDetection(
                            framework=framework,
                            technique=technique.value,
                            confidence=min(confidence, 0.95),
                            evidence=match.group(),
                            timestamp=datetime.now()
                        ))
                        break  # Only count first match per technique
        
        # Sort by confidence
        detected.sort(key=lambda x: x.confidence, reverse=True)
        return detected[:5]  # Return top 5 techniques
    
    def analyze_conversation_quality(
        self,
        messages: List[Dict],
        user_goals: Optional[List[str]] = None
    ) -> ConversationQualityMetrics:
        """
        Analyze conversation quality using evidence-based metrics
        
        Metrics based on:
        - Hill's Helping Skills Model
        - Working Alliance Inventory
        - Cognitive Therapy Scale
        """
        if not messages:
            return ConversationQualityMetrics(
                empathy_score=0.0,
                specificity_score=0.0,
                collaboration_score=0.0,
                structure_score=0.0,
                technique_usage={},
                overall_quality=0.0,
                safety_assessment=0.0,
                goal_alignment=0.0,
                cultural_sensitivity=0.5
            )
        
        ai_messages = [m for m in messages if m.get('role') == 'assistant']
        user_messages = [m for m in messages if m.get('role') == 'user']
        
        if not ai_messages:
            return ConversationQualityMetrics(
                empathy_score=0.0,
                specificity_score=0.0,
                collaboration_score=0.0,
                structure_score=0.0,
                technique_usage={},
                overall_quality=0.0,
                safety_assessment=0.0,
                goal_alignment=0.0,
                cultural_sensitivity=0.5
            )
        
        # 1. Empathy Score (0-1)
        empathy_markers = [
            "förstår", "förstå", "hör att du", "det låter", "det måste vara",
            "förstår", "förstå", "I hear you", "that sounds", "it must be",
            "känns", "låter jobbigt", "låter svårt", "låter tufft",
            "validate", "acknowledge", "that makes sense"
        ]
        empathy_count = sum(1 for msg in ai_messages
                          for marker in empathy_markers
                          if marker.lower() in msg.get('content', '').lower())
        empathy_score = min(empathy_count / max(len(ai_messages) * 0.5, 1), 1.0)
        
        # 2. Specificity Score (0-1)
        specific_action_words = [
            "nästa gång", "när det händer", "försök", "öva", "konkret",
            "next time", "when this happens", "try", "practice", "specific"
        ]
        specificity_count = sum(1 for msg in ai_messages
                              for word in specific_action_words
                              if word.lower() in msg.get('content', '').lower())
        specificity_score = min(specificity_count / max(len(ai_messages) * 0.3, 1), 1.0)
        
        # 3. Collaboration Score (0-1)
        collaboration_markers = [
            "vad tycker du", "tillsammans", "låt oss", "hur känns det",
            "what do you think", "together", "let's", "how does that feel"
        ]
        collab_count = sum(1 for msg in ai_messages
                          for marker in collaboration_markers
                          if marker.lower() in msg.get('content', '').lower())
        collaboration_score = min(collab_count / max(len(ai_messages) * 0.3, 1), 1.0)
        
        # 4. Structure Score (0-1)
        # Check for agenda, summaries, homework
        structure_markers = [
            "idag ska vi", "sammanfatta", "läxa", "hemuppgift", "till nästa gång",
            "today we will", "to summarize", "homework", "between sessions"
        ]
        structure_count = sum(1 for msg in ai_messages
                             for marker in structure_markers
                             if marker.lower() in msg.get('content', '').lower())
        structure_score = min(structure_count / max(len(ai_messages) * 0.2, 1), 1.0)
        
        # 5. Technique Usage
        all_techniques = []
        for msg in ai_messages:
            techniques = self.detect_techniques(msg.get('content', ''))
            all_techniques.extend(techniques)
        
        technique_usage = {}
        for tech in all_techniques:
            key = f"{tech.framework.value}:{tech.technique}"
            technique_usage[key] = technique_usage.get(key, 0) + 1
        
        # 6. Safety Assessment (0-1)
        safety_keywords = [
            "säkerhet", "säker", "risk", "farligt", "skada", "crisis",
            "safety", "safe", "risk", "dangerous", "harm", "suicide", "self-harm"
        ]
        safety_mentions = sum(1 for msg in ai_messages
                           for keyword in safety_keywords
                           if keyword.lower() in msg.get('content', '').lower())
        safety_score = min(safety_mentions / max(len(ai_messages) * 0.2, 1), 1.0)
        safety_score = max(safety_score, 0.3)  # Minimum for acknowledging safety
        
        # 7. Goal Alignment (0-1)
        goal_score = 0.5
        if user_goals:
            goal_keywords = ' '.join(user_goals).lower().split()
            goal_mentions = sum(1 for msg in ai_messages
                               for keyword in goal_keywords
                               if keyword in msg.get('content', '').lower())
            goal_score = min(goal_mentions / max(len(ai_messages) * 0.2, 1), 1.0)
            goal_score = max(goal_score, 0.3)
        
        # Calculate overall quality (weighted composite)
        overall_quality = (
            empathy_score * 0.25 +
            specificity_score * 0.20 +
            collaboration_score * 0.15 +
            structure_score * 0.15 +
            safety_score * 0.15 +
            goal_score * 0.10
        )
        
        return ConversationQualityMetrics(
            empathy_score=empathy_score,
            specificity_score=specificity_score,
            collaboration_score=collaboration_score,
            structure_score=structure_score,
            technique_usage=technique_usage,
            overall_quality=overall_quality,
            safety_assessment=safety_score,
            goal_alignment=goal_score,
            cultural_sensitivity=0.7  # Baseline, could be improved with more analysis
        )
    
    def generate_therapeutic_recommendations(
        self,
        current_framework: TherapeuticFramework,
        quality_metrics: ConversationQualityMetrics,
        user_progress: Optional[Dict] = None
    ) -> List[Dict]:
        """
        Generate evidence-based recommendations for improving therapy
        """
        recommendations = []
        
        # Empathy recommendations
        if quality_metrics.empathy_score < 0.6:
            recommendations.append({
                'area': 'empathy',
                'priority': 'high',
                'recommendation': 'Increase reflective statements and validation',
                'example': "Det låter som att det har varit riktigt tufft för dig...",
                'evidence': 'Carl Rogers\' research shows empathy is the strongest predictor of outcomes'
            })
        
        # Specificity recommendations
        if quality_metrics.specificity_score < 0.5:
            recommendations.append({
                'area': 'specificity',
                'priority': 'medium',
                'recommendation': 'Provide more concrete, actionable suggestions',
                'example': "Nästa gång du känner ångest, prova 5-4-3-2-1 tekniken...",
                'evidence': 'Behavioral specificity increases treatment adherence'
            })
        
        # Structure recommendations
        if quality_metrics.structure_score < 0.4:
            recommendations.append({
                'area': 'structure',
                'priority': 'medium',
                'recommendation': 'Add clear agenda and summaries',
                'example': "Låt oss sammanfatta vad vi pratat om idag...",
                'evidence': 'Structured therapy shows better outcomes in research'
            })
        
        # Framework-specific recommendations
        if current_framework == TherapeuticFramework.CBT:
            if 'cognitive_restructuring' not in str(quality_metrics.technique_usage):
                recommendations.append({
                    'area': 'technique',
                    'priority': 'medium',
                    'recommendation': 'Introduce cognitive restructuring',
                    'example': "Låt oss titta på bevisen för och emot den tanken...",
                    'evidence': 'Cognitive restructuring is a core CBT technique with strong evidence'
                })
        
        elif current_framework == TherapeuticFramework.ACT:
            if 'values' not in str(quality_metrics.technique_usage).lower():
                recommendations.append({
                    'area': 'technique',
                    'priority': 'high',
                    'recommendation': 'Explore values clarification',
                    'example': "Vad är viktigast för dig i livet?",
                    'evidence': 'Values-based action is central to ACT effectiveness'
                })
        
        return recommendations


# Global detector instance
framework_detector = TherapeuticFrameworkDetector()


def get_framework_detector() -> TherapeuticFrameworkDetector:
    """Get singleton instance of framework detector"""
    return framework_detector
