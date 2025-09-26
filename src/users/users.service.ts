import { Injectable } from '@nestjs/common';

export interface User {
  id: string;
  email?: string;
  username?: string;
  fullName: string;
  isUnder13: boolean;
  age?: number;
  parentEmail?: string;
  phoneNumber?: string;
  supabaseId?: string;
  password?: string;
  twoFactorSecret?: string;
  isTwoFactorEnabled: boolean;
  createdAt: Date;
  lastActive: Date;
}

@Injectable()
export class UsersService {
  private users: User[] = []; // In-memory storage for demo

  async createUser(userData: Partial<User>): Promise<User> {
    const user: User = {
      id: `user_${Date.now()}`,
      fullName: userData.fullName || '',
      isUnder13: userData.isUnder13 || false,
      isTwoFactorEnabled: false,
      createdAt: new Date(),
      lastActive: new Date(),
      ...userData,
    };
    
    this.users.push(user);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find(user => user.email === email) || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.users.find(user => user.username === username) || null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.find(user => user.id === id) || null;
  }

  async findBySupabaseId(supabaseId: string): Promise<User | null> {
    return this.users.find(user => user.supabaseId === supabaseId) || null;
  }

  async updateLastActive(id: string): Promise<void> {
    const user = this.users.find(user => user.id === id);
    if (user) {
      user.lastActive = new Date();
    }
  }

  async getAllUsers(): Promise<User[]> {
    return this.users;
  }

  async enable2FA(userId: string, secret: string): Promise<void> {
    const user = this.users.find(user => user.id === userId);
    if (user) {
      user.twoFactorSecret = secret;
      user.isTwoFactorEnabled = true;
    }
  }

  async disable2FA(userId: string): Promise<void> {
    const user = this.users.find(user => user.id === userId);
    if (user) {
      user.twoFactorSecret = undefined;
      user.isTwoFactorEnabled = false;
    }
  }

  async get2FASecret(userId: string): Promise<string | undefined> {
    const user = this.users.find(user => user.id === userId);
    return user?.twoFactorSecret;
  }
}