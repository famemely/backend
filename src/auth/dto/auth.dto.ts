import { IsEmail, IsString, MinLength, IsOptional, IsBoolean, IsNumber, Min, Max } from 'class-validator';

export class EmailSignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(2)
  fullName: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

export class EmailLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  totpCode?: string;
}

export class GoogleAuthDto {
  @IsString()
  idToken: string;
}

export class Under13SignupDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(2)
  fullName: string;

  @IsNumber()
  @Min(1)
  @Max(12)
  age: number;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  parentEmail: string;
}

export class VerifyTokenDto {
  @IsString()
  supabaseToken: string;
}

export class Setup2FADto {
  @IsString()
  @MinLength(6)
  totpCode: string;
}

export class Verify2FADto {
  @IsString()
  @MinLength(6)
  totpCode: string;
}

export class Disable2FADto {
  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  totpCode?: string;
}