import { AppError } from './AppError';

export class ForbiddenError extends AppError {
  constructor(message: string, code = 'FORBIDDEN') {
    super(message, 403, code);
    this.name = 'ForbiddenError';
  }
}
