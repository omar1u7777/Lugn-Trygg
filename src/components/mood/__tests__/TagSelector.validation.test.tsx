/**
 * BUG-09, BUG-16, BUG-22 — the mood tag selector.
 *
 * BUG-09 is the interesting one. Deduplication compared the typed text against
 * `selectedTags`, and selected presets are stored by ID — 'work'. A user with
 * "Arbete" already chosen who typed "arbete" was compared against 'work', found
 * no match, and got a second tag for the same thing. The comparison could never
 * have worked: it was matching a label against an id.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';

import i18n from '../../../i18n';
import { TagSelector } from '../TagSelector';

const renderSelector = (selectedTags: string[] = []) => {
  const onTagsChange = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <TagSelector selectedTags={selectedTags} onTagsChange={onTagsChange} />
    </I18nextProvider>
  );
  return { onTagsChange };
};

const typeCustom = (value: string) => {
  fireEvent.change(screen.getByPlaceholderText(/Egen tagg/i), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: /Lägg till/i }));
};

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('sv');
});

describe('a tag cannot be added twice under a different casing', () => {
  it('rejects the label of a preset that is already selected', () => {
    // "Arbete" is the label of the preset stored as 'work'.
    const { onTagsChange } = renderSelector(['work']);

    typeCustom('arbete');

    expect(onTagsChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('selects the preset rather than shadowing it with a custom tag', () => {
    // Typing a preset's label should reach the preset, not create a look-alike.
    const { onTagsChange } = renderSelector([]);

    typeCustom('Arbete');

    expect(onTagsChange).toHaveBeenCalledWith(['work']);
  });

  it('rejects a custom tag that differs only in case', () => {
    const { onTagsChange } = renderSelector(['trädgård']);

    typeCustom('TRÄDGÅRD');

    expect(onTagsChange).not.toHaveBeenCalled();
  });

  it('still accepts a genuinely new tag', () => {
    const { onTagsChange } = renderSelector(['work']);

    typeCustom('Trädgård');

    expect(onTagsChange).toHaveBeenCalledWith(['work', 'trädgård']);
  });
});

describe('the custom tag field says why it refused', () => {
  it('reports whitespace-only input instead of ignoring it', () => {
    const { onTagsChange } = renderSelector([]);

    typeCustom('   ');

    expect(onTagsChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('clears the field rather than leaving the spaces in it', () => {
    renderSelector([]);
    const input = screen.getByPlaceholderText(/Egen tagg/i) as HTMLInputElement;

    typeCustom('   ');

    // Leaving them made the button look broken rather than the input rejected.
    expect(input.value).toBe('');
  });

  it('strips markup characters before storing', () => {
    // React escapes on render, so this was never live XSS — but the value is
    // persisted, and "the current renderer happens to escape it" is not a
    // property a database should rely on.
    const { onTagsChange } = renderSelector([]);

    typeCustom('<b>xss</b>');

    expect(onTagsChange).toHaveBeenCalledWith(['bxss/b']);
  });
});

describe('selecting a tag does not move the ones after it', () => {
  it('reserves the remove icon whether or not the tag is selected', () => {
    // The X used to render only when selected, growing the chip by 20px at the
    // moment of the tap and reflowing the row — so a quick second tap landed
    // on a different tag.
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <TagSelector selectedTags={[]} onTagsChange={vi.fn()} />
      </I18nextProvider>
    );

    const chips = container.querySelectorAll('button svg.invisible');
    expect(chips.length).toBeGreaterThan(0);
  });
});
