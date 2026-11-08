/**
 * The banner on premium pages during a trial says "Provperiod", as the
 * profile does. It said "Gratisperiod aktiv".
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';

const DAY = 24 * 60 * 60 * 1000;

vi.mock('@/contexts/SubscriptionContext', () => ({
  useSubscription: () => ({
    hasFeature: () => true,
    plan: { tier: 'trial', trialEndsAt: new Date(Date.now() + 5 * DAY - 60_000) },
    loading: false,
    isTrial: true,
  }),
}));

import { PremiumGate } from '../PremiumGate';

describe('PremiumGate during a trial', () => {
  it('names it "Provperiod" with the days left', () => {
    render(
      <MemoryRouter>
        <PremiumGate feature="journal">
          <p>Dagboken</p>
        </PremiumGate>
      </MemoryRouter>,
    );

    expect(screen.getByText('Provperiod aktiv: 5 dagar kvar.')).toBeInTheDocument();
    expect(screen.getByText('Dagboken')).toBeInTheDocument();
  });
});
