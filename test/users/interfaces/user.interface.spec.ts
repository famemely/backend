import { User } from '../../../src/users/interfaces/user.interface';

describe('User Interface', () => {
  describe('User Type Validation', () => {
    it('should define valid user structure', () => {
      const user: User = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        supabaseId: 'supabase-456',
        role: 'user',
        permissions: ['read', 'write'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
        profilePicture: 'https://example.com/avatar.jpg',
        username: 'testuser123',
        parentEmail: null,
        isUnder13: false,
        twoFactorEnabled: false,
      };

      expect(user).toBeDefined();
      expect(typeof user.id).toBe('string');
      expect(typeof user.email).toBe('string');
      expect(typeof user.name).toBe('string');
      expect(typeof user.isActive).toBe('boolean');
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should support under 13 user structure', () => {
      const under13User: User = {
        id: 'child-123',
        email: null,
        name: 'Child User',
        supabaseId: null,
        role: 'child',
        permissions: ['read'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
        profilePicture: null,
        username: 'coolkid2024',
        parentEmail: 'parent@example.com',
        isUnder13: true,
        twoFactorEnabled: false,
      };

      expect(under13User.isUnder13).toBe(true);
      expect(under13User.parentEmail).toBe('parent@example.com');
      expect(under13User.email).toBeNull();
    });
  });
});