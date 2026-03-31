"""
Dynamic Worksheet Generator - Creates interactive CBT/ACT worksheets.
Generates structured therapeutic exercises based on conversation content.
"""

import logging
from typing import Any, Optional, List
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class WorksheetSection:
    """A section within a therapeutic worksheet."""
    id: str
    title: str
    prompt: str
    input_type: str  # 'text_area', 'bullet_points', 'scale', 'multiple_choice', 'emotion_scale'
    placeholder: Optional[str] = None
    helper_text: Optional[str] = None
    ai_assisted: bool = False
    required: bool = True
    validation_rules: dict = field(default_factory=dict)


@dataclass
class Worksheet:
    """A complete therapeutic worksheet."""
    id: str
    type: str  # 'cbt_thought_record', 'act_values', 'act_committed_action', 'mood_log'
    title: str
    description: str
    sections: List[WorksheetSection]
    estimated_duration: str
    can_save_progress: bool = True
    ai_instructions: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


class WorksheetGenerator:
    """
    Generates dynamic therapeutic worksheets based on conversation content.
    """
    
    def __init__(self):
        logger.info("📝 Initializing Worksheet Generator...")
    
    def generate_from_conversation(self, conversation_id: str, 
                                   messages: List[dict],
                                   detected_distortions: List[str] = None) -> Optional[Worksheet]:
        """
        Analyze conversation and generate targeted worksheet.
        
        Args:
            conversation_id: ID of the conversation to analyze
            messages: List of conversation messages
            detected_distortions: Pre-detected cognitive distortions
            
        Returns:
            Worksheet or None if no appropriate worksheet can be generated
        """
        if not messages:
            return None
        
        # Extract user messages
        user_messages = [m['content'] for m in messages if m.get('role') == 'user']
        
        if not user_messages:
            return None
        
        # Analyze content for worksheet type
        combined_text = " ".join(user_messages).lower()
        
        # Determine appropriate worksheet type
        worksheet_type = self._determine_worksheet_type(
            combined_text, 
            detected_distortions or []
        )
        
        # Generate specific worksheet
        if worksheet_type == 'cbt_thought_record':
            return self._generate_thought_record(conversation_id, messages)
        elif worksheet_type == 'act_values':
            return self._generate_values_clarification(conversation_id)
        elif worksheet_type == 'act_committed_action':
            return self._generate_committed_action(conversation_id, messages)
        elif worksheet_type == 'cbt_exposure_hierarchy':
            return self._generate_exposure_hierarchy(conversation_id, messages)
        elif worksheet_type == 'mood_patterns':
            return self._generate_mood_analysis(conversation_id)
        
        return None
    
    def _determine_worksheet_type(self, text: str, 
                                   distortions: List[str]) -> str:
        """Determine which worksheet type is most appropriate."""
        
        # Check for cognitive distortions -> Thought record
        if distortions:
            return 'cbt_thought_record'
        
        # Check for specific patterns
        thought_record_signals = [
            'tänkte att', 'tro att', 'antar att', 'måste vara', 'alla tycker',
            'aldrig', 'alltid', 'ingen', 'alla', 'förstör allt'
        ]
        
        values_signals = [
            'vet inte vad jag vill', 'meningslöst', 'vad är viktigt',
            'vem vill jag vara', 'vad vill jag', 'värderingar', 'inte vet'
        ]
        
        avoidance_signals = [
            'undviker', 'skjuter upp', 'vågar inte', 'rädd för',
            'ångest över att', 'panik vid tanken'
        ]
        
        mood_pattern_signals = [
            'mår dåligt hela tiden', 'humör svänger', 'aldrig glad',
            'alltid trött', 'mönster', 'starka känslor'
        ]
        
        # Count signals
        thought_count = sum(1 for s in thought_record_signals if s in text)
        values_count = sum(1 for s in values_signals if s in text)
        avoidance_count = sum(1 for s in avoidance_signals if s in text)
        mood_count = sum(1 for s in mood_pattern_signals if s in text)
        
        # Determine winner
        scores = [
            ('cbt_thought_record', thought_count),
            ('act_values', values_count),
            ('cbt_exposure_hierarchy', avoidance_count),
            ('mood_patterns', mood_count)
        ]
        
        scores.sort(key=lambda x: x[1], reverse=True)
        
        # Only generate if there's a clear signal
        if scores[0][1] > 0:
            return scores[0][0]
        
        # Default: generic mood/thought exploration
        return 'cbt_thought_record'
    
    def _generate_thought_record(self, conversation_id: str, 
                                  messages: List[dict]) -> Worksheet:
        """Generate CBT thought record worksheet."""
        
        # Extract situation from messages
        user_messages = [m['content'] for m in messages if m.get('role') == 'user']
        triggering_situation = self._extract_situation(user_messages[0] if user_messages else "")
        
        return Worksheet(
            id=f"tr_{conversation_id}_{datetime.now().timestamp()}",
            type="cbt_thought_record",
            title="Tanke-Record: Utforska dina tankar",
            description=(
                "Tillsammans ska vi undersöka en tanke mer noggrant. "
                "Detta är ett kraftfullt KBT-verktyg som hjälper dig se situationen "
                "från flera perspektiv. Ta dig tid - du kan spara och fortsätta senare."
            ),
            sections=[
                WorksheetSection(
                    id="situation",
                    title="1. Situation",
                    prompt="Beskriv kort vad som hände, var du var, och vem som var med.",
                    input_type="text_area",
                    placeholder=triggering_situation or "T.ex.: Jag var på jobbet och chefen kallade in mig till ett möte...",
                    helper_text="Var konkret - tid, plats, personer, vad som hände."
                ),
                WorksheetSection(
                    id="automatic_thoughts",
                    title="2. Automatiska tankar",
                    prompt="Vilka tankar dök upp för dig i situationen? Vad gick genom ditt huvud?",
                    input_type="bullet_points",
                    placeholder="• Jag kommer att göra bort mig\n• Alla ser att jag är nervös\n• Detta kommer gå åt skogen",
                    helper_text="Skriv ner tankarna som de kom - utan att filtrera."
                ),
                WorksheetSection(
                    id="emotions",
                    title="3. Känslor och intensitet",
                    prompt="Vilka känslor upplevde du? Hur intensiva var de? (0 = ingen, 100 = extrem)",
                    input_type="emotion_scale",
                    helper_text="Du kan ha flera känslor samtidigt - notera dem alla."
                ),
                WorksheetSection(
                    id="evidence_for",
                    title="4. Bevis FÖR tanken",
                    prompt="Om en vän hade denna tanke, vad skulle du säga talar FÖR att den är sann?",
                    input_type="bullet_points",
                    placeholder="• Fakta som stöder tanken\n• Konkreta observationer\n• Tidigare erfarenheter som stöder",
                    helper_text="Var ärlig - finns det något som faktiskt stöder tanken?"
                ),
                WorksheetSection(
                    id="evidence_against",
                    title="5. Bevis EMOT tanken",
                    prompt="Vad talar EMOT att tanken är helt sann? Finns andra förklaringar?",
                    input_type="bullet_points",
                    placeholder="• Fakta som motsäger tanken\n• Andra tolkningar av situationen\n• Vad skulle du säga till en vän?",
                    helper_text="Tänk: Vad skulle du säga till en vän i samma situation?"
                ),
                WorksheetSection(
                    id="alternative_thought",
                    title="6. Balanserad tanke",
                    prompt="Baserat på ALLA bevisen ovan, vad är en mer balanserad, rimlig tanke?",
                    input_type="text_area",
                    placeholder="En tanke som tar hänsyn till både för- och emot-bevisen...",
                    helper_text="Den nya tanken behöver inte vara positiv - bara mer balanserad.",
                    ai_assisted=True
                ),
                WorksheetSection(
                    id="rerate_emotions",
                    title="7. Omvärdera känslor",
                    prompt="Nu när du har utforskat tanken - hur känns det? Hur intensiva är känslorna nu?",
                    input_type="emotion_scale",
                    helper_text="Har intensiteten förändrats? Det är okej om den inte har det - det tar tid."
                ),
                WorksheetSection(
                    id="reflection",
                    title="8. Reflektion",
                    prompt="Vad lärde du dig av denna övning? Finns det något du vill komma ihåg?",
                    input_type="text_area",
                    placeholder="Mina insikter från denna övning...",
                    helper_text="Skriv ner något du kan ta med dig från denna övning.",
                    required=False
                )
            ],
            estimated_duration="10-15 minuter",
            can_save_progress=True,
            ai_instructions="""
            När användaren fyller i sektion 6 (Balanserad tanke), erbjud AI-stöd:
            1. Läs deras svar från sektionerna 4 och 5
            2. Hjälp dem formulera en balanserad tanke som:
               - Är mer flexibel än den automatiska tanken
               - Tar hänsyn till både för- och emot-bevis
               - Är rimlig och trovärdig
               - Inte är för positiv eller naiv
            3. Exempel: "Jag är orolig, men jag har hanterat liknande situationer förut"
            """
        )
    
    def _generate_values_clarification(self, conversation_id: str) -> Worksheet:
        """Generate ACT values clarification worksheet."""
        
        return Worksheet(
            id=f"act_v_{conversation_id}_{datetime.now().timestamp()}",
            type="act_values",
            title="Vad är viktigt för dig?",
            description=(
                "Låt oss utforska dina kärnvärden - den person du vill vara i olika "
                "områden av livet. Detta hjälper oss skapa meningsfulla mål och handlingar."
            ),
            sections=[
                WorksheetSection(
                    id="intro_reflection",
                    title="Reflektion",
                    prompt="Tänk på en tid när du kände dig mest levande, engagerad, eller stolt över dig själv. Vad gjorde du? Vilka värden var viktiga då?",
                    input_type="text_area",
                    placeholder="En situation där jag kände mig som 'bästa versionen av mig själv'...",
                    helper_text="Detta kan ge ledtrådar om dina kärnvärden."
                ),
                WorksheetSection(
                    id="relationships",
                    title="Relationer",
                    prompt="Vilken sorts partner, vän, familjemedlem vill du vara? Hur vill du behandla andra?",
                    input_type="text_area",
                    placeholder="T.ex.: Jag vill vara närvarande, lyhörd, och stödjande...",
                    helper_text="Tänk på närma relationer - vad är viktigt för dig i dem?"
                ),
                WorksheetSection(
                    id="work_career",
                    title="Arbete/Studier",
                    prompt="Vilken sorts medarbetare eller student vill du vara? Vad är viktigt i ditt arbete?",
                    input_type="text_area",
                    placeholder="T.ex.: Jag vill bidra med kunskap, vara pålitlig, växa professionellt...",
                    helper_text="Oavsett vad du arbetar med - vilka värden vill du ta med dig?"
                ),
                WorksheetSection(
                    id="health_wellbeing",
                    title="Hälsa och Välbefinnande",
                    prompt="Hur vill du ta hand om din kropp och ditt välmående? Vilken sorts livsstil är viktig?",
                    input_type="text_area",
                    placeholder="T.ex.: Jag vill vara aktiv, äta bra, prioritera återhämtning...",
                    helper_text="Tänk på både fysisk och mental hälsa."
                ),
                WorksheetSection(
                    id="personal_growth",
                    title="Personlig Utveckling",
                    prompt="Vad vill du lära dig? Hur vill du växa som person?",
                    input_type="text_area",
                    placeholder="T.ex.: Jag vill vara nyfiken, öppen för nya perspektiv, modig...",
                    helper_text="Utbildning, karaktär, färdigheter - vad är viktigt för din utveckling?"
                ),
                WorksheetSection(
                    id="leisure_play",
                    title="Fritid och Nöje",
                    prompt="Vad ger dig glädje och energi? Hur vill du tillbringa din fritid?",
                    input_type="text_area",
                    placeholder="T.ex.: Jag vill vara kreativ, umgås med nära vänner, vara i naturen...",
                    helper_text="Vilka aktiviteter ger dig energi och mening?"
                ),
                WorksheetSection(
                    id="top_values",
                    title="Dina Tre Viktigaste Värden",
                    prompt="Baserat på ovanstående - vilka 3 värden är mest centrala för dig just nu?",
                    input_type="bullet_points",
                    placeholder="1. \n2. \n3. ",
                    helper_text="Välj de tre som känns viktigast just nu (de kan förändras över tid)."
                )
            ],
            estimated_duration="15-20 minuter",
            can_save_progress=True,
            ai_instructions="""
            Hjälp användaren identifiera värden som är:
            - Livsriktningar (inte mål som kan 'uppnås')
            - Personligt meningsfulla (inte vad andra tycker)
            - Flexibla (kan uttryckas på många sätt)
            
            Om användaren har svårt att svara, ställ uppföljande frågor om:
            - Vilka personer de beundrar och varför
            - Vad de skulle vilja stå för i livet
            - Vad som skulle vara viktigt om de var friska om 10 år
            """
        )
    
    def _generate_committed_action(self, conversation_id: str, 
                                    messages: List[dict]) -> Worksheet:
        """Generate ACT committed action worksheet."""
        
        # Try to extract a value from messages
        user_text = " ".join([m['content'] for m in messages if m.get('role') == 'user'])
        
        return Worksheet(
            id=f"act_ca_{conversation_id}_{datetime.now().timestamp()}",
            type="act_committed_action",
            title="Engagerad Handling",
            description=(
                "Nu ska vi skapa en konkret plan för att leva dina värderingar. "
                "Detta handlar om att ta meningsfulla steg, även när det är svårt."
            ),
            sections=[
                WorksheetSection(
                    id="select_value",
                    title="1. Välj ett Värde",
                    prompt="Vilket av dina värden vill du fokusera på denna vecka?",
                    input_type="text_area",
                    placeholder="T.ex.: Jag vill vara mer närvarande i relationer...",
                    helper_text="Välj ETT värde att arbeta med just nu."
                ),
                WorksheetSection(
                    id="current_barriers",
                    title="2. Identifiera Hinder",
                    prompt="Vad hindrar dig från att leva detta värde? (Tankar, känslor, situationer, beteenden)",
                    input_type="bullet_points",
                    placeholder="• Jag känner ångest när jag...\n• Jag undviker att...\n• Jag tänker att jag inte kan...",
                    helper_text="Var ärlig - både inre (känslor) och yttre (situationer) hinder."
                ),
                WorksheetSection(
                    id="willingness_check",
                    title="3. Viljestyrka",
                    prompt="På en skala 0-10, hur villig är du att känna obehag för att leva detta värde?",
                    input_type="scale",
                    helper_text="Det är okej om viljan inte är 10/10 än. Mindfulness kan hjälpa."
                ),
                WorksheetSection(
                    id="small_action",
                    title="4. En Liten Handling",
                    prompt="Vad är en liten, konkret handling du kan ta denna vecka som rör sig mot ditt värde?",
                    input_type="text_area",
                    placeholder="En specifik, mätbar handling jag kan göra...",
                    helper_text="Ju mindre och mer konkret, desto bättre. Små steg leder till stora förändringar.",
                    ai_assisted=True
                ),
                WorksheetSection(
                    id="when_where",
                    title="5. När och Var?",
                    prompt="När och var ska du göra detta? Ju mer specifikt, desto större chans att det händer.",
                    input_type="text_area",
                    placeholder="På tisdag eftermiddag, hemma i vardagsrummet...",
                    helper_text="Implementation intention: 'När [situation], då [handling]'"
                ),
                WorksheetSection(
                    id="prepared_for_discomfort",
                    title="6. Förberedd för Obehag",
                    prompt="Vilka svåra tankar/känslor kan dyka upp? Vad vill du säga till dig själv då?",
                    input_type="text_area",
                    placeholder="Om jag känner [känsla], kan jag säga till mig själv: ...",
                    helper_text="Förbered dig på svårigheter - det är normalt och hanterbart."
                ),
                WorksheetSection(
                    id="accountability",
                    title="7. Ansvarsskyldighet",
                    prompt="Vem kan du berätta om denna plan? (Valfritt men effektivt)",
                    input_type="text_area",
                    placeholder="Jag ska berätta för...",
                    helper_text="Att dela din plan ökar sannolikheten att du följer den.",
                    required=False
                )
            ],
            estimated_duration="10-15 minuter",
            can_save_progress=True,
            ai_instructions="""
            I sektion 4 (Liten Handling), hjälp användaren:
            1. Bryta ner stora mål till mikro-steg
            2. Fokusera på PROCESS (hur) inte RESULTAT (vad)
            3. Exempel: Istället för "träna mer", föreslå "ta på mig träningsskorna och gå till dörren"
            4. Säkerställa handlingen är kopplad till värdering, inte känsla
            """
        )
    
    def _generate_exposure_hierarchy(self, conversation_id: str,
                                      messages: List[dict]) -> Worksheet:
        """Generate exposure hierarchy for anxiety/avoidance."""
        
        return Worksheet(
            id=f"exp_{conversation_id}_{datetime.now().timestamp()}",
            type="cbt_exposure_hierarchy",
            title="Exponeringshierarki",
            description=(
                "Låt oss skapa en plan för att gradvis möta det du undviker. "
                "Exponering är det mest effektiva sättet att minska ångest över tid."
            ),
            sections=[
                WorksheetSection(
                    id="identify_fear",
                    title="1. Vad Undviker Du?",
                    prompt="Beskriv en situation eller aktivitet som ger dig ångest och som du undviker.",
                    input_type="text_area",
                    placeholder="T.ex.: Att prata i möten, att gå till gymmet, att ringa ett svårt samtal...",
                    helper_text="Var specifik - vad exakt är det som känns svårt?"
                ),
                WorksheetSection(
                    id="break_into_steps",
                    title="2. Dela Upp i Steg",
                    prompt="Bryt ner situationen i 5-8 mindre steg, från lättast till svårast.",
                    input_type="bullet_points",
                    placeholder="1. (Lättast) \n2. \n3. \n4. \n5. \n6. \n7. \n8. (Svårast)",
                    helper_text="Tänk i steg om 10-20% ångestökning mellan varje steg.",
                    ai_assisted=True
                ),
                WorksheetSection(
                    id="rate_anxiety",
                    title="3. Bedöm Ångestnivå",
                    prompt="Bedöm hur mycket ångest varje steg skulle ge (0 = ingen, 100 = extrem)",
                    input_type="bullet_points",
                    placeholder="Steg 1: %\nSteg 2: %\n...",
                    helper_text="Var ärlig - detta hjälper oss välja rätt startpunkt."
                ),
                WorksheetSection(
                    id="start_step",
                    title="4. Vilket Steg Börjar Vi Med?",
                    prompt="Vilket steg känns utmanande men hanterbart att börja med?",
                    input_type="text_area",
                    placeholder="Jag börjar med steg nummer...",
                    helper_text="Välj ett steg som ger 30-50% ångest - inte det lättaste, inte det svåraste."
                ),
                WorksheetSection(
                    id="exposure_plan",
                    title="5. Din Exponeringsplan",
                    prompt="När ska du öva på detta steg? Hur ofta? Hur länge ska du stanna i situationen?",
                    input_type="text_area",
                    placeholder="Jag ska göra detta [dag] klockan [tid], i [antal] minuter...",
                    helper_text="Planera för repetition - ju oftare, desto bättre resultat."
                ),
                WorksheetSection(
                    id="coping_strategies",
                    title="6. Hanteringsstrategier",
                    prompt="Vilka tekniker kan du använda under exponering? (Andning, grounding, etc.)",
                    input_type="bullet_points",
                    placeholder="• Djupandning\n• 5-4-3-2-1 grounding\n• Självuppmaningar",
                    helper_text="Dessa ska användas FÖRE/EFTER, inte under (undvik säkerhetsbeteenden)."
                )
            ],
            estimated_duration="15-20 minuter",
            can_save_progress=True,
            ai_instructions="""
            I sektion 2 (Dela upp i steg), hjälp användaren:
            1. Skapa verkligt små steg - mikro-progressioner
            2. Exempel: Istället för "ringa", börja med "hitta numret", "skriva manus", "vänta 1 minut"
            3. Säkerställa varje steg är något de kan öva på upprepade gånger
            4. Förklara att exponering handlar om att lära sig att ångest minskar av sig själv
            """
        )
    
    def _generate_mood_analysis(self, conversation_id: str) -> Worksheet:
        """Generate mood pattern analysis worksheet."""
        
        return Worksheet(
            id=f"mood_{conversation_id}_{datetime.now().timestamp()}",
            type="mood_patterns",
            title="Mönsteranalys",
            description=(
                "Låt oss undersöka dina humörmönster för att hitta triggerfaktorer "
                "och möjliga interventioner."
            ),
            sections=[
                WorksheetSection(
                    id="recent_moods",
                    title="1. Dina Senaste Humör",
                    prompt="Beskriv dina humör de senaste 7 dagarna. Vilka känslor har dominerat?",
                    input_type="text_area",
                    placeholder="Dag 1: ...\nDag 2: ...",
                    helper_text="Var specifik om intensitet och duration."
                ),
                WorksheetSection(
                    id="triggers",
                    title="2. Triggerfaktorer",
                    prompt="Vad verkar påverka ditt humör? (Tid på dygnet, situationer, människor, tankar)",
                    input_type="bullet_points",
                    placeholder="• På morgonen känner jag...\n• Efter möten med...\n• När jag tänker på...",
                    helper_text="Leta efter mönster - vad föregår alltid låga humör?"
                ),
                WorksheetSection(
                    id="early_warning",
                    title="3. Tidiga Varningsignaler",
                    prompt="Vilka tecken märker du när humöret börjar sjunka? (Fysiska, tankar, beteenden)",
                    input_type="bullet_points",
                    placeholder="• Sömnsvårigheter\n• Negativa tankar om...\n• Undvikande av...",
                    helper_text="Tidig identifiering möjliggör tidig intervention."
                ),
                WorksheetSection(
                    id="helpful_factors",
                    title="4. Hjälpsamma Faktorer",
                    prompt="Vad verkar hjälpa när du mår dåligt? Vad har fungerat tidigare?",
                    input_type="bullet_points",
                    placeholder="• När jag... mår jag bättre\n• [Aktivitet] hjälper mig...\n• [Person] stöttar mig genom...",
                    helper_text="Dessa blir dina go-to strategier för framtiden."
                ),
                WorksheetSection(
                    id="action_plan",
                    title="5. Din Actionplan",
                    prompt="Baserat på ovanstående - vad kan du göra annorlunda nästa gång varningssignalerna dyker upp?",
                    input_type="text_area",
                    placeholder="När jag märker [signal] ska jag...",
                    ai_assisted=True
                )
            ],
            estimated_duration="15-20 minuter",
            can_save_progress=True
        )
    
    def _extract_situation(self, text: str) -> str:
        """Extract situation description from text."""
        # Simple extraction - in production use NLP
        # Look for context indicators
        indicators = ["igår", "idag", "imorse", "i fredags", "på jobbet", "hemma", "i skolan"]
        
        for indicator in indicators:
            if indicator in text.lower():
                # Find sentence containing indicator
                sentences = text.split('.')
                for sent in sentences:
                    if indicator in sent.lower():
                        return sent.strip()
        
        # Return first sentence as fallback
        first_sentence = text.split('.')[0] if text else ""
        return first_sentence[:200]  # Limit length


# Singleton instance
_worksheet_generator: Optional[WorksheetGenerator] = None


def get_worksheet_generator() -> WorksheetGenerator:
    """Get or create the worksheet generator singleton."""
    global _worksheet_generator
    if _worksheet_generator is None:
        _worksheet_generator = WorksheetGenerator()
    return _worksheet_generator
