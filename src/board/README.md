# Family Board Module

## Overview

The Family Board Module is a comprehensive NestJS module that implements a secure, encrypted family communication board with real-time features. It provides REST APIs, WebSocket support, and complete CRUD operations for family posts, todo lists, reminders, and more.

## Features

### Core Functionality (FR-5.1, FR-5.2, FR-5.3)

- **Post Types**: Text posts, todo lists, reminders, and photo posts
- **Real-time Updates**: WebSocket-based live updates for all board activities
- **End-to-End Encryption**: Family-specific encryption keys for secure content storage
- **Role-Based Permissions**: Different access levels based on family roles
- **Content Moderation**: Automatic moderation for child users
- **Post Management**: Pin, archive, edit, and delete posts
- **Search & Filtering**: Advanced search and filtering capabilities
- **Edit History**: Track all post modifications with history

### Security Features

- **Family-based Encryption**: Each family has unique encryption keys
- **JWT Authentication**: Secure token-based authentication
- **Permission Guards**: Granular access control for different operations
- **Input Validation**: Comprehensive data validation using class-validator

## Module Structure

```
src/board/
├── controllers/
│   └── board.controller.ts         # REST API endpoints
├── services/
│   ├── board.service.ts            # Main business logic
│   └── board-encryption.service.ts # Encryption handling
├── gateways/
│   └── board.gateway.ts            # WebSocket handlers
├── guards/
│   ├── family-board.guard.ts       # Main authentication guard
│   └── board-operations.guard.ts   # Operation-specific guards
├── dto/
│   └── board.dto.ts                # Data transfer objects
├── interfaces/
│   └── board.interface.ts          # TypeScript interfaces
└── board.module.ts                 # Module definition
```

## API Endpoints

### Posts Management

- `POST /api/board/posts` - Create a new post
- `GET /api/board/posts` - Get posts with filtering and pagination
- `PUT /api/board/posts/:id` - Update a post
- `DELETE /api/board/posts/:id` - Delete a post
- `PUT /api/board/posts/:id/pin` - Toggle pin status
- `PUT /api/board/posts/:id/moderate` - Moderate a post
- `PUT /api/board/posts/:id/archive` - Archive/unarchive a post
- `GET /api/board/posts/search` - Search posts

### Todo Management

- `POST /api/board/todos` - Create a todo item
- `PUT /api/board/todos/:id` - Update a todo item
- `GET /api/board/posts/:id/todos` - Get todo items for a post

### Bulk Operations

- `POST /api/board/posts/bulk` - Perform bulk operations on posts

### Statistics

- `GET /api/board/families/:familyId/stats` - Get board statistics

## WebSocket Events

### Client → Server Events

- `join_family` - Join a family board room
- `leave_family` - Leave a family board room
- `create_post` - Create a post in real-time
- `update_post` - Update a post in real-time
- `toggle_pin` - Toggle post pin status
- `update_todo` - Update todo item
- `moderate_post` - Moderate a post
- `typing_start/typing_stop` - Typing indicators

### Server → Client Events

- `connected` - Connection confirmation
- `joined_family` - Successfully joined family room
- `user_joined/user_left` - User presence updates
- `post_created` - New post created
- `post_updated` - Post updated
- `post_pinned` - Post pin status changed
- `todo_updated` - Todo item updated
- `moderation_updated` - Post moderation status changed
- `user_typing` - Typing indicators

## Encryption

The module implements family-specific encryption:

1. **Key Generation**: Each family gets a unique 256-bit encryption key
2. **Key Storage**: Keys are encrypted with a master key and stored securely
3. **Content Encryption**: All post content, titles, and metadata are encrypted
4. **Key Caching**: Keys are cached in memory for performance
5. **Key Rotation**: Support for rotating family encryption keys

### Encryption Algorithm

- **Algorithm**: AES-256-GCM for content encryption
- **Key Derivation**: Secure random key generation
- **IV**: Random initialization vector for each encryption
- **Authentication**: GCM mode provides built-in authentication

## Permissions System

### Family Roles

- **Head**: Full access to all board features including moderation
- **Member**: Can post, edit own posts, pin posts, manage attachments
- **Child Member**: Can post (with moderation), limited edit capabilities

### Granular Permissions

```typescript
interface FamilyBoardPermissions {
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
```

## Guards

### FamilyBoardGuard

Main authentication and family access guard:
- Validates JWT tokens
- Checks family membership
- Loads user permissions
- Attaches user context to requests

### Operation-Specific Guards

- `PostCreationGuard` - Validates post creation permissions
- `PostEditGuard` - Validates post editing permissions
- `PostDeletionGuard` - Validates post deletion permissions
- `PostPinGuard` - Validates pin/unpin permissions
- `PostModerationGuard` - Validates moderation permissions
- `AttachmentManagementGuard` - Validates attachment management
- `ReminderCreationGuard` - Validates reminder creation
- `PostArchiveGuard` - Validates archive operations
- `BoardViewGuard` - Validates board viewing permissions

## Database Schema

The module expects the following database tables (created by migration `002_family_board.sql`):

- `family_encryption_keys` - Stores encrypted family keys
- `board_posts` - Main posts table with encrypted content
- `board_post_edits` - Edit history tracking
- `todo_list_items` - Todo items for todo list posts
- `board_post_attachments` - File attachments
- `board_post_reminders` - Reminder scheduling

## Environment Variables

```env
# Required for encryption
ENCRYPTION_MASTER_KEY=your-256-bit-master-key-here

# JWT configuration
JWT_SECRET=your-jwt-secret-key

# Database configuration (via Supabase)
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Usage Example

### Creating a Post

```typescript
// REST API
POST /api/board/posts
{
  "family_id": "family-uuid",
  "post_type": "text",
  "title": "Family Meeting",
  "content": "We need to discuss vacation plans",
  "metadata": { "priority": "high" }
}

// WebSocket
socket.emit('create_post', {
  family_id: "family-uuid",
  post_type: "text",
  title: "Family Meeting",
  content: "We need to discuss vacation plans"
});
```

### Real-time Updates

```typescript
// Listen for new posts
socket.on('post_created', (data) => {
  console.log('New post:', data.post);
  // Update UI with new post
});

// Listen for todo updates
socket.on('todo_updated', (data) => {
  console.log('Todo updated:', data.todo);
  // Update todo list in UI
});
```

## Error Handling

The module provides comprehensive error handling:

- **ValidationException**: Invalid input data
- **UnauthorizedException**: Authentication failures
- **ForbiddenException**: Permission denied
- **NotFoundException**: Resource not found
- **BadRequestException**: General request errors

## Testing

```bash
# Unit tests
npm run test board

# Integration tests
npm run test:e2e board

# Test coverage
npm run test:cov board
```

## Development

### Adding New Post Types

1. Update `PostType` in `board.interface.ts`
2. Add validation in `board.dto.ts`
3. Update business logic in `board.service.ts`
4. Add UI handling in frontend

### Adding New Permissions

1. Update `FamilyBoardPermissions` interface
2. Add permission logic in guards
3. Update permission calculation in `FamilyBoardGuard`
4. Create specific operation guards if needed

## Performance Considerations

- **Encryption Caching**: Family keys are cached in memory
- **Connection Pooling**: Database connections are pooled
- **Pagination**: All list endpoints support pagination
- **WebSocket Optimization**: Efficient room management for families
- **Index Optimization**: Database queries are optimized with proper indexes

## Security Considerations

- **Input Sanitization**: All inputs are validated and sanitized
- **SQL Injection Prevention**: Using parameterized queries
- **XSS Prevention**: Content is properly escaped
- **Rate Limiting**: Should be implemented at the API gateway level
- **Key Rotation**: Encryption keys can be rotated periodically

## Deployment

The module is designed to work with:
- **Database**: PostgreSQL (via Supabase)
- **Caching**: Redis (for session management)
- **File Storage**: Supabase Storage (for attachments)
- **Real-time**: Socket.IO WebSockets

## Troubleshooting

### Common Issues

1. **Encryption Errors**: Check `ENCRYPTION_MASTER_KEY` environment variable
2. **Permission Denied**: Verify family membership and role permissions
3. **WebSocket Connection Issues**: Check JWT token validity
4. **Database Errors**: Ensure migration has been run

### Logging

The module uses NestJS built-in logging:
- Debug level for development
- Info level for general operations
- Error level for exceptions
- WebSocket events are logged with context