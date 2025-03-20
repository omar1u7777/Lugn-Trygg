import pytest
from main import create_app  # Importerar create_app från main.py
from unittest.mock import patch

@pytest.fixture(scope='module')
def app():
    """
    Skapar och returnerar Flask-applikationen för testning.

    Använder 'testing=True' för att aktivera testläge, vilket gör att Flask
    inte kör servern och hanterar alla fel genom att generera en HTTP-status.
    Mockar externa beroenden som Whisper och Firebase för att isolera testerna.
    """
    # Mocka Whisper och Firebase för att undvika externa beroenden
    with patch('whisper.load_model') as mock_whisper, \
         patch('src.firebase_config.initialize_firebase') as mock_firebase:
        mock_whisper.return_value = None  # Mockar Whisper-modellen
        mock_firebase.return_value = True  # Mockar Firebase-initialisering

        try:
            # Skapa appen med inställningar för testning
            app = create_app(testing=True)
        except Exception as e:
            pytest.fail(f"Misslyckades med att skapa appen för testning: {str(e)}")

        # Kör Flask-applikationen och tillhandahåll den till tester
        yield app

        # Rensning efter testerna (valfritt beroende på behov)
        # Här kan du t.ex. stänga ner resurser om det behövs
        logger = app.logger
        logger.info("✅ Testmiljö rensad efter körning.")

@pytest.fixture(scope='module')
def client(app):
    """
    Skapar en testklient som kan användas för att skicka HTTP-förfrågningar till Flask-applikationen.

    Använd denna klient för att testa endpoints i din applikation.
    """
    return app.test_client()

@pytest.fixture(scope='module')
def runner(app):
    """
    Skapar en runner som kan användas för att köra Flask CLI-kommandon i testläge.
    """
    return app.test_cli_runner()