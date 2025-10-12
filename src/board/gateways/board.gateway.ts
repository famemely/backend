// ============================================================================
// Family Board WebSocket Gateway
// Real-time updates for Family Board functionality
// ============================================================================

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { BoardService } from '../services/board.service';
import { WebSocketBoardEvent } from '../interfaces/board.interface';
import {
  CreatePostDto,
  UpdatePostDto,
  CreateTodoItemDto,
  UpdateTodoItemDto,
  TogglePinDto,
  ModeratePostDto
} from '../dto/board.dto';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  familyId?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/board',
})
@UsePipes(new ValidationPipe({ transform: true }))
export class BoardGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BoardGateway.name);
  private connectedUsers = new Map<string, Set<string>>(); // familyId -> Set of userIds

  constructor(
    private readonly boardService: BoardService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Handle client connection
   */
  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        throw new WsException('No authentication token provided');
      }

      // Verify JWT token
      const payload = this.jwtService.verify(token);
      client.userId = payload.sub || payload.id;

      this.logger.log(`Client connected: ${client.id} (User: ${client.userId})`);
      
      // Send connection success
      client.emit('connected', {
        message: 'Connected to Family Board',
        userId: client.userId,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error(`Connection failed for client ${client.id}: ${error.message}`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: AuthenticatedSocket): void {
    this.logger.log(`Client disconnected: ${client.id} (User: ${client.userId})`);
    
    // Remove user from all family rooms
    if (client.userId && client.familyId) {
      this.removeUserFromFamily(client.userId, client.familyId);
      client.leave(`family:${client.familyId}`);
    }
  }

  /**
   * Join a family board room
   */
  @SubscribeMessage('join_family')
  async handleJoinFamily(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { familyId: string }
  ): Promise<void> {
    try {
      if (!client.userId) {
        throw new WsException('User not authenticated');
      }

      // Verify user has access to this family
      const hasAccess = await this.verifyFamilyAccess(client.userId, data.familyId);
      if (!hasAccess) {
        throw new WsException('Access denied to family board');
      }

      // Leave previous family room if any
      if (client.familyId) {
        client.leave(`family:${client.familyId}`);
        this.removeUserFromFamily(client.userId, client.familyId);
      }

      // Join new family room
      client.familyId = data.familyId;
      client.join(`family:${data.familyId}`);
      this.addUserToFamily(client.userId, data.familyId);

      // Notify family members
      client.to(`family:${data.familyId}`).emit('user_joined', {
        userId: client.userId,
        familyId: data.familyId,
        timestamp: new Date().toISOString(),
      });

      // Send confirmation to client
      client.emit('joined_family', {
        familyId: data.familyId,
        activeUsers: Array.from(this.connectedUsers.get(data.familyId) || []),
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`User ${client.userId} joined family ${data.familyId}`);

    } catch (error) {
      this.logger.error(`Failed to join family: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  /**
   * Leave a family board room
   */
  @SubscribeMessage('leave_family')
  handleLeaveFamily(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { familyId: string }
  ): void {
    if (client.familyId === data.familyId) {
      client.leave(`family:${data.familyId}`);
      
      if (client.userId) {
        this.removeUserFromFamily(client.userId, data.familyId);
        
        // Notify family members
        client.to(`family:${data.familyId}`).emit('user_left', {
          userId: client.userId,
          familyId: data.familyId,
          timestamp: new Date().toISOString(),
        });
      }

      client.familyId = undefined;
      client.emit('left_family', { familyId: data.familyId });
      
      this.logger.log(`User ${client.userId} left family ${data.familyId}`);
    }
  }

  /**
   * Real-time post creation
   */
  @SubscribeMessage('create_post')
  async handleCreatePost(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() createPostDto: CreatePostDto
  ): Promise<void> {
    try {
      if (!client.userId) {
        throw new WsException('User not authenticated');
      }

      const post = await this.boardService.createPost(createPostDto, client.userId);

      // Broadcast to family members
      this.broadcastToFamily(createPostDto.family_id, 'post_created', {
        post,
        author: client.userId,
        timestamp: new Date().toISOString(),
      });

      // Send confirmation to creator
      client.emit('post_created_success', { post });

    } catch (error) {
      this.logger.error(`Failed to create post: ${error.message}`);
      client.emit('error', { message: `Failed to create post: ${error.message}` });
    }
  }

  /**
   * Real-time post updates
   */
  @SubscribeMessage('update_post')
  async handleUpdatePost(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { postId: string; updateData: UpdatePostDto }
  ): Promise<void> {
    try {
      if (!client.userId) {
        throw new WsException('User not authenticated');
      }

      const updatedPost = await this.boardService.updatePost(
        data.postId, 
        data.updateData, 
        client.userId
      );

      // Broadcast to family members
      this.broadcastToFamily(updatedPost.family_id, 'post_updated', {
        post: updatedPost,
        editor: client.userId,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error(`Failed to update post: ${error.message}`);
      client.emit('error', { message: `Failed to update post: ${error.message}` });
    }
  }

  /**
   * Real-time post pinning
   */
  @SubscribeMessage('toggle_pin')
  async handleTogglePin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() togglePinDto: TogglePinDto
  ): Promise<void> {
    try {
      if (!client.userId) {
        throw new WsException('User not authenticated');
      }

      const updatedPost = await this.boardService.togglePin(togglePinDto, client.userId);

      // Broadcast to family members
      this.broadcastToFamily(updatedPost.family_id, 'post_pinned', {
        post: updatedPost,
        pinnedBy: client.userId,
        isPinned: updatedPost.is_pinned,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error(`Failed to toggle pin: ${error.message}`);
      client.emit('error', { message: `Failed to toggle pin: ${error.message}` });
    }
  }

  /**
   * Real-time todo item updates
   */
  @SubscribeMessage('update_todo')
  async handleUpdateTodo(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { todoId: string; updateData: UpdateTodoItemDto }
  ): Promise<void> {
    try {
      if (!client.userId) {
        throw new WsException('User not authenticated');
      }

      const updatedTodo = await this.boardService.updateTodoItem(
        data.todoId, 
        data.updateData, 
        client.userId
      );

      // Get the post to determine family
      const todoItems = await this.boardService.getTodoItems(updatedTodo.post_id);
      const post = await this.getPostById(updatedTodo.post_id);

      if (post) {
        // Broadcast to family members
        this.broadcastToFamily(post.family_id, 'todo_updated', {
          todo: updatedTodo,
          postId: updatedTodo.post_id,
          updatedBy: client.userId,
          timestamp: new Date().toISOString(),
        });
      }

    } catch (error) {
      this.logger.error(`Failed to update todo: ${error.message}`);
      client.emit('error', { message: `Failed to update todo: ${error.message}` });
    }
  }

  /**
   * Real-time post moderation
   */
  @SubscribeMessage('moderate_post')
  async handleModeratePost(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() moderatePostDto: ModeratePostDto
  ): Promise<void> {
    try {
      if (!client.userId) {
        throw new WsException('User not authenticated');
      }

      const moderatedPost = await this.boardService.moderatePost(moderatePostDto, client.userId);

      // Broadcast to family members
      this.broadcastToFamily(moderatedPost.family_id, 'moderation_updated', {
        post: moderatedPost,
        moderatedBy: client.userId,
        status: moderatedPost.moderation_status,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error(`Failed to moderate post: ${error.message}`);
      client.emit('error', { message: `Failed to moderate post: ${error.message}` });
    }
  }

  /**
   * Get active users in a family
   */
  @SubscribeMessage('get_active_users')
  handleGetActiveUsers(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { familyId: string }
  ): void {
    const activeUsers = Array.from(this.connectedUsers.get(data.familyId) || []);
    client.emit('active_users', {
      familyId: data.familyId,
      users: activeUsers,
      count: activeUsers.length,
    });
  }

  /**
   * Typing indicator for posts
   */
  @SubscribeMessage('typing_start')
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { familyId: string; postId?: string }
  ): void {
    if (client.userId && client.familyId === data.familyId) {
      client.to(`family:${data.familyId}`).emit('user_typing', {
        userId: client.userId,
        familyId: data.familyId,
        postId: data.postId,
        isTyping: true,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { familyId: string; postId?: string }
  ): void {
    if (client.userId && client.familyId === data.familyId) {
      client.to(`family:${data.familyId}`).emit('user_typing', {
        userId: client.userId,
        familyId: data.familyId,
        postId: data.postId,
        isTyping: false,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Helper methods

  private broadcastToFamily(familyId: string, event: string, data: any): void {
    this.server.to(`family:${familyId}`).emit(event, data);
  }

  private addUserToFamily(userId: string, familyId: string): void {
    if (!this.connectedUsers.has(familyId)) {
      this.connectedUsers.set(familyId, new Set());
    }
    this.connectedUsers.get(familyId)!.add(userId);
  }

  private removeUserFromFamily(userId: string, familyId: string): void {
    const familyUsers = this.connectedUsers.get(familyId);
    if (familyUsers) {
      familyUsers.delete(userId);
      if (familyUsers.size === 0) {
        this.connectedUsers.delete(familyId);
      }
    }
  }

  private async verifyFamilyAccess(userId: string, familyId: string): Promise<boolean> {
    try {
      // This should verify that the user is a member of the family
      // Implementation depends on your SupabaseService
      return true; // Placeholder - implement actual verification
    } catch (error) {
      this.logger.error(`Failed to verify family access: ${error.message}`);
      return false;
    }
  }

  private async getPostById(postId: string): Promise<any> {
    try {
      // This should fetch post details
      // Implementation depends on your BoardService
      return null; // Placeholder - implement actual post fetching
    } catch (error) {
      this.logger.error(`Failed to get post: ${error.message}`);
      return null;
    }
  }

  /**
   * Broadcast system-wide events (e.g., for reminders)
   */
  broadcastReminder(familyId: string, reminderData: any): void {
    this.broadcastToFamily(familyId, 'reminder_triggered', {
      ...reminderData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    familiesWithActiveUsers: number;
    usersByFamily: { [familyId: string]: number };
  } {
    const usersByFamily: { [familyId: string]: number } = {};
    
    for (const [familyId, users] of this.connectedUsers.entries()) {
      usersByFamily[familyId] = users.size;
    }

    return {
      totalConnections: this.server.sockets.sockets.size,
      familiesWithActiveUsers: this.connectedUsers.size,
      usersByFamily,
    };
  }
}