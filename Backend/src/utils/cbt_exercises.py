import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import random

logger = logging.getLogger(__name__)


class CBTExerciseEngine:
    """
    Cognitive Behavioral Therapy exercise system
    Provides personalized CBT exercises based on user needs and progress
    """

    def __init__(self):
        self.exercise_library = self._initialize_exercise_library()

    def _initialize_exercise_library(self) -> Dict[str, List[Dict]]:
        """Initialize the comprehensive CBT exercise library"""
        return {
            "thought_records": [
                {
                    "id": "basic_thought_record",
                    "title": "Grundläggande tankeinventering",
                    "description": "Identifiera och utmana negativa tankemönster",
                    "difficulty": "beginner",
                    "duration": 15,
                    "category": "cognitive_restructuring",
                    "steps": [
                        "Beskriv situationen som utlöste tanken",
                        "Skriv ner den automatiska tanken",
                        "Identifiera de känslor tanken skapar",
                        "Utmana tanken med evidens",
                        "Formulera en mer balanserad tanke"
                    ],
                    "target_concerns": ["anxiety", "depression", "negative_thinking"]
                },
                {
                    "id": "core_beliefs_challenge",
                    "title": "Utmaning av grundläggande övertygelser",
                    "description": "Arbeta med djupare övertygelser som formar ditt tänkande",
                    "difficulty": "advanced",
                    "duration": 25,
                    "category": "schema_work",
                    "steps": [
                        "Identifiera en grundläggande övertygelse",
                        "Samla evidens för och emot övertygelsen",
                        "Utforska alternativa förklaringar",
                        "Skapa en mer nyanserad övertygelse",
                        "Testa den nya övertygelsen i vardagen"
                    ],
                    "target_concerns": ["low_self_esteem", "perfectionism", "core_beliefs"]
                }
            ],
            "behavioral_experiments": [
                {
                    "id": "fear_hierarchy",
                    "title": "Rädslahierarki och exponering",
                    "description": "Gradvis exponering för rädsla i kontrollerade steg",
                    "difficulty": "intermediate",
                    "duration": 20,
                    "category": "exposure",
                    "steps": [
                        "Lista dina rädslor från minst till mest skrämmande",
                        "Välj ett första steg att ta",
                        "Planera och genomför exponeringen",
                        "Reflektera över resultatet",
                        "Planera nästa steg"
                    ],
                    "target_concerns": ["anxiety", "phobias", "avoidance"]
                },
                {
                    "id": "activity_scheduling",
                    "title": "Aktivitetsschemaläggning",
                    "description": "Planera meningsfulla aktiviteter för att förbättra humöret",
                    "difficulty": "beginner",
                    "duration": 10,
                    "category": "behavioral_activation",
                    "steps": [
                        "Identifiera värdefulla aktivitetsområden",
                        "Välj specifika aktiviteter att planera",
                        "Schemalägg aktiviteterna i kalendern",
                        "Genomför aktiviteterna",
                        "Utvärdera effekten på ditt humör"
                    ],
                    "target_concerns": ["depression", "low_motivation", "apathy"]
                }
            ],
            "mindfulness_exercises": [
                {
                    "id": "body_scan",
                    "title": "Kroppskanning",
                    "description": "Medveten närvaro genom systematisk kroppsmedvetenhet",
                    "difficulty": "beginner",
                    "duration": 15,
                    "category": "mindfulness",
                    "steps": [
                        "Ligg bekvämt på rygg",
                        "Fokusera uppmärksamheten på fötterna",
                        "Långsamt skanna kroppen från tår till huvud",
                        "Lägg märke till sensationer utan att döma",
                        "Avsluta med några djupa andetag"
                    ],
                    "target_concerns": ["stress", "tension", "mindfulness"]
                },
                {
                    "id": "mindful_breathing",
                    "title": "Medveten andning",
                    "description": "Använd andningen som ankare för närvaro",
                    "difficulty": "beginner",
                    "duration": 5,
                    "category": "mindfulness",
                    "steps": [
                        "Sitt bekvämt med rak rygg",
                        "Lägg en hand på magen",
                        "Andas långsamt in och ut",
                        "Följ andningens naturliga rytm",
                        "Återvänd till andningen när tankarna vandrar"
                    ],
                    "target_concerns": ["anxiety", "racing_thoughts", "stress"]
                }
            ],
            "problem_solving": [
                {
                    "id": "problem_solving_worksheet",
                    "title": "Problemlösningsarbetsblad",
                    "description": "Strukturerad approach för att lösa problem",
                    "difficulty": "intermediate",
                    "duration": 20,
                    "category": "problem_solving",
                    "steps": [
                        "Definiera problemet tydligt",
                        "Generera möjliga lösningar",
                        "Utvärdera för- och nackdelar",
                        "Välj och implementera en lösning",
                        "Utvärdera resultatet och lär av det"
                    ],
                    "target_concerns": ["problem_solving", "decision_making", "overwhelm"]
                }
            ]
        }

    def generate_personalized_exercise(self, user_profile: Dict, current_concerns: List[str],
                                     exercise_history: List[Dict] = None) -> Dict[str, Any]:
        """
        Generate a personalized CBT exercise based on user profile and concerns

        Args:
            user_profile: User profile information
            current_concerns: List of current mental health concerns
            exercise_history: Previous exercises completed

        Returns:
            Personalized exercise recommendation
        """
        try:
            # Determine appropriate difficulty level
            difficulty = self._assess_difficulty_level(user_profile, exercise_history or [])

            # Find relevant exercises for concerns
            candidate_exercises = self._find_relevant_exercises(current_concerns, difficulty)

            if not candidate_exercises:
                # Fallback to general exercises
                candidate_exercises = self._get_fallback_exercises()

            # Select best exercise
            selected_exercise = self._select_optimal_exercise(
                candidate_exercises, exercise_history or [], user_profile
            )

            # Adapt exercise to user
            personalized_exercise = self._personalize_exercise(selected_exercise, user_profile)

            return {
                "exercise": personalized_exercise,
                "rationale": self._generate_rationale(selected_exercise, current_concerns),
                "estimated_benefit": self._estimate_benefit(selected_exercise, current_concerns),
                "follow_up": self._generate_follow_up_questions(selected_exercise),
                "success": True
            }

        except Exception as e:
            logger.error(f"Exercise generation failed: {str(e)}")
            return {
                "exercise": self._get_emergency_exercise(),
                "rationale": "Ett enkelt övning när andra alternativ inte är tillgängliga",
                "estimated_benefit": "Låg - men bättre än ingenting",
                "follow_up": ["Hur kändes övningen?", "Vill du prova något annat?"],
                "success": False,
                "error": str(e)
            }

    def _assess_difficulty_level(self, user_profile: Dict, exercise_history: List[Dict]) -> str:
        """Assess appropriate difficulty level for user"""
        # Check user experience
        completed_exercises = len(exercise_history)
        successful_completions = len([h for h in exercise_history if h.get("rating", 0) >= 3])

        if completed_exercises < 3:
            return "beginner"
        elif successful_completions / completed_exercises > 0.7:
            return "advanced"
        else:
            return "intermediate"

    def _find_relevant_exercises(self, concerns: List[str], difficulty: str) -> List[Dict]:
        """Find exercises relevant to user's concerns"""
        relevant_exercises = []

        for category, exercises in self.exercise_library.items():
            for exercise in exercises:
                # Check if exercise targets user's concerns
                if any(concern in exercise["target_concerns"] for concern in concerns):
                    # Check difficulty match
                    if exercise["difficulty"] == difficulty or (
                        difficulty == "intermediate" and exercise["difficulty"] in ["beginner", "intermediate"]
                    ):
                        relevant_exercises.append(exercise)

        return relevant_exercises

    def _get_fallback_exercises(self) -> List[Dict]:
        """Get general fallback exercises"""
        fallbacks = []
        for category, exercises in self.exercise_library.items():
            # Get beginner exercises from each category
            beginner_exercises = [e for e in exercises if e["difficulty"] == "beginner"]
            fallbacks.extend(beginner_exercises[:1])  # One from each category

        return fallbacks

    def _select_optimal_exercise(self, candidates: List[Dict], history: List[Dict],
                               user_profile: Dict) -> Dict:
        """Select the most appropriate exercise from candidates"""
        if len(candidates) == 1:
            return candidates[0]

        # Avoid recently completed exercises
        recent_exercise_ids = {h.get("exercise_id") for h in history[-5:]}  # Last 5 exercises
        available_candidates = [c for c in candidates if c["id"] not in recent_exercise_ids]

        if not available_candidates:
            available_candidates = candidates

        # Prefer exercises with good user ratings (if available in history)
        rated_exercises = {}
        for h in history:
            exercise_id = h.get("exercise_id")
            rating = h.get("rating", 0)
            if exercise_id and rating > 0:
                if exercise_id not in rated_exercises:
                    rated_exercises[exercise_id] = []
                rated_exercises[exercise_id].append(rating)

        # Calculate average ratings
        avg_ratings = {}
        for exercise_id, ratings in rated_exercises.items():
            avg_ratings[exercise_id] = sum(ratings) / len(ratings)

        # Sort by rating, then randomly select from top 3
        sorted_candidates = sorted(
            available_candidates,
            key=lambda x: avg_ratings.get(x["id"], 3.0),  # Default rating of 3.0
            reverse=True
        )

        # Return top candidate or random from top 3
        top_candidates = sorted_candidates[:3]
        return random.choice(top_candidates)

    def _personalize_exercise(self, exercise: Dict, user_profile: Dict) -> Dict:
        """Personalize exercise based on user profile"""
        personalized = exercise.copy()

        # Adapt duration based on user preferences
        time_available = user_profile.get("preferred_exercise_duration", 15)
        if time_available < exercise["duration"]:
            # Create shorter version
            personalized["duration"] = time_available
            personalized["steps"] = exercise["steps"][:3]  # Reduce steps
            personalized["title"] += " (kort version)"

        # Add user-specific context
        user_name = user_profile.get("name", "").split()[0] if user_profile.get("name") else ""
        if user_name:
            personalized["description"] = personalized["description"].replace(
                "du", f"du, {user_name}"
            )

        return personalized

    def _generate_rationale(self, exercise: Dict, concerns: List[str]) -> str:
        """Generate rationale for why this exercise was selected"""
        concern_map = {
            "anxiety": "ångest",
            "depression": "depression",
            "stress": "stress",
            "negative_thinking": "negativa tankemönster",
            "low_self_esteem": "lågt självförtroende",
            "phobias": "fobier",
            "avoidance": "undvikande beteenden"
        }

        relevant_concerns = [concern_map.get(c, c) for c in concerns if c in concern_map]

        if relevant_concerns:
            concern_text = ", ".join(relevant_concerns)
            return f"Denna övning är särskilt användbar för att arbeta med {concern_text}."
        else:
            return "Denna övning hjälper till att utveckla användbara coping-strategier."

    def _estimate_benefit(self, exercise: Dict, concerns: List[str]) -> str:
        """Estimate the potential benefit of the exercise"""
        difficulty = exercise["difficulty"]
        duration = exercise["duration"]

        if difficulty == "beginner" and duration <= 10:
            return "Hög - enkel att komma igång med och ger snabba resultat"
        elif difficulty == "advanced":
            return "Mycket hög - djupgående arbete med långsiktiga förändringar"
        else:
            return "Mellan - balanserad kombination av utmaning och genomförbarhet"

    def _generate_follow_up_questions(self, exercise: Dict) -> List[str]:
        """Generate follow-up questions for exercise reflection"""
        base_questions = [
            "Hur kändes övningen att göra?",
            "Vad upptäckte du under övningen?",
            "Hur kan du använda detta i vardagen?"
        ]

        # Add exercise-specific questions
        if exercise["category"] == "cognitive_restructuring":
            base_questions.append("Vilka tankar utmanade du?")
        elif exercise["category"] == "exposure":
            base_questions.append("Vad var det svåraste med övningen?")
        elif exercise["category"] == "mindfulness":
            base_questions.append("Hur påverkade övningen din närvaro?")

        return base_questions

    def _get_emergency_exercise(self) -> Dict:
        """Get a simple emergency exercise when generation fails"""
        return {
            "id": "emergency_breathing",
            "title": "Nödaning - 4-7-8 andning",
            "description": "Enkel andningsövning för omedelbar stresslindring",
            "difficulty": "beginner",
            "duration": 2,
            "category": "breathing",
            "steps": [
                "Andas ut helt genom munnen",
                "Andas in tyst genom näsan i 4 sekunder",
                "Håll andan i 7 sekunder",
                "Andas ut genom munnen i 8 sekunder med ett väsande ljud",
                "Upprepa 4 gånger"
            ],
            "target_concerns": ["stress", "anxiety", "panic"]
        }

    def track_exercise_progress(self, exercise_id: str, user_id: str,
                              completion_data: Dict) -> Dict[str, Any]:
        """
        Track and analyze exercise completion and effectiveness

        Args:
            exercise_id: ID of completed exercise
            user_id: User identifier
            completion_data: Completion data including rating, notes, etc.

        Returns:
            Progress analysis and recommendations
        """
        try:
            # Store completion data (would integrate with database)
            completion_record = {
                "exercise_id": exercise_id,
                "user_id": user_id,
                "completed_at": datetime.now().isoformat(),
                "rating": completion_data.get("rating", 0),
                "notes": completion_data.get("notes", ""),
                "difficulty_experienced": completion_data.get("difficulty", "medium"),
                "time_taken": completion_data.get("time_taken", 0)
            }

            # Analyze progress patterns
            progress_analysis = self._analyze_progress_patterns(user_id, exercise_id)

            # Generate next recommendations
            next_recommendations = self._generate_next_exercise_recommendations(
                user_id, exercise_id, completion_data
            )

            return {
                "completion_recorded": True,
                "progress_analysis": progress_analysis,
                "next_recommendations": next_recommendations,
                "streak_info": self._calculate_exercise_streak(user_id)
            }

        except Exception as e:
            logger.error(f"Progress tracking failed: {str(e)}")
            return {
                "completion_recorded": False,
                "error": str(e),
                "fallback_message": "Övningen registrerades men kunde inte analyseras"
            }

    def _analyze_progress_patterns(self, user_id: str, exercise_id: str) -> Dict[str, Any]:
        """Analyze user's progress patterns for this exercise type"""
        # This would query the database for historical data
        # For now, return mock analysis
        return {
            "times_completed": 1,
            "average_rating": 4.0,
            "improvement_trend": "stable",
            "recommended_frequency": "2-3 times per week"
        }

    def _generate_next_exercise_recommendations(self, user_id: str, completed_exercise_id: str,
                                              completion_data: Dict) -> List[Dict]:
        """Generate recommendations for next exercises"""
        rating = completion_data.get("rating", 3)

        if rating >= 4:
            # User liked it, recommend similar
            return [{
                "type": "similar_exercise",
                "reason": "Du tyckte om denna övning",
                "suggested_next": "Prova en avancerad version"
            }]
        elif rating <= 2:
            # User didn't like it, recommend alternatives
            return [{
                "type": "alternative_exercise",
                "reason": "Låt oss prova något annat som kan passa bättre",
                "suggested_next": "En kortare, enklare övning"
            }]
        else:
            # Neutral, continue with variety
            return [{
                "type": "continue_variety",
                "reason": "Bra jobbat! Fortsätt med olika övningar",
                "suggested_next": "Nästa övning från ett annat område"
            }]

    def _calculate_exercise_streak(self, user_id: str) -> Dict[str, Any]:
        """Calculate user's exercise completion streak"""
        # Mock streak calculation
        return {
            "current_streak": 3,
            "longest_streak": 7,
            "total_completed": 15,
            "streak_message": "3 dagar i rad - håll i gång!"
        }


# Global instance
cbt_engine = CBTExerciseEngine()