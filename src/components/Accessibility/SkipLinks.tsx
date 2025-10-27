import React from 'react';
import { Box, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import { KeyboardArrowDown } from '@mui/icons-material';

const SkipLinkButton = styled(Button)(({ theme }) => ({
  position: 'absolute',
  top: '-40px',
  left: '6px',
  zIndex: 1000,
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  padding: theme.spacing(1, 2),
  borderRadius: theme.shape.borderRadius,
  fontSize: '14px',
  fontWeight: 600,
  textTransform: 'none',
  boxShadow: theme.shadows[4],
  transition: theme.transitions.create(['top'], {
    duration: theme.transitions.duration.short,
  }),
  '&:focus': {
    top: '6px',
  },
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
  },
}));

interface SkipLinksProps {
  links?: Array<{
    href: string;
    label: string;
  }>;
}

const SkipLinks: React.FC<SkipLinksProps> = ({
  links = [
    { href: '#main-content', label: 'Hoppa till huvudinnehåll' },
    { href: '#navigation', label: 'Hoppa till navigation' },
    { href: '#search', label: 'Hoppa till sök' },
  ]
}) => {
  return (
    <Box sx={{ position: 'relative' }}>
      {links.map((link, index) => (
        <SkipLinkButton
          key={link.href}
          component="a"
          href={link.href}
          sx={{
            left: index * 200 + 6, // Space them out horizontally
          }}
          endIcon={<KeyboardArrowDown />}
          aria-label={`${link.label}. Tryck Enter för att hoppa.`}
        >
          {link.label}
        </SkipLinkButton>
      ))}
    </Box>
  );
};

export default SkipLinks;