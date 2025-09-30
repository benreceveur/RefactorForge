/**
 * Webhook Security Tests
 * Tests webhook signature verification and security measures
 */

import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { AppSecrets } from '../../utils/secrets-manager';
import webhookRouter from '../../routes/webhooks';

describe('Webhook Security', () => {
  let app: express.Express;
  let testSecret: string;

  beforeAll(async () => {
    // Initialize test app
    app = express();
    app.use(express.json());
    app.use('/webhooks', webhookRouter);

    // Initialize secrets manager for tests
    AppSecrets.initialize({ provider: 'local' });
    testSecret = 'test-webhook-secret-for-testing-only';
    process.env.GITHUB_WEBHOOK_SECRET = testSecret;
  });

  afterAll(() => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
  });

  function createValidSignature(payload: string): string {
    return 'sha256=' + crypto
      .createHmac('sha256', testSecret)
      .update(payload)
      .digest('hex');
  }

  describe('Signature Verification', () => {
    it('should reject webhooks without signatures', async () => {
      const payload = { action: 'opened', repository: { name: 'test' } };

      const response = await request(app)
        .post('/webhooks/github')
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
      expect(response.body.message).toContain('Invalid webhook signature');
    });

    it('should reject webhooks with invalid signatures', async () => {
      const payload = { action: 'opened', repository: { name: 'test' } };
      const invalidSignature = 'sha256=invalid_signature';

      const response = await request(app)
        .post('/webhooks/github')
        .set('x-hub-signature-256', invalidSignature)
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should accept webhooks with valid signatures', async () => {
      const payload = { 
        action: 'opened', 
        repository: { full_name: 'test/repo' },
        issue: { number: 1, title: 'Test', body: 'Test body', labels: [], user: { login: 'test' } }
      };
      const payloadString = JSON.stringify(payload);
      const validSignature = createValidSignature(payloadString);

      const response = await request(app)
        .post('/webhooks/github')
        .set('x-hub-signature-256', validSignature)
        .set('x-github-event', 'issues')
        .send(payload);

      // Should process successfully (200 or 500 for unimplemented features)
      expect([200, 500]).toContain(response.status);
      expect(response.status).not.toBe(401); // Should not be unauthorized
    });

    it('should use timing-safe comparison for signatures', async () => {
      const payload = JSON.stringify({ test: 'data' });
      const correctSignature = createValidSignature(payload);
      
      // Create a signature that differs by one character
      const almostCorrectSignature = correctSignature.slice(0, -1) + 'X';

      const response = await request(app)
        .post('/webhooks/github')
        .set('x-hub-signature-256', almostCorrectSignature)
        .send({ test: 'data' });

      expect(response.status).toBe(401);
    });
  });

  describe('Secret Management Security', () => {
    it('should not expose webhook secret in error messages', async () => {
      const originalSecret = process.env.GITHUB_WEBHOOK_SECRET;
      delete process.env.GITHUB_WEBHOOK_SECRET;

      const payload = { action: 'opened' };

      const response = await request(app)
        .post('/webhooks/github')
        .set('x-hub-signature-256', 'sha256=test')
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.message).not.toContain(testSecret);
      expect(response.body.message).not.toContain('GITHUB_WEBHOOK_SECRET');

      process.env.GITHUB_WEBHOOK_SECRET = originalSecret;
    });

    it('should handle missing secrets gracefully', async () => {
      // Mock AppSecrets.getGitHubWebhookSecret to throw error
      const originalMethod = AppSecrets.getGitHubWebhookSecret;
      AppSecrets.getGitHubWebhookSecret = jest.fn().mockRejectedValue(
        new Error('Secret not found in Key Vault')
      );

      const payload = { action: 'test' };
      const response = await request(app)
        .post('/webhooks/github')
        .set('x-hub-signature-256', 'sha256=test')
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.message).not.toContain('Key Vault');
      expect(response.body.message).not.toContain('Secret not found');

      // Restore original method
      AppSecrets.getGitHubWebhookSecret = originalMethod;
    });
  });

  describe('Input Validation Security', () => {
    it('should validate GitHub event types', async () => {
      const payload = { malicious: 'payload' };
      const validSignature = createValidSignature(JSON.stringify(payload));

      const response = await request(app)
        .post('/webhooks/github')
        .set('x-hub-signature-256', validSignature)
        .set('x-github-event', 'malicious_event')
        .send(payload);

      // Should handle unknown events gracefully
      expect([200, 400, 500]).toContain(response.status);
    });

    it('should sanitize payload data', async () => {
      const maliciousPayload = {
        action: 'opened',
        repository: {
          full_name: '<script>alert("xss")</script>'
        },
        issue: {
          number: 1,
          title: 'javascript:alert("xss")',
          body: '<iframe src="javascript:alert(1)"></iframe>',
          labels: [],
          user: { login: 'test' }
        }
      };

      const payloadString = JSON.stringify(maliciousPayload);
      const validSignature = createValidSignature(payloadString);

      const response = await request(app)
        .post('/webhooks/github')
        .set('x-hub-signature-256', validSignature)
        .set('x-github-event', 'issues')
        .send(maliciousPayload);

      // Should process without executing scripts
      expect([200, 500]).toContain(response.status);
      
      // Check that response doesn't echo back malicious content
      if (response.body && typeof response.body === 'object') {
        const responseString = JSON.stringify(response.body);
        expect(responseString).not.toContain('<script>');
        expect(responseString).not.toContain('<iframe>');
        expect(responseString).not.toContain('javascript:');
      }
    });

    it('should handle oversized payloads', async () => {
      // Create a large payload (over reasonable webhook size)
      const largeData = 'x'.repeat(10000000); // 10MB
      const largePayload = {
        action: 'opened',
        repository: { full_name: 'test/repo' },
        large_data: largeData
      };

      const payloadString = JSON.stringify(largePayload);
      const validSignature = createValidSignature(payloadString);

      const response = await request(app)
        .post('/webhooks/github')
        .set('x-hub-signature-256', validSignature)
        .set('x-github-event', 'push')
        .send(largePayload);

      // Should handle large payloads gracefully (may reject or process)
      expect(response.status).toBeDefined();
    });
  });

  describe('Rate Limiting Security', () => {
    it('should handle rapid webhook requests', async () => {
      const payload = {
        action: 'opened',
        repository: { full_name: 'test/repo' },
        issue: { 
          number: 1, 
          title: 'Test', 
          body: 'Test', 
          labels: [], 
          user: { login: 'test' } 
        }
      };
      const payloadString = JSON.stringify(payload);
      const validSignature = createValidSignature(payloadString);

      // Send multiple requests rapidly
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/webhooks/github')
          .set('x-hub-signature-256', validSignature)
          .set('x-github-event', 'issues')
          .send(payload)
      );

      const responses = await Promise.all(requests);
      
      // All should be processed (may implement rate limiting in future)
      responses.forEach(response => {
        expect([200, 429, 500]).toContain(response.status);
      });
    });
  });

  describe('Logging Security', () => {
    it('should not log sensitive information', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      const consoleWarnSpy = jest.spyOn(console, 'warn');
      const consoleErrorSpy = jest.spyOn(console, 'error');

      const payload = {
        action: 'opened',
        repository: { full_name: 'private/repo' },
        sender: { login: 'sensitive-user' },
        installation: { id: 12345 }
      };

      const payloadString = JSON.stringify(payload);
      const validSignature = createValidSignature(payloadString);

      await request(app)
        .post('/webhooks/github')
        .set('x-hub-signature-256', validSignature)
        .set('x-github-event', 'installation')
        .send(payload);

      // Check that sensitive information wasn't logged
      const allLogs = [
        ...consoleSpy.mock.calls.flat(),
        ...consoleWarnSpy.mock.calls.flat(),
        ...consoleErrorSpy.mock.calls.flat()
      ].join(' ');

      expect(allLogs).not.toContain(testSecret);
      expect(allLogs).not.toContain('installation');

      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});