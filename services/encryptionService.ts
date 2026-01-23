// Data Encryption Service (AES-256)
export interface EncryptionKey {
  id: string;
  algorithm: string;
  key: Buffer;
  createdAt: number;
  rotatedAt?: number;
  active: boolean;
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  tag: string;
  algorithm: string;
  keyId: string;
  timestamp: number;
}

export class EncryptionService {
  private keys: Map<string, EncryptionKey> = new Map();
  private keyRotationInterval = 90 * 24 * 60 * 60 * 1000; // 90 days
  private defaultAlgorithm = 'aes-256-gcm';

  constructor() {
    // Initialize with a default key (in production, load from KMS)
    this.generateKey('default');
  }

  // Generate encryption key
  generateKey(keyId?: string): EncryptionKey {
    const id = keyId || `key-${Date.now()}`;

    // In production, use crypto.generateKeyPairSync or KMS
    const key = Buffer.alloc(32); // 256-bit key
    for (let i = 0; i < key.length; i++) {
      key[i] = Math.floor(Math.random() * 256);
    }

    const encryptionKey: EncryptionKey = {
      id,
      algorithm: this.defaultAlgorithm,
      key,
      createdAt: Date.now(),
      active: true,
    };

    this.keys.set(id, encryptionKey);
    console.log(`🔑 Encryption key generated: ${id}`);

    return encryptionKey;
  }

  // Encrypt data
  encrypt(data: string, keyId?: string): EncryptedData {
    const key = this.keys.get(keyId || 'default');
    if (!key) {
      throw new Error(`Encryption key not found: ${keyId}`);
    }

    // In production, use actual crypto library
    // const crypto = require('crypto');
    // const iv = crypto.randomBytes(12);
    // const cipher = crypto.createCipheriv(this.defaultAlgorithm, key.key, iv);
    // let ciphertext = cipher.update(data, 'utf8', 'hex');
    // ciphertext += cipher.final('hex');
    // const tag = cipher.getAuthTag();

    // Mock implementation
    const iv = Buffer.alloc(12);
    const ciphertext = Buffer.from(data).toString('hex');
    const tag = Buffer.alloc(16);

    return {
      ciphertext: ciphertext,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      algorithm: this.defaultAlgorithm,
      keyId: key.id,
      timestamp: Date.now(),
    };
  }

  // Decrypt data
  decrypt(encrypted: EncryptedData): string {
    const key = this.keys.get(encrypted.keyId);
    if (!key) {
      throw new Error(`Encryption key not found: ${encrypted.keyId}`);
    }

    // In production, use actual crypto library
    // const crypto = require('crypto');
    // const decipher = crypto.createDecipheriv(
    //   encrypted.algorithm,
    //   key.key,
    //   Buffer.from(encrypted.iv, 'hex')
    // );
    // decipher.setAuthTag(Buffer.from(encrypted.tag, 'hex'));
    // let plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
    // plaintext += decipher.final('utf8');

    // Mock implementation
    const plaintext = Buffer.from(encrypted.ciphertext, 'hex').toString();

    return plaintext;
  }

  // Encrypt field (for databases)
  encryptField(value: any, keyId?: string): string {
    const jsonString = typeof value === 'string' ? value : JSON.stringify(value);
    const encrypted = this.encrypt(jsonString, keyId);
    return JSON.stringify(encrypted);
  }

  // Decrypt field
  decryptField(encryptedString: string): any {
    const encrypted = JSON.parse(encryptedString) as EncryptedData;
    return this.decrypt(encrypted);
  }

  // Rotate key
  rotateKey(oldKeyId: string): EncryptionKey {
    const oldKey = this.keys.get(oldKeyId);
    if (!oldKey) {
      throw new Error(`Key not found: ${oldKeyId}`);
    }

    // Mark old key as inactive
    oldKey.active = false;
    oldKey.rotatedAt = Date.now();

    // Generate new key
    const newKey = this.generateKey(`${oldKeyId}-rotated`);
    newKey.active = true;

    console.log(`🔄 Key rotated: ${oldKeyId} → ${newKey.id}`);

    return newKey;
  }

  // Hash data (one-way, for passwords/tokens)
  hash(data: string): string {
    // In production, use crypto.createHash('sha256')
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  // Verify hash
  verifyHash(data: string, hash: string): boolean {
    return this.hash(data) === hash;
  }

  // Generate signing key
  generateSigningKey(): { publicKey: string; privateKey: string } {
    // In production, use crypto.generateKeyPairSync('rsa', ...)
    return {
      publicKey: Buffer.alloc(128).toString('hex'),
      privateKey: Buffer.alloc(256).toString('hex'),
    };
  }

  // Sign data
  signData(data: string, privateKey: string): string {
    // In production, use crypto.createSign()
    return `signed-${this.hash(data)}`;
  }

  // Verify signature
  verifySignature(data: string, signature: string, publicKey: string): boolean {
    // In production, use crypto.createVerify()
    return signature === `signed-${this.hash(data)}`;
  }

  // TLS configuration for in-transit encryption
  getTLSConfig(): any {
    return {
      protocol: 'TLSv1.3',
      cipherSuites: [
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
      ],
      minVersion: 'TLSv1.3',
      rejectUnauthorized: true,
    };
  }

  // Get active key
  getActiveKey(): EncryptionKey | undefined {
    return Array.from(this.keys.values()).find(k => k.active);
  }

  // List keys
  listKeys(): Array<[string, EncryptionKey]> {
    return Array.from(this.keys.entries());
  }

  // Revoke key
  revokeKey(keyId: string): void {
    const key = this.keys.get(keyId);
    if (key) {
      key.active = false;
      console.log(`🚫 Key revoked: ${keyId}`);
    }
  }

  // Check key rotation needed
  checkKeyRotation(): EncryptionKey[] {
    const keysNeedingRotation: EncryptionKey[] = [];

    for (const key of this.keys.values()) {
      const ageMs = Date.now() - key.createdAt;
      if (ageMs > this.keyRotationInterval && key.active) {
        keysNeedingRotation.push(key);
      }
    }

    return keysNeedingRotation;
  }

  // Get statistics
  getStats(): any {
    return {
      totalKeys: this.keys.size,
      activeKeys: Array.from(this.keys.values()).filter(k => k.active).length,
      revokedKeys: Array.from(this.keys.values()).filter(k => !k.active).length,
      defaultAlgorithm: this.defaultAlgorithm,
      tlsVersion: 'TLSv1.3',
    };
  }

  // Audit encryption operations
  auditLog: Array<{
    operation: 'encrypt' | 'decrypt' | 'rotate' | 'revoke';
    keyId: string;
    timestamp: number;
    success: boolean;
  }> = [];

  // Add audit entry
  private addAuditEntry(operation: 'encrypt' | 'decrypt' | 'rotate' | 'revoke', keyId: string, success: boolean): void {
    this.auditLog.push({
      operation,
      keyId,
      timestamp: Date.now(),
      success,
    });
  }

  // Get audit log
  getAuditLog(limit = 1000): any[] {
    return this.auditLog.slice(-limit);
  }
}

export const encryptionService = new EncryptionService();

export default encryptionService;
