"""Quick script to check OPTIONS status codes."""
import logging
logging.disable(logging.CRITICAL)
import os
os.environ['TESTING'] = 'true'
from main import create_app

app = create_app()
c = app.test_client()
paths = [
    '/api/v1/mood/log',
    '/api/v1/notifications/save-token',
    '/api/v1/referral/generate',
    '/api/v1/memory/upload',
    '/api/v1/chatbot/chat',
    '/api/v1/feedback/submit',
]
for p in paths:
    r = c.options(p)
    print(f"{p}: {r.status_code}")
