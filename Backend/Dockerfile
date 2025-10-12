# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libffi-dev \
    libssl-dev \
    curl \
    portaudio19-dev \
    libasound2-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install torch separately for better caching (CPU-only version to reduce size)
RUN pip install --no-cache-dir torch==2.8.0+cpu --index-url https://download.pytorch.org/whl/cpu

# Install Python dependencies in batches to avoid timeout
# Core dependencies
RUN pip install --no-cache-dir \
    firebase-admin>=6.0.1 \
    python-dotenv==1.0.0 \
    requests==2.28.1 \
    flask==3.0.3 \
    flask-cors==3.0.10 \
    Flask-Babel>=3.0.0 \
    werkzeug==3.0.1 \
    bcrypt==4.0.1 \
    PyJWT>=2.0.0 \
    numpy>=1.21.0

# Voice and audio dependencies
RUN pip install --no-cache-dir \
    pyttsx3==2.90 \
    SpeechRecognition==3.8.1 \
    pyaudio==0.2.13 \
    google-cloud-speech>=2.0.0 \
    google-cloud-language>=2.0.0 \
    sounddevice==0.4.5 \
    soundfile==0.11.0

# AI and ML dependencies
RUN pip install --no-cache-dir \
    openai>=1.0.0 \
    transformers>=4.0.0 \
    librosa>=0.9.2

# Security and rate limiting
RUN pip install --no-cache-dir \
    flask-limiter>=3.0.0 \
    pycryptodome>=3.0.0 \
    redis>=4.0.0

# Testing dependencies
RUN pip install --no-cache-dir \
    pytest>=7.0.0 \
    pytest-mock>=3.10.0 \
    unittest2>=1.1.0 \
    selenium>=4.0.0

# Copy application code
COPY . .

# Create non-root user
RUN useradd --create-home --shell /bin/bash app \
    && chown -R app:app /app
USER app

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5001/ || exit 1

# Run the application
CMD ["python", "main.py"]