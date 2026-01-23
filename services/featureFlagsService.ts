// Feature Flags Service (A/B Testing & Canary Deployments)
export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  variant?: string;
  rolloutPercentage: number; // 0-100
  targetedUsers?: string[];
  targetedTenants?: string[];
  createdAt: number;
  updatedAt: number;
}

export class FeatureFlagsService {
  private flags: Map<string, FeatureFlag> = new Map();
  private userVariants: Map<string, Record<string, string>> = new Map();

  createFlag(
    name: string,
    options: Partial<FeatureFlag> = {}
  ): FeatureFlag {
    const flag: FeatureFlag = {
      id: `flag-${Date.now()}`,
      name,
      description: options.description || '',
      enabled: options.enabled !== false,
      variant: options.variant,
      rolloutPercentage: options.rolloutPercentage || 0,
      targetedUsers: options.targetedUsers || [],
      targetedTenants: options.targetedTenants || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.flags.set(flag.id, flag);
    return flag;
  }

  isEnabled(flagName: string, userId?: string, tenantId?: string): boolean {
    const flag = Array.from(this.flags.values()).find(f => f.name === flagName);
    if (!flag || !flag.enabled) return false;

    // Check targeted users
    if (userId && flag.targetedUsers?.includes(userId)) return true;

    // Check targeted tenants
    if (tenantId && flag.targetedTenants?.includes(tenantId)) return true;

    // Check rollout percentage
    if (userId) {
      const hash = this.hashUserId(userId);
      return hash < flag.rolloutPercentage;
    }

    return flag.rolloutPercentage === 100;
  }

  getVariant(flagName: string, userId?: string): string | undefined {
    const flag = Array.from(this.flags.values()).find(f => f.name === flagName);
    if (!flag || !flag.variant) return undefined;

    if (userId && this.isEnabled(flagName, userId)) {
      if (!this.userVariants.has(userId)) {
        this.userVariants.set(userId, {});
      }

      if (!this.userVariants.get(userId)![flagName]) {
        // Assign consistent variant based on user ID
        const variants = flag.variant.split('|');
        const hash = this.hashUserId(userId);
        const variantIndex = hash % variants.length;
        this.userVariants.get(userId)![flagName] = variants[variantIndex];
      }

      return this.userVariants.get(userId)![flagName];
    }

    return flag.variant.split('|')[0];
  }

  setRolloutPercentage(flagName: string, percentage: number): FeatureFlag {
    const flag = Array.from(this.flags.values()).find(f => f.name === flagName);
    if (!flag) throw new Error(`Flag ${flagName} not found`);

    flag.rolloutPercentage = Math.min(100, Math.max(0, percentage));
    flag.updatedAt = Date.now();

    return flag;
  }

  targetUser(flagName: string, userId: string): void {
    const flag = Array.from(this.flags.values()).find(f => f.name === flagName);
    if (!flag) throw new Error(`Flag ${flagName} not found`);

    if (!flag.targetedUsers) flag.targetedUsers = [];
    if (!flag.targetedUsers.includes(userId)) {
      flag.targetedUsers.push(userId);
    }
  }

  untargetUser(flagName: string, userId: string): void {
    const flag = Array.from(this.flags.values()).find(f => f.name === flagName);
    if (!flag) return;

    if (flag.targetedUsers) {
      flag.targetedUsers = flag.targetedUsers.filter(u => u !== userId);
    }
  }

  // Canary deployment
  canaryDeploy(flagName: string, startPercentage = 5): void {
    this.setRolloutPercentage(flagName, startPercentage);
  }

  progressCanary(flagName: string, percentage: number): void {
    this.setRolloutPercentage(flagName, percentage);
  }

  rollbackCanary(flagName: string): void {
    const flag = Array.from(this.flags.values()).find(f => f.name === flagName);
    if (flag) {
      flag.enabled = false;
      flag.rolloutPercentage = 0;
    }
  }

  getFlag(flagName: string): FeatureFlag | undefined {
    return Array.from(this.flags.values()).find(f => f.name === flagName);
  }

  listFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  getMetrics(flagName: string): {
    totalUsers: number;
    enabledUsers: number;
    enablementRate: number;
  } {
    const flag = this.getFlag(flagName);
    if (!flag) return { totalUsers: 0, enabledUsers: 0, enablementRate: 0 };

    const totalUsers = this.userVariants.size;
    const enabledUsers = Array.from(this.userVariants.keys()).filter(
      userId => this.isEnabled(flagName, userId)
    ).length;

    return {
      totalUsers,
      enabledUsers,
      enablementRate: totalUsers > 0 ? (enabledUsers / totalUsers) * 100 : 0,
    };
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % 100;
  }
}

export const featureFlags = new FeatureFlagsService();

export default featureFlags;
