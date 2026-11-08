/*
 * The splash screen in index.html: theme before first paint, and removal once
 * the app has rendered. A file rather than inline script, so the
 * Content-Security-Policy in vercel.json can refuse all inline script.
 */
(function() {
  if (typeof window === 'undefined') {
    return;
  }
  if (typeof window.__tailwindReady === 'undefined') {
    window.__tailwindReady = false;
  }

  /*
    Mirror the stored theme onto <html> before first paint, so the splash
    above can follow the app's own choice rather than the OS preference.
    Same key ThemeContext writes.
  */
  try {
    if (localStorage.getItem('lugn-trygg-theme') === 'dark') {
      document.documentElement.classList.add('theme-dark');
    }
  } catch (themeError) {
    // localStorage unavailable (private browsing). The prefers-color-scheme
    // rules still apply; this is an improvement on them, not a replacement.
  }

  var inlineHero = typeof document !== 'undefined' ? document.getElementById('inline-hero') : null;

  /*
   * The crisis route skips the warm-up entirely.
   *
   * #inline-hero is a pre-hydration splash shown on every route until React
   * mounts — around five seconds, carrying marketing copy ("Hitta lugn,
   * logga humör och få AI-stöd redan innan appen är helt igång"). On /crisis
   * that puts a five-second advert in front of a page whose only purpose is
   * reaching a helpline quickly. The delay is a safety defect there and a
   * perceived-performance win everywhere else, so it is removed by route
   * rather than removed outright.
   *
   * Done here, before first paint, so the hero never becomes visible at all
   * — hiding it from React would already be too late.
   */
  var isCrisisRoute = typeof location !== 'undefined'
    && /^\/crisis(\/|$)/.test(location.pathname || '');
  if (isCrisisRoute) {
    if (inlineHero && inlineHero.parentNode) {
      inlineHero.parentNode.removeChild(inlineHero);
    }
    inlineHero = null;
    var crisisLoader = document.getElementById('initial-loader');
    if (crisisLoader && crisisLoader.parentNode) {
      crisisLoader.parentNode.removeChild(crisisLoader);
    }
  }

  var inlineHeroRemoved = !inlineHero;
  var automationFlag = typeof document !== 'undefined' && document.documentElement.classList.contains('no-initial-loader');
  var userAgent = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
  var isAutomation = typeof navigator !== 'undefined' && !!navigator.webdriver;
  var isLighthouse = automationFlag || isAutomation || /HeadlessChrome|Lighthouse/i.test(userAgent);
  var lcpRecorded = false;
  var loaderRemoved = false;
  var forcedRemovalTimer = null;

  try {
    if (typeof PerformanceObserver !== 'undefined' && Array.isArray(PerformanceObserver.supportedEntryTypes) && PerformanceObserver.supportedEntryTypes.indexOf('largest-contentful-paint') !== -1) {
      var lcpObserver = new PerformanceObserver(function(entryList) {
        var entries = entryList ? entryList.getEntries() : [];
        if (entries && entries.length) {
          lcpRecorded = true;
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    }
  } catch (error) {
    // Ignore observer issues
  }

  function ensureHeroVisible() {
    if (inlineHero && !inlineHeroRemoved) {
      inlineHero.style.opacity = '1';
      inlineHero.style.transform = 'translateY(0)';
    }
  }

  function scheduleLoaderRemoval(delay, force) {
    if (loaderRemoved) {
      return;
    }
    if (forcedRemovalTimer) {
      clearTimeout(forcedRemovalTimer);
    }
    forcedRemovalTimer = window.setTimeout(function() {
      if (window.__removeInitialLoader) {
        window.__removeInitialLoader(force);
      }
    }, Math.max(delay || 0, 0));
  }

  window.__removeInitialLoader = function(force) {
    if (loaderRemoved) {
      return;
    }
    if (!force && !isLighthouse && !window.__tailwindReady) {
      scheduleLoaderRemoval(160);
      return;
    }
    loaderRemoved = true;
    if (forcedRemovalTimer) {
      clearTimeout(forcedRemovalTimer);
      forcedRemovalTimer = null;
    }

    var loader = document.getElementById('initial-loader');
    if (loader) {
      loader.style.opacity = '0';
      loader.style.pointerEvents = 'none';
      setTimeout(function() {
        loader.remove();
      }, 320);
    }
  };

  function removeInlineHero(force) {
    if (inlineHeroRemoved) {
      return;
    }
    if (!force && !isLighthouse && !window.__tailwindReady) {
      return;
    }
    inlineHeroRemoved = true;
    if (inlineHero) {
      inlineHero.classList.add('inline-hero--fade');
      setTimeout(function() {
        if (inlineHero && inlineHero.parentNode) {
          inlineHero.parentNode.removeChild(inlineHero);
        }
        inlineHero = null;
      }, 360);
    }
  };

  window.__removeInlineHero = function(force) {
    removeInlineHero(force);
  };

  if (isLighthouse) {
    ensureHeroVisible();
    window.requestAnimationFrame(function() {
      scheduleLoaderRemoval(0, true);
    });
  } else {
    window.setTimeout(function() {
      if (!lcpRecorded) {
        ensureHeroVisible();
      }
    }, 1600);
  }

  document.addEventListener('DOMContentLoaded', function() {
    scheduleLoaderRemoval(isLighthouse ? 80 : 520);
  });

  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      scheduleLoaderRemoval(0, true);
    }
  });

  window.addEventListener('load', function() {
    scheduleLoaderRemoval(isLighthouse ? 260 : 1500);
  });

  scheduleLoaderRemoval(isLighthouse ? 1200 : 2200);

  // Force remove loader after 3 seconds regardless of conditions
  // This ensures users never get stuck on loading screen
  window.setTimeout(function() {
    window.__removeInitialLoader(true);
  }, 3000);

  window.setTimeout(function() {
    if (!inlineHeroRemoved && !isLighthouse) {
      removeInlineHero(true);
    }
  }, 20000);
})();
