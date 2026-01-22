export interface SecurityScan {
  id: string;
  timestamp: string;
  code: string;
  vulnerabilities: Vulnerability[];
  score: number;
  passed: boolean;
}

export interface Vulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  description: string;
  location: {
    line?: number;
    column?: number;
    snippet?: string;
  };
  recommendation: string;
  cweId?: string;
}

class SecurityValidationService {
  private patterns = {
    // Injection attacks
    sqlInjection: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP)\b|--|;)/gi,
    commandInjection: /(\$\(|`|eval\(|exec\(|system\()/gi,
    pathTraversal: /\.\.\//gi,

    // Authentication/Authorization
    hardcodedCredentials: /(password|apikey|secret)\s*[:=]\s*['"](.*)['"]/gi,
    insecureAuth: /(Basic\s+|Bearer\s+|token\s*[:=])/gi,

    // Data exposure
    apiKeys: /[a-zA-Z0-9_-]{32,}/g,
    jwtTokens: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,

    // Unsafe operations
    dangerousFunctions: /(\beval\b|\bexec\b|\bsystem\b|\bpopen\b)/gi,
    unsafeDeserialize: /pickle\.loads|json\.loads|yaml\.load/gi,

    // Dependency issues
    outdatedDeps: /require\(|import\s+/gi,
  };

  // Scan code for vulnerabilities
  async scanCode(code: string): Promise<SecurityScan> {
    const scanId = `scan-${Date.now()}`;
    const vulnerabilities: Vulnerability[] = [];

    // Pattern-based detection
    const patternVulns = this.detectPatternVulnerabilities(code);
    vulnerabilities.push(...patternVulns);

    // Logic-based detection
    const logicVulns = this.detectLogicVulnerabilities(code);
    vulnerabilities.push(...logicVulns);

    // Complexity analysis
    const complexityIssues = this.analyzeComplexity(code);
    vulnerabilities.push(...complexityIssues);

    // Calculate score (0-100, higher is better)
    const score = Math.max(0, 100 - vulnerabilities.length * 5);

    return {
      id: scanId,
      timestamp: new Date().toISOString(),
      code,
      vulnerabilities,
      score,
      passed: vulnerabilities.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0,
    };
  }

  private detectPatternVulnerabilities(code: string): Vulnerability[] {
    const vulns: Vulnerability[] = [];
    const lines = code.split('\n');

    lines.forEach((line, idx) => {
      // SQL Injection detection
      if (this.patterns.sqlInjection.test(line)) {
        vulns.push({
          id: `vuln-sql-${idx}`,
          severity: 'high',
          category: 'SQL Injection',
          description: 'Potential SQL injection vulnerability detected',
          location: {
            line: idx + 1,
            snippet: line.trim(),
          },
          recommendation: 'Use parameterized queries or ORM with prepared statements',
          cweId: 'CWE-89',
        });
      }

      // Hardcoded credentials
      if (this.patterns.hardcodedCredentials.test(line)) {
        vulns.push({
          id: `vuln-cred-${idx}`,
          severity: 'critical',
          category: 'Hardcoded Credentials',
          description: 'Hardcoded credentials or API keys detected',
          location: {
            line: idx + 1,
            snippet: line.trim().substring(0, 50) + '...',
          },
          recommendation: 'Move credentials to environment variables or secure vault',
          cweId: 'CWE-798',
        });
      }

      // Dangerous functions
      if (this.patterns.dangerousFunctions.test(line)) {
        vulns.push({
          id: `vuln-dangerous-${idx}`,
          severity: 'high',
          category: 'Unsafe Function Usage',
          description: 'Use of eval, exec, or other dynamic code execution',
          location: {
            line: idx + 1,
            snippet: line.trim(),
          },
          recommendation: 'Avoid dynamic code execution; use safer alternatives',
          cweId: 'CWE-95',
        });
      }

      // Command injection
      if (this.patterns.commandInjection.test(line)) {
        vulns.push({
          id: `vuln-cmd-${idx}`,
          severity: 'high',
          category: 'Command Injection',
          description: 'Potential command injection vulnerability',
          location: {
            line: idx + 1,
            snippet: line.trim(),
          },
          recommendation: 'Use parameterized execution methods; avoid shell interpolation',
          cweId: 'CWE-78',
        });
      }

      // Path traversal
      if (this.patterns.pathTraversal.test(line)) {
        vulns.push({
          id: `vuln-path-${idx}`,
          severity: 'high',
          category: 'Path Traversal',
          description: 'Potential path traversal vulnerability detected',
          location: {
            line: idx + 1,
            snippet: line.trim(),
          },
          recommendation: 'Validate and sanitize file paths; use path normalization',
          cweId: 'CWE-22',
        });
      }
    });

    return vulns;
  }

  private detectLogicVulnerabilities(code: string): Vulnerability[] {
    const vulns: Vulnerability[] = [];

    // Check for missing error handling
    if (!/try\s*\{|catch\s*\{|finally\s*\{/i.test(code)) {
      vulns.push({
        id: 'vuln-error-handling',
        severity: 'medium',
        category: 'Error Handling',
        description: 'No try-catch error handling detected',
        location: {},
        recommendation: 'Implement proper error handling for all operations',
        cweId: 'CWE-390',
      });
    }

    // Check for missing input validation
    if (!/validate|sanitize|check|verify/i.test(code)) {
      vulns.push({
        id: 'vuln-validation',
        severity: 'high',
        category: 'Input Validation',
        description: 'No input validation detected',
        location: {},
        recommendation: 'Validate all user inputs before processing',
        cweId: 'CWE-20',
      });
    }

    // Check for logging sensitive data
    if (/console\.log|logger\.(info|debug).*(?:password|token|secret|key)/i.test(code)) {
      vulns.push({
        id: 'vuln-logging',
        severity: 'medium',
        category: 'Information Exposure',
        description: 'Sensitive data may be logged',
        location: {},
        recommendation: 'Avoid logging passwords, tokens, or secrets',
        cweId: 'CWE-532',
      });
    }

    return vulns;
  }

  private analyzeComplexity(code: string): Vulnerability[] {
    const vulns: Vulnerability[] = [];

    // Cyclomatic complexity (simple approximation)
    const ifCount = (code.match(/\bif\b/gi) || []).length;
    const forCount = (code.match(/\b(for|while)\b/gi) || []).length;
    const complexityScore = ifCount + forCount;

    if (complexityScore > 20) {
      vulns.push({
        id: 'vuln-complexity',
        severity: 'low',
        category: 'Code Complexity',
        description: `High cyclomatic complexity (${complexityScore}). Consider refactoring.`,
        location: {},
        recommendation: 'Break down complex logic into smaller functions',
        cweId: 'CWE-1104',
      });
    }

    // Lines of code
    const lines = code.split('\n').length;
    if (lines > 500) {
      vulns.push({
        id: 'vuln-size',
        severity: 'low',
        category: 'Code Size',
        description: `Large function (${lines} lines). Consider breaking into smaller units.`,
        location: {},
        recommendation: 'Use single responsibility principle; break into smaller functions',
      });
    }

    return vulns;
  }

  // Generate security report
  generateReport(scan: SecurityScan): string {
    let report = `
# Security Scan Report
**ID:** ${scan.id}
**Timestamp:** ${scan.timestamp}
**Score:** ${scan.score}/100
**Status:** ${scan.passed ? '✅ PASSED' : '❌ FAILED'}

## Summary
- Total Issues: ${scan.vulnerabilities.length}
- Critical: ${scan.vulnerabilities.filter(v => v.severity === 'critical').length}
- High: ${scan.vulnerabilities.filter(v => v.severity === 'high').length}
- Medium: ${scan.vulnerabilities.filter(v => v.severity === 'medium').length}
- Low: ${scan.vulnerabilities.filter(v => v.severity === 'low').length}

## Vulnerabilities

`;

    scan.vulnerabilities.forEach(vuln => {
      report += `### [${vuln.severity.toUpperCase()}] ${vuln.category}
**ID:** ${vuln.id}
**Description:** ${vuln.description}
**Recommendation:** ${vuln.recommendation}
`;

      if (vuln.location.line) {
        report += `**Location:** Line ${vuln.location.line}\n`;
      }
      if (vuln.cweId) {
        report += `**CWE:** ${vuln.cweId}\n`;
      }
      report += '\n';
    });

    return report;
  }

  // Validate agent-generated code
  async validateAgentCode(code: string, language: string = 'javascript'): Promise<{
    valid: boolean;
    scan: SecurityScan;
    canDeploy: boolean;
  }> {
    const scan = await this.scanCode(code);

    const critical = scan.vulnerabilities.filter(v => v.severity === 'critical');
    const high = scan.vulnerabilities.filter(v => v.severity === 'high');

    const canDeploy = critical.length === 0 && high.length <= 2; // Allow up to 2 high severity issues

    return {
      valid: scan.passed,
      scan,
      canDeploy,
    };
  }

  // Compare security before/after refactoring
  compareScans(before: SecurityScan, after: SecurityScan): {
    improved: boolean;
    scoreChange: number;
    issuesResolved: number;
    newIssues: number;
  } {
    const scoreChange = after.score - before.score;
    const issuesResolved = before.vulnerabilities.length - after.vulnerabilities.length;

    const afterIds = new Set(after.vulnerabilities.map(v => v.id));
    const newIssues = after.vulnerabilities.filter(v => !beforeIds.has(v.id)).length;
    const beforeIds = new Set(before.vulnerabilities.map(v => v.id));

    return {
      improved: scoreChange > 0,
      scoreChange,
      issuesResolved: Math.max(0, issuesResolved),
      newIssues,
    };
  }
}

export const securityValidationService = new SecurityValidationService();

export default securityValidationService;
