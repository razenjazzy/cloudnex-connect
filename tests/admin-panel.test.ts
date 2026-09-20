import express from 'express';
import { afterAll, describe, expect, it } from 'vitest';
import { registerAdminPanelRoutes } from '../src/http/admin-panel-routes';

describe('admin CRM HTTP', () => {
  const app = express();
  registerAdminPanelRoutes(app);
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  afterAll(() => new Promise<void>((resolve, reject) => {
    server.close(err => (err ? reject(err) : resolve()));
  }));

  it('rejects quote list without OPS or demo session', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/admin/crm/quotes`);
    expect(res.status).toBe(401);
  });
});
