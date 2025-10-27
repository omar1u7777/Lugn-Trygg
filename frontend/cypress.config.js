import { defineConfig } from 'cypress';
// import axe from 'cypress-axe';
export default defineConfig({
    e2e: {
        baseUrl: 'http://localhost:3000',
        viewportWidth: 1280,
        viewportHeight: 720,
        video: true,
        screenshotOnRunFailure: true,
        defaultCommandTimeout: 10000,
        requestTimeout: 15000,
        responseTimeout: 15000,
        setupNodeEvents(on, config) {
            // Accessibility testing setup
            on('task', {
                log(message) {
                    console.log(message);
                    return null;
                },
                table(message) {
                    console.table(message);
                    return null;
                }
            });
            // Code coverage
            require('@cypress/code-coverage/task')(on, config);
            return config;
        },
        specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
        supportFile: 'cypress/support/e2e.ts',
    },
    component: {
        devServer: {
            framework: 'react',
            bundler: 'vite',
        },
        specPattern: 'src/**/__tests__/*.cy.{js,jsx,ts,tsx}',
        supportFile: 'cypress/support/component.ts',
    },
    env: {
        API_URL: 'http://localhost:5001',
        coverage: true,
    },
    retries: {
        runMode: 2,
        openMode: 0,
    },
});
