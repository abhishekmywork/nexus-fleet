import { SetMetadata } from '@nestjs/common';

export const REQUIRE_SUPER_USER_KEY = 'requireSuperUser';

/**
 * Restricts a route to super users only (e.g. tenant management).
 */
export const RequireSuperUser = () => SetMetadata(REQUIRE_SUPER_USER_KEY, true);
