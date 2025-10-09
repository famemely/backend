import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../../src/auth/auth.module';
import { AuthService } from '../../src/auth/auth.service';
import { AuthController } from '../../src/auth/auth.controller';

describe('AuthModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(),
        AuthModule,
      ],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide AuthService', () => {
    const authService = module.get<AuthService>(AuthService);
    expect(authService).toBeDefined();
    expect(authService).toBeInstanceOf(AuthService);
  });

  it('should provide AuthController', () => {
    const authController = module.get<AuthController>(AuthController);
    expect(authController).toBeDefined();
    expect(authController).toBeInstanceOf(AuthController);
  });

  it('should have proper module configuration', () => {
    expect(module).toBeTruthy();
  });
});