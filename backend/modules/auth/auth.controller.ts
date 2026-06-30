import { Controller, Post, Body, Get, Put, Request, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegistrationService } from './registration.service';
import { EmailValidationService } from './email-validation.service';
import { CreateUserDto, LoginUserDto } from '../../shared/types';
import {
  CreateRegistrationSessionDto,
  VerifyEmailDto,
  ConfigureOutboundEmailDto,
  RetryValidationDto,
  CompleteRegistrationDto,
  GetDNSGuideDto,
  CompleteOnboardingDto,
} from './registration.dto';

import { UpdateProfileDto, UpdateWorkspaceSettingsDto, ChangePasswordDto } from './account.dto';


@Controller('api/auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private registrationService: RegistrationService,
    private emailValidation: EmailValidationService,
  ) {}

  // ==================== STANDARD AUTH ====================
  @Post('signup')
  async signup(@Body() createUserDto: CreateUserDto, @Request() req: any) {
    return this.authService.signup(createUserDto);
  }

  @Post('login')
  async login(@Body() loginUserDto: LoginUserDto, @Request() req: any) {
    return this.authService.login(loginUserDto);
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string, @Request() req: any) {
    return this.authService.refreshToken(refreshToken);
  }


  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  async resetPassword(@Body('token') token: string, @Body('password') password: string) {
    return this.authService.resetPassword(token, password);
  }


  @Get('me')
  async getMe(@Request() req: any) {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    const user = await this.authService.validateUser(req.user.userId);
    const workspace = await this.authService.getWorkspaceById(req.user.workspaceId);
    return {
      user,
      workspace,
    };
  }

  @Post('onboarding/complete')
  async completeOnboarding(@Request() req: any, @Body() payload: CompleteOnboardingDto) {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.authService.completeOnboarding(req.user.userId, req.user.workspaceId, payload);
  }

  @Get('profile')
  async getProfile(@Request() req: any) {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.authService.getProfile(req.user.userId);
  }

  @Put('profile')
  async updateProfile(@Request() req: any, @Body() payload: UpdateProfileDto) {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.authService.updateProfile(req.user.userId, payload);
  }


  @Post('change-password')
  async changePassword(@Request() req: any, @Body() payload: ChangePasswordDto) {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.authService.changePassword(
      req.user.userId,
      payload.currentPassword,
      payload.newPassword,
    );
  }


  @Get('settings')
  async getSettings(@Request() req: any) {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.authService.getWorkspaceSettings(req.user.userId, req.user.workspaceId);
  }

  @Put('settings')
  async updateSettings(@Request() req: any, @Body() payload: UpdateWorkspaceSettingsDto) {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.authService.updateWorkspaceSettings(req.user.userId, req.user.workspaceId, payload);
  }

  // ==================== MULTI-STEP REGISTRATION ====================
  /**
   * Step 1: Create registration session with company info
   */
  @Post('registration/start')
  async startRegistration(@Body() companyInfo: CreateRegistrationSessionDto) {
    return this.registrationService.createRegistrationSession(companyInfo);
  }

  /**
   * Step 2a: Send verification email
   */
  @Post('registration/send-verification')
  async sendVerification(@Body('sessionId') sessionId: string) {
    return this.registrationService.sendEmailVerification(sessionId);
  }

  /**
   * Step 2b: Verify email code
   */
  @Post('registration/verify-email')
  async verifyEmail(@Body() verifyDto: VerifyEmailDto) {
    return this.registrationService.verifyEmail(verifyDto.sessionId, verifyDto.verificationCode);
  }

  /**
   * Step 3: Configure outbound email and validate DKIM/SPF
   */
  @Post('registration/configure-email')
  async configureOutboundEmail(@Body() emailConfig: ConfigureOutboundEmailDto) {
    return this.registrationService.configureOutboundEmail(
      emailConfig.sessionId,
      {
        sendingEmail: emailConfig.sendingEmail,
        domain: emailConfig.domain,
        dkimSelector: emailConfig.dkimSelector,
      }
    );
  }

  /**
   * Get DNS configuration guide for specific provider
   */
  @Post('registration/dns-guide')
  async getDNSGuide(@Body() guideDto: GetDNSGuideDto) {
    return this.registrationService.getDNSGuide(guideDto.sessionId, guideDto.provider);
  }

  /**
   * Retry DKIM/SPF validation after DNS changes
   */
  @Post('registration/retry-validation')
  async retryValidation(@Body() retryDto: RetryValidationDto) {
    return this.registrationService.retryValidation(
      retryDto.sessionId,
      {
        sendingEmail: retryDto.sendingEmail,
        domain: retryDto.domain,
        dkimSelector: retryDto.dkimSelector,
      }
    );
  }

  /**
   * Step 4: Complete registration and create account
   */
  @Post('registration/complete')
  async completeRegistration(@Body() completeDto: CompleteRegistrationDto) {
    return this.registrationService.completeRegistration(
      completeDto.sessionId,
      { password: completeDto.password }
    );
  }

  /**
   * Get registration session status
   */
  @Get('registration/status/:sessionId')
  async getRegistrationStatus(@Request() req: any) {
    const sessionId = req.params.sessionId;
    return this.registrationService.getSessionStatus(sessionId);
  }


  // ==================== 2FA / MFA ====================

  @Post('2fa/generate')
  async generate2fa(@Request() req: any) {
    if (!req.user) throw new UnauthorizedException();
    return this.authService.generateTwoFactorSecret(req.user.userId);
  }

  @Post('2fa/turn-on')
  async turnOn2fa(@Body() body: { code: string }, @Request() req: any) {
    if (!req.user) throw new UnauthorizedException();
    return this.authService.enableTwoFactor(req.user.userId, body.code);
  }

  @Post('2fa/turn-off')
  async turnOff2fa(@Body() body: { code: string }, @Request() req: any) {
    if (!req.user) throw new UnauthorizedException();
    return this.authService.disableTwoFactor(req.user.userId, body.code);
  }

  @Post('2fa/authenticate')
  async authenticate2fa(@Body() body: { tempToken: string; code: string }) {
    return this.authService.loginWithMfa(body.tempToken, body.code);
  }

}
