import { EventEmitter } from 'node:events';
import { logger } from '../logger.js';
import { requestContext } from './context.js';

class DomainEventBus extends EventEmitter {
  constructor() {
    super();
    // Allow higher listener counts for multiple real-time subscribers
    this.setMaxListeners(100);
  }

  emitEvent(eventType, payload = {}) {
    try {
      const ctx = requestContext?.getStore?.();
      if (ctx) {
        if (!payload.originClientId && ctx.clientId) {
          payload.originClientId = ctx.clientId;
        }
        if (!payload.actorId && ctx.userId) {
          payload.actorId = ctx.userId;
        }
      }

      this.emit(eventType, payload);
      this.emit('*', { type: eventType, payload });
    } catch (err) {
      logger.error('Error emitting domain event', {
        eventType,
        error: err.message,
      });
    }
  }
}

export const events = new DomainEventBus();
