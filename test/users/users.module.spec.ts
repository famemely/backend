import { Test, TestingModule } from '@nestjs/testing';
import { UsersModule } from '../../src/users/users.module';
import { UsersService } from '../../src/users/users.service';

describe('UsersModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [UsersModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide UsersService', () => {
    const usersService = module.get<UsersService>(UsersService);
    expect(usersService).toBeDefined();
    expect(usersService).toBeInstanceOf(UsersService);
  });

  it('should export UsersService for other modules', () => {
    const usersService = module.get<UsersService>(UsersService);
    expect(usersService).toBeDefined();
  });
});