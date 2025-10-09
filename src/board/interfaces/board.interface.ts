// ============================================================================
// Family Board Interfaces
// Server-side TypeScript interfaces for Family Board functionality
// ============================================================================

export type PostType = 'text' | 'todo_list' | 'reminder' | 'photo';
export type ModerationStatus = 'pending' | 'approved' | 'rejected';

export interface BoardPost {
  id: string;
  family_id: string;
  author_id: string;
  author_name?: string;
  author_avatar_url?: string;
  post_type: PostType;
  title_encrypted?: string;
  content_encrypted: string;
  metadata_encrypted?: string;
  is_pinned: boolean;
  is_moderated: boolean;
  moderation_status: ModerationStatus;
  moderated_by?: string;
  moderated_at?: Date;
  created_at: Date;
  updated_at: Date;
  archived_at?: Date;
  attachment_count: number;
  todo_items_count: number;
  completed_todos_count: number;
}

export interface TodoListItem {
  id: string;
  post_id: string;
  item_text_encrypted: string;
  item_text?: string; // Decrypted version (not stored)
  is_completed: boolean;
  completed_by?: string;
  completed_by_name?: string;
  completed_at?: Date;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface BoardPostAttachment {
  id: string;
  post_id: string;
  filename: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: Date;
}

export interface BoardPostReminder {
  id: string;
  post_id: string;
  reminder_time: Date;
  reminder_type: 'once' | 'daily' | 'weekly' | 'monthly';
  is_all_family: boolean;
  reminded_users?: string[];
  created_at: Date;
  updated_at: Date;
}

export interface BoardPostEdit {
  id: string;
  post_id: string;
  edited_by: string;
  edited_by_name?: string;
  previous_content_encrypted: string;
  previous_title_encrypted?: string;
  edit_reason?: string;
  created_at: Date;
}

export interface FamilyEncryptionKey {
  id: string;
  family_id: string;
  key_encrypted: string;
  algorithm: string;
  created_by: string;
  created_at: Date;
  is_active: boolean;
}

// Request/Response interfaces
export interface CreatePostRequest {
  family_id: string;
  post_type: PostType;
  title?: string;
  content: string;
  metadata?: any;
  attachments?: any[]; // File attachments
  reminder_time?: Date;
  reminder_type?: 'once' | 'daily' | 'weekly' | 'monthly';
  is_all_family_reminder?: boolean;
}

export interface UpdatePostRequest {
  title?: string;
  content?: string;
  metadata?: any;
  edit_reason?: string;
}

export interface CreateTodoItemRequest {
  post_id: string;
  item_text: string;
  sort_order?: number;
}

export interface UpdateTodoItemRequest {
  item_text?: string;
  is_completed?: boolean;
  sort_order?: number;
}

export interface BoardQueryOptions {
  family_id: string;
  post_type?: PostType;
  is_pinned?: boolean;
  moderation_status?: ModerationStatus;
  author_id?: string;
  limit?: number;
  offset?: number;
  include_archived?: boolean;
  search_query?: string;
}

export interface EncryptionResult {
  encrypted_data: string;
  success: boolean;
  error?: string;
}

export interface DecryptionResult {
  decrypted_data: string;
  success: boolean;
  error?: string;
}

export interface FamilyBoardPermissions {
  canViewBoard: boolean;
  canPostToBoard: boolean;
  canEditPosts: boolean;
  canDeletePosts: boolean;
  canPinPosts: boolean;
  canModeratePosts: boolean;
  canManageAttachments: boolean;
  canCreateReminders: boolean;
  canArchivePosts: boolean;
}

export interface WebSocketBoardEvent {
  type: 'post_created' | 'post_updated' | 'post_deleted' | 'post_pinned' | 'todo_updated' | 'moderation_updated';
  family_id: string;
  data: any;
  timestamp: Date;
  user_id: string;
}