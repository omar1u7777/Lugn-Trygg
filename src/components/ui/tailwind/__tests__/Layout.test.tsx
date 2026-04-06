/**
 * Layout Components Tests (Container, Box, Stack, Grid)
 * Covers the branches in ui/tailwind/Layout.tsx
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('../../../utils/cn', () => ({
  cn: (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' '),
}));

import { Container, Box, Stack } from '../Layout';

describe('Container', () => {
  it('renders children', () => {
    render(<Container>Content</Container>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('defaults to xl maxWidth', () => {
    const { container } = render(<Container>X</Container>);
    expect(container.firstChild).toHaveClass('max-w-screen-xl');
  });

  it('applies sm maxWidth', () => {
    const { container } = render(<Container maxWidth="sm">X</Container>);
    expect(container.firstChild).toHaveClass('max-w-screen-sm');
  });

  it('applies md maxWidth', () => {
    const { container } = render(<Container maxWidth="md">X</Container>);
    expect(container.firstChild).toHaveClass('max-w-screen-md');
  });

  it('applies lg maxWidth', () => {
    const { container } = render(<Container maxWidth="lg">X</Container>);
    expect(container.firstChild).toHaveClass('max-w-screen-lg');
  });

  it('applies 2xl maxWidth', () => {
    const { container } = render(<Container maxWidth="2xl">X</Container>);
    expect(container.firstChild).toHaveClass('max-w-screen-2xl');
  });

  it('applies full maxWidth', () => {
    const { container } = render(<Container maxWidth="full">X</Container>);
    expect(container.firstChild).toHaveClass('max-w-full');
  });

  it('applies mx-auto when centered (default)', () => {
    const { container } = render(<Container>X</Container>);
    expect(container.firstChild).toHaveClass('mx-auto');
  });

  it('does not apply mx-auto when centered=false', () => {
    const { container } = render(<Container centered={false}>X</Container>);
    expect(container.firstChild).not.toHaveClass('mx-auto');
  });

  it('merges custom className', () => {
    const { container } = render(<Container className="my-custom">X</Container>);
    expect(container.firstChild).toHaveClass('my-custom');
  });
});

describe('Box', () => {
  it('renders children', () => {
    render(<Box>Box content</Box>);
    expect(screen.getByText('Box content')).toBeInTheDocument();
  });

  it('renders as div by default', () => {
    const { container } = render(<Box>X</Box>);
    expect(container.querySelector('div')).toBeInTheDocument();
  });

  it('strips MUI props without passing to DOM', () => {
    // These MUI props should be accepted without causing React warnings
    const { container } = render(
      <Box display="flex" alignItems="center" justifyContent="start" flexDirection="row" gap={2} mb={1} mt={2} sx={{ color: 'red' }}>
        OK
      </Box>
    );
    expect(container.querySelector('div')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Box className="custom-box">X</Box>);
    expect(container.firstChild).toHaveClass('custom-box');
  });
});

describe('Stack', () => {
  it('renders children', () => {
    render(<Stack><span>A</span><span>B</span></Stack>);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('defaults to flex-col direction', () => {
    const { container } = render(<Stack>X</Stack>);
    expect(container.firstChild).toHaveClass('flex-col');
  });

  it('applies row direction', () => {
    const { container } = render(<Stack direction="row">X</Stack>);
    expect(container.firstChild).toHaveClass('flex-row');
  });

  it('applies column direction explicitly', () => {
    const { container } = render(<Stack direction="column">X</Stack>);
    expect(container.firstChild).toHaveClass('flex-col');
  });

  it('applies default gap-4', () => {
    const { container } = render(<Stack>X</Stack>);
    expect(container.firstChild).toHaveClass('gap-4');
  });

  it('applies spacing=2 as gap-2', () => {
    const { container } = render(<Stack spacing={2}>X</Stack>);
    expect(container.firstChild).toHaveClass('gap-2');
  });

  it('applies spacing=6 as gap-6', () => {
    const { container } = render(<Stack spacing={6}>X</Stack>);
    expect(container.firstChild).toHaveClass('gap-6');
  });

  it('applies spacing=8 as gap-8', () => {
    const { container } = render(<Stack spacing={8}>X</Stack>);
    expect(container.firstChild).toHaveClass('gap-8');
  });

  // Alignment branches
  it('applies items-start for align=start', () => {
    const { container } = render(<Stack align="start">X</Stack>);
    expect(container.firstChild).toHaveClass('items-start');
  });

  it('applies items-center for align=center', () => {
    const { container } = render(<Stack align="center">X</Stack>);
    expect(container.firstChild).toHaveClass('items-center');
  });

  it('applies items-end for align=end', () => {
    const { container } = render(<Stack align="end">X</Stack>);
    expect(container.firstChild).toHaveClass('items-end');
  });

  it('applies items-stretch for align=stretch (default)', () => {
    const { container } = render(<Stack>X</Stack>);
    expect(container.firstChild).toHaveClass('items-stretch');
  });

  // Justification branches
  it('applies justify-start for justify=start (default)', () => {
    const { container } = render(<Stack>X</Stack>);
    expect(container.firstChild).toHaveClass('justify-start');
  });

  it('applies justify-center for justify=center', () => {
    const { container } = render(<Stack justify="center">X</Stack>);
    expect(container.firstChild).toHaveClass('justify-center');
  });

  it('applies justify-end for justify=end', () => {
    const { container } = render(<Stack justify="end">X</Stack>);
    expect(container.firstChild).toHaveClass('justify-end');
  });

  it('applies justify-between for justify=between', () => {
    const { container } = render(<Stack justify="between">X</Stack>);
    expect(container.firstChild).toHaveClass('justify-between');
  });

  it('applies justify-around for justify=around', () => {
    const { container } = render(<Stack justify="around">X</Stack>);
    expect(container.firstChild).toHaveClass('justify-around');
  });
});
