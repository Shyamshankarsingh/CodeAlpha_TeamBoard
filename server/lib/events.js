import { EventEmitter } from 'node:events';
import { logger } from '../logger.js';

class DomainEventBus extends EventEmitter {
  constructor() {
    super();
    // Allow higher listener counts for multiple real-time subscribers
    this.setMaxListeners(100);
  }

  emitEvent(eventType, payload) {
    try {
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
