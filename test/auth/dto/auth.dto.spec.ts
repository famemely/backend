import { validate } from 'class-validator';
import { EmailSignupDto, EmailLoginDto, GoogleAuthDto, Under13SignupDto } from '../../../src/auth/dto';

describe('Auth DTOs Validation', () => {
  describe('EmailSignupDto', () => {
    it('should validate correct email signup data', async () => {
      const dto = new EmailSignupDto();
      dto.email = 'test@example.com';
      dto.password = 'StrongPassword123!';
      dto.name = 'Test User';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid email format', async () => {
      const dto = new EmailSignupDto();
      dto.email = 'invalid-email-format';
      dto.password = 'StrongPassword123!';
      dto.name = 'Test User';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('EmailLoginDto', () => {
    it('should validate correct login credentials', async () => {
      const dto = new EmailLoginDto();
      dto.email = 'test@example.com';
      dto.password = 'password123';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Under13SignupDto', () => {
    it('should validate under 13 signup data', async () => {
      const dto = new Under13SignupDto();
      dto.username = 'coolkid123';
      dto.parentEmail = 'parent@example.com';
      dto.name = 'Cool Kid';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('GoogleAuthDto', () => {
    it('should validate Google ID token', async () => {
      const dto = new GoogleAuthDto();
      dto.idToken = 'valid.google.id.token.here';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});