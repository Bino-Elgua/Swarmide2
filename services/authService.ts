// Authentication & Authorization Service
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  roles: string[];
  permissions: string[];
  mfaEnabled: boolean;
  mfaSecret?: string;
  createdAt: number;
  lastLogin?: number;
}

export interface Token {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface OAuth2Config {
  provider: 'google' | 'github';
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class AuthService {
  private jwtSecret: string;
  private refreshSecret: string;
  private accessTokenExpiry = 3600; // 1 hour
  private refreshTokenExpiry = 604800; // 7 days
  private users: Map<string, User> = new Map();
  private refreshTokens: Map<string, string> = new Map();

  constructor(jwtSecret?: string, refreshSecret?: string) {
    this.jwtSecret = jwtSecret || process.env.JWT_SECRET || 'dev-secret';
    this.refreshSecret = refreshSecret || process.env.REFRESH_SECRET || 'refresh-secret';
  }

  // Password hashing
  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // User registration
  async register(email: string, password: string, roles: string[] = ['user']): Promise<User> {
    if (this.users.has(email)) {
      throw new Error('User already exists');
    }

    const passwordHash = await this.hashPassword(password);
    const user: User = {
      id: `user-${Date.now()}`,
      email,
      passwordHash,
      roles,
      permissions: this.getPermissionsForRoles(roles),
      mfaEnabled: false,
      createdAt: Date.now(),
    };

    this.users.set(email, user);
    return user;
  }

  // User login
  async login(email: string, password: string): Promise<Token> {
    const user = this.users.get(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const passwordValid = await this.verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      throw new Error('Invalid credentials');
    }

    user.lastLogin = Date.now();
    return this.generateTokens(user);
  }

  // Generate JWT tokens
  generateTokens(user: User): Token {
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        roles: user.roles,
        permissions: user.permissions,
      },
      this.jwtSecret,
      { expiresIn: this.accessTokenExpiry }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      this.refreshSecret,
      { expiresIn: this.refreshTokenExpiry }
    );

    this.refreshTokens.set(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpiry,
    };
  }

  // Verify access token
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Refresh access token
  refreshAccessToken(refreshToken: string): Token {
    try {
      const payload = jwt.verify(refreshToken, this.refreshSecret) as any;
      const user = this.users.get(Array.from(this.users.values()).find(u => u.id === payload.userId)?.email || '');
      
      if (!user) {
        throw new Error('User not found');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  // Role-based access control
  hasPermission(user: any, permission: string): boolean {
    return user.permissions?.includes(permission) || false;
  }

  hasRole(user: any, role: string): boolean {
    return user.roles?.includes(role) || false;
  }

  // Role permissions mapping
  private getPermissionsForRoles(roles: string[]): string[] {
    const rolePermissions: Record<string, string[]> = {
      admin: ['read:all', 'write:all', 'delete:all', 'manage:users', 'manage:settings'],
      user: ['read:own', 'write:own'],
      viewer: ['read:public'],
      api: ['read:all', 'write:all'],
    };

    const permissions = new Set<string>();
    roles.forEach(role => {
      (rolePermissions[role] || []).forEach(p => permissions.add(p));
    });

    return Array.from(permissions);
  }

  // OAuth2 token exchange (stub for integration)
  async exchangeOAuth2Token(provider: string, code: string): Promise<User> {
    // This would integrate with Google/GitHub OAuth2 flow
    throw new Error(`OAuth2 provider ${provider} not yet implemented`);
  }

  // MFA setup
  async enableMFA(userId: string): Promise<string> {
    const user = Array.from(this.users.values()).find(u => u.id === userId);
    if (!user) throw new Error('User not found');

    const secret = this.generateMFASecret();
    user.mfaEnabled = true;
    user.mfaSecret = secret;
    return secret;
  }

  // MFA verification
  verifyMFA(mfaSecret: string, code: string): boolean {
    // Implement TOTP verification
    return true; // Stub
  }

  private generateMFASecret(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  // Logout
  logout(userId: string): void {
    this.refreshTokens.delete(userId);
  }

  // Get user
  getUser(email: string): User | undefined {
    return this.users.get(email);
  }

  // Update user roles
  async updateUserRoles(email: string, roles: string[]): Promise<User> {
    const user = this.users.get(email);
    if (!user) throw new Error('User not found');

    user.roles = roles;
    user.permissions = this.getPermissionsForRoles(roles);
    return user;
  }
}

export const authService = new AuthService();

export default authService;
