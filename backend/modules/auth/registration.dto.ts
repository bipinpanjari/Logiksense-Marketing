export class CreateRegistrationSessionDto {
  companyName!: string;
  staffName!: string;
  numberOfEmployees!: number;
  email!: string;
}

export class VerifyEmailDto {
  sessionId!: string;
  verificationCode!: string;
}

export class ConfigureOutboundEmailDto {
  sessionId!: string;
  sendingEmail!: string;
  domain!: string;
  dkimSelector?: string;
}

export class RetryValidationDto {
  sessionId!: string;
  sendingEmail!: string;
  domain!: string;
  dkimSelector!: string;
}

export class CompleteRegistrationDto {
  sessionId!: string;
  password!: string;
}

export class GetDNSGuideDto {
  sessionId!: string;
  provider!: string; // namecheap, godaddy, route53, cloudflare, generic
}
