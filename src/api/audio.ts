import { api } from "./client";
import { ApiError } from "./errors";

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  duration: number;
  category: AudioCategory;
  url: string;
}

export interface AudioCategory {
  id: string;
  name: string;
  description: string;
}

/**
 * Get audio library
 * @returns Promise resolving to audio tracks
 */
export const getAudioLibrary = async (): Promise<AudioTrack[]> => {
  try {
    const response = await api.get('/api/audio/library');
    return response.data.tracks || [];
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.fromAxiosError(error);
  }
};