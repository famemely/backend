import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../../src/users/users.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a user successfully', async () => {
    const userData = {
      email: 'test@example.com',
      name: 'Test User',
    };

    const createdUser = await service.createUser(userData);

    expect(createdUser).toBeDefined();
    expect(createdUser.email).toBe('test@example.com');
    expect(createdUser.name).toBe('Test User');
    expect(createdUser.id).toBeDefined();
  });

  it('should find user by email', async () => {
    const userData = {
      email: 'findme@example.com',
      name: 'Find Me User',
    };

    await service.createUser(userData);
    const foundUser = await service.findByEmail('findme@example.com');

    expect(foundUser).toBeDefined();
    expect(foundUser?.email).toBe('findme@example.com');
  });

  it('should return null for non-existent email', async () => {
    const user = await service.findByEmail('nonexistent@example.com');
    expect(user).toBeNull();
  });
});