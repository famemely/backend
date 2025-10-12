// ============================================================================
// Family Board Guard
// Permission middleware for Family Board access control
// ============================================================================

import { 
  Injectable, 
  CanActivate, 
  ExecutionContext, 
  ForbiddenException,
  UnauthorizedException 
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../../supabase/supabase.service';
import { FamilyBoardPermissions } from '../interfaces/board.interface';

@Injectable()
export class FamilyBoardGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    try {
      // Extract and verify JWT token
      const token = this.extractTokenFromHeader(request);
      if (!token) {
        throw new UnauthorizedException('No authentication token provided');
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub || payload.id;
      
      if (!userId) {
        throw new UnauthorizedException('Invalid token payload');
      }

      // Add user info to request
      request.user = { id: userId, ...payload };

      // For routes that specify a family_id, check family membership
      const familyId = this.extractFamilyId(request);
      if (familyId) {
        const hasAccess = await this.checkFamilyAccess(userId, familyId);
        if (!hasAccess) {
          throw new ForbiddenException('Access denied to this family board');
        }

        // Get and attach user permissions for this family
        const permissions = await this.getFamilyPermissions(userId, familyId);
        request.permissions = permissions;
      }

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('Token validation failed');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) return undefined;

    const [type, token] = authHeader.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private extractFamilyId(request: any): string | undefined {
    // Try to get family_id from various sources
    return (
      request.params?.familyId ||
      request.params?.family_id ||
      request.body?.family_id ||
      request.query?.family_id
    );
  }

  private async checkFamilyAccess(userId: string, familyId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('family_members')
        .select('id')
        .eq('user_id', userId)
        .eq('family_id', familyId)
        .single();

      return !error && !!data;
    } catch (error) {
      return false;
    }
  }

  private async getFamilyPermissions(userId: string, familyId: string): Promise<FamilyBoardPermissions> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('family_members')
        .select('role, users!family_members_user_id_fkey(account_type)')
        .eq('user_id', userId)
        .eq('family_id', familyId)
        .single();

      if (error || !data) {
        return this.getDefaultPermissions();
      }

      const role = data.role;
      const userAccount = data.users as any;
      const accountType = userAccount?.account_type;

      return {
        canViewBoard: true,
        canPostToBoard: true,
        canEditPosts: role === 'head' || role === 'member',
        canDeletePosts: role === 'head',
        canPinPosts: role === 'head' || role === 'member',
        canModeratePosts: role === 'head' && accountType === 'adult',
        canManageAttachments: role === 'head' || role === 'member',
        canCreateReminders: true,
        canArchivePosts: role === 'head' || role === 'member',
      };
    } catch (error) {
      return this.getDefaultPermissions();
    }
  }

  private getDefaultPermissions(): FamilyBoardPermissions {
    return {
      canViewBoard: false,
      canPostToBoard: false,
      canEditPosts: false,
      canDeletePosts: false,
      canPinPosts: false,
      canModeratePosts: false,
      canManageAttachments: false,
      canCreateReminders: false,
      canArchivePosts: false,
    };
  }
}