/**
 * Boot-time environment validation. Registered via ConfigModule.forRoot({ validate }).
 * Fails fast on startup instead of surfacing cryptic runtime errors when a
 * required variable (DB creds, JWT secrets) is missing or, in production, weak.
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const isProd = config.NODE_ENV === 'production';
  const prefix = isProd ? 'PROD_DB' : 'DEV_DB';

  const required = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    `${prefix}_HOST`,
    `${prefix}_USER`,
    `${prefix}_PASSWORD`,
    `${prefix}_NAME`,
  ];

  const missing = required.filter((key) => {
    const value = config[key];
    return value === undefined || value === null || String(value).trim() === '';
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  if (isProd) {
    for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
      const value = String(config[key]);
      if (value.length < 16 || value.includes('super_secret')) {
        throw new Error(
          `${key} must be a strong, non-default value in production`,
        );
      }
    }
    if (
      !config.CORS_ALLOWED_ORIGINS ||
      String(config.CORS_ALLOWED_ORIGINS).trim() === ''
    ) {
      throw new Error(
        'CORS_ALLOWED_ORIGINS must be set to explicit origin(s) in production',
      );
    }
  }

  return config;
}
