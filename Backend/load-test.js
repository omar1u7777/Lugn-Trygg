/**
 * k6 Load Test for Lugn & Trygg Backend
 * 
 * Installation: 
 *   Windows: choco install k6
 *   Mac: brew install k6
 *   Linux: sudo apt install k6
 * 
 * Run:
 *   k6 run load-test.js
 *   k6 run load-test.js --vus 100 --duration 1m  (100 concurrent users, 1 minute)
 *   k6 run load-test.js --vus 1000 --duration 5m (1000 concurrent users, 5 minutes)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const moodLogDuration = new Trend('mood_log_duration');

// Test configuration
export const options = {
    stages: [
        { duration: '30s', target: 50 },   // Ramp up to 50 users
        { duration: '1m', target: 100 },   // Stay at 100 users
        { duration: '2m', target: 500 },   // Ramp up to 500 users
        { duration: '2m', target: 1000 },  // Ramp up to 1000 users (target)
        { duration: '1m', target: 0 },     // Ramp down
    ],
    thresholds: {
        'http_req_duration': ['p(95)<2000'],  // 95% of requests under 2s
        'http_req_failed': ['rate<0.01'],      // Less than 1% failures
        'errors': ['rate<0.05'],               // Less than 5% errors
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001';

// Test data
const testUsers = [
    { email: 'loadtest1@test.com', password: 'TestPassword123!' },
    { email: 'loadtest2@test.com', password: 'TestPassword123!' },
    { email: 'loadtest3@test.com', password: 'TestPassword123!' },
];

export function setup() {
    // Health check before starting
    const res = http.get(`${BASE_URL}/api/health`);
    check(res, {
        'Health check passed': (r) => r.status === 200,
    });
    
    console.log(`Starting load test against ${BASE_URL}`);
    return { startTime: new Date().toISOString() };
}

export default function () {
    const user = testUsers[Math.floor(Math.random() * testUsers.length)];
    
    // 1. Health check (lightweight)
    const healthRes = http.get(`${BASE_URL}/api/health`);
    check(healthRes, { 'Health OK': (r) => r.status === 200 });
    
    // 2. Login attempt
    const loginStart = new Date();
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
        email: user.email,
        password: user.password,
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
    loginDuration.add(new Date() - loginStart);
    
    const loginSuccess = check(loginRes, {
        'Login status 200 or 401': (r) => r.status === 200 || r.status === 401,
    });
    
    if (!loginSuccess) {
        errorRate.add(1);
        console.error(`Login failed: ${loginRes.status} - ${loginRes.body}`);
        return;
    }
    
    // If login succeeded, test authenticated endpoints
    if (loginRes.status === 200) {
        const body = JSON.parse(loginRes.body);
        const token = body.access_token;
        
        const authHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        };
        
        // 3. Log mood
        const moodStart = new Date();
        const moodRes = http.post(`${BASE_URL}/api/mood/log`, JSON.stringify({
            value: Math.floor(Math.random() * 10) + 1,
            note: 'Load test mood entry',
        }), { headers: authHeaders });
        moodLogDuration.add(new Date() - moodStart);
        
        check(moodRes, {
            'Mood log succeeded': (r) => r.status === 200 || r.status === 201,
        });
        
        // 4. Get mood history
        const historyRes = http.get(`${BASE_URL}/api/mood/history`, { headers: authHeaders });
        check(historyRes, {
            'Mood history retrieved': (r) => r.status === 200,
        });
        
        // 5. Dashboard stats
        const dashRes = http.get(`${BASE_URL}/api/dashboard/stats`, { headers: authHeaders });
        check(dashRes, {
            'Dashboard stats retrieved': (r) => r.status === 200,
        });
    }
    
    sleep(1); // Wait 1 second between iterations
}

export function teardown(data) {
    console.log(`Load test completed. Started at: ${data.startTime}`);
}
