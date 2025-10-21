# ♿ Accessibility Audit Checklist (WCAG 2.1 AA)

**Target Date:** End of Sprint  
**Components to Audit:** OnboardingFlow, NotificationPermission, OfflineIndicator, LoadingStates

---

## Color Contrast (WCAG 2.1 AA)

### OnboardingFlow
- [ ] Title text (h5) - Check against background
- [ ] Subtitle text - Check against background
- [ ] Goal selection buttons - Check button text vs background
- [ ] Progress bar - Check against container
- [ ] Step indicators - Check text vs background

### NotificationPermission
- [ ] Dialog title - Check against header background
- [ ] Dialog text - Check against white background
- [ ] Buttons - Check text color vs button color
- [ ] Benefit list items - Check text against background

### OfflineIndicator
- [ ] Alert text - Check against alert background
- [ ] Snackbar text - Check contrast
- [ ] Icons - Check visibility

### LoadingStates
- [ ] Spinner text (if any) - Check contrast
- [ ] Skeleton placeholder - Check against background

---

## Keyboard Navigation

### OnboardingFlow
- [ ] Tab through all interactive elements
- [ ] Focus visible on all buttons
- [ ] Next/Skip buttons keyboard accessible
- [ ] Can escape from onboarding (ESC key)
- [ ] Focus order logical (top to bottom)

### NotificationPermission
- [ ] Tab through all dialog elements
- [ ] Close button keyboard accessible
- [ ] Buttons receive keyboard focus
- [ ] Can close with ESC key
- [ ] Focus trap within dialog

### OfflineIndicator
- [ ] If snackbar has action, should be keyboard accessible
- [ ] Close button (if any) keyboard accessible

### LoadingStates
- [ ] If interactive, ensure keyboard access
- [ ] Focus management when content loads

---

## Screen Reader Support (ARIA)

### OnboardingFlow
- [ ] Main container has role="region" or aria-label
- [ ] Title uses semantic heading tags (h1-h6)
- [ ] Stepper has aria-current="step"
- [ ] Progress bar has aria-valuenow, aria-valuemin, aria-valuemax
- [ ] Buttons have clear aria-labels
- [ ] Icons described with aria-label

### NotificationPermission
- [ ] Dialog has role="dialog" and aria-label
- [ ] Dialog title id linked with aria-labelledby
- [ ] Dialog content id linked with aria-describedby
- [ ] Benefit list items semantic (<li>)
- [ ] Buttons have descriptive text

### OfflineIndicator
- [ ] Alert has role="alert"
- [ ] Status text announces to screen readers
- [ ] Snackbar has role="status" (for live updates)
- [ ] Icon descriptions with aria-label

### LoadingStates
- [ ] Spinner has role="status" or aria-busy="true"
- [ ] Loading message announced
- [ ] Skeleton loaders have aria-hidden="true"

---

## Semantic HTML

### OnboardingFlow
- [ ] Use <button> for buttons (not <div>)
- [ ] Use <form> structure if applicable
- [ ] Headings properly nested
- [ ] Image icons have alt text

### NotificationPermission
- [ ] Dialog properly structured
- [ ] List uses <ul>/<li>
- [ ] Buttons semantic

### OfflineIndicator
- [ ] Alert uses semantic element
- [ ] Status properly announced

### LoadingStates
- [ ] Proper semantic tags
- [ ] Skeleton containers marked as decorative

---

## Motion & Animation

### OnboardingFlow
- [ ] Animations respect prefers-reduced-motion
- [ ] No flashing content (> 3 flashes per second)
- [ ] Motion is essential, not decorative

### NotificationPermission
- [ ] Dialog appears/disappears smoothly
- [ ] No jarring transitions

### OfflineIndicator
- [ ] Animations smooth and not distracting

### LoadingStates
- [ ] Spinner doesn't flash
- [ ] Animations respect accessibility preferences

---

## Focus Management

### OnboardingFlow
- [ ] Initial focus on first interactive element
- [ ] Focus visible throughout
- [ ] Focus outline clear and visible
- [ ] Tab order logical

### NotificationPermission
- [ ] Focus moved to dialog on open
- [ ] Focus restored on close
- [ ] Focus trap within dialog
- [ ] Focus visible outline

### OfflineIndicator
- [ ] Focus visible if interactive

### LoadingStates
- [ ] No focus trapping
- [ ] Focus management clear

---

## Text & Labels

### OnboardingFlow
- [ ] All labels descriptive and clear
- [ ] Button text explains action
- [ ] Instructions clear for goal selection
- [ ] No placeholder-only labels

### NotificationPermission
- [ ] Benefits clearly explained
- [ ] Button text explicit (not just "OK")
- [ ] Error messages descriptive
- [ ] Permission rationale clear

### OfflineIndicator
- [ ] Status message clear
- [ ] No ambiguous icons without text
- [ ] Error messages specific

### LoadingStates
- [ ] Loading text explains what's loading
- [ ] Percentage or status updates announced
- [ ] Completion message clear

---

## Touch & Mobile Accessibility

### All Components
- [ ] Touch targets minimum 44x44px
- [ ] Adequate spacing between buttons
- [ ] Mobile focus states visible
- [ ] Works with magnification (200%)
- [ ] Responsive layout maintained

---

## Error Prevention & Recovery

### OnboardingFlow
- [ ] Can go back to previous step
- [ ] Can skip onboarding
- [ ] No data loss on skip
- [ ] Clear skip confirmation

### NotificationPermission
- [ ] Can decline without breaking app
- [ ] Can request again later
- [ ] Error messages helpful

### LoadingStates
- [ ] Timeout handling
- [ ] Error state accessible
- [ ] Retry button clear

---

## Testing Tools & Resources

```bash
# Run these tools to validate:
1. axe DevTools (Chrome extension)
2. WAVE (WebAIM)
3. Lighthouse (Chrome DevTools)
4. NVDA Screen Reader (Windows)
5. Manual keyboard navigation
```

---

## Scoring System

```
✅ Pass: Meets WCAG 2.1 AA standard
⚠️  Warning: Minor issues to fix
❌ Fail: Doesn't meet standard
⏳ Not Tested: Still needs checking
```

---

## Sign-off

- **Auditor Name:** ________________
- **Audit Date:** ________________
- **WCAG Level:** ✅ AA / ⚠️ Partial / ❌ Not Met
- **Issues Found:** ____
- **Issues Fixed:** ____
- **Ready for Production:** ✅ / ⏳ / ❌

---

## Common Fixes

### Color Contrast
```css
/* Good contrast (4.5:1 minimum for AA) */
.text-high-contrast {
  color: #333; /* 21:1 contrast on white */
  background: white;
}
```

### Focus Visible
```css
/* Clear focus outline */
button:focus-visible {
  outline: 3px solid #4A90E2;
  outline-offset: 2px;
}
```

### ARIA Labels
```jsx
<button aria-label="Close notification">×</button>
<div role="status" aria-live="polite">Loading...</div>
```

### Keyboard Event
```jsx
<div onKeyDown={(e) => e.key === 'Escape' && close()}>
  Dialog content
</div>
```
