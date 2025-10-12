// src/setupTests.ts

import { vi } from 'vitest';

// Ställ in mock för global fetch eller andra globala inställningar om det behövs
global.fetch = vi.fn().mockResolvedValue({
  json: vi.fn().mockResolvedValue({}),
});
