import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SupabaseModule } from '../../src/supabase/supabase.module';
import { SupabaseService } from '../../src/supabase/supabase.service';

describe('SupabaseModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [SupabaseModule],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'SUPABASE_URL':
                  return 'https://test.supabase.co';
                case 'SUPABASE_ANON_KEY':
                  return 'test-anon-key';
                default:
                  return null;
              }
            }),
          },
        },
      ],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide SupabaseService', () => {
    const supabaseService = module.get<SupabaseService>(SupabaseService);
    expect(supabaseService).toBeDefined();
    expect(supabaseService).toBeInstanceOf(SupabaseService);
  });
});