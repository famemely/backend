import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../src/supabase/supabase.service';

describe('SupabaseService', () => {
  let service: SupabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'SUPABASE_URL':
                case 'PUBLIC_SUPABASE_URL':
                  return 'https://test.supabase.co';
                case 'SUPABASE_ANON_KEY':
                case 'PUBLIC_SUPABASE_ANON_KEY':
                  return 'test-anon-key';
                case 'SUPABASE_SERVICE_ROLE_KEY':
                  return 'test-service-key';
                default:
                  return null;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SupabaseService>(SupabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize with configuration', () => {
    expect(service).toBeInstanceOf(SupabaseService);
  });

  it('should handle service creation', () => {
    expect(service).toBeTruthy();
  });
});