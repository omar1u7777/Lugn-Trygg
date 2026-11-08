/*
 * Runs in <head>, before first paint: skips the splash for automated browsers.
 * A file rather than inline script, so the Content-Security-Policy in
 * vercel.json can refuse all inline script.
 */
(function() {
  if (typeof navigator === 'undefined') {
    return;
  }
  var ua = navigator.userAgent || '';
  if (navigator.webdriver || /HeadlessChrome|Lighthouse/i.test(ua)) {
    document.documentElement.classList.add('no-initial-loader');
  }
})();
