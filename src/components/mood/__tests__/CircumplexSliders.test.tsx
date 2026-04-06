/**
 * CircumplexSliders Component Tests
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { CircumplexSliders } from '../CircumplexSliders';

const defaultProps = {
  valence: 5,
  arousal: 5,
  onValenceChange: vi.fn(),
  onArousalChange: vi.fn(),
};

describe('CircumplexSliders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders valence and arousal sliders', () => {
    render(<CircumplexSliders {...defaultProps} />);
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBe(2);
  });

  it('renders title text', () => {
    render(<CircumplexSliders {...defaultProps} />);
    expect(screen.getByText('Circumplex Model')).toBeInTheDocument();
  });

  it('renders current valence value', () => {
    render(<CircumplexSliders {...defaultProps} valence={7} />);
    expect(screen.getByText('7/10')).toBeInTheDocument();
  });

  it('renders current arousal value', () => {
    render(<CircumplexSliders {...defaultProps} arousal={3} />);
    expect(screen.getByText('3/10')).toBeInTheDocument();
  });

  it('calls onValenceChange when valence slider changes', () => {
    const onValenceChange = vi.fn();
    render(<CircumplexSliders {...defaultProps} onValenceChange={onValenceChange} />);
    const [valenceSlider] = screen.getAllByRole('slider');
    fireEvent.change(valenceSlider, { target: { value: '8' } });
    expect(onValenceChange).toHaveBeenCalledWith(8);
  });

  it('calls onArousalChange when arousal slider changes', () => {
    const onArousalChange = vi.fn();
    render(<CircumplexSliders {...defaultProps} onArousalChange={onArousalChange} />);
    const [, arousalSlider] = screen.getAllByRole('slider');
    fireEvent.change(arousalSlider, { target: { value: '9' } });
    expect(onArousalChange).toHaveBeenCalledWith(9);
  });

  it('disables sliders when disabled prop is true', () => {
    render(<CircumplexSliders {...defaultProps} disabled={true} />);
    const sliders = screen.getAllByRole('slider');
    sliders.forEach(slider => expect(slider).toBeDisabled());
  });

  // Test getValenceLabel boundary conditions
  // Note: static min/max labels ('Obehaglig', 'Behaglig') are always in DOM
  // so we check the dynamic label using the font-medium span or getAllByText
  it('shows "Obehaglig" label for valence <= 3 (appears in static + dynamic)', () => {
    render(<CircumplexSliders {...defaultProps} valence={2} />);
    // Static 'Obehaglig' label + dynamic label => at least 2 matches
    expect(screen.getAllByText('Obehaglig').length).toBeGreaterThanOrEqual(2);
  });

  it('shows "Neutral" label for valence between 4-5 (unique, not a static label)', () => {
    render(<CircumplexSliders {...defaultProps} valence={4} />);
    expect(screen.getByText('Neutral')).toBeInTheDocument();
  });

  it('shows "Behaglig" label for valence between 6-7 (appears in static + dynamic)', () => {
    render(<CircumplexSliders {...defaultProps} valence={6} />);
    // Static max label + dynamic label => at least 2 matches
    expect(screen.getAllByText('Behaglig').length).toBeGreaterThanOrEqual(2);
  });

  it('shows "Mycket behaglig" label for valence > 7 (unique)', () => {
    render(<CircumplexSliders {...defaultProps} valence={9} />);
    expect(screen.getByText('Mycket behaglig')).toBeInTheDocument();
  });

  // Test getArousalLabel boundary conditions
  it('shows "Lugn" label for arousal <= 3 (appears in static + dynamic)', () => {
    render(<CircumplexSliders {...defaultProps} arousal={1} />);
    expect(screen.getAllByText('Lugn').length).toBeGreaterThanOrEqual(2);
  });

  it('shows "Måttlig" label for arousal between 4-5 (unique)', () => {
    render(<CircumplexSliders {...defaultProps} arousal={4} />);
    expect(screen.getByText('Måttlig')).toBeInTheDocument();
  });

  it('shows "Energisk" label for arousal between 6-7 (unique)', () => {
    render(<CircumplexSliders {...defaultProps} arousal={7} />);
    expect(screen.getByText('Energisk')).toBeInTheDocument();
  });

  it('shows "Upphetsad" label for arousal > 7 (appears in static + dynamic)', () => {
    render(<CircumplexSliders {...defaultProps} arousal={10} />);
    expect(screen.getAllByText('Upphetsad').length).toBeGreaterThanOrEqual(2);
  });

  it('renders description text', () => {
    render(<CircumplexSliders {...defaultProps} />);
    expect(screen.getByText(/Beskriv ditt känslotillstånd/)).toBeInTheDocument();
  });
});
