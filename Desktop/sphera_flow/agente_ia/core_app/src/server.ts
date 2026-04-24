import { createApp } from './index';
import { env } from './config/env';
import { logger } from './config/logger';

const app = createApp();

app.listen(env.CORE_APP_PORT, () => {
  logger.info(
    {
      env: env.NODE_ENV,
      port: env.CORE_APP_PORT,
    },
    'core_app started',
  );
});
