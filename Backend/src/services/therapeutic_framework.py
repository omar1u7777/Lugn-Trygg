"""
Therapeutic Framework Service - Evidence-based CBT and ACT implementation.
Provides structured therapeutic interventions with dynamic technique selection.
"""

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


class TherapeuticModality(Enum):
    """Evidence-based therapeutic modalities."""
    CBT = "cognitive_behavioral_therapy"
    ACT = "acceptance_commitment_therapy"
    DBT = "dialectical_behavior_therapy"
    MINDFULNESS = "mindfulness_based"


class CBTTechnique(Enum):
    """CBT-specific techniques."""
    COGNITIVE_RESTRUCTURING = "cognitive_restructuring"
    BEHAVIORAL_ACTIVATION = "behavioral_activation"
    EXPOSURE_HIERARCHY = "exposure_hierarchy"
    PROBLEM_SOLVING = "problem_solving"
    THOUGHT_RECORDS = "thought_records"
    BEHAVIORAL_EXPERIMENTS = "behavioral_experiments"


class ACTTechnique(Enum):
    """ACT-specific techniques."""
    COGNITIVE_DEFUSION = "defusion"
    ACCEPTANCE = "acceptance"
    VALUES_CLARIFICATION = "values_clarification"
    COMMITTED_ACTION = "committed_action"
    PRESENT_MOMENT = "present_moment"
    SELF_AS_CONTEXT = "self_as_context"


class CognitiveDistortion(Enum):
    """Common cognitive distortions targeted in CBT."""
    ALL_OR_NOTHING = "all_or_nothing_thinking"
    CATASTROPHIZING = "catastrophizing"
    MIND_READING = "mind_reading"
    FORTUNE_TELLING = "fortune_telling"
    EMOTIONAL_REASONING = "emotional_reasoning"
    SHOULD_STATEMENTS = "should_statements"
    LABELING = "labeling"
    OVERGENERALIZATION = "overgeneralization"
    MENTAL_FILTER = "mental_filter"
    DISQUALIFYING_POSITIVE = "disqualifying_positive"


@dataclass
class TherapeuticContext:
    """Context for therapeutic intervention."""
    user_id: str
    current_emotion: str
    current_thoughts: list[str]
    detected_distortions: list[CognitiveDistortion]
    conversation_stage: str  # 'initial', 'exploration', 'intervention', 'closure'
    user_values: list[str] = field(default_factory=list)
    past_effective_techniques: list[str] = field(default_factory=list)
    session_goals: list[str] = field(default_factory=list)


@dataclass
class TherapeuticResponse:
    """Structured therapeutic response."""
    response_text: str
    modality_used: TherapeuticModality
    technique_used: str
    suggested_exercise: dict | None = None
    follow_up_questions: list[str] = field(default_factory=list)
    psychoeducation: str | None = None
    grounding_offer: bool = False


@dataclass
class CBTThoughtRecord:
    """Interactive CBT thought record."""
    situation: str
    automatic_thoughts: list[str]
    emotions: list[tuple[str, int]]  # (emotion, intensity 0-100)
    evidence_for: list[str]
    evidence_against: list[str]
    alternative_thought: str
    rerate_emotions: list[tuple[str, int]]


@dataclass
class ACTValuesExercise:
    """ACT values clarification exercise."""
    life_domain: str
    current_values: list[str]
    valued_actions: list[str]
    barriers: list[str]
    committed_action: str


class TherapeuticFramework:
    """
    Evidence-based therapeutic framework combining CBT and ACT.
    Dynamically selects techniques based on user context and detected patterns.
    """

    # Distortion keywords for detection (Swedish)
    DISTORTION_PATTERNS = {
        CognitiveDistortion.ALL_OR_NOTHING: [
            "alltid", "aldrig", "ingen", "alla", "inget", "fullständigt", "totalt",
            "hela tiden", "alla andra", "jag är en", "antingen eller"
        ],
        CognitiveDistortion.CATASTROPHIZING: [
            "katastrof", "hemskt", "förskräckligt", "oacceptabelt",
            "jag skulle dö", "jag skulle inte klara det", "det värsta",
            "helt förstörd", "totalt förstörd"
        ],
        CognitiveDistortion.MIND_READING: [
            "de tycker", "de tänker", "de ser att", "de märker",
            "alla vet", "folk ser", "han tycker att", "hon tror att jag"
        ],
        CognitiveDistortion.EMOTIONAL_REASONING: [
            "jag känner att det är", "det känns som", "jag känner mig svag så jag är",
            "jag känner skuld så jag måste ha gjort fel"
        ],
        CognitiveDistortion.SHOULD_STATEMENTS: [
            "jag borde", "jag måste", "jag ska", "borde ha", "måste göra",
            "borde kunna", "måste vara"
        ]
    }

    def __init__(self):
        logger.info("🧠 Initializing Therapeutic Framework (CBT/ACT)...")
        self.cbt_prompts = self._load_cbt_prompts()
        self.act_prompts = self._load_act_prompts()
        logger.info("✅ Therapeutic Framework initialized")

    def _load_cbt_prompts(self) -> dict:
        """Load CBT-specific system prompts."""
        return {
            "cognitive_restructuring": """Du är en KBT-terapeut som hjälper användaren identifiera och omstrukturera automatiska negativa tankar.

PRINCIPER:
1. Identifiera kognitiva förvrängningar (allt-eller-inget, katastroftänkande, tankeinläsning)
2. Ställ Sokratiska frågor för att utforska bevis
3. Hjälp användaren hitta balanserade alternativ till extrema tankar
4. Använd behavioral experiments för att testa trovärdighet

TONE: Empatisk, nyfiken, icke-dömande. Undvik att ge direkt råd - ställ frågor som leder till insikt.""",

            "behavioral_activation": """Du är en KBT-terapeut som fokuserar på behavioral activation vid depression.

PRINCIPER:
1. Identifiera undvikandebeteenden och aktivitetsminskning
2. Hitta små, genomförbara aktiviteter (graded task assignment)
3. Koppla aktiviteter till värdedomen och belöning
4. Skapa action planer med specificitet (vad, när, var, hur)

TONE: Uppmuntrande, konkret, praktisk.""",

            "thought_records": """Du hjälper användaren fylla i ett tanke-record (thought record).

STRUKTUR:
1. Situation - Vad hände? Var? När?
2. Automatiska tankar - Vilka tankar kom för dig? (0-100% tro)
3. Känslor - Vilka känslor? (0-100% intensitet)
4. Bevis FÖR - Vad talar för tanken?
5. Bevis EMOT - Vad talar emot? Alternativa tolkningar?
6. Balanserad tanke - Vad är en mer rimlig tanke?
7. Omvärdera - Hur känns det nu? (0-100%)

Steg-för-steg - vänta på användarens svar mellan stegen."""
        }

    def _load_act_prompts(self) -> dict:
        """Load ACT-specific system prompts."""
        return {
            "defusion": """Du är en ACT-terapeut som arbetar med kognitiv defusion.

PRINCIPER:
1. Hjälp användaren se tankar som TANKAR, inte fakta
2. Använd tekniker: "Jag har tanken att...", "Tack hjärnan!", sjunga tanken, distans
3. Målet är psykologisk flexibilitet - inte att ändra tankar
4. Skapa utrymme mellan själv och tankar

TONE: Lekfull, lättsam, accepterande.""",

            "values": """Du är en ACT-terapeut som arbetar med värderad riktning.

PRINCIPER:
1. Utforska livsområden: relationer, arbete, hälsa, personlig utveckling, fritid
2. Identifiera kärnvärden (inte mål) - hur vill användaren vara?
3. Upptäck hinder mellan värdering och handling
4. Skapa committed action mot värderingar
5. Skillnaden mellan mål (uppnås) och värderingar (riktning)

FRÅGOR:
- "Vad är viktigt för dig i [område]?"
- "Hur skulle du vilja behandla andra i relationer?"
- "Om smärtan inte fanns, vad skulle du göra?"
- "Vilken sorts person vill du vara kännas som?"

TONE: Nyfiken, utforskande, djup.""",

            "acceptance": """Du är en ACT-terapeut som arbetar med acceptans och villiga handlingar.

PRINCIPER:
1. Acceptera = ta emot, inte godkänna eller ge upp
2. Strävan efter kontroll över känslor skapar lidande
3. Känslor är signaler, inte kommandon
4. Villighet = göra det som är viktigt även när det är svårt
5. Utforskande av "reinforcing context"

METAFORER:
- Tåget med tankar (vi behöver inte hoppa av vid varje station)
- Detektivmysteriet (jobbig känsla är ledtråd, inte hinder)
- Drakmatning (undvikande föder draken)

TONE: Varm, klok, inbjudande till öppenhet."""
        }

    def analyze_input(self, user_message: str, context: TherapeuticContext) -> dict:
        """
        Analyze user input for therapeutic content.
        Detects cognitive distortions, emotional patterns, and intervention opportunities.
        """
        analysis = {
            'detected_distortions': [],
            'dominant_emotion': context.current_emotion,
            'avoidance_detected': False,
            'values_conflict': False,
            'recommended_modality': None,
            'recommended_technique': None
        }

        # Detect cognitive distortions
        message_lower = user_message.lower()
        for distortion, keywords in self.DISTORTION_PATTERNS.items():
            if any(kw in message_lower for kw in keywords):
                analysis['detected_distortions'].append(distortion)

        # Detect avoidance patterns
        avoidance_signals = ["undviker", "skjuter upp", "kan inte börja", "orkar inte", "struntar i"]
        if any(sig in message_lower for sig in avoidance_signals):
            analysis['avoidance_detected'] = True

        # Detect values conflict
        values_signals = ["men jag vill egentligen", "borde men vill inte", "värderar", "viktigt för mig"]
        if any(sig in message_lower for sig in values_signals):
            analysis['values_conflict'] = True

        # Recommend modality and technique
        analysis['recommended_modality'], analysis['recommended_technique'] = \
            self._select_intervention(analysis, context)

        return analysis

    def _select_intervention(self, analysis: dict, context: TherapeuticContext) -> tuple:
        """
        Select appropriate therapeutic modality and technique.
        """
        # Priority: Crisis > Values conflict > Distortions > Avoidance > General

        # If cognitive distortions detected -> CBT cognitive restructuring
        if analysis['detected_distortions']:
            if CognitiveDistortion.CATASTROPHIZING in analysis['detected_distortions']:
                return TherapeuticModality.CBT, CBTTechnique.COGNITIVE_RESTRUCTURING
            elif CognitiveDistortion.MIND_READING in analysis['detected_distortions']:
                return TherapeuticModality.CBT, CBTTechnique.THOUGHT_RECORDS
            else:
                return TherapeuticModality.CBT, CBTTechnique.COGNITIVE_RESTRUCTURING

        # If avoidance detected -> CBT behavioral activation
        if analysis['avoidance_detected']:
            return TherapeuticModality.CBT, CBTTechnique.BEHAVIORAL_ACTIVATION

        # If values conflict detected -> ACT values clarification
        if analysis['values_conflict']:
            return TherapeuticModality.ACT, ACTTechnique.VALUES_CLARIFICATION

        # Check past effectiveness
        if context.past_effective_techniques:
            last_effective = context.past_effective_techniques[-1]
            if 'defusion' in last_effective:
                return TherapeuticModality.ACT, ACTTechnique.COGNITIVE_DEFUSION
            elif 'acceptance' in last_effective:
                return TherapeuticModality.ACT, ACTTechnique.ACCEPTANCE

        # Default based on emotion
        emotion = context.current_emotion.lower()
        if any(word in emotion for word in ['arg', 'ilska', 'frustrerad']):
            return TherapeuticModality.CBT, CBTTechnique.COGNITIVE_RESTRUCTURING
        elif any(word in emotion for word in ['ledsen', 'deppig', 'nedstämd']):
            return TherapeuticModality.CBT, CBTTechnique.BEHAVIORAL_ACTIVATION
        elif any(word in emotion for word in ['orolig', 'ängslig', 'stressad']):
            return TherapeuticModality.ACT, ACTTechnique.COGNITIVE_DEFUSION

        # Default
        return TherapeuticModality.CBT, CBTTechnique.COGNITIVE_RESTRUCTURING

    def generate_therapeutic_prompt(self, modality: TherapeuticModality,
                                     technique: Any) -> str:
        """
        Generate appropriate system prompt for OpenAI based on selected intervention.
        """
        base_prompt = """Du är en erfaren terapeut inom evidensbaserad psykoterapi.

GRUNDLÄGGANDE PRINCIPER:
- Var empatisk, varm och icke-dömande
- Ställ öppna frågor för utforskning
- Validera känslor innan du arbetar med dem
- Ge konkreta, handlingsbara verktyg
- Respektera användarens tempo och beredskap
- Undvik att ge direkt råd - hjälp användaren hitta sina egna insikter

SVARA PÅ SVENSKA med värme och medkänsla."""

        # Add modality-specific prompt
        if modality == TherapeuticModality.CBT:
            if technique == CBTTechnique.COGNITIVE_RESTRUCTURING:
                return base_prompt + "\n\n" + self.cbt_prompts["cognitive_restructuring"]
            elif technique == CBTTechnique.BEHAVIORAL_ACTIVATION:
                return base_prompt + "\n\n" + self.cbt_prompts["behavioral_activation"]
            elif technique == CBTTechnique.THOUGHT_RECORDS:
                return base_prompt + "\n\n" + self.cbt_prompts["thought_records"]

        elif modality == TherapeuticModality.ACT:
            if technique == ACTTechnique.COGNITIVE_DEFUSION:
                return base_prompt + "\n\n" + self.act_prompts["defusion"]
            elif technique == ACTTechnique.VALUES_CLARIFICATION:
                return base_prompt + "\n\n" + self.act_prompts["values"]
            elif technique == ACTTechnique.ACCEPTANCE:
                return base_prompt + "\n\n" + self.act_prompts["acceptance"]

        return base_prompt

    def generate_interactive_exercise(self, technique: Any,
                                       context: TherapeuticContext) -> dict | None:
        """
        Generate interactive exercise based on technique and context.
        Returns exercise structure for frontend rendering.
        """
        if technique == CBTTechnique.THOUGHT_RECORDS:
            return self._generate_thought_record_exercise(context)
        elif technique == CBTTechnique.EXPOSURE_HIERARCHY:
            return self._generate_exposure_hierarchy(context)
        elif technique == ACTTechnique.VALUES_CLARIFICATION:
            return self._generate_values_exercise(context)
        elif technique == ACTTechnique.COMMITTED_ACTION:
            return self._generate_committed_action_plan(context)

        return None

    def _generate_thought_record_exercise(self, context: TherapeuticContext) -> dict:
        """Generate interactive thought record."""
        return {
            "type": "cbt_thought_record",
            "title": "Tanke-Record: Utforska dina tankar",
            "description": "Tillsammans ska vi undersöka en svår tanke mer noggrant.",
            "steps": [
                {
                    "id": "situation",
                    "title": "1. Situation",
                    "prompt": "Beskriv kort vad som hände, var du var, och vem som var med.",
                    "input_type": "text_area",
                    "placeholder": "T.ex.: Jag var på jobbet och chefen kallade in mig till ett möte..."
                },
                {
                    "id": "automatic_thoughts",
                    "title": "2. Automatiska tankar",
                    "prompt": "Vilka tankar dök upp för dig i situationen? Skriv ner dem som de kom.",
                    "input_type": "bullet_points",
                    "placeholder": "T.ex.: Jag kommer att få sparken, Alla ser att jag är inkompetent"
                },
                {
                    "id": "emotions",
                    "title": "3. Känslor",
                    "prompt": "Vilka känslor upplevde du? Hur intensiva var de (0-100%)?",
                    "input_type": "emotion_scale",
                    "emotions": ["oro", "skuld", "skam", "ilska", "sorg", "hopplöshet"]
                },
                {
                    "id": "evidence_for",
                    "title": "4. Bevis FÖR tanken",
                    "prompt": "Om en vän hade denna tanke, vad skulle du säga talar FÖR att den är sann?",
                    "input_type": "bullet_points",
                    "helper_text": "Var ärlig - finns det något som faktiskt stöder tanken?"
                },
                {
                    "id": "evidence_against",
                    "title": "5. Bevis EMOT tanken",
                    "prompt": "Vad talar EMOT att tanken är helt sann? Finns andra förklaringar?",
                    "input_type": "bullet_points",
                    "helper_text": "Tänk: Vad skulle du säga till en vän i samma situation?"
                },
                {
                    "id": "alternative",
                    "title": "6. Balanserad tanke",
                    "prompt": "Baserat på bevisen ovan, vad är en mer balanserad tanke?",
                    "input_type": "text_area",
                    "ai_assisted": True,  # AI can suggest based on previous inputs
                    "placeholder": "T.ex.: Det är möjligt att chefen ville prata om något annat..."
                },
                {
                    "id": "rerate",
                    "title": "7. Omvärdera känslor",
                    "prompt": "Nu när du har utforskat tanken - hur känns det? Hur intensiva är känslorna nu (0-100%)?",
                    "input_type": "emotion_scale"
                }
            ],
            "estimated_duration": "10-15 minuter",
            "can_save_progress": True
        }

    def _generate_exposure_hierarchy(self, context: TherapeuticContext) -> dict:
        """Generate exposure hierarchy for anxiety."""
        return {
            "type": "cbt_exposure_hierarchy",
            "title": "Exponeringshierarki",
            "description": "Låt oss skapa en plan för att gradvis möta det du undviker.",
            "steps": [
                {
                    "id": "identify_avoidance",
                    "title": "Vad undviker du?",
                    "prompt": "Beskriv en situation eller aktivitet som ger dig ångest och som du undviker.",
                    "input_type": "text_area"
                },
                {
                    "id": "break_down",
                    "title": "Dela upp i steg",
                    "prompt": "Bryt ner situationen i 5-8 mindre steg, från lättast till svårast.",
                    "input_type": "ranked_list",
                    "items": 8
                },
                {
                    "id": "rate_anxiety",
                    "title": "Bedöm ångest",
                    "prompt": "Bedöm hur mycket ångest varje steg skulle ge (0-100%).",
                    "input_type": "scale_rating"
                },
                {
                    "id": "create_plan",
                    "title": "Din exponeringsplan",
                    "prompt": "Vi börjar med det lättaste steget. När vill du öva på det?",
                    "input_type": "action_plan",
                    "ai_assisted": True
                }
            ]
        }

    def _generate_values_exercise(self, context: TherapeuticContext) -> dict:
        """Generate ACT values clarification exercise."""
        return {
            "type": "act_values",
            "title": "Vad är viktigt för dig?",
            "description": "Låt oss utforska dina kärnvärden - den person du vill vara.",
            "life_domains": [
                {
                    "id": "relationships",
                    "name": "Relationer",
                    "prompt": "Vilken sorts partner/vän/förälder vill du vara? Hur vill du behandla andra?"
                },
                {
                    "id": "work",
                    "name": "Arbete/Studier",
                    "prompt": "Vilken sorts medarbetare/student vill du vara? Vad är viktigt i ditt arbete?"
                },
                {
                    "id": "health",
                    "name": "Hälsa & Kropp",
                    "prompt": "Hur vill du ta hand om din kropp och ditt välbefinnande?"
                },
                {
                    "id": "personal_growth",
                    "name": "Personlig utveckling",
                    "prompt": "Vad vill du lära dig? Hur vill du växa som person?"
                },
                {
                    "id": "leisure",
                    "name": "Fritid & Nöje",
                    "prompt": "Vad ger dig glädje och energi? Hur vill du tillbringa din fritid?"
                }
            ],
            "format": "card_selection_with_reflection"
        }

    def _generate_committed_action_plan(self, context: TherapeuticContext) -> dict:
        """Generate committed action plan."""
        return {
            "type": "act_committed_action",
            "title": "Engagerad handling",
            "description": "Låt oss skapa en konkret plan för att leva dina värderingar.",
            "steps": [
                {
                    "id": "select_value",
                    "title": "Välj ett värde",
                    "prompt": "Vilket av dina värden vill du fokusera på denna vecka?",
                    "input_type": "value_selection"
                },
                {
                    "id": "identify_barrier",
                    "title": "Identifiera hinder",
                    "prompt": "Vad hindrar dig från att leva detta värde? (Tankar, känslor, situationer)",
                    "input_type": "text_area"
                },
                {
                    "id": "small_action",
                    "title": "En liten handling",
                    "prompt": "Vad är en liten, konkret handling du kan ta denna vecka som rör sig mot ditt värde - även om det är obehagligt?",
                    "input_type": "text_area",
                    "helper_text": "Ju mindre, desto bättre. Små steg leder till stora förändringar."
                },
                {
                    "id": "when_where",
                    "title": "När och var?",
                    "prompt": "När och var ska du göra detta? Ju mer specifikt, desto större chans att det händer.",
                    "input_type": "action_plan"
                }
            ]
        }


# Singleton instance
_therapeutic_framework: TherapeuticFramework | None = None


def get_therapeutic_framework() -> TherapeuticFramework:
    """Get or create the therapeutic framework singleton."""
    global _therapeutic_framework
    if _therapeutic_framework is None:
        _therapeutic_framework = TherapeuticFramework()
    return _therapeutic_framework
