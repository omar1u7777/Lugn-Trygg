"""
Adaptive CBT Engine for Lugn & Trygg
Dynamic Cognitive Behavioral Therapy modules with Swedish content
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)

@dataclass
class CBTModule:
    """CBT Module with adaptive content"""
    module_id: str
    title: str
    description: str
    category: str  # 'anxiety', 'depression', 'stress', 'general'
    difficulty_level: str  # 'beginner', 'intermediate', 'advanced'
    estimated_duration: int  # minutes
    prerequisites: list[str]
    learning_objectives: list[str]
    swedish_content: dict[str, Any]
    adaptive_rules: dict[str, Any]
    completion_criteria: dict[str, Any]

@dataclass
class CBTExercise:
    """Individual CBT exercise"""
    exercise_id: str
    module_id: str
    title: str
    type: str  # 'thought_record', 'behavioral_experiment', 'exposure', 'cognitive_restructuring'
    difficulty: str
    duration: int
    swedish_instructions: str
    prompts: list[str]
    adaptive_elements: dict[str, Any]
    success_metrics: list[str]

@dataclass
class UserCBTProgress:
    """User's progress through CBT modules"""
    user_id: str
    current_module: str | None
    completed_modules: list[str]
    exercise_history: list[dict[str, Any]]
    skill_mastery: dict[str, float]
    adaptive_parameters: dict[str, Any]
    last_session_date: datetime | None
    streak_count: int

@dataclass
class PersonalizedCBTSession:
    """Personalized CBT session for user"""
    exercises: list[CBTExercise]
    session_theme: str
    adaptive_adjustments: dict[str, Any]
    estimated_duration: int
    difficulty_progression: str
    motivational_elements: list[str]
    swedish_guidance: str

class CBTEngine:
    """Adaptive CBT Engine with Swedish content and personalization"""

    def __init__(self):
        # Initialize CBT modules database
        self.modules = self._initialize_cbt_modules()
        self.exercises = self._initialize_cbt_exercises()

        # Adaptive learning parameters
        self.adaptive_parameters = {
            'difficulty_adjustment_rate': 0.1,
            'mastery_threshold': 0.8,
            'progression_speed': 1.0,
            'reinforcement_schedule': 'variable_ratio'
        }

    def _initialize_cbt_modules(self) -> dict[str, CBTModule]:
        """Initialize comprehensive CBT modules database"""
        modules = {}

        # Anxiety Module
        modules['anxiety_basics'] = CBTModule(
            module_id='anxiety_basics',
            title='Att Hantera Ångest',
            description='Grundläggande verktyg för att förstå och hantera ångest',
            category='anxiety',
            difficulty_level='beginner',
            estimated_duration=45,
            prerequisites=[],
            learning_objectives=[
                'Förstå ångestsymptom och deras funktion',
                'Läga grundläggande avslappningstekniker',
                'Utveckla medvetenhet om ångesttankar'
            ],
            swedish_content={
                'introduction': """
                Ångest är en naturlig reaktion på hot eller stress, men när den blir överdriven
                kan den störa vardagslivet. Denna modul hjälper dig att förstå dina ångesttankar
                och utveckla verktyg för att hantera dem.
                """,
                'key_concepts': [
                    'Ångest som signalsystem',
                    'Skillnaden mellan användbar och störande ångest',
                    'Hur tankar påverkar känslor och beteenden'
                ],
                'common_misconceptions': [
                    'Ångest är farligt - det är obehagligt men ofarligt',
                    'Man måste undvika ångest - man kan lära sig tolerera den',
                    'Ångest betyder att något är fel - det är en normal mänsklig reaktion'
                ]
            },
            adaptive_rules={
                'difficulty_scaling': {
                    'low_anxiety': 'simplify_exercises',
                    'high_anxiety': 'add_support_elements',
                    'chronic_anxiety': 'extend_practice_period'
                },
                'progression_criteria': {
                    'understanding_score': 0.7,
                    'practice_completion': 0.8,
                    'symptom_reduction': 0.6
                }
            },
            completion_criteria={
                'exercises_completed': 5,
                'self_assessment_score': 7,
                'understanding_quiz': 0.8
            }
        )

        # Depression Module
        modules['depression_cognitive'] = CBTModule(
            module_id='depression_cognitive',
            title='Kognitiv Omstrukturering vid Nedstämdhet',
            description='Identifiera och utmana negativa tankemönster',
            category='depression',
            difficulty_level='intermediate',
            estimated_duration=60,
            prerequisites=['anxiety_basics'],
            learning_objectives=[
                'Identifiera negativa tankemönster',
                'Utmana och omstrukturera negativa tankar',
                'Utveckla mer balanserade perspektiv'
            ],
            swedish_content={
                'introduction': """
                Våra tankar påverkar våra känslor och beteenden. När vi är nedstämda tenderar
                vi att ha negativa tankemönster som förstärker känslan av hopplöshet.
                Denna modul lär dig att identifiera och utmana dessa tankar.
                """,
                'cognitive_distortions': {
                    'all_or_nothing': 'Svart-vitt tänkande',
                    'overgeneralization': 'Övergeneralisering',
                    'mental_filter': 'Mental filtrering',
                    'disqualifying_positive': 'Förkasta det positiva',
                    'mind_reading': 'Tanke-läsning',
                    'fortune_telling': 'Spådomar om framtiden'
                }
            },
            adaptive_rules={
                'difficulty_scaling': {
                    'mild_depression': 'focus_on_positive_reinforcement',
                    'moderate_depression': 'gradual_exposure',
                    'severe_depression': 'simplify_and_support'
                }
            },
            completion_criteria={
                'thought_records_completed': 10,
                'cognitive_restructuring_score': 0.75,
                'behavioral_activation': 0.7
            }
        )

        # Stress Management Module
        modules['stress_management'] = CBTModule(
            module_id='stress_management',
            title='Stressehantering och Problemlösning',
            description='Praktiska verktyg för att hantera stress och lösa problem',
            category='stress',
            difficulty_level='beginner',
            estimated_duration=40,
            prerequisites=[],
            learning_objectives=[
                'Identifiera stresskällor och symptom',
                'Utveckla problemlösningsfärdigheter',
                'Implementera stressreducerande strategier'
            ],
            swedish_content={
                'stress_signs': [
                    'Fysiska symptom: huvudvärk, spänningar, sömnproblem',
                    'Emotionella symptom: irritabilitet, ångest, nedstämdhet',
                    'Beteendemässiga symptom: undvikande, procrastination, irritabilitet'
                ],
                'problem_solving_steps': [
                    'Definiera problemet tydligt',
                    'Generera möjliga lösningar',
                    'Utvärdera för- och nackdelar',
                    'Välj och implementera lösning',
                    'Utvärdera resultatet och justera'
                ]
            },
            adaptive_rules={
                'context_adaptation': {
                    'work_stress': 'focus_on_time_management',
                    'relationship_stress': 'emphasize_communication',
                    'health_stress': 'integrate_relaxation'
                }
            },
            completion_criteria={
                'stress_assessment_completed': True,
                'coping_strategies_identified': 5,
                'problem_solving_exercises': 3
            }
        )

        return modules

    def _initialize_cbt_exercises(self) -> dict[str, CBTExercise]:
        """Initialize CBT exercises database"""
        exercises = {}

        # Thought Record Exercise
        exercises['thought_record_basic'] = CBTExercise(
            exercise_id='thought_record_basic',
            module_id='anxiety_basics',
            title='Tankeprotokoll - Grundläggande',
            type='thought_record',
            difficulty='beginner',
            duration=15,
            swedish_instructions="""
            Ett tankeprotokoll hjälper dig att undersöka dina automatiska tankar och
            utmana negativa tankeprocesser. Följ dessa steg:

            1. Beskriv situationen som utlöste tanken
            2. Skriv ner den automatiska tanken
            3. Identifiera de känslor och fysiska reaktioner tanken gav upphov till
            4. Utmana tanken med alternativa perspektiv
            5. Skriv ett balanserat alternativ
            """,
            prompts=[
                'Vilken situation utlöste denna tanke?',
                'Vad tänkte du automatiskt?',
                'Vilka känslor och fysiska sensationer upplevde du?',
                'Vilka bevis finns för och emot denna tanke?',
                'Vad skulle du säga till en vän i samma situation?',
                'Vilket balanserat alternativ kan du formulera?'
            ],
            adaptive_elements={
                'difficulty_levels': {
                    'easy': 'guided_prompts',
                    'medium': 'partial_guidance',
                    'hard': 'independent_completion'
                },
                'emotional_intensity': {
                    'low': 'focus_on_learning',
                    'high': 'add_grounding_elements'
                }
            },
            success_metrics=[
                'completed_all_prompts',
                'identified_emotional_triggers',
                'developed_balanced_alternative'
            ]
        )

        # Behavioral Activation Exercise
        exercises['behavioral_activation'] = CBTExercise(
            exercise_id='behavioral_activation',
            module_id='depression_cognitive',
            title='Beteendeaktivering',
            type='behavioral_experiment',
            difficulty='intermediate',
            duration=20,
            swedish_instructions="""
            När vi är nedstämda tenderar vi att undvika aktiviteter som tidigare gav
            oss glädje eller tillfredsställelse. Beteendeaktivering hjälper oss att
            bryta denna onda cirkel genom att planera och genomföra meningsfulla aktiviteter.

            1. Identifiera aktiviteter du tidigare njöt av
            2. Planera specifika aktiviteter för veckan
            3. Genomför aktiviteterna även om du inte känner för det
            4. Utvärdera resultatet och lär av erfarenheten
            """,
            prompts=[
                'Vilka aktiviteter brukade du gilla innan du blev nedstämd?',
                'Vilka små steg kan du ta idag?',
                'Vad hindrar dig från att göra dessa saker?',
                'Vad säger dina negativa tankar om aktiviteten?',
                'Vad hände när du genomförde aktiviteten?',
                'Vad kan du lära dig av denna erfarenhet?'
            ],
            adaptive_elements={
                'motivation_levels': {
                    'low': 'start_very_small',
                    'medium': 'build_gradually',
                    'high': 'challenge_comfort_zone'
                }
            },
            success_metrics=[
                'activity_completed',
                'pleasure_rating_recorded',
                'reflection_completed'
            ]
        )

        # Worry Time Exercise
        exercises['worry_time'] = CBTExercise(
            exercise_id='worry_time',
            module_id='anxiety_basics',
            title='Bekymmelsetid',
            type='exposure',
            difficulty='intermediate',
            duration=25,
            swedish_instructions="""
            Många människor med ångest spenderar mycket tid på att bekymra sig genom
            dagen. Detta leder ofta till att bekymren känns mer hotfulla och svåra att kontrollera.

            Bekymmelsetid är en teknik där du avsätter en specifik tid varje dag för
            att bekymra dig, och skjuter upp andra bekymmer till denna tid.

            1. Välj en tid och plats för din bekymmelsetid (t.ex. 20 minuter kl 19:00)
            2. Skriv ner bekymmer som dyker upp under dagen
            3. Under bekymmelsetiden, tillåt dig att bekymra dig fritt
            4. Utanför bekymmelsetiden, påminn dig själv att vänta till din schemalagda tid
            """,
            prompts=[
                'Vilka bekymmer dyker ofta upp genom dagen?',
                'Vilken tid passar bäst för din bekymmelsetid?',
                'Vad händer när du försöker skjuta upp bekymren?',
                'Hur känns det att ha en dedikerad tid för bekymmer?',
                'Vilka bekymmer löste sig själva genom att vänta?'
            ],
            adaptive_elements={
                'worry_intensity': {
                    'low': 'short_sessions',
                    'high': 'structured_problem_solving'
                }
            },
            success_metrics=[
                'worry_time_established',
                'worries_postponed_successfully',
                'reduction_in_spontaneous_worrying'
            ]
        )

        return exercises

    def generate_personalized_session(
        self,
        user_progress: UserCBTProgress,
        current_mood: str,
        context: dict[str, Any]
    ) -> PersonalizedCBTSession:
        """
        Generate a personalized CBT session based on user progress and context

        Args:
            user_progress: User's CBT learning progress
            current_mood: Current emotional state
            context: Session context (time, triggers, etc.)

        Returns:
            PersonalizedCBTSession with tailored exercises
        """
        logger.info(f"Generating personalized CBT session for user {user_progress.user_id}")

        # Determine session focus based on mood and progress
        session_focus = self._determine_session_focus(user_progress, current_mood, context)

        # Select appropriate exercises
        exercises = self._select_exercises(user_progress, session_focus, context)

        # Apply adaptive adjustments
        adaptive_adjustments = self._calculate_adaptive_adjustments(user_progress, context)

        # Calculate session duration and difficulty
        total_duration = sum(exercise.duration for exercise in exercises)
        difficulty_progression = self._assess_difficulty_progression(user_progress)

        # Generate motivational elements
        motivational_elements = self._generate_motivational_elements(user_progress, session_focus)

        # Create Swedish guidance
        swedish_guidance = self._generate_swedish_guidance(session_focus, context)

        return PersonalizedCBTSession(
            exercises=exercises,
            session_theme=session_focus,
            adaptive_adjustments=adaptive_adjustments,
            estimated_duration=total_duration,
            difficulty_progression=difficulty_progression,
            motivational_elements=motivational_elements,
            swedish_guidance=swedish_guidance
        )

    def _determine_session_focus(self, user_progress: UserCBTProgress, current_mood: str, context: dict[str, Any]) -> str:
        """Determine the focus for this CBT session"""

        # Priority based on current mood
        mood_priorities = {
            'high_anxiety': 'anxiety_management',
            'depression': 'behavioral_activation',
            'stress': 'stress_reduction',
            'low_mood': 'cognitive_restructuring',
            'neutral': 'skill_building'
        }

        if current_mood in mood_priorities:
            return mood_priorities[current_mood]

        # Check for patterns in user progress
        if user_progress.skill_mastery.get('anxiety_management', 0) < 0.6:
            return 'anxiety_basics'
        elif user_progress.skill_mastery.get('cognitive_restructuring', 0) < 0.6:
            return 'depression_cognitive'
        else:
            return 'advanced_skills'

    def _select_exercises(
        self,
        user_progress: UserCBTProgress,
        session_focus: str,
        context: dict[str, Any]
    ) -> list[CBTExercise]:
        """Select appropriate exercises for the session"""

        # Map focus to exercise types
        focus_exercises = {
            'anxiety_management': ['thought_record_basic', 'worry_time'],
            'behavioral_activation': ['behavioral_activation'],
            'cognitive_restructuring': ['thought_record_basic'],
            'stress_reduction': ['worry_time', 'behavioral_activation'],
            'skill_building': ['thought_record_basic', 'behavioral_activation']
        }

        exercise_ids = focus_exercises.get(session_focus, ['thought_record_basic'])
        selected_exercises = []

        for exercise_id in exercise_ids:
            if exercise_id in self.exercises:
                exercise = self.exercises[exercise_id]

                # Apply adaptive difficulty
                adapted_exercise = self._adapt_exercise_difficulty(exercise, user_progress)
                selected_exercises.append(adapted_exercise)

        return selected_exercises

    def _adapt_exercise_difficulty(self, exercise: CBTExercise, user_progress: UserCBTProgress) -> CBTExercise:
        """Adapt exercise difficulty based on user progress"""

        # Calculate user's current skill level for this exercise type
        skill_level = user_progress.skill_mastery.get(exercise.type, 0.5)

        # Adjust difficulty based on skill level
        if skill_level < 0.4:
            # Beginner level - simplify
            adapted_exercise = CBTExercise(
                exercise_id=exercise.exercise_id,
                module_id=exercise.module_id,
                title=f"{exercise.title} (Nybörjarnivå)",
                type=exercise.type,
                difficulty='beginner',
                duration=max(exercise.duration - 5, 10),
                swedish_instructions=exercise.swedish_instructions + "\n\nTa det lugnt och fokusera på att lära dig tekniken.",
                prompts=exercise.prompts[:3],  # Fewer prompts
                adaptive_elements=exercise.adaptive_elements,
                success_metrics=exercise.success_metrics
            )
        elif skill_level > 0.8:
            # Advanced level - challenge
            adapted_exercise = CBTExercise(
                exercise_id=exercise.exercise_id,
                module_id=exercise.module_id,
                title=f"{exercise.title} (Avancerad nivå)",
                type=exercise.type,
                difficulty='advanced',
                duration=exercise.duration,
                swedish_instructions=exercise.swedish_instructions + "\n\nUtmana dig själv att gå djupare i analysen.",
                prompts=exercise.prompts,  # All prompts
                adaptive_elements=exercise.adaptive_elements,
                success_metrics=exercise.success_metrics + ['applied_in_real_situation']
            )
        else:
            # Intermediate - standard
            adapted_exercise = exercise

        return adapted_exercise

    def _calculate_adaptive_adjustments(self, user_progress: UserCBTProgress, context: dict[str, Any]) -> dict[str, Any]:
        """Calculate adaptive adjustments for the session"""

        adjustments = {
            'pace_adjustment': 1.0,
            'difficulty_modifier': 0.0,
            'support_level': 'standard',
            'motivation_boost': False
        }

        # Adjust based on recent performance
        recent_exercises = user_progress.exercise_history[-5:]  # Last 5 exercises
        if recent_exercises:
            avg_success = sum(ex.get('success_rate', 0.5) for ex in recent_exercises) / len(recent_exercises)

            if avg_success < 0.6:
                adjustments['pace_adjustment'] = 0.8  # Slower pace
                adjustments['support_level'] = 'high'
                adjustments['motivation_boost'] = True
            elif avg_success > 0.9:
                adjustments['pace_adjustment'] = 1.2  # Faster pace
                adjustments['difficulty_modifier'] = 0.2  # Slightly harder

        # Adjust for time of day
        time_of_day = context.get('time_of_day', 'morning')
        if time_of_day == 'evening':
            adjustments['pace_adjustment'] *= 0.9  # Slightly slower in evening

        # Adjust for current mood
        current_mood_intensity = context.get('mood_intensity', 0.5)
        if current_mood_intensity > 0.8:
            adjustments['support_level'] = 'high'
            adjustments['pace_adjustment'] *= 0.8

        return adjustments

    def _assess_difficulty_progression(self, user_progress: UserCBTProgress) -> str:
        """Assess overall difficulty progression for user"""

        avg_mastery = sum(user_progress.skill_mastery.values()) / max(len(user_progress.skill_mastery), 1)

        if avg_mastery < 0.4:
            return 'beginner_focus'
        elif avg_mastery < 0.7:
            return 'intermediate_building'
        else:
            return 'advanced_mastery'

    def _generate_motivational_elements(self, user_progress: UserCBTProgress, session_focus: str) -> list[str]:
        """Generate personalized motivational elements"""

        motivational_elements = []

        # Streak-based motivation
        if user_progress.streak_count > 0:
            motivational_elements.append(f"Du har hållit igång i {user_progress.streak_count} dagar!")

        # Progress-based motivation
        completed_modules = len(user_progress.completed_modules)
        if completed_modules > 0:
            motivational_elements.append(f"Du har redan genomfört {completed_modules} modul(er). Fortsätt så!")

        # Focus-specific motivation
        focus_motivation = {
            'anxiety_management': 'Varje andetag tar dig närmare kontroll över din ångest.',
            'behavioral_activation': 'Små steg leder till stora förändringar.',
            'cognitive_restructuring': 'Dina tankar formar din verklighet - du har kraften att förändra dem.'
        }

        if session_focus in focus_motivation:
            motivational_elements.append(focus_motivation[session_focus])

        return motivational_elements

    def _generate_swedish_guidance(self, session_focus: str, context: dict[str, Any]) -> str:
        """Generate Swedish guidance text for the session"""

        base_guidance = {
            'anxiety_management': """
            Kom ihåg att ångest är en normal mänsklig reaktion. Genom att öva dessa tekniker
            lär du dig att hantera ångest mer effektivt. Var snäll mot dig själv genom processen.
            """,
            'behavioral_activation': """
            Även små aktiviteter kan göra stor skillnad för ditt mående. Fokusera på att göra
            något idag som ger en känsla av prestation eller glädje.
            """,
            'cognitive_restructuring': """
            Dina tankar är inte fakta - de är tolkningar. Genom att utmana negativa tankar
            kan du utveckla mer balanserade perspektiv på situationer.
            """
        }

        guidance = base_guidance.get(session_focus, """
        Fokusera på att lära dig något nytt idag. Varje liten insikt är ett steg framåt
        på din resa mot bättre psykisk hälsa.
        """)

        # Add time-specific guidance
        time_of_day = context.get('time_of_day', 'morning')
        if time_of_day == 'morning':
            guidance += " En bra start på dagen kan göra stor skillnad för hela dagen."
        elif time_of_day == 'evening':
            guidance += " Avsluta dagen med något som främjar avslappning och återhämtning."

        return guidance.strip()

    def update_user_progress(
        self,
        user_id: str,
        exercise_id: str,
        completion_data: dict[str, Any]
    ):
        """Update user's CBT progress after completing an exercise"""

        logger.info(f"Updating CBT progress for user {user_id}, exercise {exercise_id}")

        # Calculate success metrics
        success_rate = completion_data.get('success_rate', 0.5)
        completion_data.get('time_spent', 0)
        completion_data.get('difficulty_rating', 3)

        # Update skill mastery
        exercise = self.exercises.get(exercise_id)
        if exercise:
            skill_type = exercise.type
            current_mastery = completion_data.get('current_skill_mastery', {}).get(skill_type, 0.5)

            # Adjust mastery based on performance
            mastery_adjustment = (success_rate - 0.5) * 0.1
            new_mastery = min(1.0, max(0.0, current_mastery + mastery_adjustment))

            logger.info(f"Updated {skill_type} mastery from {current_mastery:.2f} to {new_mastery:.2f}")

    def get_user_insights(self, user_progress: UserCBTProgress) -> dict[str, Any]:
        """Generate insights about user's CBT journey"""

        insights = {
            'overall_progress': self._calculate_overall_progress(user_progress),
            'strength_areas': self._identify_strength_areas(user_progress),
            'improvement_areas': self._identify_improvement_areas(user_progress),
            'recommended_next_steps': self._generate_next_steps(user_progress),
            'streak_info': {
                'current_streak': user_progress.streak_count,
                'longest_streak': user_progress.streak_count,  # Simplified
                'consistency_rating': self._calculate_consistency(user_progress)
            }
        }

        return insights

    def _calculate_overall_progress(self, user_progress: UserCBTProgress) -> float:
        """Calculate overall CBT progress"""

        if not user_progress.skill_mastery:
            return 0.0

        avg_mastery = sum(user_progress.skill_mastery.values()) / len(user_progress.skill_mastery)
        modules_completed = len(user_progress.completed_modules)

        # Weight mastery more heavily than completion
        progress = (avg_mastery * 0.7) + (min(modules_completed / 3, 1.0) * 0.3)

        return min(1.0, progress)

    def _identify_strength_areas(self, user_progress: UserCBTProgress) -> list[str]:
        """Identify areas where user excels"""

        strengths = []
        for skill, mastery in user_progress.skill_mastery.items():
            if mastery > 0.8:
                skill_names = {
                    'thought_record': 'Tankeprotokoll',
                    'behavioral_experiment': 'Beteendeexperiment',
                    'cognitive_restructuring': 'Kognitiv omstrukturering',
                    'exposure': 'Exponeringstekniker'
                }
                strengths.append(skill_names.get(skill, skill))

        return strengths

    def _identify_improvement_areas(self, user_progress: UserCBTProgress) -> list[str]:
        """Identify areas needing improvement"""

        improvements = []
        for skill, mastery in user_progress.skill_mastery.items():
            if mastery < 0.6:
                skill_names = {
                    'thought_record': 'Tankeprotokoll',
                    'behavioral_experiment': 'Beteendeexperiment',
                    'cognitive_restructuring': 'Kognitiv omstrukturering',
                    'exposure': 'Exponeringstekniker'
                }
                improvements.append(skill_names.get(skill, skill))

        return improvements

    def _generate_next_steps(self, user_progress: UserCBTProgress) -> list[str]:
        """Generate recommended next steps"""

        next_steps = []

        # Check for incomplete modules
        available_modules = ['anxiety_basics', 'depression_cognitive', 'stress_management']
        incomplete_modules = [m for m in available_modules if m not in user_progress.completed_modules]

        if incomplete_modules:
            next_steps.append(f"Fortsätt med modul: {self.modules[incomplete_modules[0]].title}")

        # Check for low mastery skills
        low_mastery_skills = [skill for skill, mastery in user_progress.skill_mastery.items() if mastery < 0.7]
        if low_mastery_skills:
            next_steps.append("Öva mer på grundläggande tekniker innan du går vidare")

        # Streak maintenance
        if user_progress.streak_count < 7:
            next_steps.append("Försök att öva varje dag för att bygga en vana")

        return next_steps

    def _calculate_consistency(self, user_progress: UserCBTProgress) -> str:
        """Calculate user's consistency rating"""

        if user_progress.streak_count >= 30:
            return 'excellent'
        elif user_progress.streak_count >= 14:
            return 'very_good'
        elif user_progress.streak_count >= 7:
            return 'good'
        elif user_progress.streak_count >= 3:
            return 'fair'
        else:
            return 'needs_improvement'


# Singleton instance
cbt_engine = CBTEngine()
