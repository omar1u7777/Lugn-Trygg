/**
 * Tests for chat API functions.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../errors', () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ApiError';
    }
    static fromAxiosError(error: unknown) {
      return new ApiError((error as Error).message || 'API error');
    }
  },
}));

vi.mock('../constants', () => ({
  API_ENDPOINTS: {
    PEER_CHAT: {
      CHAT_ROOMS: '/api/v1/chat/rooms',
      CHAT_ROOM_JOIN: '/api/v1/chat',
      CHAT_ROOM_LEAVE: '/api/v1/chat',
      CHAT_MESSAGES: '/api/v1/chat',
      CHAT_SEND: '/api/v1/chat',
      CHAT_LIKE: '/api/v1/chat/messages',
      CHAT_REPORT: '/api/v1/chat/messages',
      CHAT_TYPING: '/api/v1/chat',
      CHAT_PRESENCE: '/api/v1/chat',
    },
  },
}));

import { api } from '../client';
import {
  getChatRooms,
  joinChatRoom,
  leaveChatRoom,
  getChatMessages,
  sendChatMessage,
  toggleMessageLike,
  reportChatMessage,
  updateTypingStatus,
  getRoomPresence,
} from '../chat';

const mockApi = api as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

const sampleRoom = { id: 'r1', name: 'Stöd & Samtal', description: 'Share your feelings', memberCount: 5 };
const sampleSession = {
  sessionId: 's1',
  anonymousName: 'Anonym Björk',
  avatar: '🌿',
  room: sampleRoom,
  messages: [],
};

describe('getChatRooms', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns rooms from nested data format', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { rooms: [sampleRoom] } } });

    const result = await getChatRooms();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r1');
  });

  it('returns rooms from direct format', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { rooms: [sampleRoom] } });

    const result = await getChatRooms();
    expect(result).toHaveLength(1);
  });

  it('returns empty array when rooms missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: {} });

    const result = await getChatRooms();
    expect(result).toEqual([]);
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Error'));

    await expect(getChatRooms()).rejects.toThrow();
  });
});

describe('joinChatRoom', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns normalized session data', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: sampleSession } });

    const result = await joinChatRoom('r1', 'u1');
    expect(result.sessionId).toBe('s1');
    expect(result.session_id).toBe('s1');  // Alias
    expect(result.anonymous_name).toBe('Anonym Björk');
  });

  it('posts user_id in body', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: sampleSession } });

    await joinChatRoom('r1', 'user-abc');
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.stringContaining('r1'),
      expect.objectContaining({ user_id: 'user-abc' })
    );
  });

  it('returns empty messages array when missing', async () => {
    const sessionNoMessages = { ...sampleSession };
    delete (sessionNoMessages as { messages?: unknown }).messages;
    mockApi.post.mockResolvedValueOnce({ data: { data: sessionNoMessages } });

    const result = await joinChatRoom('r1', 'u1');
    expect(result.messages).toEqual([]);
  });

  it('throws on API error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Room full'));

    await expect(joinChatRoom('r1', 'u1')).rejects.toThrow();
  });
});

describe('leaveChatRoom', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts session_id and returns result', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: { success: true } } });

    const result = await leaveChatRoom('r1', 's1');
    expect(result.success).toBe(true);
  });

  it('includes roomId and session_id', async () => {
    mockApi.post.mockResolvedValueOnce({ data: {} });

    await leaveChatRoom('r1', 's1');
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.stringContaining('r1'),
      expect.objectContaining({ session_id: 's1' })
    );
  });

  it('throws on API error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Error'));

    await expect(leaveChatRoom('r1', 's1')).rejects.toThrow();
  });
});

describe('getChatMessages', () => {
  beforeEach(() => vi.clearAllMocks());

  const sampleMessage = { id: 'm1', room_id: 'r1', session_id: 's1', anonymous_name: 'Alice', avatar: '🌿', message: 'Hello', timestamp: '2024-01-01', likes: 0, liked_by: [], reported: false };

  it('returns messages from nested format', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { messages: [sampleMessage] } } });

    const result = await getChatMessages('r1');
    expect(result).toHaveLength(1);
  });

  it('returns empty array when messages missing', async () => {
    mockApi.get.mockResolvedValueOnce({ data: {} });

    const result = await getChatMessages('r1');
    expect(result).toEqual([]);
  });

  it('includes sessionId and after params in URL', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { messages: [] } } });

    await getChatMessages('r1', 's1', 'last-msg-id');
    expect(mockApi.get).toHaveBeenCalledWith(
      expect.stringMatching(/session_id=s1.*after=last-msg-id|after=last-msg-id.*session_id=s1/)
    );
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Error'));

    await expect(getChatMessages('r1')).rejects.toThrow();
  });
});

describe('sendChatMessage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns sent message data', async () => {
    const msg = { id: 'm2', message: 'Hello world' };
    mockApi.post.mockResolvedValueOnce({ data: { data: { message: msg } } });

    const result = await sendChatMessage('r1', 's1', 'Hello world');
    expect(result.id).toBe('m2');
  });

  it('posts message with session_id', async () => {
    mockApi.post.mockResolvedValueOnce({ data: {} });

    await sendChatMessage('r1', 's1', 'Hello!', 'Alice', '🌿');
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        session_id: 's1',
        message: 'Hello!',
        anonymous_name: 'Alice',
        avatar: '🌿',
      })
    );
  });

  it('throws on API error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Error'));

    await expect(sendChatMessage('r1', 's1', 'hi')).rejects.toThrow();
  });
});

describe('toggleMessageLike', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns toggle result', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: { liked: true, likes: 3 } } });

    const result = await toggleMessageLike('m1', 's1');
    expect(result.liked).toBe(true);
  });

  it('posts session_id and includes messageId in URL', async () => {
    mockApi.post.mockResolvedValueOnce({ data: {} });

    await toggleMessageLike('msg-abc', 's1');
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.stringContaining('msg-abc'),
      expect.objectContaining({ session_id: 's1' })
    );
  });

  it('throws on API error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Error'));

    await expect(toggleMessageLike('m1', 's1')).rejects.toThrow();
  });
});

describe('reportChatMessage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts report with reason', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: { reported: true } } });

    const result = await reportChatMessage('m1', 's1', 'spam');
    expect(result.reported).toBe(true);
  });

  it('includes messageId in URL', async () => {
    mockApi.post.mockResolvedValueOnce({ data: {} });

    await reportChatMessage('msg-xyz', 's1', 'inappropriate');
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.stringContaining('msg-xyz'),
      expect.objectContaining({ reason: 'inappropriate' })
    );
  });

  it('throws on API error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Error'));

    await expect(reportChatMessage('m1', 's1', 'spam')).rejects.toThrow();
  });
});

describe('updateTypingStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts is_typing status', async () => {
    mockApi.post.mockResolvedValueOnce({ data: {} });

    await updateTypingStatus('r1', 's1', true);
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ session_id: 's1', is_typing: true })
    );
  });

  it('works for both true and false', async () => {
    mockApi.post.mockResolvedValue({ data: {} });

    await updateTypingStatus('r1', 's1', false);
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ is_typing: false })
    );
  });

  it('throws on API error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Error'));

    await expect(updateTypingStatus('r1', 's1', true)).rejects.toThrow();
  });
});

describe('getRoomPresence', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns presence data', async () => {
    const presence = { onlineCount: 5, members: ['Alice', 'Bob'] };
    mockApi.get.mockResolvedValueOnce({ data: { data: presence } });

    const result = await getRoomPresence('r1', 's1');
    expect(result.onlineCount).toBe(5);
  });

  it('includes sessionId in URL', async () => {
    mockApi.get.mockResolvedValueOnce({ data: {} });

    await getRoomPresence('r1', 'my-session');
    expect(mockApi.get).toHaveBeenCalledWith(
      expect.stringContaining('my-session')
    );
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Error'));

    await expect(getRoomPresence('r1', 's1')).rejects.toThrow();
  });
});
