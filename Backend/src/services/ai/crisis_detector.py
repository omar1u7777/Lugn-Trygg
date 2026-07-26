"""Crisis indicator detection and crisis response text.

Clinical-safety critical: keyword/severity logic must remain deterministic and
dependency-free so it cannot degrade when external AI providers fail.
"""

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


class CrisisDetector:
    """Single responsibility: detect crisis indicators and produce crisis responses."""

    def __init__(self, svc):
        self._svc = svc

    def detect_crisis(self, text: str) -> bool:
        """
        Simple boolean check for crisis indicators
        Returns True if crisis indicators are detected
        """
        crisis_result = self._svc.detect_crisis_indicators(text)
        return crisis_result.get("requires_immediate_attention", False)

    def detect_crisis_indicators(self, text: str) -> dict[str, Any]:
        """
        Detect potential crisis indicators in user text
        Critical for mental health apps - requires immediate attention
        """
        svc = self._svc
        crisis_keywords = {
            "suicidal": ["döda mig", "ta livet av mig", "självmord", "inte orka längre", "sluta leva",
                         "vill inte leva", "vill dö", "vill inte vara här", "hoppas jag dör",
                         "tänker ta mitt liv", "planerar att dö", "inte värd att leva"],
            "self_harm": ["skada mig själv", "skära mig", "göra illa mig", "självskada",
                          "skada mig", "slå mig"],
            "hopelessness": ["hopplöst", "ingen mening", "allt är meningslöst", "ge upp",
                             "ingen framtid", "bättre utan mig", "världen är bättre utan mig",
                             "ingen bryr sig", "ingen skull sakna mig"],
            "severe_distress": ["kan inte fortsätta", "håller på att bryta ihop", "psykiskt sammanbrott",
                                "orkar inte mer", "klarar inte mer", "vill bara försvinna"]
        }

        text_lower = text.lower()
        detected_indicators = []
        severity_score = 0

        for _category, keywords in crisis_keywords.items():
            matches = [keyword for keyword in keywords if keyword in text_lower]
            if matches:
                detected_indicators.extend(matches)
                severity_score += len(matches) * 2  # Higher weight for crisis indicators

        # Check for urgency indicators
        urgency_patterns = [
            r"hjälp.*?nu", r"snart", r"omedelbart", r"direkt",
            r"kan inte.*?längre", r"håll.*inte.*?ut"
        ]

        for pattern in urgency_patterns:
            if re.search(pattern, text_lower):
                severity_score += 1.5

        risk_level = "LOW"
        if severity_score >= 5:
            risk_level = "CRITICAL"
        elif severity_score >= 2:
            risk_level = "HIGH"
        elif severity_score >= 1:
            risk_level = "MEDIUM"

        return {
            "risk_level": risk_level,
            "severity_score": severity_score,
            "indicators": list(set(detected_indicators)),
            "requires_immediate_attention": risk_level in ["CRITICAL", "HIGH"],
            "recommended_actions": svc._get_crisis_recommendations(risk_level)
        }

    @staticmethod
    def get_crisis_recommendations(risk_level: str) -> list[str]:
        """Get appropriate recommendations based on crisis risk level"""
        recommendations = {
            "CRITICAL": [
                "Ring 112 för akut hjälp",
                "Kontakta närmaste akutmottagning",
                "Ring Självmordslinjen: 90101",
                "Prata med en nära vän eller familjemedlem"
            ],
            "HIGH": [
                "Kontakta din vårdcentral eller terapeut",
                "Ring Självmordslinjen: 90101",
                "Prata med någon du litar på",
                "Undvik att vara ensam just nu"
            ],
            "MEDIUM": [
                "Kontakta din vårdcentral inom kort",
                "Prata med någon du litar på om dina känslor",
                "Överväg att kontakta en terapeut"
            ],
            "LOW": [
                "Fortsätt att söka stöd när du behöver det",
                "Prata med någon du litar på"
            ]
        }

        return recommendations.get(risk_level, recommendations["LOW"])

    @staticmethod
    def generate_crisis_response(crisis_analysis: dict) -> str:
        """Generate appropriate crisis response"""
        risk_level = crisis_analysis["risk_level"]

        if risk_level == "CRITICAL":
            return """Jag är allvarligt oroad över ditt mående just nu. Detta är en akut situation som kräver omedelbar professionell hjälp.

Vänligen ring 112 direkt för akut hjälp, eller kontakta närmaste akutmottagning.

Du kan också ringa:
- Självmordslinjen: 90101 (öppen dygnet runt)
- Jourhavande präst: 112 (för akuta samtal)
- Vårdguiden: 1177

Du är inte ensam i detta. Professionell hjälp finns tillgänglig just nu."""

        elif risk_level == "HIGH":
            return """Jag hör att du mår väldigt dåligt just nu och behöver stöd. Detta är allvarligt och du bör söka hjälp snarast.

Rekommenderade åtgärder:
1. Kontakta din vårdcentral eller terapeut idag
2. Ring Självmordslinjen: 90101 för stöd
3. Prata med någon du litar på

Vill du att jag hjälper dig att formulera hur du ska kontakta vården?"""

        else:
            return """Jag hör att du har det svårt just nu. Dina känslor är viktiga och förtjänar uppmärksamhet.

Överväg att kontakta:
- Din vårdcentral för rådgivning
- En terapeut eller psykolog
- Någon du litar på för stöd

Vill du prata mer om vad som känns svårt just nu?"""
