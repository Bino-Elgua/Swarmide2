// File Storage Service (S3/GCS-compatible)
export interface StorageFile {
  id: string;
  name: string;
  key: string;
  size: number;
  mimeType: string;
  uploadedAt: number;
  expiresAt?: number;
  checksum: string;
  versions?: string[];
  metadata?: Record<string, any>;
}

export interface PresignedUrl {
  url: string;
  expiresAt: number;
  method: 'GET' | 'PUT';
}

export interface StorageQuota {
  maxSize: number;
  currentSize: number;
  fileCount: number;
}

export class FileStorageService {
  private files: Map<string, StorageFile> = new Map();
  private fileData: Map<string, Buffer> = new Map();
  private fileVersions: Map<string, string[]> = new Map();
  private quotas: Map<string, StorageQuota> = new Map();
  private presignedUrls: Map<string, PresignedUrl> = new Map();

  private defaultQuota = 10 * 1024 * 1024 * 1024; // 10GB default
  private maxFileSize = 5 * 1024 * 1024 * 1024; // 5GB max per file

  // Upload file
  async uploadFile(
    tenantId: string,
    fileName: string,
    data: Buffer,
    mimeType: string,
    metadata?: Record<string, any>
  ): Promise<StorageFile> {
    // Check quotas
    const quota = this.getQuota(tenantId);
    if (quota.currentSize + data.length > quota.maxSize) {
      throw new Error('Storage quota exceeded');
    }

    if (data.length > this.maxFileSize) {
      throw new Error(`File size exceeds maximum of ${this.maxFileSize / (1024 * 1024 * 1024)}GB`);
    }

    // Generate unique key
    const key = `${tenantId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}/${fileName}`;
    const checksum = this.generateChecksum(data);

    // Check for duplicates
    const existingFile = Array.from(this.files.values()).find(f => f.checksum === checksum);
    if (existingFile && existingFile.key.startsWith(tenantId)) {
      console.log(`📦 File already exists: ${existingFile.key}`);
      return existingFile;
    }

    const file: StorageFile = {
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: fileName,
      key,
      size: data.length,
      mimeType,
      uploadedAt: Date.now(),
      checksum,
      metadata,
    };

    this.files.set(file.id, file);
    this.fileData.set(key, data);
    this.fileVersions.set(key, [file.id]);

    // Update quota
    quota.currentSize += data.length;
    quota.fileCount++;

    console.log(`📤 File uploaded: ${fileName} (${(data.length / (1024 * 1024)).toFixed(2)}MB)`);
    return file;
  }

  // Download file
  async downloadFile(tenantId: string, fileId: string): Promise<Buffer | null> {
    const file = this.files.get(fileId);
    if (!file || !file.key.startsWith(tenantId)) {
      return null;
    }

    return this.fileData.get(file.key) || null;
  }

  // Get file metadata
  getFileMetadata(tenantId: string, fileId: string): StorageFile | null {
    const file = this.files.get(fileId);
    if (!file || !file.key.startsWith(tenantId)) {
      return null;
    }

    return file;
  }

  // List files
  listFiles(tenantId: string, prefix?: string): StorageFile[] {
    return Array.from(this.files.values()).filter(file => {
      if (!file.key.startsWith(tenantId)) return false;
      if (prefix && !file.key.includes(prefix)) return false;
      return true;
    });
  }

  // Generate presigned URL
  generatePresignedUrl(tenantId: string, fileId: string, method: 'GET' | 'PUT' = 'GET', expiresIn = 3600): PresignedUrl {
    const file = this.files.get(fileId);
    if (!file || !file.key.startsWith(tenantId)) {
      throw new Error('File not found or access denied');
    }

    const expiresAt = Date.now() + expiresIn * 1000;

    // Generate mock URL
    const url = `https://storage.example.com/${file.key}?token=${Math.random().toString(36).substr(2)}&expires=${expiresAt}`;

    const presigned: PresignedUrl = { url, expiresAt, method };
    this.presignedUrls.set(fileId, presigned);

    return presigned;
  }

  // Delete file
  async deleteFile(tenantId: string, fileId: string): Promise<boolean> {
    const file = this.files.get(fileId);
    if (!file || !file.key.startsWith(tenantId)) {
      return false;
    }

    // Update quota
    const quota = this.getQuota(tenantId);
    quota.currentSize -= file.size;
    quota.fileCount--;

    this.fileData.delete(file.key);
    this.fileVersions.delete(file.key);
    this.files.delete(fileId);

    console.log(`🗑️ File deleted: ${file.name}`);
    return true;
  }

  // Version file
  async versionFile(tenantId: string, fileId: string, data: Buffer): Promise<string> {
    const file = this.files.get(fileId);
    if (!file || !file.key.startsWith(tenantId)) {
      throw new Error('File not found or access denied');
    }

    const versionId = `${fileId}-v${(file.versions?.length || 1) + 1}`;
    const versionKey = `${file.key}/v${Date.now()}`;

    this.fileData.set(versionKey, data);

    if (!file.versions) file.versions = [];
    file.versions.push(versionId);

    return versionId;
  }

  // Get file versions
  getFileVersions(tenantId: string, fileId: string): string[] {
    const file = this.files.get(fileId);
    if (!file || !file.key.startsWith(tenantId)) {
      return [];
    }

    return file.versions || [];
  }

  // Copy file
  async copyFile(tenantId: string, sourceFileId: string, destFileName: string): Promise<StorageFile> {
    const sourceFile = this.files.get(sourceFileId);
    if (!sourceFile || !sourceFile.key.startsWith(tenantId)) {
      throw new Error('Source file not found or access denied');
    }

    const data = this.fileData.get(sourceFile.key);
    if (!data) {
      throw new Error('File data not found');
    }

    return this.uploadFile(tenantId, destFileName, data, sourceFile.mimeType);
  }

  // Get quota
  private getQuota(tenantId: string): StorageQuota {
    if (!this.quotas.has(tenantId)) {
      this.quotas.set(tenantId, {
        maxSize: this.defaultQuota,
        currentSize: 0,
        fileCount: 0,
      });
    }

    return this.quotas.get(tenantId)!;
  }

  // Set custom quota
  setQuota(tenantId: string, maxSizeGB: number): void {
    this.quotas.set(tenantId, {
      maxSize: maxSizeGB * 1024 * 1024 * 1024,
      currentSize: this.quotas.get(tenantId)?.currentSize || 0,
      fileCount: this.quotas.get(tenantId)?.fileCount || 0,
    });
  }

  // Scan for viruses (mock)
  async scanForVirus(data: Buffer): Promise<{ safe: boolean; threats?: string[] }> {
    // In production, integrate with ClamAV or similar
    return { safe: true };
  }

  // Backup file
  async backupFile(tenantId: string, fileId: string): Promise<string> {
    const file = this.files.get(fileId);
    if (!file || !file.key.startsWith(tenantId)) {
      throw new Error('File not found or access denied');
    }

    const data = this.fileData.get(file.key);
    if (!data) {
      throw new Error('File data not found');
    }

    const backupKey = `${file.key}/backup-${Date.now()}`;
    this.fileData.set(backupKey, data);

    return backupKey;
  }

  // Restore from backup
  async restoreFromBackup(tenantId: string, backupKey: string): Promise<string> {
    if (!backupKey.startsWith(tenantId)) {
      throw new Error('Access denied');
    }

    const data = this.fileData.get(backupKey);
    if (!data) {
      throw new Error('Backup not found');
    }

    const fileName = backupKey.split('/').pop() || 'restored';
    const restored = await this.uploadFile(tenantId, fileName, data, 'application/octet-stream');

    return restored.id;
  }

  // Get storage stats
  getStats(tenantId: string): any {
    const quota = this.getQuota(tenantId);
    const files = this.listFiles(tenantId);

    return {
      quotaGB: (quota.maxSize / (1024 * 1024 * 1024)).toFixed(2),
      usedGB: (quota.currentSize / (1024 * 1024 * 1024)).toFixed(2),
      remainingGB: ((quota.maxSize - quota.currentSize) / (1024 * 1024 * 1024)).toFixed(2),
      usagePercent: ((quota.currentSize / quota.maxSize) * 100).toFixed(2),
      fileCount: quota.fileCount,
      files: files.map(f => ({
        name: f.name,
        sizeMB: (f.size / (1024 * 1024)).toFixed(2),
        uploadedAt: new Date(f.uploadedAt).toISOString(),
      })),
    };
  }

  // Private methods
  private generateChecksum(data: Buffer): string {
    // Simple checksum - in production use crypto.createHash('sha256')
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data[i];
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

export const fileStorageService = new FileStorageService();

export default fileStorageService;
