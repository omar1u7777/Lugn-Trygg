# Advanced Mood Tracking - AI/ML Dependencies

## Dependencies Overview

### Required for Full Functionality
| Package | Version | Purpose | Fallback if Missing |
|---------|---------|---------|---------------------|
| `transformers` | 4.47.1 | Swedish BERT NLP | Keyword-based sentiment |
| `torch` | >=2.0.0 | PyTorch backend for transformers | Disabled |
| `tensorflow` | >=2.15.0 | LSTM mood forecasting | Statistical models (RandomForest) |

### Graceful Degradation Behavior

#### Scenario 1: Transformers/Torch Missing
```
NLP_AVAILABLE = False
```
- **Affected**: `/analyze` endpoint
- **Behavior**: Returns 503 with error "NLP service unavailable"
- **User Impact**: Mood logging works but without AI sentiment analysis
- **Fallback**: Basic mood scoring from user input

#### Scenario 2: TensorFlow Missing
```
LSTM_AVAILABLE = False
```
- **Affected**: `/forecast` endpoint
- **Behavior**: Automatically uses `_fallback_forecast_endpoint()`
- **User Impact**: Forecasts use statistical models instead of LSTM
- **Fallback**: `predictive_service.predict_mood_trend()` (RandomForest/LinearRegression)

#### Scenario 3: Both Available
```
NLP_AVAILABLE = True
LSTM_AVAILABLE = True
```
- **Full functionality**: Swedish BERT + Temporal Attention LSTM
- **Features**: Deep sentiment analysis, 31-feature LSTM predictions, uncertainty quantification

## Installation

### Production (Full AI Features)
```bash
cd Backend
pip install -r requirements.txt
```

### Minimal (Basic Features Only)
```bash
pip install flask flask-limiter firebase-admin scikit-learn numpy pandas
```

## Verification

Check which features are available on startup:
```python
from src.services.mood_nlp_service import NLP_AVAILABLE
from src.ml.temporal_lstm import LSTM_AVAILABLE

print(f"Swedish BERT NLP: {'✅' if NLP_AVAILABLE else '❌'}")
print(f"LSTM Forecasting: {'✅' if LSTM_AVAILABLE else '❌'}")
```

## Runtime API Behavior

### `/api/v1/advanced-mood/analyze` (POST)
**With transformers**:
```json
{
  "valence": 0.75,
  "arousal": 0.6,
  "primary_emotion": "glad",
  "confidence": 0.92
}
```

**Without transformers**:
```json
{
  "error": "NLP service unavailable",
  "code": "SERVICE_UNAVAILABLE"
}
```

### `/api/v1/advanced-mood/forecast` (GET)
**With tensorflow**:
```json
{
  "model_type": "temporal_attention_lstm",
  "forecasts": [...],
  "uncertainty": 0.15
}
```

**Without tensorflow**:
```json
{
  "model_type": "statistical_fallback",
  "note": "LSTM unavailable - using statistical model",
  "forecasts": [...]
}
```

## Memory/Performance Considerations

| Model | RAM Usage | GPU | CPU Fallback |
|-------|-----------|-----|--------------|
| Swedish BERT (KB-BERT) | ~500MB | Optional | ✅ Yes |
| Temporal LSTM | ~200MB | Optional | ✅ Yes |

## Docker Deployment

For resource-constrained environments, use minimal image:
```dockerfile
# Skip heavy ML packages
RUN pip install --no-cache-dir \
    flask flask-limiter firebase-admin \
    scikit-learn numpy pandas
```

For full AI features:
```dockerfile
RUN pip install --no-cache-dir -r requirements.txt
```
