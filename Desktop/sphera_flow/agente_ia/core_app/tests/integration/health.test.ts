import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src';

describe('GET /api/health', () => {
  it('returns service status', async () => {
    const app = createApp();

    await request(app)
      .get('/api/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ status: 'ok', service: 'core_app' });
      });
  });
});
