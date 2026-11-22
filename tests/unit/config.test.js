import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../../server/config.js';

describe('Config Validation', () => {
  test('loads valid environment configuration successfully', () => {
    const validEnv = {
      NODE_ENV: 'development',
      PORT: '4000',
      APP_ORIGIN: 'http://localhost:4000',
      DATABASE_PATH: 'data/test.db',
      SESSION_IDLE_DAYS: '5',
      SESSION_MAX_DAYS: '15',
      COOKIE_SECURE: 'false',
      REQUIRE_EMAIL_VERIFICATION: 'false',
    };

    const cfg = loadConfig(validEnv);
    assert.equal(cfg.PORT, 4000);
    assert.equal(cfg.NODE_ENV, 'development');
    assert.equal(cfg.APP_ORIGIN, 'http://localhost:4000');
    assert.equal(cfg.SESSION_IDLE_DAYS, 5);
  });

  test('applies defaults for missing optional variables', () => {
    const minimalEnv = {
      NODE_ENV: 'test',
    };

    const cfg = loadConfig(minimalEnv);
    assert.equal(cfg.PORT, 3000);
    assert.equal(cfg.APP_ORIGIN, 'http://localhost:3000');
    assert.equal(cfg.DATABASE_PATH, 'data/teamboard.db');
    assert.equal(cfg.SESSION_IDLE_DAYS, 7);
    assert.equal(cfg.COOKIE_SECURE, false);
  });

  test('rejects invalid PORT numbers', () => {
    assert.throws(
      () => loadConfig({ PORT: '999999' }),
      /Configuration validation error/
    );

    assert.throws(
      () => loadConfig({ PORT: 'not-a-number' }),
      /Configuration validation error/
    );
  });

  test('rejects production configuration without HTTPS origin', () => {
    assert.throws(
      () => loadConfig({ NODE_ENV: 'production', APP_ORIGIN: 'http://insecure.com' }),
      /APP_ORIGIN must use HTTPS/
    );
  });
});
