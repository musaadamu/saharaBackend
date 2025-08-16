const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';
const TEST_RESULTS = [];

// Test utilities
const logTest = (testName, passed, details = '') => {
    const result = {
        test: testName,
        passed,
        details,
        timestamp: new Date().toISOString()
    };
    TEST_RESULTS.push(result);
    console.log(`${passed ? '✅' : '❌'} ${testName}: ${details}`);
};

const makeRequest = async (method, endpoint, data = null, headers = {}) => {
    try {
        const config = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            timeout: 10000
        };
        
        if (data) {
            config.data = data;
        }
        
        return await axios(config);
    } catch (error) {
        return error.response || { status: 0, data: { message: error.message } };
    }
};

// Security Tests
const testSQLInjection = async () => {
    console.log('\n🔍 Testing SQL/NoSQL Injection Protection...');
    
    const injectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "{ $ne: null }",
        "{ $where: 'this.password.length > 0' }",
        "{ $regex: '.*' }",
        "../../../etc/passwd",
        "<script>alert('xss')</script>",
        "javascript:alert('xss')"
    ];
    
    for (const payload of injectionPayloads) {
        const response = await makeRequest('GET', `/api/journals/search?query=${encodeURIComponent(payload)}`);
        
        if (response.status === 400 || response.status === 200) {
            logTest('NoSQL Injection Protection', true, `Payload blocked or safely handled: ${payload.substring(0, 20)}...`);
        } else {
            logTest('NoSQL Injection Protection', false, `Payload may have been processed unsafely: ${payload}`);
        }
    }
};

const testXSSProtection = async () => {
    console.log('\n🔍 Testing XSS Protection...');
    
    const xssPayloads = [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert('xss')>",
        "javascript:alert('xss')",
        "<svg onload=alert('xss')>",
        "';alert('xss');//"
    ];
    
    for (const payload of xssPayloads) {
        const response = await makeRequest('POST', '/api/auth/register', {
            name: payload,
            email: 'test@example.com',
            password: 'TestPassword123!'
        });
        
        if (response.status === 400 || (response.data && !response.data.user?.name?.includes('<script>'))) {
            logTest('XSS Protection', true, `XSS payload sanitized: ${payload.substring(0, 20)}...`);
        } else {
            logTest('XSS Protection', false, `XSS payload may not be properly sanitized: ${payload}`);
        }
    }
};

const testRateLimiting = async () => {
    console.log('\n🔍 Testing Rate Limiting...');
    
    const requests = [];
    for (let i = 0; i < 10; i++) {
        requests.push(makeRequest('POST', '/api/auth/login', {
            email: 'nonexistent@example.com',
            password: 'wrongpassword'
        }));
    }
    
    const responses = await Promise.all(requests);
    const rateLimited = responses.some(r => r.status === 429);
    
    logTest('Rate Limiting', rateLimited, rateLimited ? 'Rate limiting active' : 'Rate limiting may not be working');
};

const testFileUploadSecurity = async () => {
    console.log('\n🔍 Testing File Upload Security...');
    
    // Test malicious file extensions
    const maliciousFiles = [
        { name: 'test.exe', content: 'MZ\x90\x00', type: 'application/octet-stream' },
        { name: 'test.php', content: '<?php echo "test"; ?>', type: 'application/x-php' },
        { name: 'test.js', content: 'alert("xss")', type: 'application/javascript' },
        { name: '../../../etc/passwd', content: 'root:x:0:0:root:/root:/bin/bash', type: 'text/plain' }
    ];
    
    for (const file of maliciousFiles) {
        try {
            const formData = new FormData();
            const blob = new Blob([file.content], { type: file.type });
            formData.append('file', blob, file.name);
            formData.append('title', 'Test Journal');
            formData.append('abstract', 'Test abstract for security testing');
            formData.append('authors', JSON.stringify(['Test Author']));
            
            const response = await axios.post(`${BASE_URL}/api/journals`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 10000
            });
            
            if (response.status === 400) {
                logTest('File Upload Security', true, `Malicious file rejected: ${file.name}`);
            } else {
                logTest('File Upload Security', false, `Malicious file may have been accepted: ${file.name}`);
            }
        } catch (error) {
            if (error.response?.status === 400) {
                logTest('File Upload Security', true, `Malicious file rejected: ${file.name}`);
            } else {
                logTest('File Upload Security', false, `Unexpected error for file: ${file.name}`);
            }
        }
    }
};

const testSecurityHeaders = async () => {
    console.log('\n🔍 Testing Security Headers...');
    
    const response = await makeRequest('GET', '/health');
    const headers = response.headers || {};
    
    const requiredHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection',
        'strict-transport-security'
    ];
    
    for (const header of requiredHeaders) {
        if (headers[header]) {
            logTest('Security Headers', true, `${header} header present`);
        } else {
            logTest('Security Headers', false, `${header} header missing`);
        }
    }
};

const testAuthenticationSecurity = async () => {
    console.log('\n🔍 Testing Authentication Security...');
    
    // Test weak password
    const weakPasswordResponse = await makeRequest('POST', '/api/auth/register', {
        name: 'Test User',
        email: 'weak@example.com',
        password: '123'
    });
    
    if (weakPasswordResponse.status === 400) {
        logTest('Password Strength', true, 'Weak password rejected');
    } else {
        logTest('Password Strength', false, 'Weak password may have been accepted');
    }
    
    // Test invalid JWT
    const invalidTokenResponse = await makeRequest('GET', '/api/auth/profile', null, {
        'Authorization': 'Bearer invalid.jwt.token'
    });
    
    if (invalidTokenResponse.status === 401) {
        logTest('JWT Validation', true, 'Invalid JWT rejected');
    } else {
        logTest('JWT Validation', false, 'Invalid JWT may have been accepted');
    }
};

const testInputValidation = async () => {
    console.log('\n🔍 Testing Input Validation...');
    
    // Test oversized input
    const largeString = 'A'.repeat(10000);
    const oversizedResponse = await makeRequest('POST', '/api/journals', {
        title: largeString,
        abstract: 'Test abstract',
        authors: ['Test Author']
    });
    
    if (oversizedResponse.status === 400) {
        logTest('Input Size Validation', true, 'Oversized input rejected');
    } else {
        logTest('Input Size Validation', false, 'Oversized input may have been accepted');
    }
    
    // Test invalid email format
    const invalidEmailResponse = await makeRequest('POST', '/api/auth/register', {
        name: 'Test User',
        email: 'invalid-email',
        password: 'TestPassword123!'
    });
    
    if (invalidEmailResponse.status === 400) {
        logTest('Email Validation', true, 'Invalid email format rejected');
    } else {
        logTest('Email Validation', false, 'Invalid email format may have been accepted');
    }
};

const testCORSConfiguration = async () => {
    console.log('\n🔍 Testing CORS Configuration...');
    
    const corsResponse = await makeRequest('OPTIONS', '/api/journals', null, {
        'Origin': 'https://malicious-site.com',
        'Access-Control-Request-Method': 'POST'
    });
    
    const allowedOrigin = corsResponse.headers?.['access-control-allow-origin'];
    
    if (!allowedOrigin || allowedOrigin === 'https://malicious-site.com') {
        logTest('CORS Configuration', false, 'CORS may allow unauthorized origins');
    } else {
        logTest('CORS Configuration', true, 'CORS properly configured');
    }
};

// Main test runner
const runSecurityTests = async () => {
    console.log('🚀 Starting Security Tests...\n');
    console.log(`Testing against: ${BASE_URL}\n`);
    
    try {
        await testSQLInjection();
        await testXSSProtection();
        await testRateLimiting();
        await testFileUploadSecurity();
        await testSecurityHeaders();
        await testAuthenticationSecurity();
        await testInputValidation();
        await testCORSConfiguration();
        
        // Generate report
        const passed = TEST_RESULTS.filter(r => r.passed).length;
        const total = TEST_RESULTS.length;
        const percentage = ((passed / total) * 100).toFixed(1);
        
        console.log('\n📊 Security Test Results:');
        console.log(`Passed: ${passed}/${total} (${percentage}%)`);
        
        if (percentage >= 80) {
            console.log('✅ Security posture is good!');
        } else if (percentage >= 60) {
            console.log('⚠️  Security posture needs improvement');
        } else {
            console.log('❌ Security posture is poor - immediate action required');
        }
        
        // Save detailed report
        const reportPath = path.join(__dirname, '..', 'logs', `security-test-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(TEST_RESULTS, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);
        
    } catch (error) {
        console.error('❌ Error running security tests:', error.message);
    }
};

// Run tests if called directly
if (require.main === module) {
    runSecurityTests();
}

module.exports = { runSecurityTests };
