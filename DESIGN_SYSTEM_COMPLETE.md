# 🎨 Lugn & Trygg Professional Design System

## Version 2.0 - Complete Design Foundation

This design system provides enterprise-grade UI components, styles, and animations for the Lugn & Trygg health application.

---

## 📚 Table of Contents

1. [Installation](#installation)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Components](#components)
5. [Animations](#animations)
6. [Responsive Design](#responsive-design)
7. [Accessibility](#accessibility)
8. [Best Practices](#best-practices)

---

## 🚀 Installation

### Import in Your Component

```tsx
// Import design system CSS
import '../styles/design-system.css';
import '../styles/animations.css';
import '../styles/responsive.css';

// Import professional components
import { Button, Card, Input, Modal } from '../components/UI';
```

---

## 🎨 Color System

### WCAG 2.1 AAA Compliant Colors

#### Primary Colors (Brand)
- `--color-primary-500`: #5a67d8 (Main brand color)
- `--color-primary-600`: #4c51bf (Hover state)
- `--color-primary-700`: #434190 (Active state)

#### Semantic Colors
- **Success**: Green palette (#10b981)
- **Warning**: Amber palette (#f59e0b)
- **Error**: Red palette (#ef4444)
- **Info**: Primary palette (#5a67d8)

### Dark Mode

Automatic dark mode support with smooth transitions:

```tsx
// Colors automatically adapt
<div className="bg-color-background text-color-text-primary">
  Content automatically adapts to light/dark mode
</div>
```

---

## ✍️ Typography

### Fluid Typography Scale

All typography scales smoothly across screen sizes using CSS `clamp()`:

```tsx
<h1 className="heading-1">Main Heading</h1>
{/* 32px mobile → 48px desktop */}

<h2 className="heading-2">Section Heading</h2>
{/* 24px mobile → 36px desktop */}

<p className="body-large">Large body text</p>
{/* 16px mobile → 18px desktop */}

<p className="body-base">Normal body text</p>
{/* 16px all sizes */}

<p className="body-small">Small text</p>
{/* 14px all sizes */}

<span className="caption">CAPTION TEXT</span>
{/* 12px uppercase */}
```

### Using Typography Components

```tsx
import { Heading1, Heading2, BodyText } from '../components/UI';

<Heading1>Welcome to Lugn & Trygg</Heading1>
<Heading2>Your Mental Health Journey</Heading2>
<BodyText size="large">
  Start tracking your mood and improve your well-being.
</BodyText>
```

---

## 🧩 Components

### Buttons

```tsx
import { Button, IconButton } from '../components/UI';

// Primary Button
<Button variant="primary" onClick={handleClick}>
  Save Changes
</Button>

// Secondary Button
<Button variant="secondary" leftIcon={<i className="fas fa-download" />}>
  Download Report
</Button>

// Danger Button
<Button variant="danger" size="lg">
  Delete Account
</Button>

// Loading State
<Button variant="primary" isLoading>
  Processing...
</Button>

// Icon Button
<IconButton icon={<i className="fas fa-heart" />} onClick={handleLike} />
```

### Cards

```tsx
import { Card, CardHeader, CardBody, CardFooter } from '../components/UI';

<Card elevated>
  <CardHeader>
    <h3>Mood Statistics</h3>
  </CardHeader>
  <CardBody>
    <p>Your mood has improved 25% this week!</p>
  </CardBody>
  <CardFooter>
    <Button variant="primary">View Details</Button>
  </CardFooter>
</Card>

// Gradient Header Card
<Card gradient>
  <CardBody>
    Content with gradient header
  </CardBody>
</Card>
```

### Forms

```tsx
import { Input, Textarea, Select, Checkbox } from '../components/UI';

// Input with validation
<Input
  label="Email Address"
  type="email"
  placeholder="you@example.com"
  error={errors.email}
  helperText="We'll never share your email"
/>

// Textarea
<Textarea
  label="How are you feeling?"
  rows={5}
  placeholder="Share your thoughts..."
/>

// Select dropdown
<Select
  label="Mood"
  options={[
    { value: 'happy', label: '😊 Happy' },
    { value: 'calm', label: '😌 Calm' },
    { value: 'anxious', label: '😰 Anxious' },
  ]}
/>

// Checkbox
<Checkbox label="I agree to terms and conditions" />
```

### Badges & Alerts

```tsx
import { Badge, Alert } from '../components/UI';

// Success Badge
<Badge variant="success" icon={<i className="fas fa-check" />}>
  Active
</Badge>

// Alert with close button
<Alert 
  variant="warning" 
  onClose={() => setAlertVisible(false)}
>
  Your subscription expires in 3 days
</Alert>
```

### Loading States

```tsx
import { Spinner, SkeletonText, SkeletonCard } from '../components/UI';

// Spinner
<Spinner size="lg" />

// Skeleton Loader
<SkeletonText lines={5} />

// Skeleton Card
<SkeletonCard />
```

### Modals

```tsx
import { Modal, Button } from '../components/UI';

const [isOpen, setIsOpen] = useState(false);

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Confirm Action"
  size="md"
  footer={
    <>
      <Button variant="ghost" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleConfirm}>
        Confirm
      </Button>
    </>
  }
>
  <p>Are you sure you want to proceed?</p>
</Modal>
```

---

## ✨ Animations

### Page Transitions

```tsx
<div className="page-transition-enter">
  Content fades in and slides up
</div>
```

### Scroll Reveal

```tsx
<div className="reveal">
  Reveals on scroll
</div>

<div className="reveal reveal-delay-2">
  Reveals with delay
</div>
```

### Button Effects

```tsx
<button className="btn-ripple btn-bounce-on-hover">
  Interactive Button
</button>
```

### Card Hover Effects

```tsx
<div className="card-professional card-hover-lift">
  Lifts on hover
</div>
```

### Loading Animations

```tsx
// Loading Bar
<div className="loading-bar"></div>

// Loading Dots
<div className="loading-dots">
  <span></span>
  <span></span>
  <span></span>
</div>

// Skeleton Pulse
<div className="skeleton-pulse">
  Pulsing skeleton
</div>
```

### Toast Notifications

```tsx
<div className="toast-enter">
  Slides in from right
</div>
```

### Stagger Animations

```tsx
<div className="stagger-fade-in">
  <div>Item 1 - fades in first</div>
  <div>Item 2 - fades in second</div>
  <div>Item 3 - fades in third</div>
</div>
```

### Micro-Interactions

```tsx
// Pulse on data update
<span className="pulse-on-update">
  Updated value
</span>

// Highlight flash
<div className="highlight-flash">
  New content
</div>

// Shake on error
<input className="shake-error" />
```

---

## 📱 Responsive Design

### Breakpoints

- **Mobile**: 375px - 640px
- **Tablet**: 640px - 1024px
- **Desktop**: 1024px - 1280px
- **Large**: 1280px - 1536px
- **XL**: 1536px+

### Container System

```tsx
// Responsive container with auto padding
<div className="container-responsive">
  Content with responsive padding
</div>

// Widgets Grid (1-4 columns)
<div className="widgets-grid">
  <div>Widget 1</div>
  <div>Widget 2</div>
  <div>Widget 3</div>
</div>

// Cards Grid (1-3 columns)
<div className="cards-grid">
  <Card>Card 1</Card>
  <Card>Card 2</Card>
  <Card>Card 3</Card>
</div>
```

### Touch Targets

All interactive elements meet Apple HIG (48px+ mobile):

```tsx
<button className="touch-target">
  Touch-friendly button
</button>
```

---

## ♿ Accessibility

### Keyboard Navigation

All components support keyboard navigation:
- Tab/Shift+Tab for focus
- Enter/Space for activation
- Escape to close modals

### Screen Reader Support

```tsx
// Hidden text for screen readers
<span className="sr-only">
  Additional context for screen readers
</span>

// Focus Ring
<button className="focus-ring">
  Visible focus indicator
</button>
```

### ARIA Labels

```tsx
<Button aria-label="Close modal">
  <i className="fas fa-times" />
</Button>

<Input 
  aria-invalid={hasError}
  aria-describedby="error-message"
/>
```

### Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  /* Animations automatically simplified */
}
```

### High Contrast Mode

```css
@media (prefers-contrast: high) {
  /* Colors automatically enhanced */
}
```

---

## 🎯 Best Practices

### Component Usage

```tsx
// ✅ DO: Use semantic components
<Button variant="primary">Save</Button>

// ❌ DON'T: Use raw HTML
<button className="btn-primary-pro">Save</button>
```

### Color Usage

```tsx
// ✅ DO: Use CSS variables
style={{ color: 'var(--color-primary-500)' }}

// ❌ DON'T: Hardcode colors
style={{ color: '#5a67d8' }}
```

### Spacing

```tsx
// ✅ DO: Use spacing variables
style={{ padding: 'var(--space-4)' }}

// ❌ DON'T: Use arbitrary values
style={{ padding: '1rem' }}
```

### Animations

```tsx
// ✅ DO: Use predefined animations
<div className="fade-in">Content</div>

// ❌ DON'T: Inline animations
<div style={{ animation: 'fadeIn 0.3s' }}>Content</div>
```

### Responsive Design

```tsx
// ✅ DO: Use responsive classes
<div className="widgets-grid">

// ❌ DON'T: Use breakpoint-specific classes everywhere
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
```

---

## 🔧 Customization

### Override Colors

```css
:root {
  --color-primary-500: #your-brand-color;
  --color-secondary-500: #your-accent-color;
}
```

### Custom Transitions

```css
:root {
  --transition-base: 300ms ease-out; /* Slower transitions */
}
```

### Custom Breakpoints

```css
@media (min-width: 1920px) {
  .container-responsive {
    max-width: 1800px;
  }
}
```

---

## 📊 Performance

### Optimizations

1. **GPU Acceleration**: Cards and buttons use `transform` instead of `top/left`
2. **Will-Change**: Strategic use on animated elements
3. **Lazy Animations**: `fade-in` only on visible elements
4. **Reduced Repaints**: CSS variables for theme switching

### Lazy Loading

```tsx
const Modal = React.lazy(() => import('../components/UI/Modal'));

<Suspense fallback={<Spinner />}>
  <Modal />
</Suspense>
```

---

## 🧪 Testing

### Component Testing

```tsx
import { render, screen } from '@testing-library/react';
import { Button } from '../components/UI';

test('renders button with text', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

### Accessibility Testing

```tsx
import { axe } from 'jest-axe';

test('button has no accessibility violations', async () => {
  const { container } = render(<Button>Test</Button>);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## 📄 Migration Guide

### From Old Components to New

#### Buttons

```tsx
// Before
<button className="btn btn-primary">Save</button>

// After
<Button variant="primary">Save</Button>
```

#### Cards

```tsx
// Before
<div className="card">
  <div className="card-header">Title</div>
  <div className="card-body">Content</div>
</div>

// After
<Card>
  <CardHeader>Title</CardHeader>
  <CardBody>Content</CardBody>
</Card>
```

#### Forms

```tsx
// Before
<div className="form-group">
  <label className="form-label">Email</label>
  <input className="form-input" type="email" />
</div>

// After
<Input label="Email" type="email" />
```

---

## 🆘 Support

### Common Issues

**Problem**: Colors not updating in dark mode
**Solution**: Make sure you're using CSS variables, not hardcoded colors

**Problem**: Animations not working
**Solution**: Import `animations.css` in your component

**Problem**: Components not responsive
**Solution**: Use responsive grid classes like `.widgets-grid`

---

## 📝 Changelog

### Version 2.0 (2025-10-22)

- ✨ Complete design system CSS with WCAG 2.1 compliance
- ✨ Professional UI component library
- ✨ Enhanced NavigationPro with mobile menu
- ✨ Comprehensive animation system
- ✨ Responsive grid system
- ✨ Dark mode support
- ✨ Accessibility features

---

## 🎓 Examples

### Complete Login Form

```tsx
import { Card, CardHeader, CardBody, Input, Button } from '../components/UI';

function LoginForm() {
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <h2 className="heading-2">Welcome Back</h2>
      </CardHeader>
      <CardBody>
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
        />
        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
        />
        <Button variant="primary" className="w-full">
          Sign In
        </Button>
      </CardBody>
    </Card>
  );
}
```

### Dashboard Widget

```tsx
import { Card, CardHeader, CardBody, Badge } from '../components/UI';

function StatsWidget() {
  return (
    <Card elevated className="card-hover-lift">
      <CardHeader className="flex justify-between items-center">
        <h3 className="heading-4">Mood This Week</h3>
        <Badge variant="success">+25%</Badge>
      </CardHeader>
      <CardBody>
        <p className="body-large">
          Great progress! Your mood has improved significantly.
        </p>
      </CardBody>
    </Card>
  );
}
```

---

## 🎉 Conclusion

This design system provides everything you need to build a professional, accessible, and delightful user experience for Lugn & Trygg.

**Remember**: Consistency is key! Use the provided components and styles throughout your application for a cohesive design.

**Questions?** Review the examples above or check the component source code in `src/components/UI/`.

---

Made with ❤️ for Lugn & Trygg
