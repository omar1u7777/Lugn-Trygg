// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      register(email: string, password: string): Chainable<void>;
      logout(): Chainable<void>;
      checkA11y(): Chainable<void>;
      injectAxe(): Chainable<void>;
    }
  }
}

// Custom login command
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type(password);
    cy.get('button[type="submit"]').click();
    cy.url().should('not.include', '/login');
  });
});

// Custom register command
Cypress.Commands.add('register', (email: string, password: string) => {
  cy.visit('/register');
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(password);
  cy.get('input[name="confirmPassword"]').type(password);
  cy.get('input[type="checkbox"]').check(); // Accept terms
  cy.get('button[type="submit"]').click();
  cy.url().should('not.include', '/register');
});

// Custom logout command
Cypress.Commands.add('logout', () => {
  cy.get('[data-cy="user-menu"]').click();
  cy.contains('Logga ut').click();
  cy.url().should('include', '/login');
});

// Accessibility testing commands
Cypress.Commands.add('checkA11y', () => {
  cy.injectAxe();
  cy.checkA11y(null, {
    rules: {
      'color-contrast': { enabled: true },
      'heading-order': { enabled: true },
      'image-alt': { enabled: true },
      'link-name': { enabled: true },
      'button-name': { enabled: true },
      'form-field-multiple-labels': { enabled: false },
      'select-name': { enabled: true },
      'duplicate-id': { enabled: true },
    },
  });
});

Cypress.Commands.add('injectAxe', () => {
  cy.injectAxe();
});

// Preserve session across tests
Cypress.Commands.overwrite('visit', (originalFn, url, options) => {
  // Add any custom logic here if needed
  return originalFn(url, options);
});