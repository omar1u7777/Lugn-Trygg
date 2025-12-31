# Frontend Debugging Master Prompt - Complete A-Z Guide

## Systematisk Frontend Debugging Från A till Z

### 🎯 OBJEKTIV
Skapa en komplett debugging-strategi som täcker alla aspekter av frontend-utveckling från grundläggande kodanalys till avancerad produktionsdebugging.

---

## 📋 FÖRBEREDANDE ANALYS

### 1. Projekstruktur & Arkitektur Analys
```bash
# Kartlägg hela projektstrukturen
- [ ] Analysera package.json dependencies och devDependencies
- [ ] Granska vite.config.ts / webpack.config.js / other bundler configs
- [ ] Kontrollera TypeScript configuration (tsconfig.json)
- [ ] Undersök Tailwind CSS setup (tailwind.config.js)
- [ ] Kontrollera ESLint och Prettier konfiguration
- [ ] Granska Vite dev server konfiguration
- [ ] Analysera miljövariabler (.env files)
- [ ] Kontrollera import/export struktur i src/
```

### 2. Dependencies & Versions
```bash
# Säkerställ kompatibilitet och säkerhet
- [ ] Kör `npm audit` för säkerhetsproblem
- [ ] Kontrollera `npm outdated` för föråldrade paket
- [ ] Verifiera peer dependencies
- [ ] Kontrollera bundler compatibility
- [ ] Granska TypeScript version vs dependencies
```

---

## 🔍 STATISK KODANALYS

### 3. TypeScript Fel & Typer
```typescript
// Systematisk TS-fel analys
- [ ] Kör `tsc --noEmit` för alla typfel
- [ ] Kontrollera implicit any types
- [ ] Verifiera strict mode inställningar
- [ ] Analysera unused variables och imports
- [ ] Granska type assertions och casting
- [ ] Kontrollera generic type usage
```

### 4. ESLint & Kodstandard
```bash
# Kodkvalitet och best practices
- [ ] Kör `eslint src/ --ext .ts,.tsx`
- [ ] Kontrollera React hooks regler
- [ ] Verifiera accessibility regler (eslint-plugin-jsx-a11y)
- [ ] Granska import order och naming conventions
- [ ] Kontrollera unused dependencies
```

### 5. CSS/Styling Analys
```bash
- [ ] Granska Tailwind CSS för oanvända klasser
- [ ] Kontrollera CSS specificity conflicts
- [ ] Analysera responsive design implementation
- [ ] Verifiera CSS custom properties
- [ ] Kontrollera dark mode implementation
```

---

## 🚀 RUNTIME DEBUGGING

### 6. Development Server Issues
```typescript
// Vite dev server debugging
- [ ] Kontrollera port conflicts (5173 default)
- [ ] Verifiera proxy configuration
- [ ] Analysera hot module replacement (HMR)
- [ ] Kontrollera CORS inställningar
- [ ] Granska environment variable loading
- [ ] Verifiera file watching och auto-reload
```

### 7. Browser Console Debugging
```javascript
// Console debugging strategies
// Vanliga problem att söka efter:
- [ ] Uncaught TypeErrors
- [ ] Undefined/null reference errors
- [ ] Promise rejection warnings
- [ ] Network request failures
- [ ] CORS errors
- [ ] Content Security Policy violations
- [ ] Performance warnings
```

### 8. React Komponent Debugging
```typescript
// React-specifik debugging
// Component lifecycle
- [ ] Använd React DevTools för props/state
- [ ] Kontrollera useEffect dependencies
- [ ] Verifiera memoization (useMemo, useCallback)
- [ ] Granska custom hooks implementation
- [ ] Kontrollera context provider wrapping
- [ ] Analysera component re-renders
```

---

## 🧪 TESTING & QA

### 9. Unit & Integration Testing
```bash
# Test setup debugging
- [ ] Kontrollera test environment setup
- [ ] Verifiera jest/vitest configuration
- [ ] Granska test coverage (80%+ target)
- [ ] Kontrollera mock setup för external deps
- [ ] Analysera async testing patterns
- [ ] Verifiera component testing patterns
```

### 10. E2E Testing
```bash
# Playwright debugging
- [ ] Kontrollera browser launch configuration
- [ ] Verifiera test data setup
- [ ] Granska network interception
- [ ] Kontrollera visual regression setup
- [ ] Analysera CI/CD test integration
```

---

## ⚡ PERFORMANCE DEBUGGING

### 11. Bundle Analysis
```bash
# Bundle optimization
- [ ] Kör `npm run build` och analysera output
- [ ] Använd webpack-bundle-analyzer eller vite-bundle-analyzer
- [ ] Kontrollera tree shaking effectiveness
- [ ] Verifiera code splitting implementation
- [ ] Granska lazy loading setup
- [ ] Kontrollera vendor chunk size
```

### 12. Runtime Performance
```javascript
// Performance monitoring
- [ ] Använd Performance tab i DevTools
- [ ] Kontrollera render performance
- [ ] Verifiera memory leaks
- [ ] Analysera network requests
- [ ] Kontrollera Core Web Vitals
- [ ] Granska lighthouse scores
```

### 13. Memory Issues
```javascript
// Memory leak detection
- [ ] Använd Memory tab för heap snapshots
- [ ] Kontrollera event listeners cleanup
- [ ] Verifiera React component unmounting
- [ ] Granska global state management
- [ ] Kontrollera timer/interval cleanup
```

---

## 🌐 CROSS-BROWSER & ACCESSIBILITY

### 14. Cross-Browser Compatibility
```bash
# Browser compatibility testing
- [ ] Test i Chrome, Firefox, Safari, Edge
- [ ] Kontrollera polyfills för äldre browsers
- [ ] Verifiera ES features compatibility
- [ ] Granska CSS feature support
- [ ] Kontrollera API compatibility
```

### 15. Accessibility Debugging
```bash
# A11y implementation
- [ ] Kör axe-core accessibility tests
- [ ] Använd Lighthouse accessibility audit
- [ ] Kontrollera keyboard navigation
- [ ] Verifiera screen reader compatibility
- [ ] Granska color contrast ratios
- [ ] Kontrollera semantic HTML usage
```

---

## 🔧 BYGG & DEPLOYMENT

### 16. Build Process
```bash
# Build troubleshooting
- [ ] Kontrollera production build errors
- [ ] Verifiera environment variable injection
- [ ] Analysera source map generation
- [ ] Granska asset optimization
- [ ] Kontrollera build caching
- [ ] Verifiera output directory structure
```

### 17. Deployment Issues
```bash
# Production deployment debugging
- [ ] Kontrollera routing setup (SPA vs MPA)
- [ ] Verifiera asset loading i production
- [ ] Granska CDN configuration
- [ ] Kontrollera SSL/HTTPS setup
- [ ] Analysera caching strategies
- [ ] Verifiera error handling i production
```

---

## 📊 MONITORING & LOGGING

### 18. Error Tracking
```typescript
// Production error monitoring
- [ ] Sätt upp error boundary components
- [ ] Konfigurera Sentry eller liknande
- [ ] Implementeera custom error logging
- [ ] Granska error reporting workflows
- [ ] Kontrollera user session tracking
```

### 19. Performance Monitoring
```javascript
// APM och metrics
- [ ] Sätt upp Core Web Vitals tracking
- [ ] Implementeera custom performance metrics
- [ ] Konfigurera real user monitoring
- [ ] Granska dashboard setup
- [ ] Kontrollera alert configurations
```

---

## 🛠️ VERKTYG & STRATEGIER

### 20. Essential Debugging Tools
```bash
# Development tools
- [ ] React DevTools (Components, Profiler)
- [ ] Redux DevTools (om Redux används)
- [ ] Vue.js DevTools (om Vue komponenter)
- [ ] Lighthouse för performance audit
- [ ] axe DevTools för accessibility
- [ ] Postman/Insomnia för API testing
```

### 21. Network Debugging
```typescript
// API debugging strategies
- [ ] Använd Network tab för request/response
- [ ] Kontrollera request headers
- [ ] Verifiera response status codes
- [ ] Granska payload size och timing
- [ ] Kontrollera authentication headers
- [ ] Analysera error responses
```

### 22. State Management Debugging
```javascript
// State debugging
- [ ] Använd React Context DevTools
- [ ] Kontrollera state mutations
- [ ] Verifiera state persistence
- [ ] Granska async state updates
- [ ] Kontrollera state normalization
```

---

## 🚨 COMMON ISSUES & LÖSNINGAR

### 23. Vanliga React Problem
```typescript
// Bekanta problem
- [ ] "Cannot read property 'map' of undefined"
- [ ] "Too many re-renders" errors
- [ ] Props drilling issues
- [ ] Context provider value changes
- [ ] useEffect dependency array problems
- [ ] Component unmounting async issues
```

### 24. CSS & Styling Problem
```css
/* Vanliga CSS issue */
- [ ] Z-index stacking context problems
- [ ] Flexbox/Grid layout issues
- [ ] Responsive design breakpoints
- [ ] CSS specificity conflicts
- [ ] Animation performance issues
- [ ] Mobile touch event handling
```

### 25. Build & Bundle Problem
```bash
/* Build system issues */
- [ ] Out of memory errors under build
- [ ] Missing dependency resolution
- [ ] Circular import dependencies
- [ ] Code splitting failures
- [ ] Asset path resolution
- [ ] Source map generation errors
```

---

## 📝 DEBUGGING WORKFLOW

### 26. Systematisk Debugging Process
```bash
# Strukturerad problemlösning
1. Reproduce & Isolate
   - [ ] Skapa minimal reproducer
   - [ ] Identifiera när problemet uppstår
   - [ ] Isolera variabler

2. Gather Information
   - [ ] Console logs och errors
   - [ ] Network requests
   - [ ] Performance metrics
   - [ ] User steps leading to issue

3. Hypothesis & Test
   - [ ] Formulera teorier
   - [ ] Design tests för hypoteser
   - [ ] Implementera fixes
   - [ ] Verifiera lösningar

4. Document & Monitor
   - [ ] Dokumentera fixen
   - [ ] Lägg till regression tests
   - [ ] Update troubleshooting docs
   - [ ] Monitor production impact
```

### 27. Emergency Debugging Protocol
```bash
# När något är trasigt i production
- [ ] Omedelbart: Kontrollera error logs
- [ ] Analysera recent deployments
- [ ] Rollback om kritisk issue
- [ ] Kontrollera external dependencies
- [ ] Kommunikera med team
- [ ] Prioritera fix baserat på impact
```

---

## 🎯 ANVÄNDNING AV DENNA PROMPT

### För Daglig Debugging:
```bash
# Morning routine
1. Kör full test suite
2. Kontrollera build status
3. Review error logs från natten
4. Kontrollera performance metrics
5. Test på olika browsers
```

### För Feature Development:
```bash
# Feature debugging
1. Unit tests för nya components
2. Integration tests för data flow
3. Visual regression tests
4. Performance impact assessment
5. Accessibility compliance
```

### För Production Issues:
```bash
# Production debugging
1. Immediate triage och impact assessment
2. Error log analysis
3. Recent change review
4. Rollback decision
5. Fix implementation
6. Post-mortem analysis
```

---

## 🔄 ONGOING MAINTENANCE

### 28. Regelbunden Auditing
```bash
- [ ] Weekly dependency updates
- [ ] Monthly security audits
- [ ] Quarterly performance reviews
- [ ] Semi-annual architecture review
- [ ] Continuous integration health checks
```

### 29. Team Processes
```bash
- [ ] Code review checklists
- [ ] Debugging documentation standards
- [ ] Knowledge sharing sessions
- [ ] Tool training och updates
- [ ] Incident response procedures
```

---

## 📚 RESURSER & REFERENSER

### Essential Documentation:
- [ ] React Error Boundaries Guide
- [ ] TypeScript Debugging Handbook
- [ ] Web Vitals Optimization Guide
- [ ] Accessibility Testing Guidelines
- [ ] Browser DevTools Documentation

### Tools & Extensions:
- [ ] React Developer Tools
- [ ] Redux DevTools Extension
- [ ] Lighthouse CI
- [ ] axe DevTools
- [ ] React Testing Library
- [ ] Playwright Test Runner

---

**SLUTRESULTAT:** Denna prompt ger en komplett roadmap för frontend debugging som täcker allt från grundläggande kodanalys till avancerad produktionsmonitoring. Använd den systematiskt för att säkerställa högkvalitativ frontend-utveckling och snabb problemlösning.
