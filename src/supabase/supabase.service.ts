import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient | null = null;
  private readonly logger = new Logger(SupabaseService.name);
  private isConfigured = false;

  constructor(private configService: ConfigService) {
    this.initializeSupabase();
  }

  private initializeSupabase() {
    // Try multiple env var names (backend-first, then frontend/public names)
    const candidates = [
      { urlKey: 'SUPABASE_URL', anonKey: 'SUPABASE_ANON_KEY' },
      { urlKey: 'PUBLIC_SUPABASE_URL', anonKey: 'PUBLIC_SUPABASE_ANON_KEY' },
      { urlKey: 'EXPO_PUBLIC_SUPABASE_URL', anonKey: 'EXPO_PUBLIC_SUPABASE_KEY' },
      { urlKey: 'PUBLIC_SUPABASE_URL', anonKey: 'SUPABASE_ANON_KEY' },
    ];

    let foundUrl: string | undefined;
    let foundKey: string | undefined;
    let usedPair: { urlKey: string; anonKey: string } | null = null;

    for (const c of candidates) {
      const url = this.configService.get<string>(c.urlKey);
      const key = this.configService.get<string>(c.anonKey);
      if (url && key && url !== 'your-supabase-url' && key !== 'your-supabase-anon-key') {
        foundUrl = url;
        foundKey = key;
        usedPair = c;
        break;
      }
    }

    if (!foundUrl || !foundKey) {
      this.logger.warn('Supabase not configured. Running in demo mode without Supabase integration.');
      return;
    }

    try {
      this.supabase = createClient(foundUrl, foundKey);
      this.isConfigured = true;
      this.logger.log(`Supabase client initialized successfully using env keys: ${usedPair?.urlKey}/${usedPair?.anonKey}`);
    } catch (error) {
      this.logger.error('Failed to initialize Supabase client:', error);
    }
  }

  getClient(): SupabaseClient | null {
    return this.supabase;
  }

  isSupabaseConfigured(): boolean {
    return this.isConfigured;
  }

  async verifyToken(token: string) {
    if (!this.supabase) {
      throw new Error('Supabase not configured. Cannot verify token.');
    }
    
    const { data, error } = await this.supabase.auth.getUser(token);
    if (error) {
      throw new Error(`Invalid token: ${error.message}`);
    }
    return data.user;
  }

  async createUser(email: string, password: string, metadata: any) {
    if (!this.supabase) {
      throw new Error('Supabase not configured. Cannot create user.');
    }
    
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });
    
    if (error) {
      throw new Error(`Signup failed: ${error.message}`);
    }
    
    return data;
  }

  async signInWithEmail(email: string, password: string) {
    if (!this.supabase) {
      throw new Error('Supabase not configured. Cannot sign in.');
    }
    
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
    
    return data;
  }
}