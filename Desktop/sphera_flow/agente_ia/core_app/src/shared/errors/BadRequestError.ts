import { AppError } from './AppError';

export class BadRequestError extends AppError {
  constructor(message: string, code = 'BAD_REQUEST') {
    super(message, 400, code);
    this.name = 'BadRequestError';
  }
}
