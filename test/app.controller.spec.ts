import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getHello: jest.fn().mockReturnValue('Hello World!'),
            getHealth: jest.fn().mockReturnValue({
              status: 'ok',
              timestamp: new Date().toISOString(),
              uptime: process.uptime(),
            }),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('root endpoint', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
      expect(appService.getHello).toHaveBeenCalled();
    });
  });

  describe('health endpoint', () => {
    it('should return health status', () => {
      const result = appController.getHealth();
      
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result.status).toBe('ok');
      expect(appService.getHealth).toHaveBeenCalled();
    });
  });

  it('should be defined', () => {
    expect(appController).toBeDefined();
  });
});