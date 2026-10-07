import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const onboarding = vi.fn();
vi.mock('../WellnessGoalsOnboarding', () => ({
  default: (props: { onComplete: (g: string[]) => void; mode: string; initialGoals: string[] }) => {
    onboarding(props);
    return <button onClick={() => props.onComplete(['Bättre sömn'])}>save</button>;
  },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

import WellnessGoalsDialog from '../WellnessGoalsDialog';

const renderDialog = (goals: string[] = ['Hantera stress']) => {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(<WellnessGoalsDialog open userId="u1" goals={goals} onSaved={onSaved} onClose={onClose} />);
  return { onSaved, onClose };
};

describe('WellnessGoalsDialog (UI audit Dup-18)', () => {
  it('opens the editor with the current goals selected', () => {
    renderDialog(['Hantera stress']);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(onboarding).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'edit', initialGoals: ['Hantera stress'] }),
    );
  });

  it('starts in onboarding mode for someone with no goals', () => {
    renderDialog([]);
    expect(onboarding).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'onboarding' }));
  });

  it('hands the saved goals back', () => {
    const { onSaved } = renderDialog();
    fireEvent.click(screen.getByText('save'));
    expect(onSaved).toHaveBeenCalledWith(['Bättre sömn']);
  });

  it('closes on Escape and on the close button', () => {
    const { onClose } = renderDialog();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'wellnessGoals.close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders nothing when closed', () => {
    render(<WellnessGoalsDialog open={false} goals={[]} onSaved={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
