import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../src/auth/auth.service';
import { UsersService } from '../../src/users/users.service';
import { SupabaseService } from '../../src/supabase/supabase.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn().mockReturnValue({ sub: 'user-id' }),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findBySupabaseId: jest.fn(),
            createUser: jest.fn(),
            updateLastActive: jest.fn(),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            verifyToken: jest.fn(),
            createUser: jest.fn(),
            signInWithEmail: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have JWT service dependency', () => {
    expect(jwtService).toBeDefined();
  });

  it('should handle service initialization', () => {
    expect(service).toBeInstanceOf(AuthService);
  });
});