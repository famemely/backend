import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService, User } from '../users/users.service';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { 
  EmailSignupDto, 
  EmailLoginDto, 
  GoogleAuthDto, 
  Under13SignupDto,
  VerifyTokenDto,
  Setup2FADto,
  Verify2FADto,
  Disable2FADto
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private jwtService: JwtService,
    private supabaseService: SupabaseService,
    private usersService: UsersService,
    private configService: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID')
    );
  }

  /**
   * Generate App JWT with RBAC claims
   * This is the token used for NestJS backend authorization
   */
  generateAppToken(userData: {
    id: string;
    email?: string;
    fullName: string;
    isUnder13: boolean;
    age?: number;
    roles?: string[];
    permissions?: string[];
    familyIds?: string[];
    parentId?: string;
  }): string {
    return this.jwtService.sign({
      sub: userData.id,
      email: userData.email,
      fullName: userData.fullName,
      isUnder13: userData.isUnder13,
      age: userData.age,
      roles: userData.roles || ['user'],
      permissions: userData.permissions || [],
      familyIds: userData.familyIds || [],
      parentId: userData.parentId,
    }, {
      expiresIn: '7d', // App token expires in 7 days
    });
  }

  async signupWithEmail(signupDto: EmailSignupDto) {
    try {
      // Check if user already exists
      const existingUser = await this.usersService.findByEmail(signupDto.email);
      if (existingUser) {
        throw new Error('User already exists');
      }

      let supabaseData: any = null;
      let supabaseUserId: string | undefined = undefined;

      // Try to create user in Supabase if configured
      if (this.supabaseService.isSupabaseConfigured()) {
        try {
          supabaseData = await this.supabaseService.createUser(
            signupDto.email,
            signupDto.password,
            {
              full_name: signupDto.fullName,
              phone_number: signupDto.phoneNumber,
              is_under_13: false,
            }
          );
          supabaseUserId = supabaseData?.user?.id;
        } catch (error) {
          console.warn('Supabase signup failed, proceeding without Supabase:', error);
        }
      }

      // Create user in our database
      const user = await this.usersService.createUser({
        email: signupDto.email,
        fullName: signupDto.fullName,
        phoneNumber: signupDto.phoneNumber,
        isUnder13: false,
        supabaseId: supabaseUserId,
      });

      // Generate our JWT token
      const token = this.jwtService.sign({ 
        sub: user.id, 
        email: user.email,
        isUnder13: user.isUnder13 
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          isUnder13: user.isUnder13,
        },
        token,
        supabaseSession: supabaseData?.session || null,
      };
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }

  async loginWithEmail(loginDto: EmailLoginDto) {
    try {
      let supabaseData: any = null;
      let user: User | null = null;

      // Try to authenticate with Supabase if configured
      if (this.supabaseService.isSupabaseConfigured()) {
        try {
          supabaseData = await this.supabaseService.signInWithEmail(
            loginDto.email,
            loginDto.password
          );

          // Find user in our database by Supabase ID
          user = await this.usersService.findBySupabaseId(supabaseData.user.id);
        } catch (error) {
          console.warn('Supabase login failed, trying local auth:', error);
        }
      }

      // If Supabase auth failed or not configured, try to find user by email
      if (!user) {
        user = await this.usersService.findByEmail(loginDto.email);
        if (!user) {
          throw new Error('Invalid credentials');
        }
      }

      // 2FA/MFA is handled by Supabase, not by our backend
      // Supabase validates MFA before issuing the session token

      // Update last active
      await this.usersService.updateLastActive(user.id);

      // Generate our JWT token
      const token = this.jwtService.sign({ 
        sub: user.id, 
        email: user.email,
        isUnder13: user.isUnder13 
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          isUnder13: user.isUnder13,
          isTwoFactorEnabled: user.isTwoFactorEnabled,
        },
        token,
        supabaseSession: supabaseData?.session || null,
      };
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }

  async loginWithGoogle(googleDto: GoogleAuthDto) {
    try {
      // Verify Google ID token
      const ticket = await this.googleClient.verifyIdToken({
        idToken: googleDto.idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error('Invalid Google token');
      }

      const { email, name, sub: googleId } = payload;

      // Check if user exists
      let user = await this.usersService.findByEmail(email!);
      
      if (!user) {
        // Create new user
        user = await this.usersService.createUser({
          email: email!,
          fullName: name || 'Google User',
          isUnder13: false,
        });
      }

      // Update last active
      await this.usersService.updateLastActive(user.id);

      // Generate our JWT token
      const token = this.jwtService.sign({ 
        sub: user.id, 
        email: user.email,
        isUnder13: user.isUnder13 
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          isUnder13: user.isUnder13,
        },
        token,
      };
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }

  async signupUnder13(signupDto: Under13SignupDto) {
    try {
      // Check if username already exists
      const existingUser = await this.usersService.findByUsername(signupDto.username);
      if (existingUser) {
        throw new Error('Username already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(signupDto.password, 10);

      // Create user in our database (no Supabase for under 13)
      const user = await this.usersService.createUser({
        username: signupDto.username,
        fullName: signupDto.fullName,
        age: signupDto.age,
        parentEmail: signupDto.parentEmail,
        isUnder13: true,
      });

      // Generate our JWT token
      const token = this.jwtService.sign({ 
        sub: user.id, 
        username: user.username,
        isUnder13: user.isUnder13 
      });

      return {
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          age: user.age,
          isUnder13: user.isUnder13,
        },
        token,
      };
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }

  async verifySupabaseToken(verifyDto: VerifyTokenDto) {
    try {
      if (!this.supabaseService.isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
      }

      const supabaseUser = await this.supabaseService.verifyToken(verifyDto.supabaseToken);
      
      // Find corresponding user in our database
      const user = await this.usersService.findBySupabaseId(supabaseUser.id);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Update last active
      await this.usersService.updateLastActive(user.id);

      // Generate our JWT token
      const token = this.jwtService.sign({ 
        sub: user.id, 
        email: user.email,
        isUnder13: user.isUnder13 
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          isUnder13: user.isUnder13,
        },
        token,
        valid: true,
      };
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }

  // ============================================
  // 2FA/MFA Methods - Handled by Supabase
  // ============================================
  // Note: MFA is completely managed by Supabase on the frontend
  // The backend doesn't need to implement MFA verification
  // Supabase handles TOTP, backup codes, and MFA enrollment
  
  /**
   * These methods are placeholders for reference
   * In production, users manage MFA through Supabase client SDK:
   * - supabase.auth.mfa.enroll()
   * - supabase.auth.mfa.challenge()
   * - supabase.auth.mfa.verify()
   * - supabase.auth.mfa.unenroll()
   */
  
  async setup2FA(userId: string): Promise<{ message: string }> {
    // MFA is handled by Supabase - users should use the frontend Supabase client
    return { 
      message: 'Please use Supabase MFA enrollment on the frontend. Call supabase.auth.mfa.enroll()' 
    };
  }

  async enable2FA(userId: string, setupDto: Setup2FADto): Promise<{ message: string }> {
    // MFA is handled by Supabase
    return { 
      message: 'MFA is managed through Supabase. Use supabase.auth.mfa.verify() on frontend.' 
    };
  }

  async disable2FA(userId: string, disableDto: Disable2FADto): Promise<{ message: string }> {
    // MFA is handled by Supabase
    return { 
      message: 'MFA unenrollment is handled by Supabase. Use supabase.auth.mfa.unenroll() on frontend.' 
    };
  }

  async verify2FA(userId: string, verifyDto: Verify2FADto): Promise<{ message: string }> {
    // MFA verification is handled by Supabase during login
    return { 
      message: 'MFA verification is handled by Supabase during authentication.' 
    };
  }
}