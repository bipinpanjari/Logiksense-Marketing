import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
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
} from './registration.dto';

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

  @Get('me')
  async getMe(@Request() req: any) {
    if (!req.user) {
      return { message: 'Not authenticated' };
    }
    return {
      user: await this.authService.validateUser(req.user.userId),
      workspace: req.user.workspaceId,
    };
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
}
