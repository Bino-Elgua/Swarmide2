/**
 * CCA Service (Confucius Code Agent)
 * 
 * Handles large-scale codebase analysis:
 * - Dependency graph building
 * - Refactoring opportunity detection
 * - Dead code identification
 * - Circular dependency resolution
 * - Modular tool extraction suggestions
 */

import { Agent, FileEntry } from '../types';
import { performAgentTask } from './geminiService';

export interface ModuleNode {
  id: string;
  path: string;
  size: number;  // lines of code
  deps: string[];  // file IDs this depends on
  exports: string[];  // what this exports
  isCircular: boolean;
  complexity: 'low' | 'medium' | 'high';
}

export interface ModuleEdge {
  from: string;
  to: string;
  type: 'import' | 'export' | 'circular' | 'indirect';
  strength: number;  // 0-1 based on usage intensity
}

export interface ModuleGraph {
  nodes: ModuleNode[];
  edges: ModuleEdge[];
  criticalPaths: string[][];  // longest dependency chains
  circularDeps: string[][];   // cycles detected
  entryPoints: string[];       // files with no dependencies
  deadCode: string[];          // unreferenced modules
}

export interface RefactoringOpportunity {
  id: string;
  type: 'circular_break' | 'dead_code' | 'extract_module' | 'consolidate' | 'anti_pattern';
  modules: string[];
  description: string;
  benefit: string;
  effort: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high';
  estimatedSavings: number;  // lines of code saved/improved
}

export interface ToolExtractionSuggestion {
  id: string;
  name: string;
  modules: string[];
  description: string;
  rationale: string;
  scope: 'utility' | 'core_feature' | 'integration' | 'shared_infrastructure';
  reusability: number;  // 0-1 score
  priority: 'low' | 'medium' | 'high';
}

/**
 * Analyze files and build dependency graph
 * Identifies imports, exports, and relationships
 */
export async function buildDependencyGraph(
  files: FileEntry[],
  agent: Agent
): Promise<ModuleGraph> {
  if (files.length === 0) {
    return {
      nodes: [],
      edges: [],
      criticalPaths: [],
      circularDeps: [],
      entryPoints: [],
      deadCode: []
    };
  }

  // Prepare file summary for analysis (truncate large files)
  const fileSummaries = files.map(file => {
    const lines = file.content.split('\n');
    const imports = lines.filter(l => l.match(/^(import|require|from)\s+/));
    const exports = lines.filter(l => l.match(/^(export|module\.exports)\s+/));
    const classes = lines.filter(l => l.match(/^(class|interface|type|function)\s+/));
    
    return {
      path: file.path,
      size: lines.length,
      language: file.language,
      imports: imports.slice(0, 10),  // Keep first 10
      exports: exports.slice(0, 10),
      topDefinitions: classes.slice(0, 5)
    };
  });

  const graphBuildPrompt = `
CODEBASE ANALYSIS TASK

You are analyzing a codebase with ${files.length} files totaling ${files.reduce((s, f) => s + f.content.length, 0)} characters.

FILE STRUCTURE:
${fileSummaries.map(f => `
${f.path} (${f.size} lines, ${f.language})
  Imports: ${f.imports.length > 0 ? f.imports.slice(0, 3).join('; ') : 'none'}
  Exports: ${f.exports.length > 0 ? f.exports.slice(0, 3).join('; ') : 'none'}
  Top Definitions: ${f.topDefinitions.join(', ') || 'none'}
`).join('\n---\n')}

TASK: Build a complete dependency graph. Return JSON with this exact structure:

{
  "nodes": [
    {
      "id": "unique-id",
      "path": "path/to/file.ts",
      "size": 150,
      "deps": ["id-of-dependency-1", "id-of-dependency-2"],
      "exports": ["functionName", "ClassName"],
      "isCircular": false,
      "complexity": "medium"
    }
  ],
  "edges": [
    {
      "from": "file-id-1",
      "to": "file-id-2",
      "type": "import",
      "strength": 0.8
    }
  ],
  "criticalPaths": [["id1", "id2", "id3"]],
  "circularDeps": [["id-a", "id-b"]],
  "entryPoints": ["id-of-entry"],
  "deadCode": ["id-of-unused"]
}

Analyze imports/exports carefully. Look for:
- Direct dependencies (imports)
- Circular references
- Unused modules
- Long dependency chains (>5 levels)

Return ONLY valid JSON, no markdown.`;

  const analysisResult = await performAgentTask(
    agent,
    graphBuildPrompt,
    '',
    false,
    false  // no proposal
  );

  try {
    // Parse the JSON response
    const jsonMatch = analysisResult.result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const graph = JSON.parse(jsonMatch[0]) as ModuleGraph;
    return graph;
  } catch (err) {
    console.error('Failed to parse dependency graph:', err);
    // Return minimal graph on parse failure
    return {
      nodes: files.map((f, i) => ({
        id: `file-${i}`,
        path: f.path,
        size: f.content.split('\n').length,
        deps: [],
        exports: [],
        isCircular: false,
        complexity: 'low'
      })),
      edges: [],
      criticalPaths: [],
      circularDeps: [],
      entryPoints: files.length > 0 ? [`file-0`] : [],
      deadCode: []
    };
  }
}

/**
 * Identify refactoring opportunities based on dependency graph
 */
export async function identifyRefactoringOpportunities(
  moduleGraph: ModuleGraph,
  files: FileEntry[],
  agent: Agent
): Promise<RefactoringOpportunity[]> {
  if (moduleGraph.nodes.length === 0) {
    return [];
  }

  const graphSummary = {
    totalNodes: moduleGraph.nodes.length,
    totalEdges: moduleGraph.edges.length,
    circularDeps: moduleGraph.circularDeps.length,
    deadCodeCount: moduleGraph.deadCode.length,
    criticalPathsCount: moduleGraph.criticalPaths.length,
    avgDepsPerModule: (moduleGraph.edges.length / moduleGraph.nodes.length).toFixed(2),
    maxDependencyDepth: moduleGraph.criticalPaths.length > 0 
      ? Math.max(...moduleGraph.criticalPaths.map(p => p.length)) 
      : 0
  };

  const refactoringPrompt = `
REFACTORING OPPORTUNITY ANALYSIS

Codebase Statistics:
${JSON.stringify(graphSummary, null, 2)}

Circular Dependencies: ${moduleGraph.circularDeps.map(cycle => cycle.join(' → ')).join('; ')}
Dead Code Modules: ${moduleGraph.deadCode.join(', ')}
Longest Dependency Chain: ${moduleGraph.criticalPaths[0]?.join(' → ') || 'N/A'}

TASK: Suggest refactoring opportunities. Return JSON array:

[
  {
    "id": "refactor-1",
    "type": "circular_break|dead_code|extract_module|consolidate|anti_pattern",
    "modules": ["module-id-1", "module-id-2"],
    "description": "Clear problem description",
    "benefit": "What improves (speed, maintainability, testability, etc)",
    "effort": "low|medium|high",
    "riskLevel": "low|medium|high",
    "estimatedSavings": 50
  }
]

PRIORITY:
1. Break circular dependencies (highest impact)
2. Remove dead code
3. Extract reusable utilities
4. Consolidate related modules
5. Fix anti-patterns

Return ONLY valid JSON array.`;

  const analysisResult = await performAgentTask(
    agent,
    refactoringPrompt,
    '',
    false,
    false
  );

  try {
    const jsonMatch = analysisResult.result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found');
    }
    
    const opportunities = JSON.parse(jsonMatch[0]) as RefactoringOpportunity[];
    return opportunities.sort((a, b) => {
      // Sort by type priority
      const typePriority: Record<string, number> = {
        'circular_break': 1,
        'dead_code': 2,
        'extract_module': 3,
        'consolidate': 4,
        'anti_pattern': 5
      };
      
      const aPriority = typePriority[a.type] || 99;
      const bPriority = typePriority[b.type] || 99;
      return aPriority - bPriority;
    });
  } catch (err) {
    console.error('Failed to parse refactoring opportunities:', err);
    return [];
  }
}

/**
 * Suggest modules/functionality that could be extracted as standalone tools
 */
export async function synthesizeToolExtractionCandidates(
  moduleGraph: ModuleGraph,
  refactoringOpportunities: RefactoringOpportunity[],
  files: FileEntry[],
  agent: Agent
): Promise<ToolExtractionSuggestion[]> {
  if (moduleGraph.nodes.length === 0) {
    return [];
  }

  // Identify highly reusable modules (those with many dependents but low deps)
  const reusabilityScores = moduleGraph.nodes.map(node => {
    const dependents = moduleGraph.edges.filter(e => e.to === node.id).length;
    const dependencies = moduleGraph.edges.filter(e => e.from === node.id).length;
    const reusability = dependents > 0 ? Math.min(1, dependents / (dependencies + 1)) : 0;
    
    return {
      nodeId: node.id,
      path: node.path,
      reusability,
      dependents,
      dependencies
    };
  }).sort((a, b) => b.reusability - a.reusability);

  const extractionPrompt = `
TOOL EXTRACTION ANALYSIS

Modules by Reusability (high → low):
${reusabilityScores.slice(0, 10).map(s => 
  `${s.path}: reusability=${s.reusability.toFixed(2)}, dependents=${s.dependents}, deps=${s.dependencies}`
).join('\n')}

Recent Refactoring Suggestions:
${refactoringOpportunities.slice(0, 5).map(r => `- [${r.type}] ${r.description}`).join('\n')}

TASK: Identify 3-5 modules/features that would be valuable as standalone tools/libraries.
Consider:
- High reusability (many dependents, few dependencies)
- Cohesive functionality (clear, single purpose)
- Extract opportunities (suggested by refactoring analysis)
- Cross-project value (utility, integration, infrastructure)

Return JSON array:

[
  {
    "id": "tool-1",
    "name": "Descriptive Tool Name",
    "modules": ["module-id-1"],
    "description": "What this tool does",
    "rationale": "Why extract it",
    "scope": "utility|core_feature|integration|shared_infrastructure",
    "reusability": 0.85,
    "priority": "high|medium|low"
  }
]

Return ONLY valid JSON array.`;

  const analysisResult = await performAgentTask(
    agent,
    extractionPrompt,
    '',
    false,
    false
  );

  try {
    const jsonMatch = analysisResult.result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found');
    }
    
    const suggestions = JSON.parse(jsonMatch[0]) as ToolExtractionSuggestion[];
    return suggestions.sort((a, b) => {
      const priorityMap = { 'high': 1, 'medium': 2, 'low': 3 };
      return (priorityMap[a.priority] || 99) - (priorityMap[b.priority] || 99);
    });
  } catch (err) {
    console.error('Failed to parse tool extraction suggestions:', err);
    return [];
  }
}

/**
 * Generate comprehensive CCA audit report
 */
export interface CCAAuditReport {
  summary: {
    totalFiles: number;
    totalLines: number;
    avgFileSize: number;
    complexity: 'low' | 'medium' | 'high' | 'critical';
  };
  dependencyGraph: ModuleGraph;
  refactoringOpportunities: RefactoringOpportunity[];
  toolExtractionCandidates: ToolExtractionSuggestion[];
  recommendations: string[];
  estimatedImprovements: {
    codeReduction: number;  // percent
    performanceGain: string;
    maintainabilityScore: number;  // 0-100
  };
}

export async function generateCCAAuditReport(
  files: FileEntry[],
  agent: Agent
): Promise<CCAAuditReport> {
  console.log(`[CCA] Starting audit of ${files.length} files...`);

  // Step 1: Build dependency graph
  const moduleGraph = await buildDependencyGraph(files, agent);
  console.log(`[CCA] Dependency graph built: ${moduleGraph.nodes.length} nodes, ${moduleGraph.edges.length} edges`);

  // Step 2: Identify refactoring opportunities
  const refactoringOps = await identifyRefactoringOpportunities(moduleGraph, files, agent);
  console.log(`[CCA] Found ${refactoringOps.length} refactoring opportunities`);

  // Step 3: Suggest tool extractions
  const toolExtractions = await synthesizeToolExtractionCandidates(
    moduleGraph,
    refactoringOps,
    files,
    agent
  );
  console.log(`[CCA] Identified ${toolExtractions.length} tool extraction candidates`);

  // Calculate summary stats
  const totalLines = files.reduce((sum, f) => sum + f.content.split('\n').length, 0);
  const avgFileSize = totalLines / files.length;
  
  // Determine overall complexity
  let complexity: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (moduleGraph.circularDeps.length > 3) complexity = 'critical';
  else if (moduleGraph.criticalPaths.length > 0 && moduleGraph.criticalPaths[0].length > 8) complexity = 'high';
  else if (moduleGraph.edges.length > files.length * 5) complexity = 'medium';

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (moduleGraph.circularDeps.length > 0) {
    recommendations.push(`Break ${moduleGraph.circularDeps.length} circular dependencies to improve modularity`);
  }
  if (moduleGraph.deadCode.length > 0) {
    recommendations.push(`Remove ${moduleGraph.deadCode.length} unused modules to reduce maintenance burden`);
  }
  if (toolExtractions.length > 0) {
    recommendations.push(`Extract ${toolExtractions.filter(t => t.priority === 'high').length} high-priority modules as reusable tools`);
  }
  if (moduleGraph.criticalPaths.length > 0 && moduleGraph.criticalPaths[0].length > 5) {
    recommendations.push(`Flatten dependency chains (current max depth: ${moduleGraph.criticalPaths[0].length}) to improve testability`);
  }

  // Estimate improvements
  const circularBreakSavings = refactoringOps
    .filter(r => r.type === 'circular_break')
    .reduce((sum, r) => sum + r.estimatedSavings, 0);
  
  const deadCodeSavings = moduleGraph.deadCode.length * 50;  // Estimate
  const codeReduction = Math.round(((circularBreakSavings + deadCodeSavings) / totalLines) * 100);

  return {
    summary: {
      totalFiles: files.length,
      totalLines,
      avgFileSize: Math.round(avgFileSize),
      complexity
    },
    dependencyGraph: moduleGraph,
    refactoringOpportunities: refactoringOps,
    toolExtractionCandidates: toolExtractions,
    recommendations,
    estimatedImprovements: {
      codeReduction: Math.max(0, codeReduction),
      performanceGain: complexity === 'critical' ? '15-25%' : complexity === 'high' ? '8-15%' : '0-5%',
      maintainabilityScore: Math.max(0, 100 - (moduleGraph.circularDeps.length * 10 + moduleGraph.deadCode.length * 5))
    }
  };
}
