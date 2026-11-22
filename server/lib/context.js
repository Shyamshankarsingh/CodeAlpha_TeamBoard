import { AsyncLocalStorage } from 'node:async_hooks';

export const requestContext = new AsyncLocalStorage();

export function contextMiddleware(req, res, next) {
  const store = {
    clientId: req.headers['x-client-id'] || null,
    userId: null,
  };
  requestContext.run(store, next);
}
