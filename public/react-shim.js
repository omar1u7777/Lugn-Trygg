// React Global Shim
// This ensures React is available to ALL chunks, preventing "Cannot read properties of undefined" errors
// Loaded BEFORE any modules to guarantee availability

(function() {
  'use strict';
  
  // Check if React is already loaded from CDN
  if (typeof window.React !== 'undefined' && typeof window.ReactDOM !== 'undefined') {
    console.log('✓ React ' + window.React.version + ' loaded from CDN');
    
    // Make React available as ES module exports for compatibility with bundled code
    if (typeof window.require === 'undefined') {
      window.require = function(moduleName) {
        if (moduleName === 'react') return window.React;
        if (moduleName === 'react-dom') return window.ReactDOM;
        if (moduleName === 'react/jsx-runtime') {
          return {
            jsx: window.React.createElement,
            jsxs: window.React.createElement,
            Fragment: window.React.Fragment
          };
        }
        throw new Error('Module not found: ' + moduleName);
      };
    }
    
    // Patch any module loaders to use global React
    const originalDefine = window.define;
    if (typeof originalDefine === 'function' && originalDefine.amd) {
      window.define = function(name, deps, factory) {
        if (Array.isArray(deps)) {
          deps = deps.map(function(dep) {
            if (dep === 'react') return window.React;
            if (dep === 'react-dom') return window.ReactDOM;
            return dep;
          });
        }
        return originalDefine.call(this, name, deps, factory);
      };
      window.define.amd = originalDefine.amd;
    }
    
  } else {
    console.error('⚠️ React NOT loaded! App will fail.');
    document.getElementById('root').innerHTML = 
      '<div style="padding:2rem;background:#fee;color:#c00;text-align:center;">' +
      '<h1>⚠️ Tekniskt fel</h1>' +
      '<p>React kunde inte laddas från CDN. Ladda om sidan.</p>' +
      '<p style="font-size:0.9em;color:#666;">Kontakta support om problemet kvarstår.</p>' +
      '</div>';
  }
})();
