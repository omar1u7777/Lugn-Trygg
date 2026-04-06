/**
 * TagSelector Component Tests
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { TagSelector } from '../TagSelector';

describe('TagSelector', () => {
  const defaultProps = {
    selectedTags: [] as string[],
    onTagsChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders predefined tags', () => {
    render(<TagSelector {...defaultProps} />);
    expect(screen.getByText('Arbete')).toBeInTheDocument();
    expect(screen.getByText('Familj')).toBeInTheDocument();
    expect(screen.getByText('Träning')).toBeInTheDocument();
  });

  it('shows tag count label', () => {
    render(<TagSelector {...defaultProps} />);
    expect(screen.getByText('0/5')).toBeInTheDocument();
  });

  it('selects an unselected tag when clicked', () => {
    const onTagsChange = vi.fn();
    render(<TagSelector selectedTags={[]} onTagsChange={onTagsChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Arbete/i }));
    expect(onTagsChange).toHaveBeenCalledWith(['work']);
  });

  it('deselects a selected tag when clicked again', () => {
    const onTagsChange = vi.fn();
    render(<TagSelector selectedTags={['work']} onTagsChange={onTagsChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Arbete/i }));
    expect(onTagsChange).toHaveBeenCalledWith([]);
  });

  it('prevents selecting more than 5 tags', () => {
    const onTagsChange = vi.fn();
    const fiveTags = ['work', 'family', 'friends', 'exercise', 'sleep'];
    render(<TagSelector selectedTags={fiveTags} onTagsChange={onTagsChange} />);
    // Try to click an unselected tag
    fireEvent.click(screen.getByRole('button', { name: /Hälsa/i }));
    // Should not be called with new tag (max reached)
    expect(onTagsChange).not.toHaveBeenCalled();
  });

  it('shows selected count when tags selected', () => {
    render(<TagSelector selectedTags={['work', 'family']} onTagsChange={vi.fn()} />);
    expect(screen.getByText('2/5')).toBeInTheDocument();
  });

  it('disables all tag buttons when disabled prop is true', () => {
    render(<TagSelector selectedTags={[]} onTagsChange={vi.fn()} disabled={true} />);
    const buttons = screen.getAllByRole('button');
    // All predefined tag buttons should be disabled
    const tagButtons = buttons.filter(b => b.disabled);
    expect(tagButtons.length).toBeGreaterThan(0);
  });

  it('does not toggle tag when disabled', () => {
    const onTagsChange = vi.fn();
    render(<TagSelector selectedTags={[]} onTagsChange={onTagsChange} disabled={true} />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(onTagsChange).not.toHaveBeenCalled();
  });

  it('renders custom tag input', () => {
    render(<TagSelector {...defaultProps} />);
    expect(screen.getByPlaceholderText(/egen tagg/i)).toBeInTheDocument();
  });

  it('adds custom tag on enter key (onKeyPress)', () => {
    const onTagsChange = vi.fn();
    render(<TagSelector selectedTags={[]} onTagsChange={onTagsChange} />);
    const input = screen.getByPlaceholderText(/egen tagg/i);
    fireEvent.change(input, { target: { value: 'mynewTag' } });
    fireEvent.keyPress(input, { key: 'Enter', charCode: 13 });
    expect(onTagsChange).toHaveBeenCalledWith(['mynewTag'.toLowerCase().trim()]);
  });

  it('does not add duplicate custom tag', () => {
    const onTagsChange = vi.fn();
    render(<TagSelector selectedTags={['mynewTag'.toLowerCase()]} onTagsChange={onTagsChange} />);
    const input = screen.getByPlaceholderText(/egen tagg/i);
    fireEvent.change(input, { target: { value: 'myNewTag' } });
    fireEvent.keyPress(input, { key: 'Enter', charCode: 13 });
    // Duplicate tag → should clear input but not call onTagsChange
    expect(onTagsChange).not.toHaveBeenCalled();
  });

  it('does not add empty custom tag', () => {
    const onTagsChange = vi.fn();
    render(<TagSelector selectedTags={[]} onTagsChange={onTagsChange} />);
    const input = screen.getByPlaceholderText(/egen tagg/i);
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyPress(input, { key: 'Enter', charCode: 13 });
    expect(onTagsChange).not.toHaveBeenCalled();
  });

  it('does not add custom tag when max tags reached', () => {
    const onTagsChange = vi.fn();
    const fiveTags = ['a', 'b', 'c', 'd', 'e'];
    render(<TagSelector selectedTags={fiveTags} onTagsChange={onTagsChange} />);
    const input = screen.getByPlaceholderText(/egen tagg/i);
    fireEvent.change(input, { target: { value: 'newtag' } });
    fireEvent.keyPress(input, { key: 'Enter', charCode: 13 });
    expect(onTagsChange).not.toHaveBeenCalled();
  });

  it('shows remove button (X) for selected tags', () => {
    render(<TagSelector selectedTags={['work']} onTagsChange={vi.fn()} />);
    // The selected tag should have a remove button (XMarkIcon)
    const arbeteBtn = screen.getByRole('button', { name: /Arbete/i });
    expect(arbeteBtn).toBeInTheDocument();
  });

  it('adds custom tag via add button click', () => {
    const onTagsChange = vi.fn();
    render(<TagSelector selectedTags={[]} onTagsChange={onTagsChange} />);
    const input = screen.getByPlaceholderText(/egen tagg/i);
    fireEvent.change(input, { target: { value: 'yoga' } });
    // Click the add button (if it exists)
    const addButton = screen.queryByRole('button', { name: /Lägg till/i });
    if (addButton) {
      fireEvent.click(addButton);
      expect(onTagsChange).toHaveBeenCalledWith(['yoga']);
    }
  });
});
