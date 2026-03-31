#!/usr/bin/env python3
"""Quick Memory Journal Test"""

print('='*50)
print('MEMORY JOURNAL - QUICK TEST')
print('='*50)

from PIL import Image
import io

# Test Photo Analysis
from src.services.photo_analysis_service import PhotoAnalysisService
service = PhotoAnalysisService()
print(f'✅ PhotoAnalysisService: {type(service).__name__}')

img = Image.new('RGB', (50, 50), color='blue')
buffer = io.BytesIO()
img.save(buffer, format='JPEG')
result = service.analyze_photo(buffer.getvalue(), 'test')
print(f'✅ Photo analysis: {result.dominant_emotion}, {result.color_mood}')

# Test Routes
from src.routes.multimedia_memory_routes import multimedia_memory_bp
print(f'✅ Blueprint: {multimedia_memory_bp.name}')

# Test Memory Analysis
from src.services.memory_analysis_service import get_memory_analysis_service
mas = get_memory_analysis_service()
result = mas.analyze_text_memory('Glad idag!')
print(f'✅ Text analysis: {result.primary_emotion}')

print()
print('='*50)
print('SUCCESS - All systems working!')
print('='*50)
