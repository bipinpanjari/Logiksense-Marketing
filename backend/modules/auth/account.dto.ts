import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}


export class ChangePasswordDto {
  @IsNotEmpty()
  @IsString()
  currentPassword!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  newPassword!: string;
}


export class UpdateWorkspaceSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @IsNotEmpty()
  workspaceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  notifications?: {
    productUpdates?: boolean;
    campaignAlerts?: boolean;
    weeklyDigest?: boolean;
  };


  @IsOptional()
  scraper?: {
    noWebsiteSequenceId?: string;
    autoEnrollNoWebsite?: boolean;
  };

}
