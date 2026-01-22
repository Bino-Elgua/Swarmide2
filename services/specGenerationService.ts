import { GoogleGenAI, Type } from '@google/genai';

export interface ProjectSpec {
  title: string;
  description: string;
  objectives: string[];
  scope: {
    inScope: string[];
    outOfScope: string[];
  };
  requirements: Requirement[];
  architecture: {
    components: Component[];
    dataFlow: string;
    technologies: string[];
  };
  timeline: PhaseTimeline[];
  successMetrics: string[];
  constraints: string[];
  assumptions: string[];
  risks: RiskAssessment[];
}

export interface Requirement {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: 'functional' | 'non-functional' | 'technical';
  acceptance_criteria: string[];
}

export interface Component {
  name: string;
  description: string;
  responsibility: string[];
  interfaces: Interface[];
}

export interface Interface {
  name: string;
  input: string[];
  output: string[];
}

export interface PhaseTimeline {
  phase: number;
  name: string;
  duration: string;
  deliverables: string[];
  dependencies: number[];
}

export interface RiskAssessment {
  risk: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

class SpecGenerationService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_API_KEY || process.env.API_KEY || '';
  }

  // Generate comprehensive specification from natural language prompt
  async generateSpec(prompt: string): Promise<ProjectSpec> {
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: this.buildSpecPrompt(prompt),
      config: {
        systemInstruction: this.getSpecSystemPrompt(),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
            scope: {
              type: Type.OBJECT,
              properties: {
                inScope: { type: Type.ARRAY, items: { type: Type.STRING } },
                outOfScope: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
            requirements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  priority: { type: Type.STRING, enum: ['critical', 'high', 'medium', 'low'] },
                  type: { type: Type.STRING, enum: ['functional', 'non-functional', 'technical'] },
                  acceptance_criteria: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
              },
            },
            architecture: {
              type: Type.OBJECT,
              properties: {
                components: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      description: { type: Type.STRING },
                      responsibility: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                  },
                },
                dataFlow: { type: Type.STRING },
                technologies: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
            timeline: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  phase: { type: Type.NUMBER },
                  name: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  deliverables: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
              },
            },
            successMetrics: { type: Type.ARRAY, items: { type: Type.STRING } },
            constraints: { type: Type.ARRAY, items: { type: Type.STRING } },
            assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
            risks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  risk: { type: Type.STRING },
                  probability: { type: Type.STRING },
                  impact: { type: Type.STRING },
                  mitigation: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });

    try {
      const jsonText = response.text();
      return JSON.parse(jsonText) as ProjectSpec;
    } catch (error) {
      console.error('Failed to parse specification:', error);
      throw new Error('Failed to generate valid specification');
    }
  }

  // Generate Design Document from Spec
  async generateDesignDocument(spec: ProjectSpec): Promise<string> {
    const designPrompt = `
Based on this specification:
${JSON.stringify(spec, null, 2)}

Generate a comprehensive Design Document that includes:
1. System Architecture Diagram (ASCII)
2. Component Interactions
3. API Specifications
4. Database Schema
5. Security Considerations
6. Performance Optimization Strategy
7. Deployment Architecture

Format as markdown with clear sections.
    `;

    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: designPrompt,
    });

    return response.text();
  }

  // Generate Task Breakdown from Design
  async generateTasks(spec: ProjectSpec, designDoc: string): Promise<Array<{
    id: string;
    title: string;
    description: string;
    assignedPhase: number;
    dependencies: string[];
    estimatedHours: number;
    priority: string;
  }>> {
    const taskPrompt = `
Specification:
${JSON.stringify(spec, null, 2)}

Design Document:
${designDoc}

Generate a detailed task breakdown with:
1. Task ID, Title, Description
2. Assigned Phase
3. Dependencies (task IDs)
4. Estimated Hours
5. Priority (critical/high/medium/low)

Return as JSON array.
    `;

    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: taskPrompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    try {
      return JSON.parse(response.text());
    } catch (error) {
      console.error('Failed to parse tasks:', error);
      return [];
    }
  }

  // Validate spec against requirements
  validateSpec(spec: ProjectSpec): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!spec.title || spec.title.trim() === '') {
      errors.push('Specification must have a title');
    }

    if (!spec.objectives || spec.objectives.length === 0) {
      errors.push('Specification must have at least one objective');
    }

    if (!spec.requirements || spec.requirements.length === 0) {
      errors.push('Specification must have at least one requirement');
    }

    if (!spec.timeline || spec.timeline.length === 0) {
      errors.push('Specification must have at least one phase');
    }

    spec.requirements.forEach((req, idx) => {
      if (!req.id) errors.push(`Requirement ${idx} missing ID`);
      if (!req.title) errors.push(`Requirement ${idx} missing title`);
      if (!req.acceptance_criteria || req.acceptance_criteria.length === 0) {
        errors.push(`Requirement ${idx} missing acceptance criteria`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Export spec to different formats
  exportAsMarkdown(spec: ProjectSpec): string {
    let md = `# ${spec.title}\n\n`;
    md += `${spec.description}\n\n`;

    md += `## Objectives\n`;
    spec.objectives.forEach(obj => {
      md += `- ${obj}\n`;
    });

    md += `\n## Requirements\n`;
    spec.requirements.forEach(req => {
      md += `### ${req.title} (${req.priority.toUpperCase()})\n`;
      md += `${req.description}\n`;
      md += `**Acceptance Criteria:**\n`;
      req.acceptance_criteria.forEach(ac => {
        md += `- ${ac}\n`;
      });
      md += '\n';
    });

    md += `\n## Timeline\n`;
    spec.timeline.forEach(phase => {
      md += `### Phase ${phase.phase}: ${phase.name}\n`;
      md += `Duration: ${phase.duration}\n`;
      md += `Deliverables:\n`;
      phase.deliverables.forEach(d => {
        md += `- ${d}\n`;
      });
      md += '\n';
    });

    return md;
  }

  private buildSpecPrompt(prompt: string): string {
    return `
You are a Project Specification Expert. Generate a comprehensive project specification from this user request:

"${prompt}"

Create a detailed specification that includes:
1. Clear project title and description
2. Well-defined objectives
3. In-scope and out-of-scope items
4. Functional and non-functional requirements
5. Architecture with components and data flow
6. Realistic timeline with phases
7. Success metrics
8. Constraints and assumptions
9. Risk assessment with mitigation strategies

Ensure all requirements have clear acceptance criteria.
    `;
  }

  private getSpecSystemPrompt(): string {
    return `You are an expert software architect and product manager. Your role is to:

1. Parse natural language project descriptions
2. Structure them into formal specifications
3. Identify implicit requirements and constraints
4. Create realistic timelines and effort estimates
5. Assess technical and organizational risks
6. Provide clear, actionable guidance

Always produce specifications that are:
- Complete and unambiguous
- Implementable in the given timeline
- Risk-aware
- Technically sound`;
  }
}

export const specGenerationService = new SpecGenerationService();

export default specGenerationService;
