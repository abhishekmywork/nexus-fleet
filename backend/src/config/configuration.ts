/**
 * Centralized, type-safe access to environment configuration with sensible
 * development defaults so the API runs with zero setup.
 */
export interface AppConfig {
  port: number;
  corsOrigins: string[];
  autoSeed: boolean;
  database: {
    type: 'sqljs' | 'postgres';
    url: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    database?: string;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    twoFactorSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
    twoFactorExpiresIn: string;
  };
  otp: {
    expiresInSeconds: number;
    resendCooldownSeconds: number;
  };
  seed: {
    adminEmail: string;
    adminPassword: string;
    defaultTenantName: string;
    defaultTenantSlug: string;
    demoTenantName: string;
    demoTenantSlug: string;
  };
  /** When true (dev), OTP codes are included in API responses instead of sent. */
  isDev: boolean;
  /** Days to retain audit logs. 0 = forever. */
  auditLogRetentionDays: number;
}

export const configuration = (): AppConfig => {
  const isDev = process.env.NODE_ENV !== 'production';
  const dbType = (process.env.DB_TYPE ?? 'sqljs') as 'sqljs' | 'postgres';

  // Support both individual env vars and a full PostgreSQL connection string
  const dbUrl = process.env.DATABASE_URL ?? './data/nexus.db';
  let dbConfig: AppConfig['database'];

  if (dbType === 'postgres') {
    // Parse PostgreSQL connection string or use individual env vars
    let host = process.env.DB_HOST ?? 'localhost';
    let port = parseInt(process.env.DB_PORT ?? '5432', 10);
    let username = process.env.DB_USER ?? 'postgres';
    let password = process.env.DB_PASSWORD ?? '';
    let database = process.env.DB_NAME ?? 'nexus_admin';

    // If DATABASE_URL is provided, parse it (format: postgres://user:pass@host:port/dbname)
    if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
      try {
        const url = new URL(dbUrl);
        host = url.hostname;
        port = parseInt(url.port || '5432', 10);
        username = url.username;
        password = url.password;
        database = url.pathname.slice(1); // remove leading /
      } catch {
        // Use individual env vars if URL parsing fails
      }
    }

    dbConfig = {
      type: 'postgres',
      url: dbUrl,
      host,
      port,
      username,
      password,
      database,
    };
  } else {
    dbConfig = {
      type: 'sqljs',
      url: dbUrl,
    };
  }
  return {
    port: parseInt(process.env.PORT ?? '4000', 10),
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    autoSeed: process.env.AUTO_SEED !== 'false',
    database: dbConfig,
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
      twoFactorSecret: process.env.JWT_TWO_FACTOR_SECRET ?? 'dev-two-factor-secret-change-me',
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
      twoFactorExpiresIn: process.env.JWT_TWO_FACTOR_EXPIRES_IN ?? '5m',
    },
    otp: {
      expiresInSeconds: parseInt(process.env.OTP_EXPIRES_IN_SECONDS ?? '300', 10),
      resendCooldownSeconds: parseInt(
        process.env.OTP_RESEND_COOLDOWN_SECONDS ?? '30',
        10,
      ),
    },
    seed: {
      adminEmail: process.env.ADMIN_EMAIL ?? 'admin@nexus.dev',
      adminPassword: process.env.ADMIN_PASSWORD ?? 'Admin123!',
      defaultTenantName: process.env.DEFAULT_TENANT_NAME ?? 'Nexus HQ',
      defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG ?? 'nexus',
      demoTenantName: process.env.DEMO_TENANT_NAME ?? 'Acme Corp',
      demoTenantSlug: process.env.DEMO_TENANT_SLUG ?? 'acme',
    },
    isDev,
    auditLogRetentionDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS ?? '90', 10),
  };
};
