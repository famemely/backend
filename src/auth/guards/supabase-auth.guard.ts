import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException
} from '@nestjs/common'
import { SupabaseService } from '../../supabase/supabase.service'

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const token = this.extractTokenFromHeader(request)

    if (!token) {
      throw new UnauthorizedException('No token provided')
    }

    try {
      // Check if Supabase is configured
      if (!this.supabaseService.isSupabaseConfigured()) {
        throw new UnauthorizedException('Supabase not configured')
      }

      // Verify token with Supabase
      const client = this.supabaseService.getClient()
      if (!client) {
        throw new UnauthorizedException('Supabase client not available')
      }

      const {
        data: { user },
        error
      } = await client.auth.getUser(token)

      if (error || !user) {
        throw new UnauthorizedException('Invalid token')
      }

      // Extract user metadata from Supabase
      const metadata = user.user_metadata || {}

      // Attach verified Supabase user to request
      request.user = {
        supabaseId: user.id,
        email: user.email,
        fullName:
          metadata.full_name ||
          metadata.fullName ||
          user.email?.split('@')[0] ||
          'User',
        // isUnder13 flag removed — age/dateOfBirth should be used instead
        age: metadata.age ? Number(metadata.age) : undefined,
        dateOfBirth:
          metadata.date_of_birth || metadata.dateOfBirth || undefined,
        roles: metadata.roles || ['user'],
        permissions: metadata.permissions || [],
        familyIds: metadata.familyIds || [],
        parentId: metadata.parentId
      }

      return true
    } catch (error) {
      throw new UnauthorizedException(
        'Token verification failed: ' + (error?.message || 'unknown')
      )
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? []
    return type === 'Bearer' ? token : undefined
  }
}
