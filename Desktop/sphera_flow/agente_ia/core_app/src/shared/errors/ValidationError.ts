import { AppError } from './AppError';

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}
