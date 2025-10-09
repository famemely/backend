import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AppModule } from '../src/app.module';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { SupabaseModule } from '../src/supabase/supabase.module';

describe('AppModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should have AppController', () => {
    const controller = module.get<AppController>(AppController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(AppController);
  });

  it('should have AppService', () => {
    const service = module.get<AppService>(AppService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(AppService);
  });

  it('should import ConfigModule globally', () => {
    const configModule = module.get(ConfigModule);
    expect(configModule).toBeDefined();
  });

  it('should compile all feature modules successfully', async () => {
    // Test that all modules can be instantiated together
    const testModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        AuthModule,
        UsersModule,
        SupabaseModule,
      ],
    }).compile();

    expect(testModule).toBeDefined();
  });

  it('should have global configuration available', () => {
    // Test that ConfigModule is available globally
    expect(() => module.get(ConfigModule)).not.toThrow();
  });

  it('should bootstrap successfully', async () => {
    const app = module.createNestApplication();
    await expect(app.init()).resolves.toBeDefined();
    await app.close();
  });
});