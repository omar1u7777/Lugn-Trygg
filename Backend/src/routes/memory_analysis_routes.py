"""
Memory Analysis Routes - AI-powered memory insights API
Provides intelligent analysis and therapeutic insights for memory journal entries
"""

import logging
from typing import Any

from flask import Blueprint, g, request

from src.firebase_config import db
from src.services.audit_service import audit_log
from src.services.auth_service import AuthService
from src.services.rate_limiting import rate_limit_by_endpoint
from src.services.memory_analysis_service import (
    get_memory_analysis_service,
    analyze_memory_entry,
    analyze_memory_collection
)
from src.utils.input_sanitization import input_sanitizer
from src.utils.response_utils import APIResponse

logger = logging.getLogger(__name__)

memory_analysis_bp = Blueprint('memory_analysis', __name__)


@memory_analysis_bp.route('/analyze/<memory_id>', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def analyze_single_memory(memory_id: str):
    """
    Analyze a single memory entry with AI
    
    Returns therapeutic insights, sentiment, themes, and suggestions
    """
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")
    
    try:
        # Sanitize memory_id
        memory_id = input_sanitizer.sanitize(memory_id, 'text', 100)
        
        # Fetch memory from Firestore
        memory_doc = db.collection('journal_entries').document(memory_id).get()
        
        if not memory_doc.exists:
            # Try memories collection (audio memories)
            memory_doc = db.collection('memories').document(memory_id).get()
        
        if not memory_doc.exists:
            return APIResponse.not_found("Memory not found")
        
        memory_data = memory_doc.to_dict()
        
        # Verify ownership
        if memory_data.get('user_id') != user_id:
            audit_log(
                event_type="UNAUTHORIZED_MEMORY_ANALYSIS",
                user_id=user_id,
                details={"attempted_memory_id": memory_id}
            )
            return APIResponse.forbidden("Unauthorized access to memory")
        
        # Get content (text or transcript)
        text_content = memory_data.get('content', '')
        if not text_content and memory_data.get('transcript'):
            text_content = memory_data.get('transcript')
        
        # Analyze with AI
        service = get_memory_analysis_service()
        analysis = service.analyze_text_memory(
            text=text_content,
            context={
                'memory_id': memory_id,
                'timestamp': memory_data.get('created_at'),
                'mood': memory_data.get('mood')
            }
        )
        
        # Save analysis to Firestore for caching
        analysis_ref = db.collection('memory_analyses').document(memory_id)
        analysis_ref.set({
            'user_id': user_id,
            'memory_id': memory_id,
            'sentiment_score': analysis.sentiment_score,
            'emotions': analysis.emotions,
            'themes': analysis.themes,
            'significance_score': analysis.significance_score,
            'therapeutic_insights': analysis.therapeutic_insights,
            'suggested_reflections': analysis.suggested_reflections,
            'analyzed_at': analysis.timestamp.isoformat()
        })
        
        audit_log(
            event_type="MEMORY_ANALYZED",
            user_id=user_id,
            details={
                "memory_id": memory_id,
                "primary_emotion": max(analysis.emotions, key=analysis.emotions.get),
                "sentiment": analysis.sentiment_score
            }
        )
        
        return APIResponse.success({
            'analysis': {
                'sentiment': {
                    'score': analysis.sentiment_score,
                    'label': 'positive' if analysis.sentiment_score > 0.3 else 
                            'negative' if analysis.sentiment_score < -0.3 else 'neutral'
                },
                'emotions': analysis.emotions,
                'themes': analysis.themes,
                'significance': analysis.significance_score,
                'insights': analysis.therapeutic_insights,
                'reflections': analysis.suggested_reflections
            },
            'memoryId': memory_id
        }, "Memory analysis completed")
        
    except Exception as e:
        logger.exception(f"Error analyzing memory {memory_id}: {e}")
        return APIResponse.error("Failed to analyze memory", "ANALYSIS_ERROR", 500)


@memory_analysis_bp.route('/patterns', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def detect_memory_patterns():
    """
    Detect patterns across user's memory collection
    
    Returns recurring themes, emotional arcs, and life milestones
    """
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")
    
    try:
        # Fetch user's memories
        from google.cloud.firestore import FieldFilter
        
        journal_entries = db.collection('journal_entries').where(
            filter=FieldFilter('user_id', '==', user_id)
        ).stream()
        
        memories = []
        for doc in journal_entries:
            data = doc.to_dict()
            memories.append({
                'id': doc.id,
                'content': data.get('content', ''),
                'timestamp': data.get('created_at', ''),
                'mood': data.get('mood')
            })
        
        if len(memories) < 3:
            return APIResponse.success({
                'patterns': [],
                'message': 'Save at least 3 memories to detect patterns'
            }, "Insufficient data for pattern detection")
        
        # Analyze patterns
        service = get_memory_analysis_service()
        patterns = service.detect_memory_patterns(memories)
        
        return APIResponse.success({
            'patterns': [
                {
                    'type': p.pattern_type,
                    'description': p.description,
                    'confidence': p.confidence,
                    'memoryCount': len(p.memory_ids),
                    'timeSpan': str(p.time_span),
                    'significance': p.psychological_significance
                }
                for p in patterns
            ],
            'totalMemories': len(memories)
        }, f"Detected {len(patterns)} patterns in your memories")
        
    except Exception as e:
        logger.exception(f"Error detecting patterns for user {user_id}: {e}")
        return APIResponse.error("Failed to detect patterns", "ANALYSIS_ERROR", 500)


@memory_analysis_bp.route('/narrative', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def generate_life_narrative():
    """
    Generate AI-powered life narrative from memory collection
    
    Creates therapeutic story arcs and identifies key life chapters
    """
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")
    
    try:
        # Fetch memories
        from google.cloud.firestore import FieldFilter
        
        journal_entries = db.collection('journal_entries').where(
            filter=FieldFilter('user_id', '==', user_id)
        ).stream()
        
        memories = []
        for doc in journal_entries:
            data = doc.to_dict()
            memories.append({
                'id': doc.id,
                'content': data.get('content', ''),
                'timestamp': data.get('created_at', ''),
                'title': data.get('title', ''),
                'mood': data.get('mood')
            })
        
        if len(memories) < 5:
            return APIResponse.success({
                'narrative': "Save more memories to generate your life narrative",
                'progress': f"{len(memories)}/5 memories needed"
            }, "Insufficient data for narrative")
        
        # Generate narrative
        service = get_memory_analysis_service()
        narrative_data = service.generate_life_narrative(memories)
        
        return APIResponse.success({
            'narrative': narrative_data['narrative'],
            'chapters': narrative_data['chapters'],
            'themes': narrative_data['themes'],
            'patterns': narrative_data['patterns'],
            'growthAreas': narrative_data['growth_areas'],
            'totalMemoriesAnalyzed': len(memories)
        }, "Life narrative generated")
        
    except Exception as e:
        logger.exception(f"Error generating narrative for user {user_id}: {e}")
        return APIResponse.error("Failed to generate narrative", "ANALYSIS_ERROR", 500)


@memory_analysis_bp.route('/batch-analyze', methods=['POST'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def batch_analyze_memories():
    """
    Batch analyze multiple memories
    
    Request body: {"memory_ids": ["id1", "id2", ...]}
    Returns analyses for all specified memories
    """
    user_id = g.get('user_id')
    if not user_id:
        return APIResponse.unauthorized("Authentication required")
    
    data = request.get_json(silent=True) or {}
    memory_ids = data.get('memory_ids', [])
    
    if not memory_ids or len(memory_ids) > 50:
        return APIResponse.bad_request("Provide 1-50 memory IDs to analyze")
    
    try:
        results = []
        service = get_memory_analysis_service()
        
        for memory_id in memory_ids[:50]:  # Limit to 50
            try:
                # Fetch memory
                memory_doc = db.collection('journal_entries').document(memory_id).get()
                
                if not memory_doc.exists:
                    continue
                
                memory_data = memory_doc.to_dict()
                
                # Verify ownership
                if memory_data.get('user_id') != user_id:
                    continue
                
                # Analyze
                analysis = service.analyze_text_memory(
                    text=memory_data.get('content', ''),
                    context={'memory_id': memory_id}
                )
                
                results.append({
                    'memoryId': memory_id,
                    'sentiment': analysis.sentiment_score,
                    'emotions': analysis.emotions,
                    'themes': analysis.themes,
                    'significance': analysis.significance_score
                })
                
            except Exception as e:
                logger.warning(f"Failed to analyze memory {memory_id}: {e}")
                continue
        
        return APIResponse.success({
            'analyses': results,
            'totalAnalyzed': len(results)
        }, f"Analyzed {len(results)} memories")
        
    except Exception as e:
        logger.exception(f"Error in batch analysis: {e}")
        return APIResponse.error("Batch analysis failed", "ANALYSIS_ERROR", 500)


@memory_analysis_bp.route('/insights/<user_id>', methods=['GET'])
@AuthService.jwt_required
@rate_limit_by_endpoint
def get_memory_insights(user_id: str):
    """
    Get comprehensive memory insights for a user
    
    Includes statistics, trends, and therapeutic recommendations
    """
    current_user = g.get('user_id')
    if not current_user:
        return APIResponse.unauthorized("Authentication required")
    
    # Users can only view their own insights
    if user_id != current_user:
        return APIResponse.forbidden("Unauthorized access")
    
    try:
        from google.cloud.firestore import FieldFilter
        
        # Get all memories
        memories_query = db.collection('journal_entries').where(
            filter=FieldFilter('user_id', '==', user_id)
        ).stream()
        
        memories = [doc.to_dict() for doc in memories_query]
        
        if not memories:
            return APIResponse.success({
                'stats': {
                    'totalMemories': 0,
                    'avgSentiment': 0,
                    'dominantThemes': []
                },
                'insights': ["Start saving memories to get insights!"]
            }, "No memories found")
        
        # Calculate statistics
        service = get_memory_analysis_service()
        analyses = []
        
        for memory in memories[:100]:  # Analyze last 100
            analysis = service.analyze_text_memory(memory.get('content', ''))
            analyses.append(analysis)
        
        # Aggregate statistics
        avg_sentiment = sum(a.sentiment_score for a in analyses) / len(analyses)
        all_themes = []
        for a in analyses:
            all_themes.extend(a.themes)
        
        from collections import Counter
        top_themes = [t for t, c in Counter(all_themes).most_common(5)]
        
        # Generate insights
        insights = []
        if avg_sentiment > 0.3:
            insights.append("Dina minnen visar en generellt positiv ton.")
        elif avg_sentiment < -0.1:
            insights.append("Dina minnen visar vissa utmanande perioder, men det är en del av livet.")
        
        if 'growth' in top_themes:
            insights.append("Du visar stark personlig utveckling genom dina minnen.")
        
        if 'connection' in top_themes:
            insights.append("Relationer verkar vara en viktig del av ditt liv.")
        
        return APIResponse.success({
            'stats': {
                'totalMemories': len(memories),
                'analyzedCount': len(analyses),
                'avgSentiment': round(avg_sentiment, 2),
                'dominantThemes': top_themes,
                'timeSpan': str((max([m.get('created_at', '') for m in memories]) if memories else '') +
                              ' - ' +
                              (min([m.get('created_at', '') for m in memories]) if memories else ''))
            },
            'insights': insights,
            'recommendations': [
                "Fortsätt dokumentera både stora och små ögonblick.",
                "Reflektera över vad dina återkommande teman betyder för dig."
            ]
        }, f"Insights based on {len(memories)} memories")
        
    except Exception as e:
        logger.exception(f"Error generating insights for {user_id}: {e}")
        return APIResponse.error("Failed to generate insights", "ANALYSIS_ERROR", 500)
