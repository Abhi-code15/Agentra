import { createApp } from './app.js';
import { config } from './config/env.js';
import { pool } from './db/pool.js';
import { logger } from './shared/logger.js';

const app = createApp();

const server = app.listen(config.PORT, config.HOST, () => {
  logger.info(`Agentra server running on http://${config.HOST}:${config.PORT} [${config.NODE_ENV}]`);
});

async function shutdown(signal) {
  logger.info(`Received ${signal}. Gracefully shutting down...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await pool.end();
      logger.info('Database pool closed.');
      process.exit(0);
    } catch (err) {
      logger.error('Error closing database pool', { error: err.message });
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('Forcefully terminating server after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
