
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Container } from '../ui/tailwind/Layout';

const AuthEntryLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center px-2 sm:px-4 py-6">
      <Container maxWidth="xl" centered>
        <main className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 items-center">
          {/* Info/Branding Section */}
          <section className="hidden lg:flex flex-col justify-between h-full rounded-3xl bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl border border-white/40 dark:border-slate-800 shadow-xl p-4 md:p-8 transition-all sticky top-8 max-h-[90vh] overflow-auto">
            <header>
              <p className="text-xs md:text-sm uppercase tracking-widest text-primary-500 mb-3 md:mb-4">Lugn &amp; Trygg</p>
              <h1 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-white leading-tight">
                Din mentala hälso-kompanjon i vardagen
              </h1>
              <p className="mt-3 md:mt-4 text-base md:text-lg text-slate-600 dark:text-slate-300">
                Följ ditt humör, få personligt AI-stöd och bygg hållbara vanor i din egen takt, tillsammans med tusentals andra som använder Lugn & Trygg.
              </p>
            </header>
            <ul className="space-y-3 md:space-y-4 text-slate-700 dark:text-slate-200 mt-6 md:mt-10">
              <li className="flex items-center gap-2 md:gap-3">
                <span className="text-xl md:text-2xl" aria-hidden="true">🛡️</span>
                <p className="text-sm md:text-base">Din data är skyddad och delas aldrig utan ditt samtycke.</p>
              </li>
              <li className="flex items-center gap-2 md:gap-3">
                <span className="text-xl md:text-2xl" aria-hidden="true">📈</span>
                <p className="text-sm md:text-base">Få dagliga insikter, små belöningar och stöd som hjälper dig att hålla rutiner över tid.</p>
              </li>
              <li className="flex items-center gap-2 md:gap-3">
                <span className="text-xl md:text-2xl" aria-hidden="true">🤖</span>
                <p className="text-sm md:text-base">AI-stöd för mental hälsa som erbjuder reflektion och praktiska strategier anpassade efter dig.</p>
              </li>
            </ul>
          </section>
          {/* Login Form Section */}
          <section className="w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-4 sm:p-6 md:p-8 transition-all">
            <Outlet />
          </section>
        </main>
      </Container>
    </div>
  );
};

export default AuthEntryLayout;
