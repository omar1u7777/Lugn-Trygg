import React from 'react';

interface DebugPanelProps {
  showDebugTools: boolean;
  debugMode: boolean;
  userId: string | null;
  goals: string[];
  progress: Record<string, unknown>;
  filters: { searchTerm: string; selectedCategory: string; sortBy: string };
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  showDebugTools,
  debugMode,
  userId,
  goals,
  progress,
  filters,
}) => {
  if (!showDebugTools || !debugMode) return null;

  return (
    <div className="mt-4 p-4 bg-black/20 rounded-lg text-xs font-mono">
      <h4 className="font-bold mb-2">🐛 Debug Info:</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>User ID: {userId || 'null'}</div>
        <div>Goals: {JSON.stringify(goals)}</div>
        <div>Progress: {JSON.stringify(progress)}</div>
        <div>Filters: {filters.searchTerm}|{filters.selectedCategory}|{filters.sortBy}</div>
      </div>
    </div>
  );
};
