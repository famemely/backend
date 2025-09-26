import { Controller, Post, Body, Get, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('exchange-token')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Exchange Supabase JWT for App JWT with RBAC' })
  @ApiResponse({ status: 200, description: 'Token exchanged successfully' })
  @ApiResponse({ status: 401, description: 'Invalid Supabase token' })
  async exchangeToken(@Request() req) {
    try {
      // Extract user data from the validated Supabase token
      const supabaseUser = req.user;
      
      // Create app-specific JWT with RBAC claims
      const appToken = this.authService.generateAppToken({
        id: supabaseUser.id,
        email: supabaseUser.email,
        fullName: supabaseUser.fullName,
        isUnder13: supabaseUser.isUnder13 || false,
        age: supabaseUser.age,
        roles: supabaseUser.roles || ['user'],
        permissions: supabaseUser.permissions || [],
        familyIds: supabaseUser.familyIds || [],
        parentId: supabaseUser.parentId,
      });

      return {
        appToken,
        user: {
          id: supabaseUser.id,
          email: supabaseUser.email,
          fullName: supabaseUser.fullName,
          isUnder13: supabaseUser.isUnder13 || false,
          age: supabaseUser.age,
          roles: supabaseUser.roles || ['user'],
          permissions: supabaseUser.permissions || [],
          familyIds: supabaseUser.familyIds || [],
          parentId: supabaseUser.parentId,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Token exchange failed');
    }
  }

  @Get('profile')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Get user profile (for backend data if needed)' })
  async getProfile(@Request() req) {
    return {
      user: {
        id: req.user.id,
        email: req.user.email,
        fullName: req.user.fullName,
        isUnder13: req.user.isUnder13,
        age: req.user.age,
      }
    };
  }

  @Post('sync-user')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Sync user data from Supabase to backend (if needed for business logic)' })
  async syncUser(@Request() req) {
    try {
      // This could be used to sync user data to your backend database
      // when you need to store additional app-specific data
      return {
        success: true,
        message: 'User data synced successfully',
        user: req.user,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to sync user data',
        error: error.message,
      };
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check for auth service' })
  async healthCheck() {
    return {
      status: 'ok',
      message: 'Auth service is running',
      timestamp: new Date().toISOString(),
    };
  }
}