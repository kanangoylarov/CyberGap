import app from './app.js';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';

// Start Server
const server = app.listen(config.port, () => {
  logger.info(`Server started securely on port ${config.port}`);
});

export default server;
