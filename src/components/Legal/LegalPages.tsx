import React from 'react';
import { Link } from 'react-router-dom';
import { SUPPORT_EMAIL } from '../../config/contact';

/**
 * The terms and the privacy policy, readable without an account.
 *
 * Swedish only, like the app's own copy for these documents: a translated
 * legal text is a second document that has to be kept true.
 */

const LAST_UPDATED = '15 november 2026';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2">
    <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
    <div className="space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed">{children}</div>
  </section>
);

const SupportLink: React.FC = () => (
  <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary-600 dark:text-primary-400 underline">
    {SUPPORT_EMAIL}
  </a>
);

const LegalLayout: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="min-h-screen bg-white dark:bg-slate-900">
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">Lugn &amp; Trygg</p>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Senast uppdaterad {LAST_UPDATED}</p>
      </header>
      {children}
      <nav aria-label="Fler dokument" className="flex flex-wrap gap-4 border-t border-slate-200 dark:border-slate-700 pt-6 text-sm">
        <Link to="/terms" className="text-primary-600 dark:text-primary-400 underline">Användarvillkor</Link>
        <Link to="/privacy" className="text-primary-600 dark:text-primary-400 underline">Integritetspolicy</Link>
        <Link to="/register" className="text-primary-600 dark:text-primary-400 underline">Skapa konto</Link>
        <Link to="/login" className="text-primary-600 dark:text-primary-400 underline">Logga in</Link>
      </nav>
    </main>
  </div>
);

export const PrivacyPolicyPage: React.FC = () => (
  <LegalLayout title="Integritetspolicy">
    <Section title="Vem som ansvarar">
      <p>
        Lugn &amp; Trygg ansvarar för de personuppgifter som behandlas i appen. Frågor om dina uppgifter
        skickar du till <SupportLink />.
      </p>
    </Section>

    <Section title="Vad vi sparar">
      <ul className="list-disc pl-6 space-y-1">
        <li>Kontouppgifter: e-postadress, namn och inställningar.</li>
        <li>Det du loggar om ditt humör: poäng, anteckningar och taggar.</li>
        <li>En röstinspelning och dess utskrift, om du väljer att logga med rösten.</li>
        <li>Det du skriver i din dagbok.</li>
        <li>Dina samtal med AI-stödet.</li>
        <li>Dina svar och resultat i skattningarna PHQ-9 och GAD-7.</li>
        <li>Dina mål, din aktivitet i appen och dina belöningar.</li>
        <li>Hälsodata från en tjänst som du själv ansluter.</li>
        <li>Uppgifter om din prenumeration. Kortuppgifter hanteras av betaltjänsten och sparas inte hos oss.</li>
      </ul>
      <p>
        Flera av uppgifterna handlar om din hälsa. Vi behandlar dem för att du har samtyckt till det när du
        skapade ditt konto, och du kan när som helst ta tillbaka samtycket genom att radera kontot.
      </p>
    </Section>

    <Section title="Vad vi använder uppgifterna till">
      <p>
        För att visa din historik, din statistik och dina prognoser, för att AI-stödet ska kunna svara utifrån
        det du har berättat, för att upptäcka tecken på kris och visa vägar till hjälp, och för att hitta och
        rätta fel i appen. Vi säljer inte dina uppgifter och använder dem inte för reklam.
      </p>
    </Section>

    <Section title="Vilka som behandlar uppgifterna åt oss">
      <ul className="list-disc pl-6 space-y-1">
        <li>Google (Firebase): inloggning, databas och lagring av filer.</li>
        <li>Microsoft (Azure OpenAI): AI-stödets svar och analys av text du skriver.</li>
        <li>Render och Vercel: drift av appens server och webbplats.</li>
        <li>Sentry: felrapporter från appen.</li>
        <li>Stripe: betalningar.</li>
      </ul>
      <p>Några av dessa kan behandla uppgifter utanför EU/EES.</p>
    </Section>

    <Section title="Hur länge vi sparar">
      <p>
        Vi sparar dina uppgifter så länge du har ett konto. När du raderar kontot stängs det direkt, och efter
        30 dagar tas uppgifterna bort permanent, även röstinspelningar. Under de 30 dagarna kan supporten
        öppna kontot igen om du ångrar dig.
      </p>
    </Section>

    <Section title="Dina rättigheter">
      <p>
        Du har rätt att få veta vilka uppgifter vi har om dig, få ut dem, få dem rättade eller raderade och
        att invända mot behandlingen. Export och radering gör du själv under Profil, fliken Integritet, när du
        är inloggad. För övrigt skriver du till <SupportLink />.
      </p>
      <p>
        Är du missnöjd med hur vi hanterar dina uppgifter kan du klaga hos Integritetsskyddsmyndigheten (IMY).
      </p>
    </Section>
  </LegalLayout>
);

export const TermsPage: React.FC = () => (
  <LegalLayout title="Användarvillkor">
    <Section title="Vad Lugn & Trygg är">
      <p>
        Lugn &amp; Trygg är ett verktyg för att följa ditt mående: humörlogg, dagbok, övningar, självskattningar
        och ett AI-stöd att samtala med.
      </p>
    </Section>

    <Section title="Inte sjukvård">
      <p>
        Appen är inte vård och ersätter inte läkare, psykolog eller annan vårdpersonal. Skattningar, prognoser
        och AI-stödets svar är inga diagnoser och ingen behandling. AI-stödet kan ha fel.
      </p>
      <p>
        Vid akut fara, ring 112. För råd om vård, ring 1177. Om du har tankar på att ta ditt liv kan du nå
        Mind Självmordslinjen på 90101.
      </p>
    </Section>

    <Section title="Ditt konto">
      <p>
        Du ansvarar för att uppgifterna du anger stämmer och för att hålla ditt lösenord för dig själv. Kontot
        är personligt.
      </p>
    </Section>

    <Section title="Hur appen får användas">
      <p>
        Du får inte använda appen för att skada andra, sprida olagligt innehåll, försöka komma åt andras
        uppgifter eller störa tjänsten. I delar där du möter andra användare ska du visa respekt. Vi kan stänga
        ett konto som bryter mot detta.
      </p>
    </Section>

    <Section title="Prenumeration">
      <p>
        Appen kan användas utan kostnad med begränsningar. Det som ingår i en betald prenumeration, priset och
        hur du säger upp den visas innan du betalar. Betalningen hanteras av Stripe.
      </p>
    </Section>

    <Section title="Avsluta">
      <p>
        Du kan när som helst radera ditt konto under Profil, fliken Integritet. Vad som händer med dina
        uppgifter står i <Link to="/privacy" className="text-primary-600 dark:text-primary-400 underline">integritetspolicyn</Link>.
      </p>
    </Section>

    <Section title="Ändringar och kontakt">
      <p>
        Om villkoren ändras på ett sätt som påverkar dig meddelar vi det i appen. Frågor skickar du till{' '}
        <SupportLink />.
      </p>
    </Section>
  </LegalLayout>
);
