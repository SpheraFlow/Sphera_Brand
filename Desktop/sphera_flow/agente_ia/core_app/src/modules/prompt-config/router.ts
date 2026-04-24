import { Router } from 'express';
import { authApiKey } from '../../shared/middleware/authApiKey';
import { authJwt } from '../../shared/middleware/authJwt';
import { tenantContext } from '../../shared/middleware/tenantContext';
import { promptConfigController } from './controller';

const router = Router();

function authApiKeyOrJwt(
  req: Parameters<typeof authApiKey>[0],
  res: Parameters<typeof authApiKey>[1],
  next: Parameters<typeof authApiKey>[2],
): void {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    authJwt(req, res, next);
    return;
  }

  void authApiKey(req, res, next);
}

router.get('/prompts/current', authApiKey, tenantContext, promptConfigController.getCurrent);
router.get('/prompt-packs/active', authApiKey, tenantContext, promptConfigController.getActive);
router.get('/prompt-packs/:id', authApiKeyOrJwt, tenantContext, promptConfigController.getById);
router.get('/prompt-packs', authJwt, tenantContext, promptConfigController.list);
router.post('/prompt-packs', authJwt, tenantContext, promptConfigController.create);
router.patch('/prompt-packs/:id', authJwt, tenantContext, promptConfigController.update);
router.post('/prompt-packs/:id/activate', authJwt, tenantContext, promptConfigController.activate);

export { router as promptConfigRouter };
