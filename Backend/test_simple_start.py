#!/usr/bin/env python3
"""
Minimal Flask test - Kollar om Flask kan starta överhuvudtaget
"""
from flask import Flask
import sys

app = Flask(__name__)

@app.route('/')
def home():
    return "Backend fungerar!"

@app.route('/test')
def test():
    return {"status": "ok", "message": "Test endpoint"}

if __name__ == '__main__':
    print("🧪 TESTAR MINIMAL FLASK SERVER")
    print("=" * 50)
    print("📍 Startar på http://127.0.0.1:5001")
    print("🔍 Testa med: curl http://127.0.0.1:5001/test")
    print("=" * 50)
    
    try:
        app.run(
            host='127.0.0.1',
            port=5001,
            debug=False,
            use_reloader=False
        )
    except KeyboardInterrupt:
        print("\n👋 Stängd av användaren")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ FEL: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
