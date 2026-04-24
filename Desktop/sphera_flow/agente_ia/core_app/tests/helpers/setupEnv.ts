process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.CORE_APP_PORT = process.env.CORE_APP_PORT ?? '3001';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:password@localhost:5432/agente_ia_test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test_secret_with_at_least_32_characters';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '15m';
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
