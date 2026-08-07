import { DataSource } from 'typeorm';
import { configuration } from '../config/configuration';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { Permission } from '../permissions/permission.entity';
import { Tenant } from '../tenants/tenant.entity';
import { RefreshToken } from '../auth/refresh-token.entity';
import { TwoFactorOtp } from '../auth/two-factor-otp.entity';

/**
 * Standalone TypeORM DataSource (used by CLI tooling). The application
 * itself connects through TypeOrmModule in AppModule.
 */
const config = configuration();
const entities = [User, Role, Permission, Tenant, RefreshToken, TwoFactorOtp];

export const AppDataSource = config.database.type === 'postgres'
  ? new DataSource({
      type: 'postgres',
      host: config.database.host,
      port: config.database.port,
      username: config.database.username,
      password: config.database.password,
      database: config.database.database,
      entities,
      synchronize: true,
    })
  : new DataSource({
      type: 'sqljs',
      location: config.database.url,
      autoSave: true,
      entities,
      synchronize: true,
    });
