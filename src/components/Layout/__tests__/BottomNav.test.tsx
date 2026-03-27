import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BottomNav from '../BottomNav';

const renderBottomNav = (route = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <BottomNav />
    </MemoryRouter>
  );

describe('BottomNav', () => {
  it('renders the mobile navigation landmark', () => {
    renderBottomNav();
    expect(screen.getByRole('navigation', { name: 'Mobilnavigation' })).toBeTruthy();
  });

  it('renders all primary bottom navigation links', () => {
    renderBottomNav();

    expect(screen.getByRole('link', { name: 'Hem' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Humör' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'AI' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Mer' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Profil' })).toBeTruthy();
  });

  it('marks the current route as active with aria-current', () => {
    renderBottomNav('/profile');

    expect(screen.getByRole('link', { name: 'Profil' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Hem' }).getAttribute('aria-current')).not.toBe('page');
  });

  it('uses a minimum 44px touch target class on all nav links', () => {
    renderBottomNav();

    const links = screen.getAllByRole('link');
    expect(links.length).toBe(5);

    for (const link of links) {
      expect(link.className).toContain('min-h-[44px]');
    }
  });
});
