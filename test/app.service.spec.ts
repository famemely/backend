import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from '../src/app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHello method', () => {
    it('should return "Hello World!"', () => {
      expect(service.getHello()).toBe('Hello World!');
    });

    it('should return string type', () => {
      const result = service.getHello();
      expect(typeof result).toBe('string');
    });

    it('should be consistent', () => {
      expect(service.getHello()).toBe(service.getHello());
    });
  });

  describe('getHealth method', () => {
    it('should return health check object', () => {
      const health = service.getHealth();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('uptime');
      
      expect(health.status).toBe('ok');
      expect(typeof health.timestamp).toBe('string');
      expect(typeof health.uptime).toBe('number');
    });

    it('should have valid timestamp format', () => {
      const health = service.getHealth();
      const timestamp = new Date(health.timestamp);
      
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it('should have positive uptime', () => {
      const health = service.getHealth();
      expect(health.uptime).toBeGreaterThan(0);
    });

    it('should have different timestamps on multiple calls', (done) => {
      const health1 = service.getHealth();
      
      setTimeout(() => {
        const health2 = service.getHealth();
        expect(health1.timestamp).not.toBe(health2.timestamp);
        done();
      }, 10);
    });
  });
});