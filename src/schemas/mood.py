"""
Mood tracking and analysis schemas
Pydantic models for mood logging, analysis, and therapeutic content
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, date
from enum import Enum
from .base import (
    BaseRequest, BaseResponse, SanitizedString, MoodValue,
    validate_safe_string
)

class MoodCategory(str, Enum):
    """Mood categories for classification"""
    JOYFUL = "glad"
    STRESSED = "stressad"
    TIRED = "trött"
    RELAXED = "avslappnad"
    WORRIED = "orolig"
    ANXIOUS = "ängslig"
    SAD = "ledsen"
    ANGRY = "arg"
    MOTIVATED = "motiverad"
    CONFUSED = "förvirrad"

class MoodIntensity(str, Enum):
    """Mood intensity levels"""
    LOW = "låg"
    MEDIUM = "måttlig"
    HIGH = "hög"
    EXTREME = "extrem"

class TriggerType(str, Enum):
    """Types of mood triggers"""
    WORK = "arbete"
    RELATIONSHIPS = "relationer"
    HEALTH = "hälsa"
    FINANCES = "ekonomi"
    ENVIRONMENT = "miljö"
    OTHER = "annat"

# Mood logging schemas
class MoodLogRequest(BaseRequest):
    """Mood logging request"""
    mood_value: MoodValue = Field(..., ge=1, le=10, description="Mood value (1-10)")
    category: Optional[MoodCategory] = None
    intensity: Optional[MoodIntensity] = None
    note: Optional[SanitizedString] = Field(None, max_length=1000, description="Optional mood note")
    voice_data: Optional[str] = Field(None, description="Base64 encoded voice recording")
    triggers: Optional[List[TriggerType]] = Field(default_factory=list, max_length=5)
    location: Optional[Dict[str, float]] = None  # {"lat": float, "lng": float}
    weather: Optional[Dict[str, Any]] = None  # Weather context
    activities: Optional[List[SanitizedString]] = Field(default_factory=list, max_length=10)
    timestamp: Optional[datetime] = None

    @validator('note')
    def validate_note(cls, v):
        if v is not None:
            return validate_safe_string(v, 1000)
        return v

    @validator('activities', each_item=True)
    def validate_activities(cls, v):
        return validate_safe_string(v, 100)

    @validator('location')
    def validate_location(cls, v):
        if v is not None:
            if not isinstance(v, dict) or 'lat' not in v or 'lng' not in v:
                raise ValueError('Location must contain lat and lng coordinates')
            lat, lng = v['lat'], v['lng']
            if not (-90 <= lat <= 90):
                raise ValueError('Latitude must be between -90 and 90')
            if not (-180 <= lng <= 180):
                raise ValueError('Longitude must be between -180 and 180')
        return v

class MoodEntry(BaseModel):
    """Complete mood entry"""
    id: str
    user_id: str
    mood_value: MoodValue
    category: Optional[MoodCategory]
    intensity: Optional[MoodIntensity]
    note: Optional[SanitizedString]
    voice_transcript: Optional[str]
    triggers: List[TriggerType] = Field(default_factory=list)
    location: Optional[Dict[str, float]]
    weather: Optional[Dict[str, Any]]
    activities: List[SanitizedString] = Field(default_factory=list)
    timestamp: datetime

    # AI analysis
    sentiment_score: Optional[float] = Field(None, ge=-1, le=1)
    keywords: List[str] = Field(default_factory=list)
    ai_insights: Optional[Dict[str, Any]] = None

    # System fields
    created_at: datetime
    updated_at: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class MoodUpdateRequest(BaseRequest):
    """Update mood entry request"""
    mood_value: Optional[MoodValue] = None
    category: Optional[MoodCategory] = None
    intensity: Optional[MoodIntensity] = None
    note: Optional[SanitizedString] = Field(None, max_length=1000)
    triggers: Optional[List[TriggerType]] = None
    activities: Optional[List[SanitizedString]] = None

    @validator('note')
    def validate_note(cls, v):
        if v is not None:
            return validate_safe_string(v, 1000)
        return v

    @validator('activities', each_item=True)
    def validate_activities(cls, v):
        return validate_safe_string(v, 100)

# Analysis schemas
class MoodAnalysisRequest(BaseRequest):
    """Mood analysis request"""
    period: str = Field(..., pattern=r'^(week|month|quarter|year)$', description="Analysis period")
    include_insights: bool = True
    include_trends: bool = True
    include_correlations: bool = False

class MoodTrend(BaseModel):
    """Mood trend analysis"""
    period: str
    average_mood: float = Field(ge=1, le=10)
    trend_direction: str  # improving, declining, stable
    trend_strength: float = Field(ge=0, le=1)  # 0-1 scale
    volatility: float = Field(ge=0)  # Mood variability
    best_day: Optional[str] = None
    worst_day: Optional[str] = None

class MoodCorrelation(BaseModel):
    """Mood correlation analysis"""
    factor: str
    correlation_coefficient: float = Field(ge=-1, le=1)
    significance: float = Field(ge=0, le=1)
    sample_size: int
    description: str

class MoodInsight(BaseModel):
    """AI-generated mood insight"""
    type: str  # pattern, trigger, recommendation
    title: str
    description: str
    confidence: float = Field(ge=0, le=1)
    severity: Optional[str] = None  # low, medium, high
    actionable: bool = False

class MoodAnalysis(BaseModel):
    """Complete mood analysis"""
    user_id: str
    period: str
    date_range: Dict[str, datetime]

    # Basic statistics
    total_entries: int
    average_mood: float = Field(ge=1, le=10)
    mood_distribution: Dict[str, int]  # category -> count
    most_common_triggers: List[Dict[str, Any]]

    # Trends
    trend: MoodTrend

    # Correlations (optional)
    correlations: Optional[List[MoodCorrelation]] = None

    # AI insights
    insights: List[MoodInsight] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)

    # Risk assessment
    risk_level: str  # low, medium, high
    risk_factors: List[str] = Field(default_factory=list)
    crisis_indicators: List[str] = Field(default_factory=list)

    # Generated at
    generated_at: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# Voice analysis schemas
class VoiceAnalysisRequest(BaseRequest):
    """Voice mood analysis request"""
    audio_data: str = Field(..., description="Base64 encoded audio data")
    audio_format: str = Field(default="webm", pattern=r'^(webm|wav|mp3|ogg)$')
    language: str = Field(default="sv-SE", description="Language code for speech recognition")

class VoiceAnalysisResult(BaseModel):
    """Voice analysis result"""
    transcript: str
    confidence: float = Field(ge=0, le=1)
    detected_mood: Optional[MoodValue] = None
    sentiment_score: float = Field(ge=-1, le=1)
    emotional_indicators: Dict[str, float] = Field(default_factory=dict)
    speech_characteristics: Dict[str, Any] = Field(default_factory=dict)

# Prediction schemas
class MoodPredictionRequest(BaseRequest):
    """Mood prediction request"""
    days_ahead: int = Field(..., ge=1, le=30, description="Days to predict ahead")
    include_factors: bool = True
    confidence_threshold: float = Field(default=0.6, ge=0, le=1)

class MoodPrediction(BaseModel):
    """Mood prediction result"""
    date: date
    predicted_mood: float = Field(ge=1, le=10)
    confidence: float = Field(ge=0, le=1)
    factors: List[Dict[str, Any]] = Field(default_factory=list)
    risk_assessment: str  # low, medium, high

# Response schemas
class MoodLogResponse(BaseResponse):
    """Mood logging response"""
    entry: MoodEntry

class MoodListResponse(BaseResponse):
    """Mood entries list response"""
    entries: List[MoodEntry]
    total: int
    pagination: Dict[str, Any]

class MoodAnalysisResponse(BaseResponse):
    """Mood analysis response"""
    analysis: MoodAnalysis

class VoiceAnalysisResponse(BaseResponse):
    """Voice analysis response"""
    analysis: VoiceAnalysisResult
    suggested_mood: Optional[MoodValue] = None

class MoodPredictionResponse(BaseResponse):
    """Mood prediction response"""
    predictions: List[MoodPrediction]
    model_accuracy: float = Field(ge=0, le=1)
    prediction_period: str

# Bulk operations
class BulkMoodDeleteRequest(BaseRequest):
    """Bulk delete mood entries"""
    entry_ids: List[str] = Field(..., max_length=100, description="IDs of entries to delete")

class BulkMoodUpdateRequest(BaseRequest):
    """Bulk update mood entries"""
    updates: Dict[str, Any] = Field(..., description="Fields to update")
    entry_ids: List[str] = Field(..., max_length=50, description="IDs of entries to update")

# Export schemas
class MoodExportRequest(BaseRequest):
    """Mood data export request"""
    format: str = Field(..., pattern=r'^(json|csv|pdf)$', description="Export format")
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    include_analysis: bool = True
    include_insights: bool = True

class MoodExportResponse(BaseResponse):
    """Mood export response"""
    export_id: str
    download_url: str
    expires_at: datetime
    file_size: int
    format: str

# Validation utilities
def validate_mood_data(data: Dict[str, Any]) -> MoodLogRequest:
    """Validate mood logging data"""
    try:
        return MoodLogRequest(**data)
    except Exception as e:
        raise ValueError(f"Mood data validation failed: {str(e)}")

def sanitize_mood_note(note: str) -> str:
    """Sanitize mood note content"""
    return validate_safe_string(note, 1000)

def validate_mood_range(value: int) -> int:
    """Validate mood value is within acceptable range"""
    if not (1 <= value <= 10):
        raise ValueError("Mood value must be between 1 and 10")
    return value