import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';

const app = createApp(config);

const server = app.listen(config.PORT, () => {
  logger.info(`TeamBoard server running at http://localhost:${config.PORT}`, {
    port: config.PORT,
    env: config.NODE_ENV,
    origin: config.APP_ORIGIN,
  });
});

// Graceful shutdown handling
function shutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });

  // Force close if it takes too long
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
