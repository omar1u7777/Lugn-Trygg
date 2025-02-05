import logging
import sys
import os


def konfigurera_loggning():
    level = getattr(logging, os.getenv('LOGG_NIVÅ', 'DEBUG').upper())  # Default to DEBUG level if LOGG_NIVÅ is not defined
    format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    handlers = [
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("app.log")
    ]
    logging.basicConfig(level=level, format=format, handlers=handlers)


def main():
    try:
        from system.gui import starta_gui
        from system.config import verifiera_konfiguration
    except ImportError as e:
        logging.critical(f"Import error: {str(e)}")
        sys.exit(1)

    try:
        verifiera_konfiguration()
        starta_gui()
    except ImportError as e:
        logging.critical(f"Import error during runtime: {str(e)}")
        sys.exit(1)
    except AttributeError as e:
        logging.critical(f"Attribute error: {str(e)}")
        sys.exit(1)
    except Exception as e:
        logging.exception("Critical error")
        sys.exit(1)


if __name__ == "__main__":
    konfigurera_loggning()
    main()
