import { Router } from 'express';
import { authApiKey } from '../../shared/middleware/authApiKey';
import { authJwt } from '../../shared/middleware/authJwt';
import { tenantContext } from '../../shared/middleware/tenantContext';
import { handoffController } from './controller';

const router = Router();

router.get('/handoffs/check', authApiKey, tenantContext, handoffController.check);
router.post('/handoffs', authApiKey, tenantContext, handoffController.start);
router.post('/handoffs/:id/resolve', authApiKey, tenantContext, handoffController.resolve);
router.get('/handoffs/active', authJwt, tenantContext, handoffController.listActive);
router.get('/handoffs/:id', authJwt, tenantContext, handoffController.getById);

export { router as handoffRouter };
