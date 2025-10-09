import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../../src/auth/guards/supabase-auth.guard';
import { SupabaseService } from '../../../src/supabase/supabase.service';
import { UsersService } from '../../../src/users/users.service';

describe('SupabaseAuthGuard', () => {
  let guard: SupabaseAuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseAuthGuard,
        {
          provide: SupabaseService,
          useValue: {
            verifyToken: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findBySupabaseId: jest.fn(),
            findByEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<SupabaseAuthGuard>(SupabaseAuthGuard);
  });

  const createMockExecutionContext = (headers: any): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as ExecutionContext);

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should reject request without authorization header', async () => {
    const context = createMockExecutionContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject request with invalid token format', async () => {
    const context = createMockExecutionContext({
      authorization: 'InvalidFormat token',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});