#!/usr/bin/env python3
"""
Alternativ backend-start script
Kör backend utan debug mode för stabil drift
"""
import os
import sys

# Sätt miljövariabler
os.environ['FLASK_DEBUG'] = 'False'
os.environ['HOST'] = '127.0.0.1'
os.environ['PORT'] = '5001'

# Importera och kör main
if __name__ == '__main__':
    # Importera efter miljövariabler är satta
    from main import create_app
    
    app = create_app()
    
    print("🚀 Backend startar...")
    print(f"📍 URL: http://127.0.0.1:5001")
    print(f"🔍 Debug mode: False")
    print("="*50)
    
    try:
        # Kör servern med werkzeug direkt
        app.run(
            host='127.0.0.1',
            port=5001,
            debug=False,
            use_reloader=False,  # Viktigt: Disable reloader!
            threaded=True
        )
    except KeyboardInterrupt:
        print("\n👋 Backend stoppad av användaren")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Kritiskt fel: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
