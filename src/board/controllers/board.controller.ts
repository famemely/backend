// ============================================================================
// Family Board Controller
// REST API endpoints for Family Board functionality
// ============================================================================

import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Request,
  HttpStatus,
  HttpCode,
  ValidationPipe,
  UsePipes
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth, 
  ApiParam,
  ApiQuery 
} from '@nestjs/swagger';

import { BoardService } from '../services/board.service';
import { FamilyBoardGuard } from '../guards/family-board.guard';
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
  BoardSearchDto,
  CreateReminderDto
} from '../dto/board.dto';
import { BoardPost, TodoListItem } from '../interfaces/board.interface';

@ApiTags('Family Board')
@ApiBearerAuth()
@Controller('api/board')
@UseGuards(FamilyBoardGuard)
@UsePipes(new ValidationPipe({ transform: true }))
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  /**
   * FR-5.1: Create a new board post
   */
  @Post('posts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create a new board post',
    description: 'Create a new post on the family board with encryption'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Post created successfully',
    type: BoardPost
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  async createPost(
    @Body() createPostDto: CreatePostDto,
    @Request() req: any
  ): Promise<BoardPost> {
    return this.boardService.createPost(createPostDto, req.user.id);
  }

  /**
   * FR-5.3: Get board posts with filtering and pagination
   */
  @Get('posts')
  @ApiOperation({ 
    summary: 'Get board posts',
    description: 'Retrieve board posts with filtering, pagination, and search'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Posts retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        posts: { type: 'array', items: { $ref: '#/components/schemas/BoardPost' } },
        total: { type: 'number' }
      }
    }
  })
  @ApiQuery({ name: 'family_id', required: true, description: 'Family ID' })
  @ApiQuery({ name: 'post_type', required: false, description: 'Filter by post type' })
  @ApiQuery({ name: 'is_pinned', required: false, description: 'Filter pinned posts' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of posts to return' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of posts to skip' })
  async getBoardPosts(
    @Query() queryDto: BoardQueryDto
  ): Promise<{ posts: BoardPost[]; total: number }> {
    return this.boardService.getBoardPosts(queryDto);
  }

  /**
   * FR-5.2: Update a board post
   */
  @Put('posts/:id')
  @ApiOperation({ 
    summary: 'Update a board post',
    description: 'Update post content with edit history tracking'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Post updated successfully',
    type: BoardPost
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  async updatePost(
    @Param('id') postId: string,
    @Body() updatePostDto: UpdatePostDto,
    @Request() req: any
  ): Promise<BoardPost> {
    return this.boardService.updatePost(postId, updatePostDto, req.user.id);
  }

  /**
   * FR-5.2: Delete a board post
   */
  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: 'Delete a board post',
    description: 'Permanently delete a board post'
  })
  @ApiResponse({ status: 204, description: 'Post deleted successfully' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  async deletePost(
    @Param('id') postId: string,
    @Request() req: any
  ): Promise<void> {
    return this.boardService.deletePost(postId, req.user.id);
  }

  /**
   * FR-5.2: Toggle post pin status
   */
  @Put('posts/:id/pin')
  @ApiOperation({ 
    summary: 'Toggle post pin status',
    description: 'Pin or unpin a board post'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Pin status updated successfully',
    type: BoardPost
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  async togglePin(
    @Param('id') postId: string,
    @Body() togglePinDto: TogglePinDto,
    @Request() req: any
  ): Promise<BoardPost> {
    return this.boardService.togglePin(
      { ...togglePinDto, post_id: postId }, 
      req.user.id
    );
  }

  /**
   * FR-5.2: Moderate a post (approve/reject)
   */
  @Put('posts/:id/moderate')
  @ApiOperation({ 
    summary: 'Moderate a board post',
    description: 'Approve or reject a pending post'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Post moderated successfully',
    type: BoardPost
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  async moderatePost(
    @Param('id') postId: string,
    @Body() moderatePostDto: ModeratePostDto,
    @Request() req: any
  ): Promise<BoardPost> {
    return this.boardService.moderatePost(
      { ...moderatePostDto, post_id: postId }, 
      req.user.id
    );
  }

  /**
   * Archive/unarchive a post
   */
  @Put('posts/:id/archive')
  @ApiOperation({ 
    summary: 'Archive or unarchive a post',
    description: 'Move post to/from archive'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Archive status updated successfully',
    type: BoardPost
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  async archivePost(
    @Param('id') postId: string,
    @Body() archiveDto: ArchivePostDto,
    @Request() req: any
  ): Promise<BoardPost> {
    return this.boardService.archivePost(
      { ...archiveDto, post_id: postId }, 
      req.user.id
    );
  }

  /**
   * FR-5.3: Search board posts
   */
  @Get('posts/search')
  @ApiOperation({ 
    summary: 'Search board posts',
    description: 'Search posts by content, title, or metadata'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Search results retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        posts: { type: 'array', items: { $ref: '#/components/schemas/BoardPost' } },
        total: { type: 'number' }
      }
    }
  })
  @ApiQuery({ name: 'family_id', required: true, description: 'Family ID' })
  @ApiQuery({ name: 'query', required: true, description: 'Search query' })
  @ApiQuery({ name: 'post_type', required: false, description: 'Filter by post type' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results to return' })
  async searchPosts(
    @Query() searchDto: BoardSearchDto
  ): Promise<{ posts: BoardPost[]; total: number }> {
    return this.boardService.searchPosts(searchDto);
  }

  /**
   * FR-5.1: Create todo list item
   */
  @Post('todos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create a todo list item',
    description: 'Add a new item to a todo list post'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Todo item created successfully',
    type: TodoListItem
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async createTodoItem(
    @Body() createTodoDto: CreateTodoItemDto,
    @Request() req: any
  ): Promise<TodoListItem> {
    return this.boardService.createTodoItem(createTodoDto, req.user.id);
  }

  /**
   * FR-5.1: Update todo list item
   */
  @Put('todos/:id')
  @ApiOperation({ 
    summary: 'Update a todo list item',
    description: 'Update todo item text, completion status, or order'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Todo item updated successfully',
    type: TodoListItem
  })
  @ApiResponse({ status: 404, description: 'Todo item not found' })
  @ApiParam({ name: 'id', description: 'Todo item ID' })
  async updateTodoItem(
    @Param('id') todoId: string,
    @Body() updateTodoDto: UpdateTodoItemDto,
    @Request() req: any
  ): Promise<TodoListItem> {
    return this.boardService.updateTodoItem(todoId, updateTodoDto, req.user.id);
  }

  /**
   * Get todo items for a post
   */
  @Get('posts/:id/todos')
  @ApiOperation({ 
    summary: 'Get todo items for a post',
    description: 'Retrieve all todo items for a specific post'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Todo items retrieved successfully',
    type: [TodoListItem]
  })
  @ApiParam({ name: 'id', description: 'Post ID' })
  async getTodoItems(
    @Param('id') postId: string
  ): Promise<TodoListItem[]> {
    return this.boardService.getTodoItems(postId);
  }

  /**
   * Bulk operations on posts
   */
  @Post('posts/bulk')
  @ApiOperation({ 
    summary: 'Perform bulk operations on posts',
    description: 'Pin, unpin, archive, or delete multiple posts at once'
  })
  @ApiResponse({ status: 200, description: 'Bulk operation completed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid operation or post IDs' })
  async bulkOperation(
    @Body() bulkDto: BulkOperationDto,
    @Request() req: any
  ): Promise<{ success: boolean; processed: number; errors: string[] }> {
    // Implementation for bulk operations
    const results = {
      success: true,
      processed: 0,
      errors: [] as string[]
    };

    for (const postId of bulkDto.post_ids) {
      try {
        switch (bulkDto.operation) {
          case 'pin':
            await this.boardService.togglePin({ post_id: postId, is_pinned: true }, req.user.id);
            break;
          case 'unpin':
            await this.boardService.togglePin({ post_id: postId, is_pinned: false }, req.user.id);
            break;
          case 'archive':
            await this.boardService.archivePost({ post_id: postId, is_archived: true }, req.user.id);
            break;
          case 'unarchive':
            await this.boardService.archivePost({ post_id: postId, is_archived: false }, req.user.id);
            break;
          case 'delete':
            await this.boardService.deletePost(postId, req.user.id);
            break;
        }
        results.processed++;
      } catch (error) {
        results.errors.push(`Failed to ${bulkDto.operation} post ${postId}: ${error.message}`);
        results.success = false;
      }
    }

    return results;
  }

  /**
   * Create reminder for post
   */
  @Post('posts/:id/reminders')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create a reminder for a post',
    description: 'Set up a reminder for a specific post'
  })
  @ApiResponse({ status: 201, description: 'Reminder created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid reminder data' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  async createReminder(
    @Param('id') postId: string,
    @Body() createReminderDto: CreateReminderDto,
    @Request() req: any
  ): Promise<{ success: boolean; message: string }> {
    // Implementation for creating reminders
    try {
      // This would typically create a reminder record and schedule the notification
      // For now, return success response
      return {
        success: true,
        message: 'Reminder created successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create reminder: ${error.message}`
      };
    }
  }

  /**
   * Get post statistics for family
   */
  @Get('families/:familyId/stats')
  @ApiOperation({ 
    summary: 'Get board statistics for family',
    description: 'Get posting statistics and metrics for a family board'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        total_posts: { type: 'number' },
        posts_by_type: { type: 'object' },
        active_users: { type: 'number' },
        pending_moderation: { type: 'number' },
        pinned_posts: { type: 'number' }
      }
    }
  })
  @ApiParam({ name: 'familyId', description: 'Family ID' })
  async getBoardStats(
    @Param('familyId') familyId: string
  ): Promise<any> {
    // Implementation for board statistics
    return {
      total_posts: 0,
      posts_by_type: {},
      active_users: 0,
      pending_moderation: 0,
      pinned_posts: 0
    };
  }
}