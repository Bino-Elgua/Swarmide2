/**
 * Phase 5: Custom Scoring Rubric Service
 * 
 * Enables users to define custom evaluation criteria for proposals beyond defaults:
 * 1. Domain-specific scoring weights
 * 2. Custom evaluation dimensions
 * 3. Rubric templates by project type
 * 4. Real-time rubric adjustment
 */

import { ProposalOutput, Agent } from '../types';
import { GoogleGenAI, Type } from '@google/genai';

export interface ScoringDimension {
  id: string;
  name: string;
  description: string;
  weight: number; // 0-1, normalized
  minScore?: number;
  maxScore?: number;
  rubricGuidelines?: string;
  examples?: { good: string; bad: string };
}

export interface CustomScoringRubric {
  id: string;
  name: string;
  description: string;
  projectType: 'software' | 'science' | 'story' | 'general';
  dimensions: ScoringDimension[];
  totalWeight: number;
  createdAt: Date;
  updatedAt: Date;
  isTemplate: boolean;
  notes?: string;
}

export interface ProposalScore {
  proposalId: string;
  rubricId: string;
  dimensionScores: Record<string, number>;
  overallScore: number;
  normalizedScore: number;
  flags: { dimension: string; flag: string }[];
  reasoning: string;
  timestamp: Date;
}

// Default rubrics by project type
export const DEFAULT_RUBRICS: Record<string, CustomScoringRubric> = {
  software: {
    id: 'rubric_software_v1',
    name: 'Software Engineering Excellence',
    description: 'Evaluates architecture, scalability, maintainability',
    projectType: 'software',
    dimensions: [
      {
        id: 'alignment',
        name: 'Requirement Alignment',
        description: 'How well does this proposal match the original request?',
        weight: 0.25,
        rubricGuidelines: 'Score 100 if core requirements fully met. 50 if partial. 0 if misses critical items.',
        examples: {
          good: 'Request: "Build REST API with authentication". Proposal: REST, JWT auth, rate limiting.',
          bad: 'Request: "Build REST API". Proposal: GraphQL server only.'
        }
      },
      {
        id: 'technical',
        name: 'Technical Feasibility',
        description: 'Is it implementable? Scalable? Performant? Secure?',
        weight: 0.30,
        rubricGuidelines: '100: Proven patterns, well-architected. 70: Good but has tradeoffs. 30: Risky, unproven.',
        examples: {
          good: 'Microservices with service mesh, proven at scale, observability built-in',
          bad: 'Monolith with global mutable state, no caching, blocking I/O'
        }
      },
      {
        id: 'ethics',
        name: 'Safety & Ethics',
        description: 'Privacy-preserving? Fair? Secure? Accessible?',
        weight: 0.20,
        rubricGuidelines: '100: Privacy-by-design, security hardened. 50: Basic protections. 0: Exposes user data.',
        examples: {
          good: 'End-to-end encryption, no user tracking, WCAG accessible',
          bad: 'Stores passwords in plaintext, sells user data'
        }
      },
      {
        id: 'novelty',
        name: 'Innovation & Freshness',
        description: 'Novel approach? Cutting-edge or derivative?',
        weight: 0.10,
        rubricGuidelines: '100: Pioneering technique. 70: Modern best-practice. 30: Outdated approach.',
        examples: {
          good: 'AI-powered caching with predictive pre-loading',
          bad: 'Reinventing basic CRUD, ignoring modern frameworks'
        }
      },
      {
        id: 'coherence',
        name: 'Internal Consistency',
        description: 'Does it hang together logically? No contradictions?',
        weight: 0.15,
        rubricGuidelines: '100: All parts work in harmony. 50: Minor conflicts. 0: Fundamentally contradictory.',
        examples: {
          good: 'Sync + async clearly separated; consistent naming; no circular deps',
          bad: 'Mix of sync/async without clear boundaries; naming inconsistent'
        }
      }
    ],
    totalWeight: 1.0,
    createdAt: new Date(),
    updatedAt: new Date(),
    isTemplate: true
  },
  science: {
    id: 'rubric_science_v1',
    name: 'Scientific Rigor & Validity',
    description: 'Evaluates methodology, reproducibility, impact',
    projectType: 'science',
    dimensions: [
      {
        id: 'methodology',
        name: 'Methodological Rigor',
        description: 'Sound experimental design? Proper controls? Statistically valid?',
        weight: 0.35,
        rubricGuidelines: '100: Gold-standard design, peer-reviewed. 60: Reasonable but some gaps. 20: Flawed.',
        examples: {
          good: 'Randomized controlled trial with pre-registered hypotheses',
          bad: 'Anecdotal observations with confirmation bias'
        }
      },
      {
        id: 'reproducibility',
        name: 'Reproducibility',
        description: 'Can others replicate this? Code/data open-source?',
        weight: 0.25,
        rubricGuidelines: '100: Full code+data available. 50: Partially available. 0: Not reproducible.',
        examples: {
          good: 'GitHub repo with Docker setup, data on Zenodo, paper preprint',
          bad: 'Only description, no code, data locked'
        }
      },
      {
        id: 'impact',
        name: 'Research Impact',
        description: 'Novel findings? Advances field? Practical applications?',
        weight: 0.20,
        rubricGuidelines: '100: Paradigm-shifting. 60: Incremental but solid. 20: Confirms known.',
        examples: {
          good: 'First demonstration of X phenomenon with real-world applications',
          bad: 'Repeats previous study with slight variation'
        }
      },
      {
        id: 'ethics',
        name: 'Ethical Compliance',
        description: 'IRB approval? Informed consent? Bias mitigation?',
        weight: 0.20,
        rubricGuidelines: '100: Full ethical review + consent. 50: Partial. 0: Ethical violations.',
        examples: {
          good: 'IRB approval, informed consent, demographic parity analysis',
          bad: 'Human subjects without consent, potential bias unchecked'
        }
      }
    ],
    totalWeight: 1.0,
    createdAt: new Date(),
    updatedAt: new Date(),
    isTemplate: true
  }
};

/**
 * Scoring engine using custom rubric
 */
export async function scoreProposalWithRubric(
  proposal: ProposalOutput,
  rubric: CustomScoringRubric,
  originalPrompt: string,
  aiConfig?: any
): Promise<ProposalScore> {
  const apiKey = process.env.VITE_GEMINI_API_KEY || localStorage.getItem('vibe_logic_hub_key');
  if (!apiKey) throw new Error('API key not configured');

  const ai = new GoogleGenerativeAI({ apiKey });
  const model = ai.getGenerativeModel({ model: 'gemini-3-flash-preview' });

  const rubricText = rubric.dimensions
    .map(d => `- ${d.name} (weight: ${(d.weight * 100).toFixed(0)}%): ${d.description}
       Guidelines: ${d.rubricGuidelines || 'N/A'}`)
    .join('\n');

  const scoringPrompt = `
You are an expert evaluator. Score this proposal against the custom rubric.

CUSTOM RUBRIC:
${rubricText}

PROPOSAL TO EVALUATE:
Architecture: ${proposal.architecture}
Rationale: ${proposal.rationale}
Tradeoffs - Pro: ${proposal.tradeoffs.pro.join(', ')}
Tradeoffs - Con: ${proposal.tradeoffs.con.join(', ')}

ORIGINAL USER REQUEST: "${originalPrompt}"

TASK: Return a JSON object with:
{
  "dimensionScores": {
    "alignment": 0-100,
    "technical": 0-100,
    "ethics": 0-100,
    "novelty": 0-100,
    "coherence": 0-100
  },
  "flags": [
    {"dimension": "alignment", "flag": "missing X requirement"}
  ],
  "reasoning": "Detailed explanation of scores"
}`;

  try {
    const response = await model.generateContent({
      contents: scoringPrompt,
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.response.text();
    const scoreData = JSON.parse(text);

    // Calculate weighted overall score
    let overallScore = 0;
    const normalizedScores: Record<string, number> = {};

    rubric.dimensions.forEach(dim => {
      const score = scoreData.dimensionScores[dim.id] || 50;
      const normalized = (score / 100) * dim.weight;
      normalizedScores[dim.id] = normalized;
      overallScore += normalized;
    });

    return {
      proposalId: proposal.id,
      rubricId: rubric.id,
      dimensionScores: scoreData.dimensionScores,
      overallScore: Math.round(overallScore * 100),
      normalizedScore: overallScore,
      flags: scoreData.flags || [],
      reasoning: scoreData.reasoning,
      timestamp: new Date()
    };
  } catch (err) {
    console.error('Scoring error:', err);
    // Return neutral score on error
    return {
      proposalId: proposal.id,
      rubricId: rubric.id,
      dimensionScores: Object.fromEntries(rubric.dimensions.map(d => [d.id, 50])),
      overallScore: 50,
      normalizedScore: 0.5,
      flags: [{ dimension: 'error', flag: 'Could not score proposal' }],
      reasoning: 'Scoring unavailable',
      timestamp: new Date()
    };
  }
}

/**
 * Score multiple proposals against rubric, return ranked list
 */
export async function rankProposalsWithRubric(
  proposals: ProposalOutput[],
  rubric: CustomScoringRubric,
  originalPrompt: string,
  aiConfig?: any
): Promise<Array<{ proposal: ProposalOutput; score: ProposalScore }>> {
  const scores = await Promise.all(
    proposals.map(p => scoreProposalWithRubric(p, rubric, originalPrompt, aiConfig))
  );

  return proposals
    .map((p, i) => ({ proposal: p, score: scores[i] }))
    .sort((a, b) => b.score.overallScore - a.score.overallScore);
}

/**
 * Create custom rubric from natural language description
 */
export async function generateCustomRubric(
  description: string,
  projectType: 'software' | 'science' | 'story' | 'general',
  aiConfig?: any
): Promise<CustomScoringRubric> {
  const apiKey = process.env.VITE_GEMINI_API_KEY || localStorage.getItem('vibe_logic_hub_key');
  if (!apiKey) throw new Error('API key not configured');

  const ai = new GoogleGenerativeAI({ apiKey });
  const model = ai.getGenerativeModel({ model: 'gemini-3-flash-preview' });

  const prompt = `
You are an expert in evaluation rubrics. Create a custom scoring rubric based on this description.

PROJECT TYPE: ${projectType}
DESCRIPTION: "${description}"

Generate a JSON rubric with 4-5 dimensions, each with:
- id: unique identifier
- name: dimension name
- description: what it measures
- weight: 0.15-0.35 (must sum to 1.0)
- rubricGuidelines: scoring guidance
- examples: {good, bad}

Return JSON:
{
  "dimensions": [
    {
      "id": "dim1",
      "name": "Name",
      "description": "...",
      "weight": 0.25,
      "rubricGuidelines": "...",
      "examples": {"good": "...", "bad": "..."}
    }
  ]
}`;

  try {
    const response = await model.generateContent({
      contents: prompt,
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.response.text();
    const data = JSON.parse(text);

    // Normalize weights
    const dimensions = data.dimensions as ScoringDimension[];
    const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
    dimensions.forEach(d => d.weight = d.weight / totalWeight);

    return {
      id: `rubric_custom_${Date.now()}`,
      name: `Custom Rubric (${projectType})`,
      description,
      projectType,
      dimensions,
      totalWeight: 1.0,
      createdAt: new Date(),
      updatedAt: new Date(),
      isTemplate: false
    };
  } catch (err) {
    console.error('Rubric generation error:', err);
    throw new Error('Failed to generate custom rubric');
  }
}

/**
 * Get rubric for project type (default or custom)
 */
export function getRubricForProject(
  projectType: 'software' | 'science' | 'story' | 'general',
  customRubrics?: CustomScoringRubric[]
): CustomScoringRubric {
  // Check custom rubrics first
  if (customRubrics) {
    const custom = customRubrics.find(r => r.projectType === projectType && !r.isTemplate);
    if (custom) return custom;
  }

  // Fall back to template
  const key = projectType === 'general' ? 'software' : projectType;
  return DEFAULT_RUBRICS[key] || DEFAULT_RUBRICS.software;
}

/**
 * Rubric persistence (localStorage)
 */
export function saveRubric(rubric: CustomScoringRubric): void {
  try {
    const rubrics = loadAllRubrics();
    const index = rubrics.findIndex(r => r.id === rubric.id);
    if (index >= 0) {
      rubrics[index] = rubric;
    } else {
      rubrics.push(rubric);
    }
    localStorage.setItem('swarmide_custom_rubrics', JSON.stringify(rubrics));
  } catch (err) {
    console.error('Failed to save rubric:', err);
  }
}

export function loadAllRubrics(): CustomScoringRubric[] {
  try {
    const stored = localStorage.getItem('swarmide_custom_rubrics');
    if (!stored) return [];
    const data = JSON.parse(stored) as any[];
    return data.map(r => ({
      ...r,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt)
    }));
  } catch (err) {
    console.error('Failed to load rubrics:', err);
    return [];
  }
}

export function deleteRubric(rubricId: string): void {
  try {
    const rubrics = loadAllRubrics().filter(r => r.id !== rubricId);
    localStorage.setItem('swarmide_custom_rubrics', JSON.stringify(rubrics));
  } catch (err) {
    console.error('Failed to delete rubric:', err);
  }
}
