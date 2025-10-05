import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  UnauthorizedException
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { SupabaseAuthGuard } from './guards/supabase-auth.guard'

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
      // Guard has already verified Supabase token and attached user to req.user
      const supabaseUser = req.user

      if (!supabaseUser) {
        throw new UnauthorizedException('User not found in request')
      }

      // Generate app-specific JWT with user claims
      const appToken = this.authService.generateAppToken({
        id: supabaseUser.supabaseId, // Use Supabase ID as the primary ID
        email: supabaseUser.email,
        fullName: supabaseUser.fullName,
        age: supabaseUser.age,
        dateOfBirth: supabaseUser.dateOfBirth,
        roles: supabaseUser.roles || ['user'],
        permissions: supabaseUser.permissions || [],
        familyIds: supabaseUser.familyIds || [],
        parentId: supabaseUser.parentId
      })

      return {
        appToken,
        user: {
          id: supabaseUser.supabaseId,
          email: supabaseUser.email,
          fullName: supabaseUser.fullName,
          age: supabaseUser.age,
          dateOfBirth: supabaseUser.dateOfBirth,
          roles: supabaseUser.roles || ['user'],
          permissions: supabaseUser.permissions || [],
          familyIds: supabaseUser.familyIds || [],
          parentId: supabaseUser.parentId
        }
      }
    } catch (error) {
      throw new UnauthorizedException('Token exchange failed')
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check for auth service' })
  async healthCheck() {
    return {
      status: 'ok',
      message: 'Auth service is running',
      timestamp: new Date().toISOString()
    }
  }
}
