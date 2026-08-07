import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/auth-user.interface';
import { TwoFactorService } from './two-factor.service';
import {
  DisableTwoFactorDto,
  SetupTwoFactorDto,
  VerifyTwoFactorSetupDto,
} from './dto/two-factor.dto';

/**
 * Self-service 2FA management for the authenticated user.
 */
@Controller('auth/2fa')
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  /** Send a code to start enabling 2FA (email or SMS). */
  @Post('setup')
  @HttpCode(HttpStatus.OK)
  beginSetup(
    @CurrentUser('id') userId: string,
    @Body() dto: SetupTwoFactorDto,
  ) {
    return this.twoFactorService.beginSetup(userId, dto);
  }

  /** Confirm the code and enable 2FA. */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  completeSetup(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyTwoFactorSetupDto,
  ) {
    return this.twoFactorService.completeSetup(userId, dto.code);
  }

  /** Disable 2FA by verifying the current code. */
  @Post('disable')
  @HttpCode(HttpStatus.OK)
  disable(
    @CurrentUser('id') userId: string,
    @Body() dto: DisableTwoFactorDto,
  ) {
    return this.twoFactorService.disable(userId, dto.code);
  }
}
