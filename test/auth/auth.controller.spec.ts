import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            exchangeToken: jest.fn(),
            getProfile: jest.fn(),
            syncUser: jest.fn(),
            emailSignup: jest.fn(),
            emailLogin: jest.fn(),
            googleAuth: jest.fn(),
            under13Signup: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have health endpoint', () => {
    const result = controller.health();
    expect(result).toEqual({
      status: 'ok',
      service: 'auth',
      timestamp: expect.any(String),
    });
  });

  it('should handle token exchange', async () => {
    const mockResult = { token: 'new-token', user: { id: '1' } };
    jest.spyOn(authService, 'exchangeToken').mockResolvedValue(mockResult);

    const result = await controller.exchangeToken({ token: 'supabase-token' });

    expect(authService.exchangeToken).toHaveBeenCalledWith('supabase-token');
    expect(result).toEqual(mockResult);
  });
});