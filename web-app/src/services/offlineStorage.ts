/**
 * Offline Storage Service
 * Handles localStorage for offline mood logging and data queuing
 */

interface OfflineData {
  moods: OfflineMoodLog[];
  memories: OfflineMemory[];
  queuedRequests: QueuedRequest[];
  lastSyncTime: number;
}

interface OfflineMoodLog {
  id: string;
  mood: string;
  intensity: number;
  notes?: string | undefined;
  timestamp: number;
  synced: boolean;
}

interface OfflineMemory {
  id: string;
  title: string;
  content: string;
  timestamp: number;
  synced: boolean;
}

interface QueuedRequest {
  id: string;
  method: 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  data: Record<string, any>;
  timestamp: number;
  retries: number;
}

const STORAGE_KEY = 'lugn_trygg_offline_data';
const MAX_RETRIES = 3;

/**
 * Get offline data from localStorage
 */
export function getOfflineData(): OfflineData {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to retrieve offline data:', error);
  }

  return {
    moods: [],
    memories: [],
    queuedRequests: [],
    lastSyncTime: Date.now(),
  };
}

/**
 * Save offline data to localStorage
 */
function saveOfflineData(data: OfflineData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log('💾 Offline data saved');
  } catch (error) {
    console.error('Failed to save offline data:', error);
  }
}

/**
 * Add mood log for offline storage
 */
export function addOfflineMoodLog(
  mood: string,
  intensity: number,
  notes?: string
): OfflineMoodLog {
  const offlineData = getOfflineData();
  const moodLog: OfflineMoodLog = {
    id: `mood_${Date.now()}`,
    mood,
    intensity,
    notes,
    timestamp: Date.now(),
    synced: false,
  };

  offlineData.moods.push(moodLog);
  saveOfflineData(offlineData);

  console.log('😊 Mood logged offline:', moodLog);
  return moodLog;
}

/**
 * Add memory for offline storage
 */
export function addOfflineMemory(title: string, content: string): OfflineMemory {
  const offlineData = getOfflineData();
  const memory: OfflineMemory = {
    id: `memory_${Date.now()}`,
    title,
    content,
    timestamp: Date.now(),
    synced: false,
  };

  offlineData.memories.push(memory);
  saveOfflineData(offlineData);

  console.log('💭 Memory stored offline:', memory);
  return memory;
}

/**
 * Queue API request for retry when online
 */
export function queueRequest(
  method: 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data: Record<string, any>
): QueuedRequest {
  const offlineData = getOfflineData();
  const request: QueuedRequest = {
    id: `req_${Date.now()}`,
    method,
    endpoint,
    data,
    timestamp: Date.now(),
    retries: 0,
  };

  offlineData.queuedRequests.push(request);
  saveOfflineData(offlineData);

  console.log('📤 Request queued:', request);
  return request;
}

/**
 * Get all unsynced data
 */
export function getUnsyncedData() {
  const offlineData = getOfflineData();
  return {
    moods: offlineData.moods.filter((m) => !m.synced),
    memories: offlineData.memories.filter((m) => !m.synced),
    requests: offlineData.queuedRequests.filter((r) => r.retries < MAX_RETRIES),
  };
}

/**
 * Mark mood as synced
 */
export function markMoodAsSynced(moodId: string) {
  const offlineData = getOfflineData();
  const mood = offlineData.moods.find((m) => m.id === moodId);
  if (mood) {
    mood.synced = true;
    saveOfflineData(offlineData);
    console.log('✅ Mood marked as synced:', moodId);
  }
}

/**
 * Mark memory as synced
 */
export function markMemoryAsSynced(memoryId: string) {
  const offlineData = getOfflineData();
  const memory = offlineData.memories.find((m) => m.id === memoryId);
  if (memory) {
    memory.synced = true;
    saveOfflineData(offlineData);
    console.log('✅ Memory marked as synced:', memoryId);
  }
}

/**
 * Remove queued request
 */
export function removeQueuedRequest(requestId: string) {
  const offlineData = getOfflineData();
  offlineData.queuedRequests = offlineData.queuedRequests.filter((r) => r.id !== requestId);
  saveOfflineData(offlineData);
  console.log('🗑️ Queued request removed:', requestId);
}

/**
 * Retry failed request
 */
export function retryQueuedRequest(requestId: string) {
  const offlineData = getOfflineData();
  const request = offlineData.queuedRequests.find((r) => r.id === requestId);
  if (request) {
    request.retries++;
    saveOfflineData(offlineData);
    console.log('🔄 Retrying queued request:', requestId, `(${request.retries}/${MAX_RETRIES})`);
  }
}

/**
 * Clear all offline data
 */
export function clearOfflineData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('🧹 Offline data cleared');
  } catch (error) {
    console.error('Failed to clear offline data:', error);
  }
}

/**
 * Check if offline
 */
export function isOffline(): boolean {
  return !navigator.onLine;
}

/**
 * Listen for online/offline changes
 * Returns an unsubscribe function for cleanup
 */
export function listenForOnlineStatus(
  onOnline: () => void,
  onOffline: () => void
): () => void {
  const handleOnline = () => {
    console.log('🌐 Back online!');
    onOnline();
  };

  const handleOffline = () => {
    console.log('📴 Went offline!');
    onOffline();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Return unsubscribe function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

export default {
  getOfflineData,
  addOfflineMoodLog,
  addOfflineMemory,
  queueRequest,
  getUnsyncedData,
  markMoodAsSynced,
  markMemoryAsSynced,
  removeQueuedRequest,
  retryQueuedRequest,
  clearOfflineData,
  isOffline,
  listenForOnlineStatus,
};
