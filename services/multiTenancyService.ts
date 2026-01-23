// Multi-Tenancy Service
export interface Tenant {
  id: string;
  name: string;
  domain: string;
  tier: 'free' | 'pro' | 'enterprise';
  createdAt: number;
  metadata?: Record<string, any>;
  customDomain?: string;
  billingEmail?: string;
  features: string[];
}

export interface TenantDatabase {
  tenantId: string;
  type: 'postgres' | 'mysql' | 'mongodb';
  host: string;
  port: number;
  database: string;
  credentials?: {
    username: string;
    password: string; // In production, encrypt this
  };
}

export interface TenantMetrics {
  tenantId: string;
  totalRequests: number;
  totalCost: number;
  storageUsed: number;
  usersCount: number;
  lastActiveAt: number;
}

export class MultiTenancyManager {
  private tenants: Map<string, Tenant> = new Map();
  private tenantDatabases: Map<string, TenantDatabase> = new Map();
  private tenantMetrics: Map<string, TenantMetrics> = new Map();
  private tenantIsolation: Map<string, Set<string>> = new Map(); // Tenant data isolation

  private tierFeatures: Record<string, string[]> = {
    free: ['basic-analysis', 'single-agent', 'limited-storage'],
    pro: ['multi-agent', 'advanced-analysis', 'extended-storage', 'custom-domain'],
    enterprise: ['unlimited-agents', 'dedicated-support', 'custom-domain', 'sso', 'audit-logs'],
  };

  // Create tenant
  createTenant(name: string, domain: string, tier: 'free' | 'pro' | 'enterprise' = 'free'): Tenant {
    const tenant: Tenant = {
      id: `tenant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      domain,
      tier,
      createdAt: Date.now(),
      features: this.tierFeatures[tier],
    };

    this.tenants.set(tenant.id, tenant);
    this.tenantIsolation.set(tenant.id, new Set());
    this.tenantMetrics.set(tenant.id, {
      tenantId: tenant.id,
      totalRequests: 0,
      totalCost: 0,
      storageUsed: 0,
      usersCount: 0,
      lastActiveAt: Date.now(),
    });

    console.log(`🏢 Tenant created: ${tenant.id} (${name})`);
    return tenant;
  }

  // Get tenant
  getTenant(tenantId: string): Tenant | undefined {
    return this.tenants.get(tenantId);
  }

  // List tenants
  listTenants(): Array<[string, Tenant]> {
    return Array.from(this.tenants.entries());
  }

  // Update tenant
  updateTenant(tenantId: string, updates: Partial<Tenant>): void {
    const tenant = this.tenants.get(tenantId);
    if (tenant) {
      Object.assign(tenant, updates);
      if (updates.tier && updates.features === undefined) {
        tenant.features = this.tierFeatures[updates.tier];
      }
    }
  }

  // Delete tenant
  deleteTenant(tenantId: string): boolean {
    this.tenants.delete(tenantId);
    this.tenantDatabases.delete(tenantId);
    this.tenantMetrics.delete(tenantId);
    this.tenantIsolation.delete(tenantId);
    return true;
  }

  // Register tenant database
  registerDatabase(tenantId: string, database: TenantDatabase): void {
    this.tenantDatabases.set(tenantId, database);
    console.log(`🗄️ Database registered for tenant ${tenantId}`);
  }

  // Get tenant database
  getDatabase(tenantId: string): TenantDatabase | undefined {
    return this.tenantDatabases.get(tenantId);
  }

  // Isolate tenant data
  isolateData(tenantId: string, dataKey: string): void {
    const isolation = this.tenantIsolation.get(tenantId);
    if (isolation) {
      isolation.add(dataKey);
    }
  }

  // Check data isolation
  checkDataIsolation(tenantId: string, dataKey: string): boolean {
    const isolation = this.tenantIsolation.get(tenantId);
    return isolation?.has(dataKey) || false;
  }

  // Check feature access
  hasFeature(tenantId: string, feature: string): boolean {
    const tenant = this.tenants.get(tenantId);
    return tenant?.features.includes(feature) || false;
  }

  // Upgrade tenant tier
  upgradeTier(tenantId: string, newTier: 'free' | 'pro' | 'enterprise'): void {
    const tenant = this.tenants.get(tenantId);
    if (tenant) {
      tenant.tier = newTier;
      tenant.features = this.tierFeatures[newTier];
      console.log(`⬆️ Tenant upgraded: ${tenantId} → ${newTier}`);
    }
  }

  // Add custom domain
  addCustomDomain(tenantId: string, customDomain: string): void {
    const tenant = this.tenants.get(tenantId);
    if (tenant) {
      tenant.customDomain = customDomain;
      console.log(`🌐 Custom domain added: ${customDomain} → ${tenantId}`);
    }
  }

  // Track request
  trackRequest(tenantId: string, cost: number = 0): void {
    const metrics = this.tenantMetrics.get(tenantId);
    if (metrics) {
      metrics.totalRequests++;
      metrics.totalCost += cost;
      metrics.lastActiveAt = Date.now();
    }
  }

  // Update storage usage
  updateStorageUsage(tenantId: string, bytes: number): void {
    const metrics = this.tenantMetrics.get(tenantId);
    if (metrics) {
      metrics.storageUsed += bytes;
    }
  }

  // Update user count
  updateUserCount(tenantId: string, count: number): void {
    const metrics = this.tenantMetrics.get(tenantId);
    if (metrics) {
      metrics.usersCount = count;
    }
  }

  // Get tenant metrics
  getMetrics(tenantId: string): TenantMetrics | undefined {
    return this.tenantMetrics.get(tenantId);
  }

  // Get all metrics
  getAllMetrics(): Record<string, TenantMetrics> {
    const result: Record<string, TenantMetrics> = {};
    for (const [id, metrics] of this.tenantMetrics) {
      result[id] = metrics;
    }
    return result;
  }

  // Calculate billing
  calculateBilling(tenantId: string, month: string): any {
    const tenant = this.tenants.get(tenantId);
    const metrics = this.tenantMetrics.get(tenantId);

    if (!tenant || !metrics) return null;

    const basePrices: Record<string, number> = {
      free: 0,
      pro: 29,
      enterprise: 299,
    };

    const overagePrices: Record<string, number> = {
      free: 0.001,   // $0.001 per request
      pro: 0.0001,   // $0.0001 per request
      enterprise: 0, // No overage
    };

    const basePrice = basePrices[tenant.tier];
    const overagePrice = metrics.totalRequests * overagePrices[tenant.tier];
    const storagePrice = (metrics.storageUsed / (1024 * 1024 * 1024)) * 0.10; // $0.10 per GB

    return {
      tenantId,
      month,
      basePrice,
      overagePrice,
      storagePrice,
      total: basePrice + overagePrice + storagePrice,
      metrics: {
        requests: metrics.totalRequests,
        storageGB: (metrics.storageUsed / (1024 * 1024 * 1024)).toFixed(2),
        users: metrics.usersCount,
      },
    };
  }

  // Onboard tenant
  async onboardTenant(name: string, domain: string, tier: 'free' | 'pro' | 'enterprise'): Promise<Tenant> {
    // Create tenant
    const tenant = this.createTenant(name, domain, tier);

    // Register database (mock)
    this.registerDatabase(tenant.id, {
      tenantId: tenant.id,
      type: 'postgres',
      host: 'db.example.com',
      port: 5432,
      database: `tenant_${tenant.id}`,
      credentials: {
        username: `user_${tenant.id}`,
        password: 'encrypted-password', // Would be encrypted in production
      },
    });

    // Initialize metrics
    this.trackRequest(tenant.id);

    console.log(`✨ Tenant onboarded: ${tenant.id}`);
    return tenant;
  }

  // Get system stats
  getSystemStats(): any {
    const metrics = Array.from(this.tenantMetrics.values());
    const tierDistribution = Array.from(this.tenants.values()).reduce((acc, t) => {
      acc[t.tier] = (acc[t.tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalTenants: this.tenants.size,
      tierDistribution,
      totalRequests: metrics.reduce((sum, m) => sum + m.totalRequests, 0),
      totalCost: metrics.reduce((sum, m) => sum + m.totalCost, 0),
      totalStorageGB: (metrics.reduce((sum, m) => sum + m.storageUsed, 0) / (1024 * 1024 * 1024)).toFixed(2),
      totalUsers: metrics.reduce((sum, m) => sum + m.usersCount, 0),
    };
  }
}

export const multiTenancyManager = new MultiTenancyManager();

export default multiTenancyManager;
