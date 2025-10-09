// ============================================================================
// Board Operations Guards
// Specific permission guards for board operations
// ============================================================================

import { 
  Injectable, 
  CanActivate, 
  ExecutionContext, 
  ForbiddenException,
  createParamDecorator 
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FamilyBoardPermissions } from '../interfaces/board.interface';

// Custom decorator to get permissions from request
export const Permissions = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): FamilyBoardPermissions => {
    const request = ctx.switchToHttp().getRequest();
    return request.permissions;
  },
);

// Custom decorator to get current user
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// Permission requirement decorator
export const RequirePermission = (permission: keyof FamilyBoardPermissions) => 
  Reflector.createDecorator<keyof FamilyBoardPermissions>({ key: permission });

@Injectable()
export class PostCreationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const permissions: FamilyBoardPermissions = request.permissions;
    
    if (!permissions?.canPostToBoard) {
      throw new ForbiddenException('You do not have permission to create posts on this board');
    }
    
    return true;
  }
}

@Injectable()
export class PostEditGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const permissions: FamilyBoardPermissions = request.permissions;
    
    if (!permissions?.canEditPosts) {
      throw new ForbiddenException('You do not have permission to edit posts');
    }
    
    return true;
  }
}

@Injectable()
export class PostDeletionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const permissions: FamilyBoardPermissions = request.permissions;
    
    if (!permissions?.canDeletePosts) {
      throw new ForbiddenException('You do not have permission to delete posts');
    }
    
    return true;
  }
}

@Injectable()
export class PostPinGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const permissions: FamilyBoardPermissions = request.permissions;
    
    if (!permissions?.canPinPosts) {
      throw new ForbiddenException('You do not have permission to pin posts');
    }
    
    return true;
  }
}

@Injectable()
export class PostModerationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const permissions: FamilyBoardPermissions = request.permissions;
    
    if (!permissions?.canModeratePosts) {
      throw new ForbiddenException('You do not have permission to moderate posts');
    }
    
    return true;
  }
}

@Injectable()
export class AttachmentManagementGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const permissions: FamilyBoardPermissions = request.permissions;
    
    if (!permissions?.canManageAttachments) {
      throw new ForbiddenException('You do not have permission to manage attachments');
    }
    
    return true;
  }
}

@Injectable()
export class ReminderCreationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const permissions: FamilyBoardPermissions = request.permissions;
    
    if (!permissions?.canCreateReminders) {
      throw new ForbiddenException('You do not have permission to create reminders');
    }
    
    return true;
  }
}

@Injectable()
export class PostArchiveGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const permissions: FamilyBoardPermissions = request.permissions;
    
    if (!permissions?.canArchivePosts) {
      throw new ForbiddenException('You do not have permission to archive posts');
    }
    
    return true;
  }
}

@Injectable()
export class BoardViewGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const permissions: FamilyBoardPermissions = request.permissions;
    
    if (!permissions?.canViewBoard) {
      throw new ForbiddenException('You do not have permission to view this board');
    }
    
    return true;
  }
}