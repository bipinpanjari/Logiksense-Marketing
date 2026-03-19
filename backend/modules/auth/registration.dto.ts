import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

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
}
