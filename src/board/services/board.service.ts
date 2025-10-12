// ============================================================================
// Family Board Service
// Main service for Family Board CRUD operations
// Implements FR-5.1, FR-5.2, FR-5.3 requirements
// ============================================================================

import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { 
  BoardPost, 
  TodoListItem, 
  BoardQueryOptions, 
  CreatePostRequest, 
  UpdatePostRequest,
  CreateTodoItemRequest,
  UpdateTodoItemRequest,
  FamilyBoardPermissions,
  WebSocketBoardEvent
} from '../interfaces/board.interface';
import { 
  CreatePostDto, 
  UpdatePostDto, 
  CreateTodoItemDto, 
  UpdateTodoItemDto,
  BoardQueryDto,
  TogglePinDto,
  ModeratePostDto,
  ArchivePostDto,
  BulkOperationDto,
  BoardSearchDto
} from '../dto/board.dto';
import { SupabaseService } from '../../supabase/supabase.service';
import { BoardEncryptionService } from './board-encryption.service';

@Injectable()
export class BoardService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly encryptionService: BoardEncryptionService,
  ) {}

  /**
   * FR-5.1: Create a new board post
   */
  async createPost(createPostDto: CreatePostDto, authorId: string): Promise<BoardPost> {
    try {
      // Get family encryption key
      const familyKey = await this.encryptionService.getFamilyKey(createPostDto.family_id);
      
      // Encrypt content
      const encryptedContent = await this.encryptionService.encryptText(createPostDto.content, familyKey);
      const encryptedTitle = createPostDto.title 
        ? await this.encryptionService.encryptText(createPostDto.title, familyKey)
        : null;
      
      if (!encryptedContent.success) {
        throw new BadRequestException('Failed to encrypt post content');
      }

      // Prepare metadata
      let encryptedMetadata = null;
      if (createPostDto.metadata) {
        const metadataResult = await this.encryptionService.encryptText(
          JSON.stringify(createPostDto.metadata), 
          familyKey
        );
        if (metadataResult.success) {
          encryptedMetadata = metadataResult.encrypted_data;
        }
      }

      // Check if post needs moderation (for child users)
      const isModerated = await this.needsModeration(authorId, createPostDto.family_id);
      
      const { data, error } = await this.supabaseService.client
        .rpc('create_board_post', {
          _family_id: createPostDto.family_id,
          _author_id: authorId,
          _post_type: createPostDto.post_type,
          _title_encrypted: encryptedTitle?.encrypted_data || null,
          _content_encrypted: encryptedContent.encrypted_data,
          _metadata_encrypted: encryptedMetadata,
          _is_moderated: isModerated,
          _moderation_status: isModerated ? 'pending' : 'approved'
        });

      if (error) {
        throw new BadRequestException(`Failed to create post: ${error.message}`);
      }

      const post = data as BoardPost;

      // Create reminder if specified
      if (createPostDto.reminder_time && createPostDto.post_type === 'reminder') {
        await this.createReminder(post.id, {
          reminder_time: new Date(createPostDto.reminder_time),
          reminder_type: createPostDto.reminder_type || 'once',
          is_all_family: createPostDto.is_all_family_reminder || false
        });
      }

      return post;
    } catch (error) {
      throw new BadRequestException(`Failed to create post: ${error.message}`);
    }
  }

  /**
   * FR-5.3: Get board posts with filtering and pagination
   */
  async getBoardPosts(queryDto: BoardQueryDto): Promise<{ posts: BoardPost[]; total: number }> {
    try {
      const { data, error } = await this.supabaseService.client
        .rpc('get_family_board_posts', {
          _family_id: queryDto.family_id,
          _post_type: queryDto.post_type || null,
          _is_pinned: queryDto.is_pinned || null,
          _moderation_status: queryDto.moderation_status || null,
          _author_id: queryDto.author_id || null,
          _limit: queryDto.limit || 20,
          _offset: queryDto.offset || 0,
          _include_archived: queryDto.include_archived || false,
          _search_query: queryDto.search_query || null
        });

      if (error) {
        throw new BadRequestException(`Failed to fetch posts: ${error.message}`);
      }

      const posts = data?.posts || [];
      const total = data?.total || 0;

      return { posts, total };
    } catch (error) {
      throw new BadRequestException(`Failed to fetch posts: ${error.message}`);
    }
  }

  /**
   * FR-5.2: Update a board post
   */
  async updatePost(postId: string, updatePostDto: UpdatePostDto, editorId: string): Promise<BoardPost> {
    try {
      // Get the post to check permissions
      const post = await this.getPostById(postId);
      if (!post) {
        throw new NotFoundException('Post not found');
      }

      // Check permissions
      const canEdit = await this.canEditPost(editorId, post);
      if (!canEdit) {
        throw new ForbiddenException('You do not have permission to edit this post');
      }

      // Get family encryption key
      const familyKey = await this.encryptionService.getFamilyKey(post.family_id);
      
      // Encrypt new content if provided
      let encryptedContent = null;
      let encryptedTitle = null;

      if (updatePostDto.content) {
        const contentResult = await this.encryptionService.encryptText(updatePostDto.content, familyKey);
        if (!contentResult.success) {
          throw new BadRequestException('Failed to encrypt content');
        }
        encryptedContent = contentResult.encrypted_data;
      }

      if (updatePostDto.title) {
        const titleResult = await this.encryptionService.encryptText(updatePostDto.title, familyKey);
        if (titleResult.success) {
          encryptedTitle = titleResult.encrypted_data;
        }
      }

      // Save edit history
      await this.saveEditHistory(postId, editorId, post, updatePostDto.edit_reason);

      const { data, error } = await this.supabaseService.client
        .rpc('update_board_post', {
          _post_id: postId,
          _title_encrypted: encryptedTitle,
          _content_encrypted: encryptedContent,
          _metadata_encrypted: updatePostDto.metadata ? JSON.stringify(updatePostDto.metadata) : null,
          _edited_by: editorId
        });

      if (error) {
        throw new BadRequestException(`Failed to update post: ${error.message}`);
      }

      return data as BoardPost;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update post: ${error.message}`);
    }
  }

  /**
   * FR-5.2: Delete a board post
   */
  async deletePost(postId: string, deleterId: string): Promise<void> {
    try {
      const post = await this.getPostById(postId);
      if (!post) {
        throw new NotFoundException('Post not found');
      }

      const canDelete = await this.canDeletePost(deleterId, post);
      if (!canDelete) {
        throw new ForbiddenException('You do not have permission to delete this post');
      }

      const { error } = await this.supabaseService.client
        .rpc('delete_board_post', {
          _post_id: postId,
          _deleted_by: deleterId
        });

      if (error) {
        throw new BadRequestException(`Failed to delete post: ${error.message}`);
      }
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to delete post: ${error.message}`);
    }
  }

  /**
   * FR-5.2: Toggle post pin status
   */
  async togglePin(togglePinDto: TogglePinDto, userId: string): Promise<BoardPost> {
    try {
      const post = await this.getPostById(togglePinDto.post_id);
      if (!post) {
        throw new NotFoundException('Post not found');
      }

      const canPin = await this.canPinPost(userId, post.family_id);
      if (!canPin) {
        throw new ForbiddenException('You do not have permission to pin posts');
      }

      const { data, error } = await this.supabaseService.client
        .rpc('toggle_post_pin', {
          _post_id: togglePinDto.post_id,
          _is_pinned: togglePinDto.is_pinned,
          _pinned_by: userId
        });

      if (error) {
        throw new BadRequestException(`Failed to toggle pin: ${error.message}`);
      }

      return data as BoardPost;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to toggle pin: ${error.message}`);
    }
  }

  /**
   * FR-5.2: Moderate a post (approve/reject)
   */
  async moderatePost(moderatePostDto: ModeratePostDto, moderatorId: string): Promise<BoardPost> {
    try {
      const post = await this.getPostById(moderatePostDto.post_id);
      if (!post) {
        throw new NotFoundException('Post not found');
      }

      const canModerate = await this.canModeratePost(moderatorId, post.family_id);
      if (!canModerate) {
        throw new ForbiddenException('You do not have permission to moderate posts');
      }

      const { data, error } = await this.supabaseService.client
        .rpc('moderate_board_post', {
          _post_id: moderatePostDto.post_id,
          _moderation_status: moderatePostDto.moderation_status,
          _moderated_by: moderatorId,
          _moderation_reason: moderatePostDto.moderation_reason || null
        });

      if (error) {
        throw new BadRequestException(`Failed to moderate post: ${error.message}`);
      }

      return data as BoardPost;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to moderate post: ${error.message}`);
    }
  }

  /**
   * FR-5.1: Create todo list item
   */
  async createTodoItem(createTodoDto: CreateTodoItemDto, userId: string): Promise<TodoListItem> {
    try {
      const post = await this.getPostById(createTodoDto.post_id);
      if (!post) {
        throw new NotFoundException('Post not found');
      }

      if (post.post_type !== 'todo_list') {
        throw new BadRequestException('Can only add todo items to todo list posts');
      }

      // Get family encryption key
      const familyKey = await this.encryptionService.getFamilyKey(post.family_id);
      
      // Encrypt todo text
      const encryptedText = await this.encryptionService.encryptText(createTodoDto.item_text, familyKey);
      if (!encryptedText.success) {
        throw new BadRequestException('Failed to encrypt todo item');
      }

      const { data, error } = await this.supabaseService.client
        .rpc('create_todo_item', {
          _post_id: createTodoDto.post_id,
          _item_text_encrypted: encryptedText.encrypted_data,
          _sort_order: createTodoDto.sort_order || 0,
          _created_by: userId
        });

      if (error) {
        throw new BadRequestException(`Failed to create todo item: ${error.message}`);
      }

      return data as TodoListItem;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create todo item: ${error.message}`);
    }
  }

  /**
   * FR-5.1: Update todo list item
   */
  async updateTodoItem(todoId: string, updateTodoDto: UpdateTodoItemDto, userId: string): Promise<TodoListItem> {
    try {
      const todo = await this.getTodoItemById(todoId);
      if (!todo) {
        throw new NotFoundException('Todo item not found');
      }

      const post = await this.getPostById(todo.post_id);
      const familyKey = await this.encryptionService.getFamilyKey(post.family_id);

      let encryptedText = null;
      if (updateTodoDto.item_text) {
        const textResult = await this.encryptionService.encryptText(updateTodoDto.item_text, familyKey);
        if (textResult.success) {
          encryptedText = textResult.encrypted_data;
        }
      }

      const { data, error } = await this.supabaseService.client
        .rpc('update_todo_item', {
          _todo_id: todoId,
          _item_text_encrypted: encryptedText,
          _is_completed: updateTodoDto.is_completed,
          _sort_order: updateTodoDto.sort_order,
          _updated_by: userId
        });

      if (error) {
        throw new BadRequestException(`Failed to update todo item: ${error.message}`);
      }

      return data as TodoListItem;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update todo item: ${error.message}`);
    }
  }

  /**
   * Get todo items for a post
   */
  async getTodoItems(postId: string): Promise<TodoListItem[]> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('todo_list_items')
        .select('*')
        .eq('post_id', postId)
        .order('sort_order', { ascending: true });

      if (error) {
        throw new BadRequestException(`Failed to fetch todo items: ${error.message}`);
      }

      return data as TodoListItem[];
    } catch (error) {
      throw new BadRequestException(`Failed to fetch todo items: ${error.message}`);
    }
  }

  /**
   * FR-5.3: Search board posts
   */
  async searchPosts(searchDto: BoardSearchDto): Promise<{ posts: BoardPost[]; total: number }> {
    try {
      const { data, error } = await this.supabaseService.client
        .rpc('search_board_posts', {
          _family_id: searchDto.family_id,
          _search_query: searchDto.query,
          _post_type: searchDto.post_type || null,
          _limit: searchDto.limit || 10,
          _offset: searchDto.offset || 0
        });

      if (error) {
        throw new BadRequestException(`Failed to search posts: ${error.message}`);
      }

      const posts = data?.posts || [];
      const total = data?.total || 0;

      return { posts, total };
    } catch (error) {
      throw new BadRequestException(`Failed to search posts: ${error.message}`);
    }
  }

  /**
   * Archive/unarchive post
   */
  async archivePost(archiveDto: ArchivePostDto, userId: string): Promise<BoardPost> {
    try {
      const post = await this.getPostById(archiveDto.post_id);
      if (!post) {
        throw new NotFoundException('Post not found');
      }

      const canArchive = await this.canArchivePost(userId, post);
      if (!canArchive) {
        throw new ForbiddenException('You do not have permission to archive this post');
      }

      const { data, error } = await this.supabaseService.client
        .rpc('archive_board_post', {
          _post_id: archiveDto.post_id,
          _is_archived: archiveDto.is_archived,
          _archived_by: userId
        });

      if (error) {
        throw new BadRequestException(`Failed to archive post: ${error.message}`);
      }

      return data as BoardPost;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Failed to archive post: ${error.message}`);
    }
  }

  // Helper methods

  private async getPostById(postId: string): Promise<BoardPost | null> {
    const { data, error } = await this.supabaseService.client
      .from('board_posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as BoardPost;
  }

  private async getTodoItemById(todoId: string): Promise<TodoListItem | null> {
    const { data, error } = await this.supabaseService.client
      .from('todo_list_items')
      .select('*')
      .eq('id', todoId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as TodoListItem;
  }

  private async needsModeration(userId: string, familyId: string): Promise<boolean> {
    // Check if user is a child - child posts need moderation
    const { data, error } = await this.supabaseService.client
      .from('family_members')
      .select('role, users!family_members_user_id_fkey(account_type)')
      .eq('user_id', userId)
      .eq('family_id', familyId)
      .single();

    if (error || !data) {
      return true; // Default to moderation if we can't determine
    }

    const userAccount = data.users as any;
    return userAccount?.account_type === 'child';
  }

  private async canEditPost(userId: string, post: BoardPost): Promise<boolean> {
    // Users can edit their own posts, or family heads/moderators can edit any post
    if (post.author_id === userId) {
      return true;
    }

    const permissions = await this.getUserPermissions(userId, post.family_id);
    return permissions.canEditPosts;
  }

  private async canDeletePost(userId: string, post: BoardPost): Promise<boolean> {
    // Users can delete their own posts, or family heads can delete any post
    if (post.author_id === userId) {
      return true;
    }

    const permissions = await this.getUserPermissions(userId, post.family_id);
    return permissions.canDeletePosts;
  }

  private async canPinPost(userId: string, familyId: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId, familyId);
    return permissions.canPinPosts;
  }

  private async canModeratePost(userId: string, familyId: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId, familyId);
    return permissions.canModeratePosts;
  }

  private async canArchivePost(userId: string, post: BoardPost): Promise<boolean> {
    if (post.author_id === userId) {
      return true;
    }

    const permissions = await this.getUserPermissions(userId, post.family_id);
    return permissions.canArchivePosts;
  }

  private async getUserPermissions(userId: string, familyId: string): Promise<FamilyBoardPermissions> {
    const { data, error } = await this.supabaseService.client
      .from('family_members')
      .select('role, users!family_members_user_id_fkey(account_type)')
      .eq('user_id', userId)
      .eq('family_id', familyId)
      .single();

    if (error || !data) {
      // Default permissions for non-members
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
  }

  private async saveEditHistory(postId: string, editorId: string, originalPost: BoardPost, editReason?: string): Promise<void> {
    await this.supabaseService.client
      .from('board_post_edits')
      .insert({
        post_id: postId,
        edited_by: editorId,
        previous_content_encrypted: originalPost.content_encrypted,
        previous_title_encrypted: originalPost.title_encrypted,
        edit_reason: editReason,
      });
  }

  private async createReminder(postId: string, reminderData: {
    reminder_time: Date;
    reminder_type: string;
    is_all_family: boolean;
  }): Promise<void> {
    await this.supabaseService.client
      .from('board_post_reminders')
      .insert({
        post_id: postId,
        reminder_time: reminderData.reminder_time.toISOString(),
        reminder_type: reminderData.reminder_type,
        is_all_family: reminderData.is_all_family,
      });
  }
}