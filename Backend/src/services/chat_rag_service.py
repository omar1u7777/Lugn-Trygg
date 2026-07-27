"""
Advanced RAG (Retrieval-Augmented Generation) Service for AI Chat
Provides personalized context-aware conversations using vector similarity search
"""

import hashlib
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

import numpy as np

# Embedding via Azure OpenAI API (no local model — saves ~420 MB RAM on Starter)
try:
    from openai import AzureOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    import pinecone
    PINECONE_AVAILABLE = True
except ImportError:
    PINECONE_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class RetrievedContext:
    """Context retrieved from vector store for prompt augmentation"""
    content: str
    source: str  # 'mood_logs', 'journal', 'goals', 'coping_strategies', 'conversations'
    similarity: float
    timestamp: datetime
    metadata: dict[str, Any]


@dataclass
class ConversationMemory:
    """Structured conversation memory for RAG"""
    user_id: str
    session_id: str
    messages: list[dict]
    emotional_trajectory: list[dict]
    key_topics: list[str]
    therapeutic_insights: list[dict]
    created_at: datetime
    last_updated: datetime


class ChatRAGService:
    """
    Professional RAG service for therapeutic AI conversations

    Features:
    - Semantic search across user's mental health data
    - Conversation memory with emotional trajectory tracking
    - Multi-source context retrieval (moods, journal, goals, strategies)
    - Duplicate detection and semantic caching
    - Privacy-preserving context selection
    """

    def __init__(self, user_id: str):
        self.user_id = user_id
        self.session_id = hashlib.sha256(f"{user_id}_{datetime.now().isoformat()}".encode()).hexdigest()[:16]

        # Initialize Azure OpenAI embedding client
        self.embedding_client = None
        self._embedding_deployment = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-small")
        if OPENAI_AVAILABLE:
            azure_key = os.getenv("AZURE_OPENAI_API_KEY")
            azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
            azure_api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
            if azure_key and azure_endpoint:
                try:
                    import httpx
                    timeout = httpx.Timeout(10.0, connect=5.0, read=30.0, write=10.0, pool=5.0)
                    self.embedding_client = AzureOpenAI(
                        api_key=azure_key,
                        azure_endpoint=azure_endpoint,
                        api_version=azure_api_version,
                        timeout=timeout,
                        max_retries=2,
                    )
                    logger.info(f"RAG: Azure OpenAI embedding client ready for user {user_id}")
                except Exception as e:
                    logger.warning(f"RAG: Failed to init Azure OpenAI embedding client: {e}")

        # Pinecone or Firestore vector store
        self.vector_store = None
        self._init_vector_store()

        # Semantic cache to avoid repeated embeddings
        self._embedding_cache: dict[str, np.ndarray] = {}
        self._cache_hits = 0
        self._cache_misses = 0
        self._max_cache_size = 1000  # CRITICAL FIX: Limit cache size to prevent memory leaks

    def _init_vector_store(self):
        """Initialize vector store (Pinecone preferred, Firestore fallback)"""
        if PINECONE_AVAILABLE:
            try:
                pinecone_api_key = os.getenv('PINECONE_API_KEY')
                if pinecone_api_key:
                    pinecone.init(api_key=pinecone_api_key, environment='us-west1-gcp')
                    self.vector_store = 'pinecone'
                    logger.info("RAG: Using Pinecone vector store")
                    return
            except Exception as e:
                logger.warning(f"RAG: Pinecone init failed: {e}")

        # Fallback to Firestore for metadata + local embeddings
        self.vector_store = 'firestore'
        logger.info("RAG: Using Firestore fallback for vector storage")

    def embed_text(self, text: str) -> np.ndarray | None:
        """Generate embedding for text with caching"""
        if not text:
            return None

        # Check cache
        cache_key = hashlib.md5(text.encode()).hexdigest()[:16]
        if cache_key in self._embedding_cache:
            self._cache_hits += 1
            return self._embedding_cache[cache_key]

        # Generate embedding via Azure OpenAI API
        if self.embedding_client:
            try:
                response = self.embedding_client.embeddings.create(
                    input=text,
                    model=self._embedding_deployment,
                )
                embedding = np.array(response.data[0].embedding, dtype=np.float32)
                self._embedding_cache[cache_key] = embedding
                self._cache_misses += 1

                # Limit cache size
                if len(self._embedding_cache) > self._max_cache_size:
                    oldest_keys = list(self._embedding_cache.keys())[:100]
                    for key in oldest_keys:
                        del self._embedding_cache[key]

                return embedding
            except Exception as e:
                logger.error(f"RAG: Embedding generation failed: {e}")

        return None

    def prewarm_embeddings(self, texts: list[str]) -> None:
        """Embed many texts in ONE batched API call and populate the cache.

        PERFORMANCE: retrieval embeds every candidate document (up to ~100 per
        chat message across moods/journal/goals/strategies/conversations). Doing
        that one-at-a-time meant ~100 sequential Azure round-trips per message.
        The embeddings API accepts a LIST, so we batch all cache misses into a
        single request; the subsequent per-document embed_text() calls then hit
        the cache. Failure here is non-fatal — callers fall back to per-text
        embedding exactly as before.
        """
        if not self.embedding_client or not texts:
            return

        # Deduplicate + keep only cache misses, preserving order.
        pending: list[str] = []
        seen: set[str] = set()
        for text in texts:
            if not text or not text.strip():
                continue
            cache_key = hashlib.md5(text.encode()).hexdigest()[:16]
            if cache_key in self._embedding_cache or cache_key in seen:
                continue
            seen.add(cache_key)
            pending.append(text)

        if not pending:
            return

        # Chunk to stay well inside per-request input limits.
        BATCH = 64
        for start in range(0, len(pending), BATCH):
            chunk = pending[start:start + BATCH]
            try:
                response = self.embedding_client.embeddings.create(
                    input=chunk,
                    model=self._embedding_deployment,
                )
                # Response items carry .index mapping back to the input order.
                for item in response.data:
                    idx = getattr(item, 'index', None)
                    if idx is None or idx >= len(chunk):
                        continue
                    key = hashlib.md5(chunk[idx].encode()).hexdigest()[:16]
                    self._embedding_cache[key] = np.array(item.embedding, dtype=np.float32)
                    self._cache_misses += 1
            except Exception as e:
                # Non-fatal: the per-text path still works for THIS chunk,
                # just slower. Using `continue` (not `return`) so one bad
                # chunk doesn't abandon every remaining chunk — with >64
                # pending texts a single transient blip on chunk 1 would
                # otherwise silently revert the ENTIRE call back to one
                # request per document, quietly undoing the whole batching
                # optimization for the rest of the message.
                logger.warning(f"RAG: Batched embedding failed for one chunk ({len(chunk)} texts): {e}")
                continue

        # Keep the cache bounded (same policy as embed_text).
        if len(self._embedding_cache) > self._max_cache_size:
            overflow = len(self._embedding_cache) - self._max_cache_size
            for key in list(self._embedding_cache.keys())[:overflow + 100]:
                self._embedding_cache.pop(key, None)

    def retrieve_context(
        self,
        query: str,
        context_types: list[str] = None,
        max_results: int = 5,
        recency_days: int = 30
    ) -> list[RetrievedContext]:
        """
        Retrieve relevant context from user's mental health data

        Args:
            query: User's current message/query
            context_types: Types of context to search ['mood', 'journal', 'goals', 'strategies']
            max_results: Maximum number of results to return
            recency_days: Only consider data from last N days

        Returns:
            List of RetrievedContext ordered by relevance
        """
        if context_types is None:
            context_types = ['mood', 'journal', 'goals', 'strategies', 'conversations']

        query_embedding = self.embed_text(query)
        if query_embedding is None:
            logger.warning("RAG: No embedding available, returning empty context")
            return []

        all_contexts = []

        try:
            from src.firebase_config import db

            cutoff_date = datetime.now() - timedelta(days=recency_days)

            # Retrieve from each context type
            if 'mood' in context_types:
                mood_contexts = self._retrieve_mood_contexts(db, query_embedding, cutoff_date, max_results)
                all_contexts.extend(mood_contexts)

            if 'journal' in context_types:
                journal_contexts = self._retrieve_journal_contexts(db, query_embedding, cutoff_date, max_results)
                all_contexts.extend(journal_contexts)

            if 'goals' in context_types:
                goals_contexts = self._retrieve_goals_contexts(db, query_embedding, max_results)
                all_contexts.extend(goals_contexts)

            if 'strategies' in context_types:
                strategy_contexts = self._retrieve_coping_strategies(db, query_embedding, max_results)
                all_contexts.extend(strategy_contexts)

            if 'conversations' in context_types:
                conversation_contexts = self._retrieve_conversation_history(db, query_embedding, cutoff_date, max_results)
                all_contexts.extend(conversation_contexts)

            # Sort by similarity and return top results
            all_contexts.sort(key=lambda x: x.similarity, reverse=True)
            return all_contexts[:max_results]

        except Exception as e:
            logger.error(f"RAG: Context retrieval failed: {e}")
            return []

    def _calculate_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Calculate cosine similarity between embeddings"""
        return float(np.dot(embedding1, embedding2) / (np.linalg.norm(embedding1) * np.linalg.norm(embedding2)))

    def _retrieve_mood_contexts(
        self, db, query_embedding: np.ndarray, cutoff_date: datetime, max_results: int
    ) -> list[RetrievedContext]:
        """Retrieve relevant mood entries"""
        contexts = []

        try:
            mood_docs = db.collection('users').document(self.user_id)\
                .collection('moods')\
                .where('timestamp', '>=', cutoff_date.isoformat())\
                .order_by('timestamp', direction='DESCENDING')\
                .limit(50)\
                .get()

            mood_docs = list(mood_docs)
            # ONE batched embedding call for all candidates; the per-doc
            # embed_text() below then resolves from cache.
            self.prewarm_embeddings([
                f"{(d.to_dict() or {}).get('mood_label', '')} {(d.to_dict() or {}).get('note', '')}"
                for d in mood_docs
            ])

            for doc in mood_docs:
                data = doc.to_dict()
                mood_text = f"{data.get('mood_label', '')} {data.get('note', '')}"

                if mood_text.strip():
                    mood_embedding = self.embed_text(mood_text)
                    if mood_embedding is not None:
                        similarity = self._calculate_similarity(query_embedding, mood_embedding)

                        if similarity > 0.6:  # Threshold for relevance
                            contexts.append(RetrievedContext(
                                content=f"Mood: {data.get('mood_label', 'Unknown')} - {data.get('note', '')}",
                                source='mood_logs',
                                similarity=similarity,
                                timestamp=datetime.fromisoformat(data.get('timestamp', datetime.now().isoformat())),
                                metadata={
                                    'valence': data.get('valence'),
                                    'intensity': data.get('intensity'),
                                    'tags': data.get('tags', [])
                                }
                            ))
        except Exception as e:
            logger.warning(f"RAG: Mood context retrieval failed: {e}")

        return sorted(contexts, key=lambda x: x.similarity, reverse=True)[:max_results]

    def _retrieve_journal_contexts(
        self, db, query_embedding: np.ndarray, cutoff_date: datetime, max_results: int
    ) -> list[RetrievedContext]:
        """Retrieve relevant journal entries"""
        contexts = []

        try:
            journal_docs = db.collection('users').document(self.user_id)\
                .collection('journal_entries')\
                .where('timestamp', '>=', cutoff_date.isoformat())\
                .order_by('timestamp', direction='DESCENDING')\
                .limit(30)\
                .get()

            journal_docs = list(journal_docs)
            self.prewarm_embeddings([
                f"{(d.to_dict() or {}).get('title', '')} {(d.to_dict() or {}).get('content', '')}"
                for d in journal_docs
            ])

            for doc in journal_docs:
                data = doc.to_dict()
                entry_text = f"{data.get('title', '')} {data.get('content', '')}"

                if entry_text.strip():
                    entry_embedding = self.embed_text(entry_text)
                    if entry_embedding is not None:
                        similarity = self._calculate_similarity(query_embedding, entry_embedding)

                        if similarity > 0.65:  # Higher threshold for journal entries
                            contexts.append(RetrievedContext(
                                content=f"Journal: {data.get('title', 'Untitled')} - {data.get('content', '')[:200]}...",
                                source='journal',
                                similarity=similarity,
                                timestamp=datetime.fromisoformat(data.get('timestamp', datetime.now().isoformat())),
                                metadata={
                                    'tags': data.get('tags', []),
                                    'mood_at_time': data.get('mood_at_time')
                                }
                            ))
        except Exception as e:
            logger.warning(f"RAG: Journal context retrieval failed: {e}")

        return sorted(contexts, key=lambda x: x.similarity, reverse=True)[:max_results]

    def _retrieve_goals_contexts(
        self, db, query_embedding: np.ndarray, max_results: int
    ) -> list[RetrievedContext]:
        """Retrieve user's goals and aspirations"""
        contexts = []

        try:
            goals_docs = db.collection('users').document(self.user_id)\
                .collection('goals')\
                .where('status', 'in', ['active', 'in_progress'])\
                .limit(20)\
                .get()

            goals_docs = list(goals_docs)
            self.prewarm_embeddings([
                f"{(d.to_dict() or {}).get('title', '')} {(d.to_dict() or {}).get('description', '')}"
                for d in goals_docs
            ])

            for doc in goals_docs:
                data = doc.to_dict()
                goal_text = f"{data.get('title', '')} {data.get('description', '')}"

                if goal_text.strip():
                    goal_embedding = self.embed_text(goal_text)
                    if goal_embedding is not None:
                        similarity = self._calculate_similarity(query_embedding, goal_embedding)

                        if similarity > 0.55:  # Lower threshold for goals
                            contexts.append(RetrievedContext(
                                content=f"Goal: {data.get('title', '')} - {data.get('description', '')}",
                                source='goals',
                                similarity=similarity,
                                timestamp=datetime.fromisoformat(data.get('created_at', datetime.now().isoformat())),
                                metadata={
                                    'category': data.get('category'),
                                    'progress': data.get('progress', 0)
                                }
                            ))
        except Exception as e:
            logger.warning(f"RAG: Goals context retrieval failed: {e}")

        return sorted(contexts, key=lambda x: x.similarity, reverse=True)[:max_results]

    def _retrieve_coping_strategies(
        self, db, query_embedding: np.ndarray, max_results: int
    ) -> list[RetrievedContext]:
        """Retrieve user's successful coping strategies"""
        contexts = []

        try:
            # Get strategies that have been helpful (rated positively)
            strategies_docs = db.collection('users').document(self.user_id)\
                .collection('coping_strategies')\
                .where('effectiveness_rating', '>=', 3)\
                .order_by('effectiveness_rating', direction='DESCENDING')\
                .limit(15)\
                .get()

            strategies_docs = list(strategies_docs)
            self.prewarm_embeddings([
                f"{(d.to_dict() or {}).get('name', '')} {(d.to_dict() or {}).get('description', '')}"
                for d in strategies_docs
            ])

            for doc in strategies_docs:
                data = doc.to_dict()
                strategy_text = f"{data.get('name', '')} {data.get('description', '')}"

                if strategy_text.strip():
                    strategy_embedding = self.embed_text(strategy_text)
                    if strategy_embedding is not None:
                        similarity = self._calculate_similarity(query_embedding, strategy_embedding)

                        if similarity > 0.6:
                            contexts.append(RetrievedContext(
                                content=f"Coping Strategy: {data.get('name', '')} - {data.get('description', '')}",
                                source='coping_strategies',
                                similarity=similarity,
                                timestamp=datetime.fromisoformat(data.get('last_used', datetime.now().isoformat())),
                                metadata={
                                    'effectiveness': data.get('effectiveness_rating'),
                                    'usage_count': data.get('usage_count', 0)
                                }
                            ))
        except Exception as e:
            logger.warning(f"RAG: Coping strategies retrieval failed: {e}")

        return sorted(contexts, key=lambda x: x.similarity, reverse=True)[:max_results]

    def _retrieve_conversation_history(
        self, db, query_embedding: np.ndarray, cutoff_date: datetime, max_results: int
    ) -> list[RetrievedContext]:
        """Retrieve relevant previous conversations"""
        contexts = []

        try:
            conv_docs = db.collection('users').document(self.user_id)\
                .collection('conversations')\
                .where('timestamp', '>=', cutoff_date.isoformat())\
                .where('role', '==', 'user')\
                .order_by('timestamp', direction='DESCENDING')\
                .limit(40)\
                .get()

            # Group by session/conversation thread
            session_messages: dict[str, list[dict]] = {}
            for doc in conv_docs:
                data = doc.to_dict()
                session_id = data.get('session_id', 'default')
                if session_id not in session_messages:
                    session_messages[session_id] = []
                session_messages[session_id].append(data)

            # ONE batched embedding call for every session thread.
            self.prewarm_embeddings([
                ' '.join([m.get('content', '') for m in msgs])
                for msgs in session_messages.values()
            ])

            # Find most relevant conversation threads
            for session_id, messages in session_messages.items():
                session_text = ' '.join([m.get('content', '') for m in messages])

                if session_text.strip():
                    session_embedding = self.embed_text(session_text)
                    if session_embedding is not None:
                        similarity = self._calculate_similarity(query_embedding, session_embedding)

                        if similarity > 0.7:  # High threshold for conversations
                            # Get AI responses from this session
                            ai_responses = [
                                m.get('content', '')[:150]
                                for m in messages
                                if m.get('role') == 'assistant'
                            ]

                            contexts.append(RetrievedContext(
                                content=f"Previous conversation: {' '.join(ai_responses[:2])}",
                                source='conversations',
                                similarity=similarity,
                                timestamp=datetime.fromisoformat(messages[0].get('timestamp', datetime.now().isoformat())),
                                metadata={
                                    'session_id': session_id,
                                    'message_count': len(messages)
                                }
                            ))
        except Exception as e:
            logger.warning(f"RAG: Conversation history retrieval failed: {e}")

        return sorted(contexts, key=lambda x: x.similarity, reverse=True)[:max_results]

    def augment_prompt(self, user_message: str, base_prompt: str) -> str:
        """
        Augment system prompt with retrieved context

        This is the main entry point for RAG-enhanced conversations
        """
        # Retrieve relevant context
        contexts = self.retrieve_context(user_message)

        if not contexts:
            return base_prompt

        # Build context section
        context_sections = []
        sources_used = set()

        for ctx in contexts:
            if ctx.source not in sources_used:
                sources_used.add(ctx.source)
                relevance_indicator = "⭐" if ctx.similarity > 0.8 else ""
                context_sections.append(
                    f"[{ctx.source.upper()}]{relevance_indicator} {ctx.content}"
                )

        # Build augmented prompt
        context_text = "\n\n".join(context_sections)

        augmented_prompt = f"""{base_prompt}

=== RELEVANT USER CONTEXT ===
The following information from the user's history may help you provide a more personalized and consistent response:

{context_text}

=== INSTRUCTIONS FOR USING CONTEXT ===
- Use the context to maintain continuity with previous conversations
- Reference the user's goals and coping strategies when relevant
- Acknowledge patterns in their mood or journal entries if appropriate
- Do NOT repeat information the user just told you
- Be natural and conversational, not robotic
- Focus on being helpful and supportive based on their history

=== USER'S MESSAGE ===
"""

        return augmented_prompt

    def get_cache_stats(self) -> dict[str, int]:
        """Get embedding cache statistics"""
        total_requests = self._cache_hits + self._cache_misses
        hit_rate = self._cache_hits / total_requests if total_requests > 0 else 0

        return {
            'cache_hits': self._cache_hits,
            'cache_misses': self._cache_misses,
            'hit_rate': hit_rate,
            'cache_size': len(self._embedding_cache)
        }


# Global service cache
_chat_rag_cache: dict[str, ChatRAGService] = {}


def get_chat_rag_service(user_id: str) -> ChatRAGService:
    """Get or create RAG service for user"""
    if user_id not in _chat_rag_cache:
        _chat_rag_cache[user_id] = ChatRAGService(user_id)
    return _chat_rag_cache[user_id]


# Lazy import os at module level for Pinecone check
