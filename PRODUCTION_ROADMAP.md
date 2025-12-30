# Lugn & Trygg - 6-dagarsplan för produktionsstatus
> **⚠️ KRITISKT FEL UPPTÄCKT (2025-12-04)**
> 
> Filen `Backend/src/services/tamper_detection_service.py` är korrupt (rad 149).
> **Åtgärd krävs:** Fixa syntaxfel innan backend kan startas.

---

## Dag 1: Backend Foundation ✅ (Pågående)
- [x] Ta bort Firebase stub helt
- [x] Implementera production Firebase credentials
- [x] Uppgradera Dockerfile med multi-stage build
- [x] Säkra .dockerignore (inga credentials i image)
- [x] Skapa CI/CD pipeline (GitHub Actions)
- [x] Förbättra security headers middleware
- [ ] Installera alla dependencies i venv
- [ ] Köra pytest och fixa alla test-failures
- [ ] Verifiera Firebase-anslutning fungerar
- [ ] Test rate limiting med Redis

## Dag 2: Backend Säkerhet & Kvalitet
- [ ] Komplett säkerhetsaudit (OWASP ASVS)
  - [ ] Input validation överallt
  - [ ] SQL injection protection (verify all queries)
  - [ ] XSS prevention i alla responses
  - [ ] CSRF tokens för state-changing operations
- [ ] Secrets management
  - [ ] Migrera alla secrets till miljövariabler
  - [ ] Dokumentera secrets som krävs
  - [ ] Setup för Azure Key Vault / AWS Secrets Manager
- [ ] Error handling & logging
  - [ ] Structured logging (JSON format)
  - [ ] Central log aggregation setup
  - [ ] Error tracking (Sentry integration)
  - [ ] Alert rules för kritiska fel
- [ ] Code quality
  - [ ] Kör flake8, black, pylint
  - [ ] Fix alla lint warnings
  - [ ] Type hints överallt
  - [ ] Docstrings för alla publika funktioner

## Dag 3: Frontend Optimering & Säkerhet *(Status: Pågående, 40% klart)*

### Performance audit
- [x] Bundle size analys och action plan (`scripts/optimize-performance.js`)
- [x] Lazy loading + code splitting baseline (React Router direct imports sedan 2025-11, inga MUI dynamic imports)
- [ ] Lighthouse score >90 på alla sidor *(måste köras efter nästa build)*
- [ ] Image optimization backlog *(behöver WebP + responsive sources)*
  - [x] Migrera dashboardens hero/emoji till `OptimizedImage` med Cloudinary/WebP + `width/height` för CLS-säkerhet
  - [ ] Ersätt `img` i Wellness-, Journal- och Onboarding-flöden med `OptimizedImage` + `srcset`
  - [ ] Introducera `sizes`-attribut och `loading="lazy"` för alla kortbilder samt definiera `aspect-[ratio]`
  - [ ] Automatisk bildkomprimering via CI (sharp + imagemin) innan deploy
  - [ ] Dokumentera krav i `docs/performance/images.md` och lägg till checklist i PR-template

### Säkerhet
- [x] CSP headers + säkerhetsmiddleware (`Backend/src/middleware/security_headers.py`) – aktiv i prod
- [x] XSS prevention via sanering (`src/api/api.ts`, `Backend/src/routes/mood_routes.py`)
- [x] Säker auth-flow m. token refresh via `AuthContext` + `src/api/api.ts`
- [x] Säker local storage/token-hantering verifierad i `test-secure-storage.html`
- [ ] Complete threat-model review av varje frontend-komponent

### Accessibility (WCAG 2.1 AA)
- [x] Automatisk audit körd (`scripts/accessibility-audit.js`) – checklistan dokumenterad
- [ ] Keyboard navigation / focus-styling fixes implementerade
- [ ] Color contrast >4.5:1 på alla primära färger
- [ ] Screen reader labels & aria-kartor för dashboard widgets

### Internationalization
- [x] Befintliga texter passerar i18n-builden (`locales/` + `npm run type-check`)
- [ ] RTL support-bedömning *(rendera `/dashboard` och `/login` med `dir=rtl`, lista visuella buggar i `i18n/rtl.md`)*
- [ ] Datum/tid-format verifieras för alla språk *(skriv Jest- eller Vitest-tester som säkerställer `formatDateByLocale` använder `i18n.language`)*
- [ ] Numeriska formatterare för analyticskort *(återanvänd `intlFormatters.ts` i `DashboardStats` och `Recommendations`, täck med enhetstester)*

## Dag 4: Infrastructure & Deployment ✅
- [x] Containerisering
  - [x] Docker Compose för full stack (`docker-compose.yml`, `docker-compose.prod.yml`)
  - [x] Kubernetes manifests (deployments, services, ingress) i `k8s/`
  - [x] Helm charts för enkel deployment (`helm/lugn-trygg`)
- [x] Cloud infrastructure (Azure/AWS/GCP)
  - [x] Managed Kubernetes cluster plan (`infra/CLOUD_INFRA_PLAN_DAY4.md`)
  - [x] Redis cluster strategi för rate limiting (samma dokument + `k8s/redis-statefulset.yaml`)
  - [x] Load balancer + edge-säkerhet beskrivet i infra-planen
  - [x] Auto-scaling policies (`k8s/hpa.yaml` + infra-plan avsnitt 4)
  - [x] CDN riktlinjer och konfiguration (`infra/CLOUD_INFRA_PLAN_DAY4.md` §5)
- [x] Monitoring & Alerting
  - [x] Prometheus + Grafana setup (`infra/monitoring/` + docs)
  - [x] Application metrics inklusive backend `/health` och `/metrics` endpoints
  - [x] Custom dashboards provisionerade i `infra/monitoring/grafana/`
  - [x] Alert rules (CPU, memory, errors, latency) i `infra/monitoring/alert.rules.yml`
  - [x] PagerDuty / Slack integration via `infra/monitoring/alertmanager.yml`
- [x] Backup & Disaster Recovery
  - [x] Automated Firestore backups (`Backend/src/services/backup_service.py` + `k8s/backup-cronjob.yaml`)
  - [x] Storage bucket backups täcks av backup-tjänstens full exports
  - [x] Backup testing (restore runbook i `infra/BACKUP_DR_PLAN.md`)
  - [x] Disaster recovery plan dokumentation (`infra/BACKUP_DR_PLAN.md`)

## Dag 5: Data & Compliance
- [ ] GDPR Compliance
  - [ ] Privacy policy uppdatering
  - [ ] Cookie consent implementation
  - [ ] Data retention policies
  - [ ] Right to be forgotten implementation
  - [ ] Data export funktionalitet
  - [ ] Privacy by design audit
- [ ] Database optimering
  - [ ] Firestore indexes för alla queries
  - [ ] Query performance analys
  - [ ] Data migration scripts
  - [ ] Database sharding strategy (om relevant)
- [ ] Security audit
  - [ ] Penetration testing
  - [ ] Dependency vulnerability scan
  - [ ] Container image scanning
  - [ ] Secrets rotation policy
  - [ ] API key rotation implementation
- [ ] Documentation
  - [ ] API documentation (OpenAPI/Swagger)
  - [ ] Architecture diagrams
  - [ ] Runbooks för common issues
  - [ ] Incident response procedures

## Dag 6: Testing & Go-Live Prep
- [ ] Comprehensive testing
  - [ ] Unit tests (>80% coverage)
  - [ ] Integration tests
  - [ ] E2E tests (Playwright/Cypress)
  - [ ] Load testing (k6/Locust)
  - [ ] Security testing (OWASP ZAP)
  - [ ] Mobile app testing (iOS/Android)
- [ ] Performance testing
  - [ ] Load test med 1000+ concurrent users
  - [ ] Stress testing
  - [ ] Latency benchmarks
  - [ ] Database query optimization
- [ ] Mobile apps (React Native/Expo)
  - [ ] Build iOS app
  - [ ] Build Android APK/AAB
  - [ ] TestFlight deployment
  - [ ] Play Store internal testing
  - [ ] Push notifications setup
  - [ ] Crash reporting (Crashlytics)
- [ ] Final checklist
  - [ ] All CI/CD pipelines green
  - [ ] Production environment setup
  - [ ] DNS configuration
  - [ ] SSL certificates
  - [ ] Rate limiting verified
  - [ ] Backup system verified
  - [ ] Monitoring dashboards live
  - [ ] Alerts tested
  - [ ] Rollback procedure tested
  - [ ] Support team trained
  - [ ] Launch announcement prepared

## Kontinuerliga uppgifter (alla dagar)
- [ ] Daily standup/progress review
- [ ] Security patching av dependencies
- [ ] Performance monitoring
- [ ] Bug fixing från test results
- [ ] Documentation updates
- [ ] Code reviews
- [ ] Team communication

## Post-Launch (Dag 7+)
- [ ] 24/7 monitoring setup
- [ ] On-call rotation
- [ ] User feedback collection
- [ ] Performance optimization baserat på real-world data
- [ ] Gradual feature rollout
- [ ] A/B testing framework
- [ ] Analytics dashboards
- [ ] Customer support workflows

---

**Nuvarande status**: Dag 1 pågående
**Nästa milestone**: Komplett backend med alla tester gröna
**Blockers**: Inga för tillfället
**Risks**: Omfattande scope - prioritera kärnfunktionalitet först

---

## LAN / Dev Miljö Checklista (2025-12-04)
1. **Firebase Authorized Domains** – Lägg till varje LAN-IP (t.ex. `192.168.10.154`) under *Firebase Console → Authentication → Settings → Authorized domains* för att aktivera Google-inloggning via popup/redirect.
2. **HTTPS i Vite-dev** – Kör dev-servern med TLS när du testar på IP:
  ```bash
  mkcert -install
  mkcert -key certs/dev-key.pem -cert certs/dev-cert.pem localhost 127.0.0.1 192.168.10.154
  set VITE_DEV_HTTPS=true
  set VITE_DEV_HTTPS_CERT=certs/dev-cert.pem
  set VITE_DEV_HTTPS_KEY=certs/dev-key.pem
  npm run dev
  ```
  Detta aktiverar Web Crypto API och eliminierar varningen i `secureStorage.ts`.
3. **Vercel Analytics dev-läge** – Loggar visas bara i utvecklingsläge. Ingen trafik skickas förrän build körs i production-mode.
