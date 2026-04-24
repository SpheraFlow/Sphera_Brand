import { Router } from 'express';
import { tenantContext } from '../../shared/middleware/tenantContext';
import { webhookController } from './controller';

const router = Router();

// Receives raw webhooks from Chatwoot, validates HMAC securely before doing anything else
router.post('/chatwoot', webhookController.handleChatwoot);

export { router as webhookRouter };
