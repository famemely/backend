// ============================================================================
// Family Board Encryption Service (Server-side)
// Implements server-side encryption for family board data
// ============================================================================

import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { EncryptionResult, DecryptionResult } from '../interfaces/board.interface';
import * as crypto from 'crypto';

@Injectable()
export class BoardEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private familyKeys: { [familyId: string]: string } = {}; // Cache for family keys

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Get or generate family encryption key
   */
  async getFamilyKey(familyId: string): Promise<string> {
    // Check cache first
    if (this.familyKeys[familyId]) {
      return this.familyKeys[familyId];
    }

    try {
      // Try to get existing key from database
      const { data: existingKey, error: fetchError } = await this.supabaseService.client
        .from('family_encryption_keys')
        .select('key_encrypted')
        .eq('family_id', familyId)
        .eq('is_active', true)
        .single();

      if (existingKey && !fetchError) {
        // Decrypt the stored key
        const decryptedKey = this.decryptStoredKey(existingKey.key_encrypted);
        this.familyKeys[familyId] = decryptedKey;
        return decryptedKey;
      }

      // Generate new key if none exists
      const newKey = await this.generateFamilyKey(familyId);
      this.familyKeys[familyId] = newKey;
      return newKey;
    } catch (error) {
      throw new BadRequestException(`Failed to get family encryption key: ${error.message}`);
    }
  }

  /**
   * Generate a new family encryption key
   */
  private async generateFamilyKey(familyId: string): Promise<string> {
    try {
      // Generate a random 256-bit key
      const key = crypto.randomBytes(32).toString('hex');
      
      // Encrypt the key for storage
      const encryptedKey = this.encryptStoredKey(key);

      // Store in database
      const { error } = await this.supabaseService.client
        .from('family_encryption_keys')
        .insert({
          family_id: familyId,
          key_encrypted: encryptedKey,
          algorithm: this.algorithm,
          is_active: true,
        });

      if (error) {
        throw new Error(`Failed to store family key: ${error.message}`);
      }

      return key;
    } catch (error) {
      throw new BadRequestException(`Failed to generate family key: ${error.message}`);
    }
  }

  /**
   * Encrypt text using family key
   */
  async encryptText(text: string, familyKey: string): Promise<EncryptionResult> {
    try {
      if (!text || !familyKey) {
        return {
          encrypted_data: '',
          success: false,
          error: 'Text and family key are required'
        };
      }

      // Generate random IV
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipher(this.algorithm, familyKey);
      cipher.setAAD(Buffer.from('family_board'));
      
      // Encrypt
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get auth tag
      const authTag = cipher.getAuthTag();
      
      // Combine IV + authTag + encrypted data
      const combined = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
      
      return {
        encrypted_data: combined,
        success: true
      };
    } catch (error) {
      return {
        encrypted_data: '',
        success: false,
        error: error instanceof Error ? error.message : 'Encryption failed'
      };
    }
  }

  /**
   * Decrypt text using family key
   */
  async decryptText(encryptedText: string, familyKey: string): Promise<DecryptionResult> {
    try {
      if (!encryptedText || !familyKey) {
        return {
          decrypted_data: '',
          success: false,
          error: 'Encrypted text and family key are required'
        };
      }

      // Split the components
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        return {
          decrypted_data: '',
          success: false,
          error: 'Invalid encrypted data format'
        };
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      // Create decipher
      const decipher = crypto.createDecipher(this.algorithm, familyKey);
      decipher.setAAD(Buffer.from('family_board'));
      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return {
        decrypted_data: decrypted,
        success: true
      };
    } catch (error) {
      return {
        decrypted_data: '',
        success: false,
        error: error instanceof Error ? error.message : 'Decryption failed'
      };
    }
  }

  /**
   * Encrypt multiple fields for a post
   */
  async encryptPostContent(
    content: { title?: string; content: string; metadata?: any },
    familyKey: string
  ): Promise<{
    title_encrypted: string | null;
    content_encrypted: string;
    metadata_encrypted: string | null;
  }> {
    try {
      const results = await Promise.all([
        content.title ? this.encryptText(content.title, familyKey) : Promise.resolve(null),
        this.encryptText(content.content, familyKey),
        content.metadata ? this.encryptText(JSON.stringify(content.metadata), familyKey) : Promise.resolve(null)
      ]);

      const [titleResult, contentResult, metadataResult] = results;

      if (!contentResult?.success) {
        throw new Error(`Failed to encrypt content: ${contentResult?.error}`);
      }

      if (titleResult && !titleResult.success) {
        throw new Error(`Failed to encrypt title: ${titleResult.error}`);
      }

      if (metadataResult && !metadataResult.success) {
        throw new Error(`Failed to encrypt metadata: ${metadataResult.error}`);
      }

      return {
        title_encrypted: titleResult?.encrypted_data || null,
        content_encrypted: contentResult.encrypted_data,
        metadata_encrypted: metadataResult?.encrypted_data || null
      };
    } catch (error) {
      throw new BadRequestException(`Error encrypting post content: ${error.message}`);
    }
  }

  /**
   * Decrypt multiple fields for a post
   */
  async decryptPostContent(
    encryptedContent: {
      title_encrypted: string | null;
      content_encrypted: string;
      metadata_encrypted: string | null;
    },
    familyKey: string
  ): Promise<{
    title?: string;
    content: string;
    metadata?: any;
  }> {
    try {
      const results = await Promise.all([
        encryptedContent.title_encrypted 
          ? this.decryptText(encryptedContent.title_encrypted, familyKey) 
          : Promise.resolve(null),
        this.decryptText(encryptedContent.content_encrypted, familyKey),
        encryptedContent.metadata_encrypted 
          ? this.decryptText(encryptedContent.metadata_encrypted, familyKey) 
          : Promise.resolve(null)
      ]);

      const [titleResult, contentResult, metadataResult] = results;

      if (!contentResult.success) {
        throw new Error(`Failed to decrypt content: ${contentResult.error}`);
      }

      if (titleResult && !titleResult.success) {
        throw new Error(`Failed to decrypt title: ${titleResult.error}`);
      }

      if (metadataResult && !metadataResult.success) {
        throw new Error(`Failed to decrypt metadata: ${metadataResult.error}`);
      }

      return {
        title: titleResult?.decrypted_data || undefined,
        content: contentResult.decrypted_data,
        metadata: metadataResult?.decrypted_data 
          ? JSON.parse(metadataResult.decrypted_data) 
          : undefined
      };
    } catch (error) {
      throw new BadRequestException(`Error decrypting post content: ${error.message}`);
    }
  }

  /**
   * Verify family encryption key
   */
  async verifyFamilyKey(familyId: string, familyKey: string): Promise<boolean> {
    try {
      // Test encryption/decryption with a known string
      const testString = 'test_verification_string';
      const encrypted = await this.encryptText(testString, familyKey);
      
      if (!encrypted.success) {
        return false;
      }

      const decrypted = await this.decryptText(encrypted.encrypted_data, familyKey);
      
      return decrypted.success && decrypted.decrypted_data === testString;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear cached keys (for security)
   */
  clearKeyCache(): void {
    this.familyKeys = {};
  }

  /**
   * Rotate family encryption key
   */
  async rotateFamilyKey(familyId: string, userId: string): Promise<string> {
    try {
      // Mark old key as inactive
      await this.supabaseService.client
        .from('family_encryption_keys')
        .update({ is_active: false })
        .eq('family_id', familyId)
        .eq('is_active', true);

      // Generate new key
      const newKey = await this.generateFamilyKey(familyId);
      
      // Clear from cache
      delete this.familyKeys[familyId];
      
      return newKey;
    } catch (error) {
      throw new BadRequestException(`Failed to rotate family key: ${error.message}`);
    }
  }

  // Private helper methods

  /**
   * Encrypt key for storage (uses server master key)
   */
  private encryptStoredKey(key: string): string {
    try {
      // Use environment variable for master key
      const masterKey = process.env.ENCRYPTION_MASTER_KEY || 'default_master_key_change_in_production';
      
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', masterKey);
      
      let encrypted = cipher.update(key, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      throw new Error(`Failed to encrypt stored key: ${error.message}`);
    }
  }

  /**
   * Decrypt key from storage (uses server master key)
   */
  private decryptStoredKey(encryptedKey: string): string {
    try {
      const masterKey = process.env.ENCRYPTION_MASTER_KEY || 'default_master_key_change_in_production';
      
      const parts = encryptedKey.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted key format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipher('aes-256-cbc', masterKey);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Failed to decrypt stored key: ${error.message}`);
    }
  }
}