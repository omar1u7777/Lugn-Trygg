"use client";
import React, { useState } from "react";
import { DashboardLayout, DashboardHeader, DashboardGrid, DashboardSection } from "../../components/Dashboard/Layout";
import MoodLogger from "../../components/MoodLogger";
import MoodList from "../../components/MoodList";
import MemoryRecorder from "../../components/MemoryRecorder";
import MemoryList from "../../components/MemoryList";
import { useAuth } from "../../contexts/AuthContext";
import Chatbot from "../../components/Chatbot";
import CrisisAlert from "../../components/CrisisAlert";
import { LoadingOverlay } from "../../components/UI";

export default function DashboardPage() {
  const { user } = useAuth() as any;
  const [showMoodLogger, setShowMoodLogger] = useState(false);
  const [showMoodList, setShowMoodList] = useState(false);
  const [showMemoryRecorder, setShowMemoryRecorder] = useState(false);
  const [showMemoryList, setShowMemoryList] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [crisisAlert, setCrisisAlert] = useState<{ open: boolean; score: number | null }>({ open: false, score: null });
  const [isNavigating, setIsNavigating] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8">
      <DashboardLayout>
        <DashboardHeader
          userName={user?.email || ''}
          title="Dashboard"
          subtitle="Välkommen tillbaka"
        >
          {/* header widgets could go here */}
        </DashboardHeader>

        <DashboardSection title="Snabbåtgärder" icon="⚡">
          <DashboardGrid columns={{ mobile: 1, tablet: 2, desktop: 4 }} gap="md">
            <div className="p-4">
              <button
                onClick={() => {
                  setIsNavigating(true);
                  setTimeout(() => setShowMoodLogger(true), 100);
                  setTimeout(() => setIsNavigating(false), 300);
                }}
                className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-semibold transition-all duration-200"
              >
                🎭 Logga humör
              </button>
            </div>

            <div className="p-4">
              <button
                onClick={() => {
                  setIsNavigating(true);
                  setTimeout(() => setShowMoodList(true), 100);
                  setTimeout(() => setIsNavigating(false), 300);
                }}
                className="w-full py-3 px-4 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-semibold transition-all duration-200"
              >
                📝 Visa humörloggar
              </button>
            </div>

            <div className="p-4">
              <button
                onClick={() => {
                  setIsNavigating(true);
                  setTimeout(() => setShowMemoryRecorder(true), 100);
                  setTimeout(() => setIsNavigating(false), 300);
                }}
                className="w-full py-3 px-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold transition-all duration-200"
              >
                💾 Spela in minne
              </button>
            </div>

            <div className="p-4">
              <button
                onClick={() => {
                  setIsNavigating(true);
                  setTimeout(() => setShowMemoryList(true), 100);
                  setTimeout(() => setIsNavigating(false), 300);
                }}
                className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold transition-all duration-200"
              >
                💭 Visa minnen
              </button>
            </div>

            {/* placeholders for other action cards */}
            <div className="p-4">
              <button className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold">🎵 Lugn musik</button>
            </div>

            <div className="p-4">
              <button
                onClick={() => setShowChatbot(true)}
                className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-semibold"
              >
                🤖 Chatta med AI
              </button>
            </div>
      {showChatbot && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.2)', padding: 24, maxWidth: 540, width: '100%', position: 'relative' }}>
            <button onClick={() => setShowChatbot(false)} style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', fontSize: 24, cursor: 'pointer' }}>&times;</button>
            <Chatbot />
          </div>
        </div>
      )}
          </DashboardGrid>
        </DashboardSection>
      </DashboardLayout>


      {showMoodLogger && (
        <MoodLogger
          userEmail={user?.email || ''}
          onClose={() => setShowMoodLogger(false)}
          onMoodLogged={() => setShowMoodList(true)}
          onCrisisDetected={(score) => setCrisisAlert({ open: true, score })}
        />
      )}

      {crisisAlert.open && crisisAlert.score !== null && (
        <CrisisAlert
          isOpen={crisisAlert.open}
          moodScore={crisisAlert.score}
          onClose={() => setCrisisAlert({ open: false, score: null })}
        />
      )}

      {showMoodList && (
        <MoodList onClose={() => setShowMoodList(false)} />
      )}

      {showMemoryRecorder && (
        <MemoryRecorder userId={user?.user_id || ''} onClose={() => setShowMemoryRecorder(false)} />
      )}

      {showMemoryList && (
        <MemoryList onClose={() => setShowMemoryList(false)} />
      )}

      <LoadingOverlay
        isVisible={isNavigating}
        text="Öppnar..."
        variant="pulse"
      />
    </div>
  );
}
