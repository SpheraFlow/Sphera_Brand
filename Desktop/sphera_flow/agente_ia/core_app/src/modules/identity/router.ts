import { NextFunction, Request, Response, Router } from 'express';
import { authApiKey } from '../../shared/middleware/authApiKey';
import { authJwt } from '../../shared/middleware/authJwt';
import { tenantContext } from '../../shared/middleware/tenantContext';
import { identityController } from './controller';

function authApiKeyOrJwt(req: Request, res: Response, next: NextFunction): void {
  const authorization = req.get('authorization');

  if (authorization?.startsWith('Bearer ')) {
    authJwt(req, res, next);
    return;
  }

  authApiKey(req, res, next);
}

const router = Router();

router.post('/persons/resolve', authApiKey, tenantContext, identityController.resolve);
router.get('/persons/search', authJwt, tenantContext, identityController.search);
router.get('/persons/:id', authApiKeyOrJwt, tenantContext, identityController.getById);
router.patch('/persons/:id', authJwt, tenantContext, identityController.update);
router.post('/persons/:id/identities', authApiKey, tenantContext, identityController.addIdentity);

export { router as identityRouter };
