import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import DeleteAccountFlow from '../DeleteAccountFlow';
import { SUPPORT_EMAIL } from '../../../config/contact';

const renderFlow = (onDelete = vi.fn().mockResolvedValue(undefined)) => {
  const onCancel = vi.fn();
  const onDeleted = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <DeleteAccountFlow isOpen onDelete={onDelete} onCancel={onCancel} onDeleted={onDeleted} />
    </I18nextProvider>,
  );
  return { onDelete, onCancel, onDeleted };
};

const confirmDeletion = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Fortsätt' }));
  fireEvent.change(screen.getByLabelText(/Skriv "RADERA"/), { target: { value: 'radera' } });
  fireEvent.change(screen.getByLabelText(/lösenord/i), { target: { value: 'hemligt' } });
  fireEvent.click(screen.getByRole('button', { name: 'Radera kontot' }));
};

describe('DeleteAccountFlow', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('sv');
  });

  it('describes the period the backend uses and how to change one\'s mind', () => {
    renderFlow();
    fireEvent.click(screen.getByRole('button', { name: 'Fortsätt' }));

    const dialogText = document.body.textContent ?? '';
    expect(dialogText).toContain('30 dagar');
    expect(dialogText).toContain(SUPPORT_EMAIL);
    // It promised a 7-day "ångertid" that did not exist.
    expect(dialogText).not.toMatch(/7 dagar|7-dagars/);
  });

  it('offers no in-app "cancel deletion", which never called the backend', async () => {
    const { onDelete } = renderFlow();
    confirmDeletion();

    await waitFor(() => expect(screen.getByText('Ditt konto är stängt')).toBeInTheDocument());
    expect(onDelete).toHaveBeenCalledWith('hemligt');
    expect(screen.queryByRole('button', { name: /Avbryt radering/ })).toBeNull();
  });

  it('signs the person out once the account is closed', async () => {
    const { onDeleted, onCancel } = renderFlow();
    confirmDeletion();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Logga ut' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Logga ut' }));
    expect(onDeleted).toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('stays on the form with an error when the password is wrong', async () => {
    renderFlow(vi.fn().mockRejectedValue(new Error('401')));
    confirmDeletion();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Kontrollera ditt lösenord'));
    expect(screen.queryByText('Ditt konto är stängt')).toBeNull();
  });
});
