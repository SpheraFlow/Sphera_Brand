import { Router } from 'express';
import { authApiKey } from '../../shared/middleware/authApiKey';
import { authJwt } from '../../shared/middleware/authJwt';
import { tenantContext } from '../../shared/middleware/tenantContext';
import { analyticsController } from './controller';

const router = Router();

router.post('/events', authApiKey, tenantContext, analyticsController.recordEvent);
router.post('/events/batch', authApiKey, tenantContext, analyticsController.recordBatch);
router.get('/analytics/summary', authJwt, tenantContext, analyticsController.summary);
router.get('/analytics/events', authJwt, tenantContext, analyticsController.listEvents);

export { router as analyticsRouter };
