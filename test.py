import os
from pydoc import text
import time
import threading
import sounddevice as sd
import soundfile as sf
import pyttsx3
import whisper
import numpy as np
import firebase_admin
from firebase_admin import credentials, firestore, storage
import speech_recognition as sr
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Firebase Initialization
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred, {
    'storageBucket': 'lugn-trygg-53d75.appspot.com'
})
db = firestore.client()
bucket = storage.bucket()

class VoiceAssistant:
    def __init__(self):
        self.nlu_model = self._load_nlu_model()
        self.stt_model = whisper.load_model("small")  # Optimized model for speed
        self.engine = pyttsx3.init()
        self.recognizer = sr.Recognizer()
        self.settings = self._load_settings()
    
    def run(self):
        self.speak("Hej! Hur kan jag hjälpa dig?")
        while True:
            command = self.listen()
            if command:
                print(f"🎤 Användarens input: {command}")  # DEBUGGING
                intent = self.understand_command(command)
                print(f"🤖 Identifierad intent: {intent}")  # DEBUGGING

                if intent == 'log_mood':
                    self.log_mood()
                elif intent == 'record_memory':
                    self.record_memory()
                elif intent == 'play_sound':
                    self.play_sound()
                elif intent == 'summary':
                    self.daily_summary()
                elif 'stopp' in command or 'avsluta' in command:
                    self.speak("Adjö! Ha en fin dag!")
                    break
                else:
                    self.speak("Jag förstår inte, försök igen.")

    def _load_nlu_model(self):
        commands = {
            'log_mood': ['Skriv ner mitt humör', 'Lagra mitt humör', 'Mina känslor idag'],
            'record_memory': ['Spara en berättelse', 'Spela in minnet', 'Jag vill spela in'],
            'play_sound': ['Lugnande musik', 'Spela avkopplande ljud', 'Ge mig lugn'],
            'summary': ['Vad har jag gjort idag?', 'Visa min sammanfattning', 'Summera min dag']
        }

        texts = [cmd for group in commands.values() for cmd in group]
        return TfidfVectorizer().fit(texts), commands

    def _load_settings(self):
        return {'voice_speed': 150, 'voice_gender': 'female'}

    def speak(self, text):
        self.engine.setProperty('rate', self.settings['voice_speed'])
        voices = self.engine.getProperty('voices')
        self.engine.setProperty('voice', voices[1].id)
        self.engine.say(text)
        self.engine.runAndWait()

    def listen(self, timeout=5):
        with sr.Microphone() as source:
            try:
                audio = self.recognizer.listen(source, timeout=timeout)
                audio_data = np.frombuffer(audio.get_raw_data(), np.int16)
                result = self.stt_model.transcribe(audio_data.astype(np.float32) / 32768.0)
                
                print(f"📝 Whisper hörde: {result['text']}")  # DEBUGGING
                return result['text']
            except sr.WaitTimeoutError:
                return None

    def understand_command(self, text):
        vectorizer, commands = self.nlu_model
        query_vec = vectorizer.transform([text])
        
        max_sim = -1
        best_match = None
        for intent, examples in commands.items():
            examples_vec = vectorizer.transform(examples)
            sim = cosine_similarity(query_vec, examples_vec).max()
            
            if sim > max_sim:
                max_sim = sim
                best_match = intent

        print(f"📊 Likhetspoäng: {max_sim} (Intent: {best_match})")  # DEBUGGING
        return best_match if max_sim > 0.4 else None  # Lowered threshold

    def log_mood(self):
        self.speak("Hur känner du dig idag?")
        mood = self.listen()
        if mood:
            db.collection("moods").add({"timestamp": time.time(), "mood": mood})
            self.speak(f"Ditt humör '{mood}' har sparats.")

    def record_memory(self):
        self.speak("Börja prata för att spela in ditt minne.")
        fs = 44100
        duration = 10
        filename = f"memory_{int(time.time())}.wav"
        recording = sd.rec(int(duration * fs), samplerate=fs, channels=2, dtype='int16')
        sd.wait()
        sf.write(filename, recording, fs)

        blob = bucket.blob(f"memories/{filename}")
        blob.upload_from_filename(filename)
        os.remove(filename)

        db.collection("memories").add({"timestamp": time.time(), "file_url": blob.public_url})
        self.speak("Ditt minne har sparats i molnet.")

    def play_sound(self):
        self.speak("Vilket ljud vill du spela?")
        sound = self.listen()
        sound_map = {
            "hav": "sounds/ocean.wav",
            "skog": "sounds/forest.wav"
        }
        if sound in sound_map and os.path.exists(sound_map[sound]):
            threading.Thread(target=lambda: os.system(f"start {sound_map[sound]}"), daemon=True).start()
        else:
            self.speak("Jag hittade inte det ljudet.")

    def daily_summary(self):
        today = time.strftime("%Y-%m-%d")
        moods = [doc.to_dict()["mood"] for doc in db.collection("moods").stream() if time.strftime("%Y-%m-%d", time.localtime(doc.to_dict()["timestamp"])) == today]
        if moods:
            self.speak(f"Idag har du känt dig {', '.join(moods)}")
        else:
            self.speak("Du har inte registrerat något humör idag.")

if __name__ == "__main__":
    assistant = VoiceAssistant()
    assistant.run()
