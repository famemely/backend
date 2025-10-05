import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  Max
} from 'class-validator'

export class EmailSignupDto {
  @IsEmail()
  email: string

  @IsString()
  @MinLength(6)
  password: string

  @IsString()
  @MinLength(2)
  fullName: string

  @IsOptional()
  @IsString()
  phoneNumber?: string

  @IsOptional()
  @IsString()
  // Expecting ISO date string YYYY-MM-DD
  dateOfBirth?: string
}

export class EmailLoginDto {
  @IsEmail()
  email: string

  @IsString()
  password: string

  @IsOptional()
  @IsString()
  totpCode?: string
}

export class GoogleAuthDto {
  @IsString()
  idToken: string
}

// Under13SignupDto removed — children/under-13 signup flow discontinued.

export class VerifyTokenDto {
  @IsString()
  supabaseToken: string
}

export class Setup2FADto {
  @IsString()
  @MinLength(6)
  totpCode: string
}

export class Verify2FADto {
  @IsString()
  @MinLength(6)
  totpCode: string
}

export class Disable2FADto {
  @IsString()
  password: string

  @IsOptional()
  @IsString()
  totpCode?: string
}
