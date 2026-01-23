// Feature Flags Service (LaunchDarkly-style)
export interface FeatureFlag {
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  rolloutPercent: number; // 0-100
  targetUsers?: Set<string>;
  rules?: FeatureFlagRule[];
  variants?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface FeatureFlagRule {
  id: string;
  name: string;
  conditions: Record<string, any>;
  variation: string;
  priority: number;
}

export interface FeatureFlagContext {
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  attributes?: Record<string, any>;
}

export class FeatureFlagsManager {
  private flags: Map<string, FeatureFlag> = new Map();
  private evaluationLog: Array<{
    flag: string;
    userId?: string;
    result: boolean;
    timestamp: number;
    variant?: string;
  }> = [];
  private maxLogSize = 100000;

  // Create flag
  createFlag(key: string, name: string, description?: string): FeatureFlag {
    if (this.flags.has(key)) {
      throw new Error(`Feature flag ${key} already exists`);
    }

    const flag: FeatureFlag = {
      key,
      name,
      description,
      enabled: false,
      rolloutPercent: 0,
      targetUsers: new Set(),
      rules: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.flags.set(key, flag);
    console.log(`🚩 Feature flag created: ${key}`);
    return flag;
  }

  // Get flag
  getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  // List flags
  listFlags(): Array<[string, FeatureFlag]> {
    return Array.from(this.flags.entries());
  }

  // Enable flag
  enableFlag(key: string): void {
    const flag = this.flags.get(key);
    if (flag) {
      flag.enabled = true;
      flag.updatedAt = Date.now();
      console.log(`✅ Flag enabled: ${key}`);
    }
  }

  // Disable flag
  disableFlag(key: string): void {
    const flag = this.flags.get(key);
    if (flag) {
      flag.enabled = false;
      flag.updatedAt = Date.now();
      console.log(`❌ Flag disabled: ${key}`);
    }
  }

  // Set rollout percentage
  setRolloutPercent(key: string, percent: number): void {
    const flag = this.flags.get(key);
    if (flag) {
      flag.rolloutPercent = Math.max(0, Math.min(100, percent));
      flag.updatedAt = Date.now();
    }
  }

  // Target specific user
  targetUser(key: string, userId: string): void {
    const flag = this.flags.get(key);
    if (flag && !flag.targetUsers) {
      flag.targetUsers = new Set();
    }
    flag?.targetUsers?.add(userId);
  }

  // Untarget user
  untargetUser(key: string, userId: string): void {
    const flag = this.flags.get(key);
    flag?.targetUsers?.delete(userId);
  }

  // Add rule
  addRule(key: string, rule: FeatureFlagRule): void {
    const flag = this.flags.get(key);
    if (flag) {
      if (!flag.rules) flag.rules = [];
      flag.rules.push(rule);
      flag.rules.sort((a, b) => a.priority - b.priority);
      flag.updatedAt = Date.now();
    }
  }

  // Evaluate flag for context
  isEnabled(key: string, context?: FeatureFlagContext): boolean {
    const flag = this.flags.get(key);
    if (!flag) {
      console.warn(`Feature flag not found: ${key}`);
      return false;
    }

    let result = false;

    // Check if globally disabled
    if (!flag.enabled) {
      result = false;
    } else if (context?.userId && flag.targetUsers?.has(context.userId)) {
      // Check target users
      result = true;
    } else if (flag.rules && flag.rules.length > 0) {
      // Evaluate rules
      for (const rule of flag.rules) {
        if (this.matchesConditions(rule.conditions, context)) {
          result = rule.variation !== 'off';
          break;
        }
      }
    } else if (flag.rolloutPercent > 0) {
      // Hash-based rollout
      const hash = this.hashUserId(context?.userId || 'anonymous');
      result = hash % 100 < flag.rolloutPercent;
    } else {
      result = flag.enabled;
    }

    // Log evaluation
    this.logEvaluation(key, context?.userId, result);

    return result;
  }

  // Get variant
  getVariant(key: string, context?: FeatureFlagContext): string | undefined {
    const flag = this.flags.get(key);
    if (!flag || !flag.variants) return undefined;

    // Check rules for variant
    if (flag.rules) {
      for (const rule of flag.rules) {
        if (this.matchesConditions(rule.conditions, context)) {
          return rule.variation;
        }
      }
    }

    // Hash-based variant selection
    const hash = this.hashUserId(context?.userId || 'anonymous');
    const variants = Object.keys(flag.variants);
    return variants[hash % variants.length];
  }

  // A/B testing
  isUserInVariant(key: string, variant: string, userId: string): boolean {
    const hash = this.hashUserId(userId);
    const bucketSize = 100 / 2; // For 50/50 split

    const bucket = Math.floor((hash % 100) / bucketSize);
    const variants = ['control', 'treatment'];

    return variants[bucket] === variant;
  }

  // Canary deployment
  canaryDeployment(flagKey: string, initialPercent = 5): void {
    const flag = this.flags.get(flagKey);
    if (flag) {
      flag.rolloutPercent = initialPercent;
      flag.enabled = true;
      console.log(`🚀 Canary deployment: ${flagKey} @ ${initialPercent}%`);
    }
  }

  // Increase rollout (for canary)
  increaseRollout(key: string, percent: number): void {
    const flag = this.flags.get(key);
    if (flag) {
      flag.rolloutPercent = Math.min(100, flag.rolloutPercent + percent);
      flag.updatedAt = Date.now();
      console.log(`📈 Rollout increased: ${key} @ ${flag.rolloutPercent}%`);
    }
  }

  // Rollback
  rollback(key: string): void {
    const flag = this.flags.get(key);
    if (flag) {
      flag.enabled = false;
      flag.rolloutPercent = 0;
      flag.updatedAt = Date.now();
      console.log(`⏮️ Rollback: ${key}`);
    }
  }

  // Get analytics
  getAnalytics(key: string, since?: number): any {
    const logs = this.evaluationLog.filter(log => {
      if (log.flag !== key) return false;
      if (since && log.timestamp < since) return false;
      return true;
    });

    const enabledCount = logs.filter(l => l.result).length;
    const disabledCount = logs.length - enabledCount;

    return {
      totalEvaluations: logs.length,
      enabledCount,
      disabledCount,
      enabledPercent: logs.length > 0 ? (enabledCount / logs.length * 100).toFixed(2) : 0,
      uniqueUsers: new Set(logs.map(l => l.userId)).size,
    };
  }

  // Delete flag
  deleteFlag(key: string): boolean {
    return this.flags.delete(key);
  }

  // Private methods
  private matchesConditions(conditions: Record<string, any>, context?: FeatureFlagContext): boolean {
    if (!context) return false;

    for (const [key, expected] of Object.entries(conditions)) {
      let actual: any;

      if (key === 'userId') {
        actual = context.userId;
      } else if (key === 'tenantId') {
        actual = context.tenantId;
      } else {
        actual = context.attributes?.[key];
      }

      if (actual !== expected) {
        return false;
      }
    }

    return true;
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private logEvaluation(flag: string, userId: string | undefined, result: boolean): void {
    this.evaluationLog.push({
      flag,
      userId,
      result,
      timestamp: Date.now(),
    });

    // Cleanup old logs
    if (this.evaluationLog.length > this.maxLogSize) {
      this.evaluationLog = this.evaluationLog.slice(-this.maxLogSize);
    }
  }
}

export const featureFlagsManager = new FeatureFlagsManager();

export default featureFlagsManager;
