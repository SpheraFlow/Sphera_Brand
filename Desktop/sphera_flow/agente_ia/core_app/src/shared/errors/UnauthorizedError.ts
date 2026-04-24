import { AppError } from './AppError';

export class UnauthorizedError extends AppError {
  constructor(message: string, code = 'UNAUTHORIZED') {
    super(message, 401, code);
    this.name = 'UnauthorizedError';
  }
}
