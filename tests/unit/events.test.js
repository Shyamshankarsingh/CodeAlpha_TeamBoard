import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { events } from '../../server/lib/events.js';

describe('DomainEventBus Unit Tests', () => {
  test('emits event to specific topic subscriber', (t, done) => {
    const handler = (payload) => {
      assert.equal(payload.foo, 'bar');
      events.off('test.topic', handler);
      done();
    };

    events.on('test.topic', handler);
    events.emitEvent('test.topic', { foo: 'bar' });
  });

  test('emits to wildcard subscriber with type and payload', (t, done) => {
    const wildcardHandler = (event) => {
      if (event.type === 'wildcard.test') {
        assert.equal(event.payload.item, 42);
        events.off('*', wildcardHandler);
        done();
      }
    };

    events.on('*', wildcardHandler);
    events.emitEvent('wildcard.test', { item: 42 });
  });

  test('handles errors in listener without crashing', () => {
    const faultyListener = () => {
      throw new Error('Boom from listener');
    };

    events.on('crash.test', faultyListener);
    assert.doesNotThrow(() => {
      events.emitEvent('crash.test', { ok: true });
    });
    events.off('crash.test', faultyListener);
  });
});
