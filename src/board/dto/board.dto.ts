// ============================================================================
// Family Board DTOs (Data Transfer Objects)
// Input validation and data transfer for Family Board API
// ============================================================================

import { IsString, IsOptional, IsEnum, IsBoolean, IsDateString, IsNumber, IsArray, IsUUID, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PostType, ModerationStatus } from '../interfaces/board.interface';

export class CreatePostDto {
  @IsUUID()
  family_id: string;

  @IsEnum(['text', 'todo_list', 'reminder', 'photo'])
  post_type: PostType;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content: string;

  @IsOptional()
  metadata?: any;

  @IsOptional()
  @IsDateString()
  reminder_time?: string;

  @IsOptional()
  @IsEnum(['once', 'daily', 'weekly', 'monthly'])
  reminder_type?: 'once' | 'daily' | 'weekly' | 'monthly';

  @IsOptional()
  @IsBoolean()
  is_all_family_reminder?: boolean;
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content?: string;

  @IsOptional()
  metadata?: any;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  edit_reason?: string;
}

export class CreateTodoItemDto {
  @IsUUID()
  post_id: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  item_text: string;

  @IsOptional()
  @IsNumber()
  sort_order?: number;
}

export class UpdateTodoItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  item_text?: string;

  @IsOptional()
  @IsBoolean()
  is_completed?: boolean;

  @IsOptional()
  @IsNumber()
  sort_order?: number;
}

export class TogglePinDto {
  @IsUUID()
  post_id: string;

  @IsBoolean()
  is_pinned: boolean;
}

export class ModeratePostDto {
  @IsUUID()
  post_id: string;

  @IsEnum(['approved', 'rejected'])
  moderation_status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  moderation_reason?: string;
}

export class BoardQueryDto {
  @IsUUID()
  family_id: string;

  @IsOptional()
  @IsEnum(['text', 'todo_list', 'reminder', 'photo'])
  post_type?: PostType;

  @IsOptional()
  @IsBoolean()
  is_pinned?: boolean;

  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected'])
  moderation_status?: ModerationStatus;

  @IsOptional()
  @IsUUID()
  author_id?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  offset?: number = 0;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  include_archived?: boolean = false;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  search_query?: string;
}

export class ArchivePostDto {
  @IsUUID()
  post_id: string;

  @IsBoolean()
  is_archived: boolean;
}

export class BulkOperationDto {
  @IsArray()
  @IsUUID({}, { each: true })
  post_ids: string[];

  @IsEnum(['pin', 'unpin', 'archive', 'unarchive', 'delete'])
  operation: 'pin' | 'unpin' | 'archive' | 'unarchive' | 'delete';
}

export class BoardSearchDto {
  @IsUUID()
  family_id: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  query: string;

  @IsOptional()
  @IsEnum(['text', 'todo_list', 'reminder', 'photo'])
  post_type?: PostType;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  offset?: number = 0;
}

export class CreateReminderDto {
  @IsUUID()
  post_id: string;

  @IsDateString()
  reminder_time: string;

  @IsEnum(['once', 'daily', 'weekly', 'monthly'])
  reminder_type: 'once' | 'daily' | 'weekly' | 'monthly';

  @IsBoolean()
  is_all_family: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID({}, { each: true })
  target_users?: string[];
}