import http from 'node:http';
import { createApp } from '../../server/app.js';
import { loadConfig } from '../../server/config.js';

export async function createTestApp(envOverrides = {}) {
  const config = loadConfig({
    NODE_ENV: 'test',
    PORT: '0',
    APP_ORIGIN: 'http://localhost',
    DATABASE_PATH: ':memory:',
    COOKIE_SECURE: 'false',
    ...envOverrides,
  });

  const app = createApp(config);
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    app,
    server,
    baseUrl,
    config,
    close: () => new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    }),
  };
}
