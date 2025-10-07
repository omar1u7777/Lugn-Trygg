describe('Authentication Flow', () => {
  beforeEach(() => {
    // Clear localStorage and cookies before each test
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  it('should load the login page', () => {
    cy.visit('/login')
    cy.contains('Logga in').should('be.visible')
    cy.get('input[type="email"]').should('be.visible')
    cy.get('input[type="password"]').should('be.visible')
  })

  it('should show validation errors for empty form', () => {
    cy.visit('/login')
    cy.get('button[type="submit"]').click()
    // Should show validation errors or prevent submission
    cy.url().should('include', '/login')
  })

  it('should navigate to register page', () => {
    cy.visit('/login')
    cy.contains('Registrera').click()
    cy.url().should('include', '/register')
    cy.contains('Skapa konto').should('be.visible')
  })

  it('should allow language switching', () => {
    cy.visit('/login')

    // Check default Swedish text
    cy.contains('Logga in').should('be.visible')

    // Switch to English
    cy.get('select').select('en')

    // Check English text appears
    cy.contains('Login').should('be.visible')
  })

  it('should handle login with invalid credentials', () => {
    cy.visit('/login')

    cy.get('input[type="email"]').type('invalid@example.com')
    cy.get('input[type="password"]').type('wrongpassword')
    cy.get('button[type="submit"]').click()

    // Should show error message and stay on login page
    cy.contains('Felaktiga inloggningsuppgifter').should('be.visible')
    cy.url().should('include', '/login')
  })

  it('should redirect authenticated users from login page', () => {
    // Mock authenticated state
    cy.window().then((win) => {
      win.localStorage.setItem('token', 'mock-token')
      win.localStorage.setItem('user', JSON.stringify({ user_id: 'test', email: 'test@example.com' }))
    })

    cy.visit('/login')
    cy.url().should('include', '/dashboard')
  })

  it('should handle logout correctly', () => {
    // First login (mock)
    cy.window().then((win) => {
      win.localStorage.setItem('token', 'mock-token')
      win.localStorage.setItem('user', JSON.stringify({ user_id: 'test', email: 'test@example.com' }))
    })

    cy.visit('/dashboard')
    cy.contains('Logga ut').click()

    // Should redirect to login and clear storage
    cy.url().should('include', '/login')
    cy.window().then((win) => {
      expect(win.localStorage.getItem('token')).to.be.null
      expect(win.localStorage.getItem('user')).to.be.null
    })
  })
})