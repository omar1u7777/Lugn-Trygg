describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.injectAxe();
  });

  it('should load login page', () => {
    cy.contains('Logga in').should('be.visible');
    cy.checkA11y();
  });

  it('should show validation errors for empty form', () => {
    cy.get('button[type="submit"]').click();
    cy.contains('E-postadress krävs').should('be.visible');
    cy.contains('Lösenord krävs').should('be.visible');
  });

  it('should show validation error for invalid email', () => {
    cy.get('input[type="email"]').type('invalid-email');
    cy.get('input[type="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    cy.contains('Ogiltig e-postadress').should('be.visible');
  });

  it('should navigate to register page', () => {
    cy.contains('Skapa konto').click();
    cy.url().should('include', '/register');
    cy.contains('Registrera').should('be.visible');
  });

  it('should complete registration flow', () => {
    cy.visit('/register');
    cy.get('input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').type('TestPassword123!');
    cy.get('input[name="confirmPassword"]').type('TestPassword123!');
    cy.get('input[type="checkbox"]').check(); // Accept terms
    cy.get('button[type="submit"]').click();

    // Should redirect to dashboard or show success message
    cy.url().should('not.include', '/register');
  });

  it('should handle login with valid credentials', () => {
    // Mock successful login
    cy.intercept('POST', '**/auth/login', { fixture: 'login-success.json' }).as('loginRequest');

    cy.get('input[type="email"]').type('user@example.com');
    cy.get('input[type="password"]').type('password123');
    cy.get('button[type="submit"]').click();

    cy.wait('@loginRequest');
    cy.url().should('include', '/dashboard');
  });

  it('should handle login with invalid credentials', () => {
    cy.intercept('POST', '**/auth/login', {
      statusCode: 401,
      body: { error: 'Invalid credentials' }
    }).as('loginError');

    cy.get('input[type="email"]').type('wrong@example.com');
    cy.get('input[type="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();

    cy.wait('@loginError');
    cy.contains('Felaktiga inloggningsuppgifter').should('be.visible');
  });

  it('should handle forgot password flow', () => {
    cy.contains('Glömt lösenord?').click();
    cy.get('input[type="email"]').type('user@example.com');
    cy.get('button[type="submit"]').click();
    cy.contains('Återställningslänk skickad').should('be.visible');
  });

  it('should maintain accessibility throughout auth flow', () => {
    // Test keyboard navigation
    cy.get('input[type="email"]').focus();
    cy.realPress('Tab');
    cy.get('input[type="password"]').should('be.focused');

    // Test ARIA labels
    cy.get('input[type="email"]').should('have.attr', 'aria-label');
    cy.get('input[type="password"]').should('have.attr', 'aria-label');

    // Test color contrast
    cy.checkA11y();
  });
});