export interface NormalizedSpec {
  title: string;
  description: string;
  type: 'software' | 'research' | 'content' | 'general';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  scale: 'small' | 'medium' | 'large' | 'enterprise';
  estimatedHours: number;
  technologies?: string[];
  constraints?: string[];
  success_criteria?: string[];
  raw_input: string;
  confidence: number; // 0-1, how confident is the parsing
}

class SpecKitService {
  // Normalize free-form user input into structured spec
  async normalizeInput(userInput: string): Promise<NormalizedSpec> {
    // Extract key indicators
    const titleMatch = userInput.match(/^(.*?)(?:\n|$)/);
    const title = titleMatch ? titleMatch[1].trim() : 'Unnamed Project';

    // Detect project type
    const type = this.detectProjectType(userInput);

    // Extract priority
    const priority = this.extractPriority(userInput);

    // Estimate scale
    const scale = this.estimateScale(userInput);

    // Extract technologies mentioned
    const technologies = this.extractTechnologies(userInput);

    // Extract constraints
    const constraints = this.extractConstraints(userInput);

    // Extract success criteria
    const success_criteria = this.extractSuccessCriteria(userInput);

    // Estimate effort
    const estimatedHours = this.estimateEffort(
      userInput,
      type,
      scale,
      technologies.length
    );

    // Calculate confidence
    const confidence = this.calculateConfidence(userInput, {
      title,
      type,
      priority,
      scale,
      technologies,
      constraints,
      success_criteria,
    });

    return {
      title,
      description: userInput,
      type,
      priority,
      scale,
      estimatedHours,
      technologies,
      constraints,
      success_criteria,
      raw_input: userInput,
      confidence,
    };
  }

  private detectProjectType(input: string): 'software' | 'research' | 'content' | 'general' {
    const softwareKeywords = [
      'app',
      'api',
      'service',
      'website',
      'platform',
      'system',
      'tool',
      'framework',
      'library',
      'backend',
      'frontend',
      'database',
      'microservice',
      'saas',
    ];
    const researchKeywords = [
      'study',
      'research',
      'analysis',
      'experiment',
      'paper',
      'hypothesis',
      'data',
      'algorithm',
      'optimization',
      'benchmark',
    ];
    const contentKeywords = [
      'write',
      'article',
      'blog',
      'documentation',
      'guide',
      'tutorial',
      'video',
      'course',
      'book',
      'story',
    ];

    const inputLower = input.toLowerCase();
    const softwareScore = softwareKeywords.filter(k => inputLower.includes(k)).length;
    const researchScore = researchKeywords.filter(k => inputLower.includes(k)).length;
    const contentScore = contentKeywords.filter(k => inputLower.includes(k)).length;

    if (softwareScore > researchScore && softwareScore > contentScore) return 'software';
    if (researchScore > contentScore) return 'research';
    if (contentScore > 0) return 'content';
    return 'general';
  }

  private extractPriority(input: string): 'urgent' | 'high' | 'medium' | 'low' {
    const inputLower = input.toLowerCase();

    if (/urgent|asap|immediately|critical|emergency/i.test(inputLower)) return 'urgent';
    if (/high|important|priority|must|essential/i.test(inputLower)) return 'high';
    if (/medium|standard|regular|normal/i.test(inputLower)) return 'medium';

    return 'low';
  }

  private estimateScale(input: string): 'small' | 'medium' | 'large' | 'enterprise' {
    const inputLower = input.toLowerCase();
    const length = input.length;

    // Simple heuristics
    if (/enterprise|large scale|millions?|distributed|global|multi.?(region|tenant|country)/i.test(inputLower)) {
      return 'enterprise';
    }
    if (/complex|integration|multiple|custom|advanced/i.test(inputLower) || length > 500) {
      return 'large';
    }
    if (length > 200) {
      return 'medium';
    }

    return 'small';
  }

  private extractTechnologies(input: string): string[] {
    const techKeywords = [
      'python',
      'javascript',
      'typescript',
      'react',
      'vue',
      'svelte',
      'node',
      'nextjs',
      'fastapi',
      'django',
      'rust',
      'go',
      'java',
      'csharp',
      'kotlin',
      'php',
      'rails',
      'laravel',
      'postgresql',
      'mysql',
      'mongodb',
      'redis',
      'elasticsearch',
      'aws',
      'gcp',
      'azure',
      'kubernetes',
      'docker',
      'graphql',
      'rest',
      'grpc',
      'openai',
      'claude',
      'gemini',
      'llm',
      'ml',
      'ai',
      'tensorflow',
      'pytorch',
      'scikit-learn',
    ];

    const inputLower = input.toLowerCase();
    const found = new Set<string>();

    techKeywords.forEach(tech => {
      if (inputLower.includes(tech)) {
        found.add(tech);
      }
    });

    return Array.from(found);
  }

  private extractConstraints(input: string): string[] {
    const constraints: string[] = [];

    // Time constraints
    const timeMatch = input.match(/(?:within|in|by|deadline|due)\s+(\d+\s+(?:days?|weeks?|months?))/i);
    if (timeMatch) {
      constraints.push(`Timeline: ${timeMatch[1]}`);
    }

    // Budget constraints
    const budgetMatch = input.match(/\$[\d,]+|budget[:\s]+[\d,]+|cost[:\s]+[\d,]+/i);
    if (budgetMatch) {
      constraints.push(`Budget: ${budgetMatch[0]}`);
    }

    // Resource constraints
    if (/limited resources|small team|solo|one person/i.test(input)) {
      constraints.push('Limited team resources');
    }

    // Technical constraints
    if (/offline|air.?gap|no internet|local only/i.test(input)) {
      constraints.push('Offline/Air-gapped environment');
    }

    if (/mobile.?only|web.?only|browser.?only/i.test(input)) {
      constraints.push('Platform-specific requirement');
    }

    return constraints;
  }

  private extractSuccessCriteria(input: string): string[] {
    const criteria: string[] = [];

    // Performance criteria
    if (/performance|speed|latency|throughput/i.test(input)) {
      const perfMatch = input.match(/(\d+\s*(?:ms|seconds?|minutes?|requests?\/s|qps|tps))/i);
      if (perfMatch) {
        criteria.push(`Performance: ${perfMatch[1]}`);
      } else {
        criteria.push('Performance optimization required');
      }
    }

    // Reliability criteria
    if (/uptime|availability|reliability|99\.|sla/i.test(input)) {
      const availMatch = input.match(/(99\.?99|99\.9|99|95)%/);
      if (availMatch) {
        criteria.push(`Availability: ${availMatch[1]}%`);
      } else {
        criteria.push('High availability required');
      }
    }

    // User metrics
    if (/users?|customers?|scale to/i.test(input)) {
      const userMatch = input.match(/(\d+(?:k|m)?)\s+(?:users?|customers?|concurrent)/i);
      if (userMatch) {
        criteria.push(`User capacity: ${userMatch[1]}`);
      }
    }

    // Feature criteria
    if (/must have|requirements|should/i.test(input)) {
      const features = input
        .split(/[\n;,.]/)
        .filter(line => /must have|should|requirement|feature/i.test(line))
        .slice(0, 3);

      features.forEach(f => {
        const clean = f.replace(/must have|should|requirement|feature|:/gi, '').trim();
        if (clean) criteria.push(clean);
      });
    }

    return criteria.slice(0, 5); // Top 5 criteria
  }

  private estimateEffort(input: string, type: string, scale: string, techCount: number): number {
    let baseHours = 0;

    // Type-based estimates
    switch (type) {
      case 'software':
        baseHours = 40;
        break;
      case 'research':
        baseHours = 60;
        break;
      case 'content':
        baseHours = 20;
        break;
      default:
        baseHours = 30;
    }

    // Scale multipliers
    switch (scale) {
      case 'small':
        baseHours *= 1;
        break;
      case 'medium':
        baseHours *= 2.5;
        break;
      case 'large':
        baseHours *= 5;
        break;
      case 'enterprise':
        baseHours *= 10;
        break;
    }

    // Technology complexity multiplier (each tech adds ~5 hours)
    baseHours += techCount * 5;

    // Input length multiplier (longer requirements = more effort)
    const lengthMultiplier = Math.min(2, 1 + input.length / 1000);
    baseHours *= lengthMultiplier;

    // Integration/complexity indicators
    if (/integration|api|external|third.?party|webhook|complex|algorithm/i.test(input)) {
      baseHours *= 1.5;
    }

    return Math.round(baseHours);
  }

  private calculateConfidence(input: string, parsed: any): number {
    let confidence = 0.5; // Start at 50%

    // Title extraction confidence
    if (parsed.title && parsed.title.length > 5) {
      confidence += 0.1;
    }

    // Type detection confidence
    if (parsed.type !== 'general') {
      confidence += 0.1;
    }

    // Clear priority indication
    if (parsed.priority !== 'low') {
      confidence += 0.05;
    }

    // Technologies mentioned (clearer spec)
    if (parsed.technologies && parsed.technologies.length > 0) {
      confidence += Math.min(0.1, parsed.technologies.length * 0.02);
    }

    // Constraints defined
    if (parsed.constraints && parsed.constraints.length > 0) {
      confidence += 0.1;
    }

    // Success criteria explicit
    if (parsed.success_criteria && parsed.success_criteria.length > 0) {
      confidence += 0.1;
    }

    // Input length (more detailed = more confident)
    if (input.length > 500) {
      confidence += 0.15;
    } else if (input.length > 200) {
      confidence += 0.08;
    }

    return Math.min(1, Math.max(0, confidence));
  }

  // Validate normalized spec
  validate(spec: NormalizedSpec): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!spec.title || spec.title.length < 3) {
      issues.push('Title must be at least 3 characters');
    }

    if (spec.confidence < 0.4) {
      issues.push(
        'Specification is ambiguous. Please provide more details.'
      );
    }

    if (spec.estimatedHours < 1) {
      issues.push('Estimated hours must be at least 1');
    }

    if (!spec.type || !['software', 'research', 'content', 'general'].includes(spec.type)) {
      issues.push('Invalid project type');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  // Convert to structured spec format
  toStructuredSpec(normalized: NormalizedSpec): Record<string, any> {
    return {
      title: normalized.title,
      description: normalized.description,
      projectType: normalized.type,
      priority: normalized.priority,
      scale: normalized.scale,
      estimatedEffort: {
        hours: normalized.estimatedHours,
        days: Math.ceil(normalized.estimatedHours / 8),
      },
      technologies: normalized.technologies,
      constraints: normalized.constraints,
      successCriteria: normalized.success_criteria,
      parsingConfidence: normalized.confidence,
    };
  }
}

export const specKitService = new SpecKitService();

export default specKitService;
