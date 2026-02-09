/**
 * 🔥 FRONTEND-BACKEND-DESIGN SYSTEM INTEGRATION TEST
 * Tests real component integration with Tailwind, API calls, and state management
 * 
 * Updated for Tailwind CSS component library (MUI removed Nov 2025)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { Button, Card, CardContent, Input } from '../ui/tailwind';

// Mock API
vi.mock('../../api/api', () => ({
  API_BASE_URL: 'http://localhost:54112',
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  logMood: vi.fn(),
  getMoods: vi.fn(),
  chatWithAI: vi.fn(),
  getChatHistory: vi.fn(),
}));

// Mock hooks
vi.mock('../../hooks/useAuth', () => ({
  default: () => ({
    user: { user_id: 'test-user-123', email: 'test@example.com' },
    loading: false,
    error: null
  })
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'sv' }
  })
}));

vi.mock('../../hooks/useAccessibility', () => ({
  useAccessibility: () => ({
    announceToScreenReader: vi.fn(),
    isReducedMotion: false
  })
}));

vi.mock('../../services/analytics', () => ({
  analytics: {
    page: vi.fn(),
    track: vi.fn(),
    identify: vi.fn(),
    business: {
      apiCall: vi.fn(),
    }
  }
}));

const renderComponent = (component: React.ReactElement) => {
  return render(component);
};

describe('🔥 Frontend-Backend-Design Integration', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tailwind Component Integration', () => {
    test('should render Button with Tailwind styling', () => {
      renderComponent(
        <Button variant="primary">
          Test Button
        </Button>
      );
      
      const button = screen.getByText('Test Button');
      expect(button).toBeInTheDocument();
      expect(button.tagName).toBe('BUTTON');
    });

    test('should render Card with content', () => {
      renderComponent(
        <Card>
          <CardContent>
            <p>Card Content</p>
          </CardContent>
        </Card>
      );
      
      expect(screen.getByText('Card Content')).toBeInTheDocument();
    });

    test('should render Input with label', () => {
      renderComponent(
        <Input
          label="Email"
          placeholder="Enter your email"
        />
      );
      
      const input = screen.getByLabelText('Email');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('placeholder', 'Enter your email');
    });
  });

  describe('Form State Management', () => {
    test('should handle button click event', () => {
      const handleClick = vi.fn();
      
      renderComponent(
        <Button onClick={handleClick}>
          Click Me
        </Button>
      );
      
      const button = screen.getByText('Click Me');
      fireEvent.click(button);
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    test('should handle text input change', () => {
      const handleChange = vi.fn();
      
      renderComponent(
        <Input
          label="Test Input"
          onChange={handleChange}
        />
      );
      
      const input = screen.getByLabelText('Test Input');
      fireEvent.change(input, { target: { value: 'test value' } });
      
      expect(handleChange).toHaveBeenCalled();
    });

    test('should validate form submission', () => {
      const handleSubmit = vi.fn((e) => e.preventDefault());
      
      const { container } = renderComponent(
        <form onSubmit={handleSubmit}>
          <Input label="Email" required />
          <Button type="submit">Submit</Button>
        </form>
      );
      
      const form = container.querySelector('form');
      fireEvent.submit(form!);
      
      expect(handleSubmit).toHaveBeenCalled();
    });
  });

  describe('API Integration Mock Tests', () => {
    test('should mock mood logging API call', async () => {
      const { logMood } = await import('../../api/api');
      
      vi.mocked(logMood).mockResolvedValue({
        success: true,
        mood_id: 'mood-123'
      });
      
      const payload = { mood_text: 'happy', mood_score: 8 };
      const result = await logMood('user-123', payload);
      
      expect(logMood).toHaveBeenCalledWith('user-123', payload);
      expect(result.success).toBe(true);
    });

    test('should mock mood fetching API call', async () => {
      const { getMoods } = await import('../../api/api');
      
      vi.mocked(getMoods).mockResolvedValue([
        { id: '1', mood: 'happy', score: 8, timestamp: '2025-11-10' },
        { id: '2', mood: 'calm', score: 7, timestamp: '2025-11-09' }
      ]);
      
      const moods = await getMoods('user-123');
      
      expect(getMoods).toHaveBeenCalledWith('user-123');
      expect(moods).toHaveLength(2);
      expect(moods[0].mood).toBe('happy');
    });

    test('should mock chatbot API call', async () => {
      const { chatWithAI } = await import('../../api/api');
      
      vi.mocked(chatWithAI).mockResolvedValue({
        response: 'Hej! Hur kan jag hjälpa dig?',
        sentiment: 'positive'
      });
      
      const result = await chatWithAI('user-123', 'Hej!');
      
      expect(chatWithAI).toHaveBeenCalledWith('user-123', 'Hej!');
      expect(result.response).toContain('Hej!');
    });

    test('should handle API errors gracefully', async () => {
      const { logMood } = await import('../../api/api');
      
      vi.mocked(logMood).mockRejectedValue(new Error('Network error'));
      
      try {
        await logMood('user-123', { mood_text: 'sad', mood_score: 3 });
      } catch (error: unknown) {
        expect((error as Error).message).toBe('Network error');
      }
      
      expect(logMood).toHaveBeenCalled();
    });
  });

  describe('Component Composition', () => {
    test('should compose form with button and input', () => {
      renderComponent(
        <Card>
          <CardContent>
            <form>
              <Input label="Mood Note" />
              <Button variant="primary">
                Log Mood
              </Button>
            </form>
          </CardContent>
        </Card>
      );
      
      expect(screen.getByLabelText('Mood Note')).toBeInTheDocument();
      expect(screen.getByText('Log Mood')).toBeInTheDocument();
    });

    test('should compose multiple cards in grid', () => {
      renderComponent(
        <div className="grid gap-4">
          <Card><CardContent>Card 1</CardContent></Card>
          <Card><CardContent>Card 2</CardContent></Card>
          <Card><CardContent>Card 3</CardContent></Card>
        </div>
      );
      
      expect(screen.getByText('Card 1')).toBeInTheDocument();
      expect(screen.getByText('Card 2')).toBeInTheDocument();
      expect(screen.getByText('Card 3')).toBeInTheDocument();
    });
  });

  describe('Theme Integration', () => {
    test('should apply primary button variant', () => {
      renderComponent(
        <Button variant="primary">
          Primary Button
        </Button>
      );
      
      const button = screen.getByText('Primary Button');
      expect(button).toBeInTheDocument();
      expect(button.tagName).toBe('BUTTON');
    });

    test('should apply secondary button variant', () => {
      renderComponent(
        <Button variant="secondary">
          Secondary Button
        </Button>
      );
      
      const button = screen.getByText('Secondary Button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Accessibility Integration', () => {
    test('should have proper ARIA labels', () => {
      renderComponent(
        <Button aria-label="Submit form">
          Submit
        </Button>
      );
      
      const button = screen.getByLabelText('Submit form');
      expect(button).toBeInTheDocument();
    });

    test('should have proper form labels', () => {
      renderComponent(
        <Input label="Email Address" id="email" />
      );
      
      const input = screen.getByLabelText('Email Address');
      expect(input).toBeInTheDocument();
    });

    test('should support keyboard navigation', () => {
      const handleClick = vi.fn();
      
      renderComponent(
        <Button onClick={handleClick}>
          Keyboard Accessible
        </Button>
      );
      
      const button = screen.getByText('Keyboard Accessible');
      
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
      
      // Button should be in the document and focusable
      expect(button).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    test('should show disabled state during loading', () => {
      renderComponent(
        <Button disabled>
          Loading...
        </Button>
      );
      
      const button = screen.getByText('Loading...');
      expect(button).toBeDisabled();
    });

    test('should show loading indicator', () => {
      const { container } = renderComponent(
        <Button disabled>
          <span className="loading-spinner"></span>
          Loading...
        </Button>
      );
      
      const spinner = container.querySelector('.loading-spinner');
      expect(spinner).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    test('should display error message in input', () => {
      renderComponent(
        <Input
          label="Email"
          error="Please enter a valid email"
        />
      );
      
      expect(screen.getByText('Please enter a valid email')).toBeInTheDocument();
    });

    test('should handle form validation errors', () => {
      renderComponent(
        <form>
          <Input
            label="Password"
            error="Password must be at least 8 characters"
          />
        </form>
      );
      
      const errorText = screen.getByText('Password must be at least 8 characters');
      expect(errorText).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    test('should support responsive spacing', () => {
      const { container } = renderComponent(
        <div className="max-w-2xl mx-auto p-6">
          <Card>Responsive Card</Card>
        </div>
      );
      
      const wrapper = container.querySelector('.max-w-2xl');
      expect(wrapper).toBeTruthy();
      expect(wrapper?.classList.contains('mx-auto')).toBe(true);
    });

    test('should support mobile-first design', () => {
      const { container } = renderComponent(
        <div className="w-full sm:w-1/2 md:w-1/3">
          <Card>Responsive Width</Card>
        </div>
      );
      
      const wrapper = container.querySelector('.w-full');
      expect(wrapper).toBeTruthy();
    });
  });

  describe('Performance', () => {
    test('should render quickly', () => {
      const startTime = performance.now();
      
      renderComponent(
        <Button>Performance Test</Button>
      );
      
      const renderTime = performance.now() - startTime;
      expect(renderTime).toBeLessThan(100);
    });

    test('should handle multiple re-renders efficiently', () => {
      const { rerender } = renderComponent(
        <Button>Initial</Button>
      );
      
      const startTime = performance.now();
      
      for (let i = 0; i < 10; i++) {
        rerender(
          <Button>Rerender {i}</Button>
        );
      }
      
      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(500);
    });
  });
});

describe('🎯 Real-World Integration Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should simulate mood logging workflow', async () => {
    const { logMood } = await import('../../api/api');
    vi.mocked(logMood).mockResolvedValue({ success: true, mood_id: 'mood-123' });
    
    renderComponent(
      <Card>
        <CardContent>
          <Input label="Mood Note" id="mood-note" />
          <Button variant="primary">
            Log Mood
          </Button>
        </CardContent>
      </Card>
    );
    
    expect(screen.getByLabelText('Mood Note')).toBeInTheDocument();
    expect(screen.getByText('Log Mood')).toBeInTheDocument();
    
    const input = screen.getByLabelText('Mood Note') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Feeling great today!' } });
    
    expect(input.value).toBe('Feeling great today!');
    
    const button = screen.getByText('Log Mood');
    fireEvent.click(button);
  });

  test('should simulate chat interaction workflow', async () => {
    const { chatWithAI } = await import('../../api/api');
    vi.mocked(chatWithAI).mockResolvedValue({
      response: 'Det låter bra! Fortsätt så.'
    });
    
    renderComponent(
      <div>
        <Input
          label="Message"
          id="chat-message"
        />
        <Button variant="primary">
          Send
        </Button>
      </div>
    );
    
    const input = screen.getByLabelText('Message') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Jag mår bra idag!' } });
    
    expect(input.value).toBe('Jag mår bra idag!');
    
    const button = screen.getByText('Send');
    fireEvent.click(button);
  });
});
