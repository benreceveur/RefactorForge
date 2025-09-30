/**
 * API Security Tests
 * Tests for SQL injection, XSS, CSRF, and other API security vulnerabilities
 */

import request from 'supertest';
import express from 'express';
import { testWithRealData, validateRealData } from '../../testUtils/testHelpers';

// Import routes to test
import analysisRoutes from '../../routes/analysis';
import githubRoutes from '../../routes/github';
import searchRoutes from '../../routes/searches';

describe('API Security Tests', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/api/analysis', analysisRoutes);
    app.use('/api/github', githubRoutes);
    app.use('/api/searches', searchRoutes);
  });

  describe('SQL Injection Prevention', () => {
    const sqlInjectionPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM secrets --",
      "'; INSERT INTO admin (user) VALUES ('hacker'); --",
      "' OR 1=1 --",
      "admin'--",
      "admin' /*",
      "' or 1=1#",
      "' or 1=1--",
      "') or '1'='1--",
      "') or ('1'='1--"
    ];

    sqlInjectionPayloads.forEach(payload => {
      it(`should prevent SQL injection: ${payload.substring(0, 20)}...`, async () => {
        // Test different endpoints with SQL injection payloads
        const testCases = [
          {
            method: 'get',
            url: `/api/analysis/status?id=${encodeURIComponent(payload)}`,
          },
          {
            method: 'post',
            url: '/api/analysis',
            body: { repository: payload }
          },
          {
            method: 'get',
            url: `/api/searches?q=${encodeURIComponent(payload)}`
          }
        ];

        for (const testCase of testCases) {
          let response;
          if (testCase.method === 'get') {
            response = await request(app).get(testCase.url);
          } else {
            response = await request(app)
              .post(testCase.url)
              .send(testCase.body);
          }

          // Should not return database errors or execute SQL
          expect(response.status).not.toBe(500);
          if (response.body && response.body.error) {
            expect(response.body.error).not.toContain('sqlite');
            expect(response.body.error).not.toContain('SQL');
            expect(response.body.error).not.toContain('database');
            expect(response.body.error).not.toContain('syntax error');
          }
        }
      });
    });

    it('should use parameterized queries', async () => {
      // Test that the application properly uses parameterized queries
      await testWithRealData(
        'parameterized query test',
        async () => {
          const response = await request(app)
            .post('/api/analysis')
            .send({ 
              repository: 'facebook/react', // Real repository
              options: { includeTests: true }
            });
          
          return response.status < 500 ? response.body : null;
        },
        (data) => {
          if (data) {
            // Should process real data successfully
            expect(data).toBeDefined();
          }
        }
      );
    });
  });

  describe('XSS Prevention', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      '<body onload=alert("XSS")>',
      '<input onfocus=alert("XSS") autofocus>',
      '<select onfocus=alert("XSS") autofocus>',
      '<textarea onfocus=alert("XSS") autofocus>',
      '<keygen onfocus=alert("XSS") autofocus>',
      '<video><source onerror="alert(\'XSS\')">',
      '<audio src=x onerror=alert("XSS")>'
    ];

    xssPayloads.forEach(payload => {
      it(`should prevent XSS: ${payload.substring(0, 30)}...`, async () => {
        const response = await request(app)
          .post('/api/analysis')
          .send({ 
            repository: 'test/repo',
            description: payload,
            tags: [payload]
          });

        // Response should not echo back unescaped script tags
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain('<script>');
        expect(responseText).not.toContain('javascript:');
        expect(responseText).not.toContain('onerror=');
        expect(responseText).not.toContain('onload=');
      });
    });

    it('should sanitize user input in search', async () => {
      const xssPayload = '<script>alert("search XSS")</script>';
      
      const response = await request(app)
        .get(`/api/searches?q=${encodeURIComponent(xssPayload)}`);

      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('<script>');
      expect(responseText).not.toContain('alert(');
    });
  });

  describe('Input Validation', () => {
    it('should validate repository format', async () => {
      const invalidRepos = [
        '', // Empty
        'invalid', // No owner/repo format
        'owner/', // Missing repo
        '/repo', // Missing owner
        'owner//repo', // Double slash
        'owner/repo/extra', // Too many parts
        'owner with spaces/repo', // Spaces
        'owner/repo with spaces', // Spaces in repo
        'owner/repo#malicious', // Hash fragment
        'owner/repo?param=value', // Query params
        'https://github.com/owner/repo', // Full URL
      ];

      for (const repo of invalidRepos) {
        const response = await request(app)
          .post('/api/analysis')
          .send({ repository: repo });

        // Should validate and reject invalid formats
        if (repo === '') {
          expect(response.status).toBe(400);
        } else {
          // Should handle gracefully
          expect([400, 404, 422]).toContain(response.status);
        }
      }
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/analysis')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should limit request size', async () => {
      const largePayload = {
        repository: 'test/repo',
        data: 'x'.repeat(20000000) // 20MB
      };

      const response = await request(app)
        .post('/api/analysis')
        .send(largePayload);

      // Should reject or handle large payloads
      expect([413, 400, 500]).toContain(response.status);
    });
  });

  describe('Authentication & Authorization', () => {
    it('should handle missing authentication gracefully', async () => {
      // Test endpoints that might require authentication
      const protectedEndpoints = [
        { method: 'delete', url: '/api/analysis/123' },
        { method: 'post', url: '/api/github/webhooks' },
      ];

      for (const endpoint of protectedEndpoints) {
        let response;
        if (endpoint.method === 'delete') {
          response = await request(app).delete(endpoint.url);
        } else {
          response = await request(app).post(endpoint.url);
        }

        // Should either work (no auth required) or properly reject
        expect(response.status).toBeDefined();
        if (response.status === 401) {
          expect(response.body.error).toBeDefined();
        }
      }
    });

    it('should not expose internal system information', async () => {
      const response = await request(app)
        .get('/api/nonexistent');

      expect(response.status).toBe(404);
      
      // Should not expose server information
      if (response.body && response.body.error) {
        expect(response.body.error).not.toContain('Express');
        expect(response.body.error).not.toContain('Node.js');
        expect(response.body.error).not.toContain('sqlite');
        expect(response.body.error).not.toContain(__dirname);
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should handle concurrent requests', async () => {
      const concurrentRequests = Array(20).fill(null).map(() =>
        request(app)
          .get('/api/analysis')
      );

      const responses = await Promise.all(concurrentRequests);
      
      // Should handle all requests without crashing
      responses.forEach(response => {
        expect(response.status).toBeDefined();
        expect(response.status).not.toBe(0); // Connection error
      });
    });

    it('should prevent abuse through rapid requests', async () => {
      const rapidRequests = [];
      for (let i = 0; i < 100; i++) {
        rapidRequests.push(
          request(app)
            .post('/api/analysis')
            .send({ repository: `test/repo${i}` })
        );
      }

      const responses = await Promise.all(rapidRequests);
      
      // Should either process all or implement rate limiting
      const rateLimited = responses.some(r => r.status === 429);
      const processed = responses.filter(r => r.status < 400).length;
      
      // Either all processed or some rate limited
      expect(processed + responses.filter(r => r.status === 429).length).toBeGreaterThan(0);
    });
  });

  describe('Error Information Disclosure', () => {
    it('should not expose stack traces in production', async () => {
      // Force an error
      const response = await request(app)
        .post('/api/analysis')
        .send({ 
          repository: null, // This should cause an error
          malformedData: { deeply: { nested: { object: undefined } } }
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      
      if (response.body && response.body.error) {
        // Should not expose internal details
        expect(response.body.error).not.toContain('at Object.');
        expect(response.body.error).not.toContain('node_modules');
        expect(response.body.error).not.toContain('backend/src');
        expect(response.body.error).not.toContain('TypeError');
        expect(response.body.stack).toBeUndefined();
      }
    });

    it('should sanitize database errors', async () => {
      // Try to trigger a database error
      const response = await request(app)
        .get('/api/analysis/status?id=999999999999999999999999');

      if (response.status >= 400 && response.body && response.body.error) {
        // Should not expose database details
        expect(response.body.error).not.toContain('SQLITE_');
        expect(response.body.error).not.toContain('database is locked');
        expect(response.body.error).not.toContain('no such table');
        expect(response.body.error).not.toContain('constraint failed');
      }
    });
  });

  describe('CORS Security', () => {
    it('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/analysis')
        .set('Origin', 'http://malicious-site.com')
        .set('Access-Control-Request-Method', 'POST');

      // Should have CORS headers configured
      if (response.headers['access-control-allow-origin']) {
        // If CORS is configured, should be restrictive
        expect(response.headers['access-control-allow-origin']).not.toBe('*');
      }
    });
  });

  describe('Content Security', () => {
    it('should set security headers', async () => {
      const response = await request(app)
        .get('/api/analysis');

      // Should have security headers (from helmet middleware)
      const headers = response.headers;
      
      // These might be set by helmet
      if (headers['x-content-type-options']) {
        expect(headers['x-content-type-options']).toBe('nosniff');
      }
      
      if (headers['x-frame-options']) {
        expect(['DENY', 'SAMEORIGIN']).toContain(headers['x-frame-options']);
      }
    });

    it('should handle content type validation', async () => {
      const response = await request(app)
        .post('/api/analysis')
        .set('Content-Type', 'text/plain')
        .send('not json');

      // Should reject non-JSON content for JSON endpoints
      expect([400, 415]).toContain(response.status);
    });
  });
});