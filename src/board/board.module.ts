// ============================================================================
// Family Board Module
// Main NestJS module for Family Board functionality
// ============================================================================

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

// Controllers
import { BoardController } from './controllers/board.controller';

// Services
import { BoardService } from './services/board.service';
import { BoardEncryptionService } from './services/board-encryption.service';

// Gateways
import { BoardGateway } from './gateways/board.gateway';

// Guards
import { FamilyBoardGuard } from './guards/family-board.guard';
import {
  PostCreationGuard,
  PostEditGuard,
  PostDeletionGuard,
  PostPinGuard,
  PostModerationGuard,
  AttachmentManagementGuard,
  ReminderCreationGuard,
  PostArchiveGuard,
  BoardViewGuard,
} from './guards/board-operations.guard';

// External modules
import { SupabaseService } from '../supabase/supabase.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [BoardController],
  providers: [
    // Core services
    BoardService,
    BoardEncryptionService,
    SupabaseService,
    
    // WebSocket gateway
    BoardGateway,
    
    // Guards
    FamilyBoardGuard,
    PostCreationGuard,
    PostEditGuard,
    PostDeletionGuard,
    PostPinGuard,
    PostModerationGuard,
    AttachmentManagementGuard,
    ReminderCreationGuard,
    PostArchiveGuard,
    BoardViewGuard,
  ],
  exports: [
    BoardService,
    BoardEncryptionService,
    BoardGateway,
  ],
})
export class BoardModule {}