import React from 'react';

interface DebugPanelProps {
  debugMode: boolean;
  showDebugTools: boolean;
  onToggle: () => void;
  data: Record<string, unknown>;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ debugMode, showDebugTools, onToggle, data }) => {
  if (!showDebugTools) return null;

  return (
    <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-mono">
      <label className="flex items-center gap-2 mb-2 cursor-pointer">
        <input
          type="checkbox"
          checked={debugMode}
          onChange={onToggle}
          className="rounded"
        />
        <span className="text-gray-700 dark:text-gray-300">Debug Mode</span>
      </label>
      {debugMode && (
        <pre className="whitespace-pre-wrap break-all text-gray-600 dark:text-gray-400 max-h-48 overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
};
