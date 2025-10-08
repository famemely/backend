import { readFileSync } from 'fs';
import { join } from 'path';

describe('Environment Configuration Validation', () => {
  let envContent: string;
  let envVariables: Record<string, string>;
    
  beforeAll(() => {
    const envPath = join(process.cwd(), '.env.example');
    envContent = readFileSync(envPath, 'utf-8');
    
    envVariables = {};
    envContent.split('\n').forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        if (key && value) {
          envVariables[key.trim()] = value.trim();
        }
      }
    });
  });

  describe('Database Configuration', () => {
    it('should contain DATABASE_URL', () => {
      expect(envVariables.DATABASE_URL).toBeDefined();
      expect(envVariables.DATABASE_URL).toBe('your_database_url_here');
    });
  });

  describe('Supabase Configuration', () => {
    it('should contain SUPABASE_URL', () => {
      expect(envVariables.SUPABASE_URL).toBeDefined();
      expect(envVariables.SUPABASE_URL).toBe('your_supabase_url_here');
    });

    it('should contain SUPABASE_ANON_KEY', () => {
      expect(envVariables.SUPABASE_ANON_KEY).toBeDefined();
      expect(envVariables.SUPABASE_ANON_KEY).toBe('your_supabase_anon_key_here');
    });

    it('should contain SUPABASE_SERVICE_ROLE_KEY', () => {
      expect(envVariables.SUPABASE_SERVICE_ROLE_KEY).toBeDefined();
      expect(envVariables.SUPABASE_SERVICE_ROLE_KEY).toBe('your_supabase_service_role_key_here');
    });
  });

  describe('JWT Configuration', () => {
    it('should contain JWT_SECRET', () => {
      expect(envVariables.JWT_SECRET).toBeDefined();
      expect(envVariables.JWT_SECRET).toBe('your_jwt_secret_here_change_this_in_production');
    });
  });

  describe('Google OAuth Configuration', () => {
    it('should contain GOOGLE_CLIENT_ID', () => {
      expect(envVariables.GOOGLE_CLIENT_ID).toBeDefined();
      expect(envVariables.GOOGLE_CLIENT_ID).toBe('your_google_client_id_here');
    });

    it('should contain GOOGLE_CLIENT_SECRET', () => {
      expect(envVariables.GOOGLE_CLIENT_SECRET).toBeDefined();
      expect(envVariables.GOOGLE_CLIENT_SECRET).toBe('your_google_client_secret_here');
    });
  });

  describe('App Configuration', () => {
    it('should contain NODE_ENV', () => {
      expect(envVariables.NODE_ENV).toBeDefined();
      expect(envVariables.NODE_ENV).toBe('development');
    });

    it('should contain PORT', () => {
      expect(envVariables.PORT).toBeDefined();
      expect(envVariables.PORT).toBe('3001');
    });
  });
});