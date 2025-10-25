// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';
import 'cypress-axe';
import '@cypress/code-coverage/support';

// Accessibility testing setup
Cypress.on('uncaught:exception', (err, runnable) => {
  // returning false here prevents Cypress from failing the test
  return false;
});

// Global test setup
beforeEach(() => {
  // Clear all cookies and local storage
  cy.clearCookies();
  cy.clearLocalStorage();

  // Set consistent viewport
  cy.viewport(1280, 720);

  // Disable service worker for testing
  if (window.navigator && navigator.serviceWorker) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
      });
    });
  }
});

// Global error handling
Cypress.on('fail', (error, runnable) => {
  // Log additional context on test failure
  console.error('Test failed:', runnable.title);
  console.error('Error:', error.message);

  // Take screenshot on failure
  cy.screenshot(`failure-${runnable.title}`, { capture: 'fullPage' });

  throw error;
});