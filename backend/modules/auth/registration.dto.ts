import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateRegistrationSessionDto {
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsString()
  @IsNotEmpty()
  staffName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  numberOfEmployees!: number;

  @IsEmail()
  email!: string;
}

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  verificationCode!: string;
}

export class ConfigureOutboundEmailDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsEmail()
  sendingEmail!: string;

  @IsString()
  @IsNotEmpty()
  domain!: string;

  @IsOptional()
  @IsString()
  dkimSelector?: string;
}

export class RetryValidationDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsEmail()
  sendingEmail!: string;

  @IsString()
  @IsNotEmpty()
  domain!: string;

  @IsString()
  @IsNotEmpty()
  dkimSelector!: string;
}

export class CompleteRegistrationDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class GetDNSGuideDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsString()
  @IsIn(['namecheap', 'godaddy', 'route53', 'cloudflare', 'generic'])
  provider!: string;
}

export class CompleteOnboardingDto {

  @IsBoolean()
  @IsOptional()
  termsAccepted?: boolean;


  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsString()
  @IsNotEmpty()
  staffName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  numberOfEmployees!: number;

  @IsEmail()
  workEmail!: string;

  @IsEmail()
  sendingEmail!: string;

  @IsString()
  @IsNotEmpty()
  domain!: string;

  @IsOptional()
  @IsString()
  dkimSelector?: string;

  /**
   * When true, onboarding completes even if MX/DNS checks fail (e.g. local dev, DNS not propagated).
   * In production, the server also requires ONBOARDING_ALLOW_CLIENT_DNS_SKIP=true.
   * Alternatively set ONBOARDING_SKIP_DNS_VALIDATION=true in env to skip for all users.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 1)
  @IsBoolean()
  skipDnsValidation?: boolean;
}
