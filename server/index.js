import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { getDb, closeDb } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { initSockets, closeSockets } from './lib/sockets.js';

// Initialize database and run migrations at boot
const db = getDb();
const applied = runMigrations(db);
if (applied.length > 0) {
  logger.info(`Database migrations completed. Applied ${applied.length} migration(s).`);
}

const app = createApp(config);
const server = http.createServer(app);

// Attach Socket.IO to HTTP server
initSockets(server, config);

server.listen(config.PORT, () => {
  logger.info(`TeamBoard server running at http://localhost:${config.PORT}`, {
    port: config.PORT,
    env: config.NODE_ENV,
    origin: config.APP_ORIGIN,
  });
});

// Graceful shutdown handling
function shutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  closeSockets();
  server.close(() => {
    logger.info('HTTP server closed.');
    closeDb();
    logger.info('Database connection closed.');
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
