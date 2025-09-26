import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { UsersService } from '../../users/users.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private supabaseService: SupabaseService,
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      // Check if Supabase is configured
      if (!this.supabaseService.isSupabaseConfigured()) {
        throw new UnauthorizedException('Supabase not configured');
      }

      // Verify token with Supabase
      const client = this.supabaseService.getClient();
      if (!client) {
        throw new UnauthorizedException('Supabase client not available');
      }

      const { data: { user }, error } = await client.auth.getUser(token);
      
      if (error || !user) {
        throw new UnauthorizedException('Invalid token');
      }

      // Get user data from our database
      const userData = await this.usersService.findBySupabaseId(user.id);
      if (!userData) {
        throw new UnauthorizedException('User not found');
      }

      // Attach user to request
      request.user = {
        id: userData.id,
        supabaseId: user.id,
        email: user.email,
        fullName: userData.fullName,
        isUnder13: userData.isUnder13,
        age: userData.age,
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException('Token verification failed');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}