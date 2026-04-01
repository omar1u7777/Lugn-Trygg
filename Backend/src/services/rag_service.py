"""
Retrieval-Augmented Generation (RAG) Service for Personalized AI Therapy.
Stores and retrieves user-specific context to personalize therapeutic responses.
"""

import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime

# Graceful import of vector store
try:
    import pinecone
    PINECONE_AVAILABLE = True
except ImportError:
    PINECONE_AVAILABLE = False

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

from ..config.firebase_config import db

logger = logging.getLogger(__name__)


@dataclass
class UserContext:
    """Aggregated user context for RAG."""
    user_id: str
    effective_coping_strategies: list[dict]  # What has worked before
    treatment_goals: list[str]
    preferred_techniques: list[str]
    conversation_history_embeddings: list[dict]
    mood_patterns: dict
    crisis_history: list[dict]
    values_identified: list[str]
    last_updated: datetime


@dataclass
class RetrievedContext:
    """Context retrieved for augmenting prompts."""
    similar_past_conversations: list[dict]
    effective_strategies: list[str]
    relevant_goals: list[str]
    helpful_techniques: list[str]
    continuity_notes: str  # Summary of ongoing threads


class VectorStore:
    """
    Vector store interface. Uses Pinecone in production, Firestore fallback in dev.
    """

    def __init__(self, use_pinecone: bool = True):
        self.use_pinecone = use_pinecone and PINECONE_AVAILABLE
        self.index = None
        self.embedding_model = None

        if self.use_pinecone:
            self._init_pinecone()
        else:
            logger.info("Using Firestore-based fallback vector storage")

        # Initialize embedding model
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                logger.info("Loading Swedish sentence transformer for embeddings...")
                self.embedding_model = SentenceTransformer('KBLab/sentence-bert-swedish-cased')
                logger.info("✅ Embedding model loaded")
            except Exception as e:
                logger.error(f"Failed to load embedding model: {e}")
                self.embedding_model = None

    def _init_pinecone(self):
        """Initialize Pinecone connection."""
        import os

        api_key = os.getenv("PINECONE_API_KEY")
        environment = os.getenv("PINECONE_ENVIRONMENT", "us-west1-gcp")
        index_name = os.getenv("PINECONE_INDEX_NAME", "lugn-trygg-therapeutic")

        if not api_key:
            logger.warning("PINECONE_API_KEY not set, falling back to Firestore")
            self.use_pinecone = False
            return

        try:
            pinecone.init(api_key=api_key, environment=environment)

            # Create index if it doesn't exist
            if index_name not in pinecone.list_indexes():
                pinecone.create_index(
                    name=index_name,
                    dimension=768,  # BERT embedding size
                    metric="cosine"
                )

            self.index = pinecone.Index(index_name)
            logger.info(f"✅ Pinecone index '{index_name}' connected")

        except Exception as e:
            logger.error(f"Failed to initialize Pinecone: {e}")
            self.use_pinecone = False

    def embed_text(self, text: str) -> list[float]:
        """Generate embedding for text."""
        if self.embedding_model is None:
            # Return zero vector as fallback
            return [0.0] * 768

        try:
            embedding = self.embedding_model.encode(text)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Embedding failed: {e}")
            return [0.0] * 768

    def upsert(self, id: str, vector: list[float], metadata: dict):
        """Store vector with metadata."""
        if self.use_pinecone and self.index:
            self.index.upsert(vectors=[(id, vector, metadata)])
        else:
            # Firestore fallback
            db.collection('vector_store').document(id).set({
                'vector': vector,
                'metadata': metadata,
                'timestamp': datetime.now().isoformat()
            })

    def query(self, vector: list[float], filter: dict = None, top_k: int = 5) -> list[dict]:
        """Query for similar vectors."""
        if self.use_pinecone and self.index:
            try:
                results = self.index.query(
                    vector=vector,
                    top_k=top_k,
                    filter=filter,
                    include_metadata=True
                )
                return [
                    {
                        'id': match['id'],
                        'score': match['score'],
                        'metadata': match.get('metadata', {})
                    }
                    for match in results['matches']
                ]
            except Exception as e:
                logger.error(f"Pinecone query failed: {e}")
                return []
        else:
            # Firestore fallback - simple cosine similarity
            return self._firestore_query(vector, filter, top_k)

    def _firestore_query(self, query_vector: list[float], filter: dict, top_k: int) -> list[dict]:
        """Fallback query using Firestore."""
        # In production, this would use a vector search extension or pgvector
        # For now, return recent documents
        docs = db.collection('vector_store').limit(top_k * 10).get()

        results = []
        for doc in docs:
            data = doc.to_dict()
            metadata = data.get('metadata', {})

            # Apply filter
            if filter:
                match = True
                for key, value in filter.items():
                    if metadata.get(key) != value:
                        match = False
                        break
                if not match:
                    continue

            # Calculate cosine similarity
            doc_vector = data.get('vector', [])
            if doc_vector:
                similarity = self._cosine_similarity(query_vector, doc_vector)
                results.append({
                    'id': doc.id,
                    'score': similarity,
                    'metadata': metadata
                })

        # Sort by similarity and return top_k
        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:top_k]

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        import numpy as np

        a = np.array(a)
        b = np.array(b)

        dot = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return dot / (norm_a * norm_b)


class RAGService:
    """
    Retrieval-Augmented Generation service for personalized therapy.
    Retrieves relevant context and augments AI prompts.
    """

    def __init__(self):
        logger.info("🧠 Initializing RAG Service...")
        self.vector_store = VectorStore()
        logger.info("✅ RAG Service initialized")

    def index_conversation(self, user_id: str, conversation_id: str,
                          messages: list[dict], outcome: str = "neutral"):
        """
        Index a conversation for future retrieval.
        
        Args:
            user_id: User identifier
            conversation_id: Conversation identifier
            messages: List of message dicts with role and content
            outcome: 'positive', 'neutral', 'negative', 'crisis'
        """
        try:
            # Concatenate user messages for embedding
            user_messages = [m['content'] for m in messages if m.get('role') == 'user']
            conversation_text = " ".join(user_messages)

            # Generate embedding
            embedding = self.vector_store.embed_text(conversation_text[:1000])  # Truncate for efficiency

            # Extract key metadata
            techniques_used = self._extract_techniques(messages)
            emotions = self._extract_emotions(messages)

            # Create metadata
            metadata = {
                'user_id': user_id,
                'type': 'conversation',
                'conversation_id': conversation_id,
                'outcome': outcome,
                'techniques_used': techniques_used,
                'emotions': emotions,
                'timestamp': datetime.now().isoformat(),
                'message_count': len(messages),
                'text_preview': conversation_text[:200]
            }

            # Store in vector database
            doc_id = f"conv_{user_id}_{conversation_id}_{datetime.now().timestamp()}"
            self.vector_store.upsert(doc_id, embedding, metadata)

            logger.info(f"Indexed conversation {conversation_id} for user {user_id[:8]}...")

        except Exception as e:
            logger.error(f"Failed to index conversation: {e}")

    def index_coping_strategy(self, user_id: str, strategy: str,
                               context: str, effectiveness: float):
        """
        Index a coping strategy that worked for the user.
        
        Args:
            user_id: User identifier
            strategy: Description of the coping strategy
            context: When/where this strategy was used
            effectiveness: 0.0 to 1.0 rating of how well it worked
        """
        try:
            embedding = self.vector_store.embed_text(f"{strategy} {context}")

            metadata = {
                'user_id': user_id,
                'type': 'coping_strategy',
                'strategy': strategy,
                'context': context,
                'effectiveness': effectiveness,
                'success_rate': effectiveness,  # For filtering
                'timestamp': datetime.now().isoformat()
            }

            doc_id = f"strategy_{user_id}_{hashlib.md5(strategy.encode()).hexdigest()[:8]}"
            self.vector_store.upsert(doc_id, embedding, metadata)

            logger.info(f"Indexed coping strategy for user {user_id[:8]}...")

        except Exception as e:
            logger.error(f"Failed to index coping strategy: {e}")

    def index_goal_progress(self, user_id: str, goal: str, progress: str):
        """Index treatment goal and progress."""
        try:
            embedding = self.vector_store.embed_text(goal)

            metadata = {
                'user_id': user_id,
                'type': 'goal',
                'goal': goal,
                'progress': progress,
                'timestamp': datetime.now().isoformat()
            }

            doc_id = f"goal_{user_id}_{hashlib.md5(goal.encode()).hexdigest()[:8]}"
            self.vector_store.upsert(doc_id, embedding, metadata)

        except Exception as e:
            logger.error(f"Failed to index goal: {e}")

    def retrieve_context(self, user_id: str, current_message: str,
                         top_k: int = 5) -> RetrievedContext:
        """
        Retrieve relevant context for augmenting the AI prompt.
        
        Returns:
            RetrievedContext with similar conversations, effective strategies, etc.
        """
        try:
            # Embed current message
            query_embedding = self.vector_store.embed_text(current_message)

            # 1. Retrieve similar past conversations with positive outcomes
            similar_conversations = self.vector_store.query(
                vector=query_embedding,
                filter={
                    'user_id': user_id,
                    'type': 'conversation',
                    'outcome': {'$in': ['positive', 'neutral']}  # Good outcomes
                },
                top_k=3
            )

            # 2. Retrieve effective coping strategies
            effective_strategies = self.vector_store.query(
                vector=query_embedding,
                filter={
                    'user_id': user_id,
                    'type': 'coping_strategy',
                    'success_rate': {'$gt': 0.6}  # >60% effective
                },
                top_k=2
            )

            # 3. Retrieve relevant goals
            relevant_goals = self.vector_store.query(
                vector=query_embedding,
                filter={
                    'user_id': user_id,
                    'type': 'goal'
                },
                top_k=2
            )

            # 4. Get continuity notes (ongoing threads from recent conversations)
            continuity_notes = self._get_continuity_notes(user_id)

            return RetrievedContext(
                similar_past_conversations=similar_conversations,
                effective_strategies=[s['metadata'].get('strategy', '') for s in effective_strategies],
                relevant_goals=[g['metadata'].get('goal', '') for g in relevant_goals],
                helpful_techniques=self._extract_techniques_from_conversations(similar_conversations),
                continuity_notes=continuity_notes
            )

        except Exception as e:
            logger.error(f"Context retrieval failed: {e}")
            return RetrievedContext(
                similar_past_conversations=[],
                effective_strategies=[],
                relevant_goals=[],
                helpful_techniques=[],
                continuity_notes=""
            )

    def generate_augmented_prompt(self, user_id: str, current_message: str,
                                   base_system_prompt: str) -> str:
        """
        Generate an augmented system prompt with retrieved context.
        
        This is the main RAG function - it personalizes the AI's response
        by adding user-specific context to the system prompt.
        """
        # Retrieve context
        context = self.retrieve_context(user_id, current_message)

        # Build context string
        context_parts = []

        # 1. Effective strategies
        if context.effective_strategies:
            strategies_text = "\n- " + "\n- ".join(context.effective_strategies[:3])
            context_parts.append(
                f"TIDIGARE EFFEKTIVA STRATEGIER FÖR DENNA ANVÄNDARE:\n"
                f"När användaren haft liknande känslor tidigare har följande hjälpt:{strategies_text}\n"
                f"Referera till dessa när det känns relevant."
            )

        # 2. Similar past conversations
        if context.similar_past_conversations:
            conv_summary = []
            for conv in context.similar_past_conversations[:2]:
                meta = conv.get('metadata', {})
                techniques = meta.get('techniques_used', [])
                outcome = meta.get('outcome', 'neutral')
                preview = meta.get('text_preview', '')[:100]

                conv_summary.append(
                    f"- Tidigare: '{preview}...' -> Använde: {', '.join(techniques)} (resultat: {outcome})"
                )

            context_parts.append(
                "\nLIKELUTANDE TIDIGARE KONVERSATIONER:\n" + "\n".join(conv_summary) + "\n"
                "Om användaren uttrycker liknande känslor igen, referera till vad som hjälpte då."
            )

        # 3. Current goals
        if context.relevant_goals:
            goals_text = "\n- " + "\n- ".join(context.relevant_goals[:2])
            context_parts.append(
                f"\nANVÄNDARENS AKTUELLA MÅL:\n"
                f"Användaren arbetar med:{goals_text}\n"
                f"Försök att koppla ditt svar till dessa mål när det är möjligt."
            )

        # 4. Continuity notes
        if context.continuity_notes:
            context_parts.append(
                f"\nKONTINUITET FRÅN FÖREGÅENDE KONVERSATION:\n{context.continuity_notes}"
            )

        # Combine with base prompt
        if context_parts:
            augmented_prompt = base_system_prompt + "\n\n" + "---\n".join(context_parts)
            augmented_prompt += (
                "\n\nVIKTIGT: Använd ovanstående kontext för att personanpassa ditt svar, "
                "men var naturlig och undvik att överreferera. Målet är att användaren känner sig förstådd, "
                "inte att AI:n 'vet' för mycket."
            )
            return augmented_prompt

        return base_system_prompt

    def _extract_techniques(self, messages: list[dict]) -> list[str]:
        """Extract therapeutic techniques from conversation."""
        techniques = []
        technique_keywords = {
            'thought_record': ['tanke-record', 'bevis för', 'bevis emot'],
            'grounding': ['5-4-3-2-1', 'grounding', 'förankring', 'sinnen'],
            'breathing': ['andning', 'andas', 'andas djupet'],
            'defusion': ['defusion', 'tack hjärnan', 'jag har tanken att'],
            'values': ['värderingar', 'värden', 'vad är viktigt', 'vem vill du vara']
        }

        all_text = " ".join([m.get('content', '') for m in messages]).lower()

        for technique, keywords in technique_keywords.items():
            if any(kw in all_text for kw in keywords):
                techniques.append(technique)

        return techniques

    def _extract_emotions(self, messages: list[dict]) -> list[str]:
        """Extract emotions from user messages."""
        emotion_keywords = {
            'sadness': ['ledsen', 'deppig', 'nedstämd', 'sorgsen', 'gråter'],
            'anxiety': ['orolig', 'ängslig', 'stressad', 'panik', 'nervös'],
            'anger': ['arg', 'ilska', 'rasande', 'frustrerad', 'irriterad'],
            'hopelessness': ['hopplös', 'meningslös', 'uppgiven'],
            'shame': ['skam', 'skäms', 'förstörd', 'värdelös']
        }

        emotions = []
        all_text = " ".join([m.get('content', '') for m in messages if m.get('role') == 'user']).lower()

        for emotion, keywords in emotion_keywords.items():
            if any(kw in all_text for kw in keywords):
                emotions.append(emotion)

        return emotions

    def _get_continuity_notes(self, user_id: str) -> str:
        """Get notes about ongoing threads from recent conversations."""
        try:
            # Get last conversation
            conv_ref = db.collection('users').document(user_id).collection('conversations')
            last_conv = conv_ref.order_by('timestamp', direction='DESCENDING').limit(1).get()

            if not last_conv:
                return ""

            # Check if there's an unresolved thread
            # This would require more sophisticated tracking in production
            return ""

        except Exception as e:
            logger.error(f"Failed to get continuity notes: {e}")
            return ""

    def _extract_techniques_from_conversations(self, conversations: list[dict]) -> list[str]:
        """Extract techniques that worked in similar conversations."""
        techniques = []
        for conv in conversations:
            meta = conv.get('metadata', {})
            conv_techniques = meta.get('techniques_used', [])
            techniques.extend(conv_techniques)

        return list(set(techniques))


# Singleton instance
_rag_service: RAGService | None = None


def get_rag_service() -> RAGService:
    """Get or create the RAG service singleton."""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
