
import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import { OrchestrationResponse, SynthesisResponse, Agent, ToolConfigs, ElevenLabsConfig, MediaAsset, IntelligenceConfig, KnowledgeAsset, ProposalOutput, CostMetrics } from "../types";
import { estimateCost } from "./costCalculator";

// Global speech queue to prevent overlapping voices
class SpeechQueue {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;

  async add(speechFn: () => Promise<void>) {
    this.queue.push(speechFn);
    this.process();
  }

  private async process() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const current = this.queue.shift();
      if (current) {
        try {
          await current();
        } catch (e) {
          console.error("Speech playback error:", e);
        }
      }
    }
    this.isProcessing = false;
  }
}

const speechQueue = new SpeechQueue();

export const orchestrateTeam = async (
  prompt: string, 
  availableRegistry: Agent[],
  config: IntelligenceConfig
): Promise<OrchestrationResponse> => {
  // Always initialize with apiKey object and directly use process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const registryDigest = availableRegistry.map(a => 
    `ID: ${a.id}, Name: ${a.name}, Role: ${a.role}, Expertise: ${a.description}, Tools: ${a.enabledTools.join(', ')}`
  ).join('\n');

  const response = await ai.models.generateContent({
    model: config.model as any,
    contents: `PROJECT MISSION: "${prompt}"

AVAILABLE AGENT REGISTRY:
${registryDigest}

TASK:
1. Categorize the project type.
2. Break the mission into 3 logical execution phases.
3. SELECT the best agents from the REGISTRY to fulfill this mission. Choose only necessary agents (3-6 typically).
4. If a vital role is missing from the registry, ARCHITECT a new custom specialist.
5. Define personality traits: verbosity (0.1-1.0) and riskAversion (0.1-1.0) for each chosen agent.`,
    config: {
      systemInstruction: `You are the Lead Neural Orchestrator. Your goal is high-efficiency resource allocation.
      Evaluate the Project Mission against the Available Agent Registry. 
      Select specialists based on domain relevance. 
      
      Output a JSON structure with:
      1. projectType (software, science, story, general)
      2. phases (Array of {id, name, description, agentRolesRequired})
      3. initialTeam (Array of {registryId, name, role, description, icon, color, tasks, phase, personality, voiceName, selectionReason, verbosity, riskAversion, intelligenceConfig})`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          projectType: { type: Type.STRING, enum: ['software', 'science', 'story', 'general'] },
          phases: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.NUMBER },
                name: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["id", "name", "description"]
            }
          },
          initialTeam: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                registryId: { type: Type.STRING, nullable: true },
                name: { type: Type.STRING },
                role: { type: Type.STRING },
                description: { type: Type.STRING },
                icon: { type: Type.STRING },
                color: { type: Type.STRING },
                tasks: { type: Type.ARRAY, items: { type: Type.STRING } },
                phase: { type: Type.NUMBER },
                personality: { type: Type.STRING },
                voiceName: { type: Type.STRING, enum: ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'] },
                selectionReason: { type: Type.STRING },
                verbosity: { type: Type.NUMBER },
                riskAversion: { type: Type.NUMBER },
                intelligenceConfig: {
                  type: Type.OBJECT,
                  properties: {
                    provider: { type: Type.STRING },
                    model: { type: Type.STRING },
                    maxTokens: { type: Type.NUMBER },
                    topP: { type: Type.NUMBER },
                    recursiveRefinement: { type: Type.BOOLEAN, nullable: true },
                    refinementPasses: { type: Type.NUMBER, nullable: true }
                  }
                }
              },
              required: ["name", "role", "description", "icon", "color", "tasks", "phase", "selectionReason"]
            }
          }
        },
        required: ["projectType", "phases", "initialTeam"]
      }
    }
  });

  // Extract text and trim as recommended for JSON responses.
  const text = response.text;
  if (!text) throw new Error("Orchestration failed: AI returned an empty response.");
  return JSON.parse(text.trim()) as OrchestrationResponse;
};

export const generateImage = async (prompt: string, config: IntelligenceConfig, toolConfig?: ToolConfigs['mediaSynth']): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelToUse = config.imageModel || config.model;
  
  const response = await ai.models.generateContent({
    model: modelToUse as any,
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        aspectRatio: toolConfig?.aspectRatio || "1:1",
      },
    },
  });

  // Iterate through parts to find the image part, do not assume it is the first part.
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Image synthesis failed or no image was returned.");
};

export const generateVideo = async (prompt: string, config: IntelligenceConfig, toolConfig?: ToolConfigs['mediaSynth']): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelToUse = config.videoModel || config.model;

  let operation = await ai.models.generateVideos({
    model: modelToUse as any,
    prompt: prompt,
    config: {
      numberOfVideos: 1,
      resolution: toolConfig?.quality === 'hd' ? '1080p' : '720p',
      aspectRatio: toolConfig?.aspectRatio === '16:9' ? '16:9' : '9:16'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  // MP4 bytes fetch requires appending the API key.
  return `${downloadLink}&key=${process.env.API_KEY}`;
};

export const performAgentTask = async (
  agent: Agent,
  projectContext: string,
  previousOutputs: string,
  enableMedia: boolean = false,
  requestProposal: boolean = false,
  costTracker?: (metrics: CostMetrics) => void
): Promise<{ 
  result: string; 
  thoughts: string[]; 
  media?: MediaAsset;
  proposal?: ProposalOutput;
  tokensUsed?: number;
  costUSD?: number;
}> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const verbosityInst = agent.verbosity > 0.8 
    ? "Be extremely detailed and comprehensive. Provide thorough explanations."
    : agent.verbosity < 0.3 
      ? "Be extremely concise and terse. Use bullet points and avoid fluff."
      : "Provide a balanced level of detail.";
      
  const riskInst = agent.riskAversion > 0.8
    ? "Prioritize stability and proven methods. Be cautious and avoid experimental ideas."
    : agent.riskAversion < 0.3
      ? "Be bold and innovative. Suggest experimental, high-reward solutions and think outside the box."
      : "Balance innovation with stability.";

  const toolConfigDigest = Object.entries(agent.toolConfigs).map(([tool, cfg]: [string, any]) => {
    let contextData = "";
    if (cfg.knowledgeAssetIds?.length) {
      const mountedAssets = agent.knowledgeAssets.filter(a => cfg.knowledgeAssetIds.includes(a.id));
      contextData = mountedAssets.map(a => {
        try {
          const decoded = atob(a.content);
          return `[MOUNTED DATA: ${a.name}]\n${decoded}\n[END MOUNTED DATA]`;
        } catch (e) {
          return `[MOUNTED BINARY: ${a.name}] (Binary data, available via agent tool-access)`;
        }
      }).join('\n');
    }
    return `- ${tool} configuration: ${JSON.stringify(cfg)}\n${contextData ? `  INJECTED CONTEXT FOR ${tool}:\n${contextData}` : ""}`;
  }).join('\n');

  const knowledgeDigest = agent.knowledgeAssets?.length > 0 
    ? `FULL DATA CLUSTER INVENTORY (Available for general reference):
    ${agent.knowledgeAssets.map(a => `- FILE: ${a.name} (Type: ${a.type}, Size: ${a.size} bytes).`).join('\n')}`
    : "No specialized data clusters attached.";

  const modelToUse = agent.intelligenceConfig.model;
  const maxOutputTokens = agent.intelligenceConfig?.maxTokens || 2048;
  const taskDescriptions = agent.tasks.map(t => `- ${t.label}${t.dependencyIds?.length ? ` (Wait for: ${t.dependencyIds.join(', ')})` : ''}`).join('\n');

  const initialPrompt = `ROLE: ${agent.role}
    CORE DIRECTIVE: ${agent.personality}
    TRAITS: 
    - Verbosity Strategy: ${verbosityInst}
    - Risk Profile: ${riskInst}
    
    SUB-SYSTEM CALIBRATIONS & MOUNTED CONTEXT:
    ${toolConfigDigest}
    
    GENERAL DATA INVENTORY:
    ${knowledgeDigest}
    
    TASK QUEUE:
    ${taskDescriptions}
    
    PROJECT CONTEXT: ${projectContext}
    PREVIOUS AGENT INPUTS: ${previousOutputs}
    
    Execute your primary mission. Adhere strictly to your stylistic traits. 
    CRITICAL: You have been provided with MOUNTED DATA for specific tools. Prioritize analyzing this content when producing your result.
    
    ${agent.toolConfigs.logicEngine?.wisdomRefinement ? "Apply Wisdom Refinement: Audit your logic against first principles before finalizing." : ""}
    
    ${requestProposal ? `
    PROPOSAL REQUEST:
    If you are proposing an architecture or design decision, structure it as:
    {
      "architecture": "detailed design description",
      "rationale": "why this approach is optimal",
      "tradeoffs": { 
        "pro": ["benefit1", "benefit2"],
        "con": ["tradeoff1", "tradeoff2"]
      },
      "confidence": 0.85,
      "dependencies": ["other_agent_or_component"],
      "risks": ["potential_risk"]
    }` : ''}
    
    MANDATORY RESPONSE FORMAT:
    Return a JSON object with:
    1. 'thoughts': A list of 2-4 narrative sentences describing your internal reasoning.
    2. 'result': The actual technical output produced.
    3. 'mediaPrompt': If mediaSynth is enabled and you are generating a visual asset, provide a highly descriptive prompt for image/video generation here. Otherwise, null.
    ${requestProposal ? '4. \'proposal\': If applicable, the structured proposal object (see PROPOSAL REQUEST above). Otherwise, omit.' : ''}`;

  const initialResponse = await ai.models.generateContent({
    model: modelToUse as any,
    contents: initialPrompt,
    config: {
      temperature: agent.temperature,
      maxOutputTokens: maxOutputTokens,
      thinkingConfig: { thinkingBudget: Math.floor(maxOutputTokens / 2) },
      topP: agent.intelligenceConfig?.topP || 0.95,
      responseMimeType: "application/json",
       responseSchema: {
         type: Type.OBJECT,
         properties: {
           thoughts: { type: Type.ARRAY, items: { type: Type.STRING } },
           result: { type: Type.STRING },
           mediaPrompt: { type: Type.STRING, nullable: true },
           ...(requestProposal && {
             proposal: {
               type: Type.OBJECT,
               properties: {
                 architecture: { type: Type.STRING },
                 rationale: { type: Type.STRING },
                 tradeoffs: {
                   type: Type.OBJECT,
                   properties: {
                     pro: { type: Type.ARRAY, items: { type: Type.STRING } },
                     con: { type: Type.ARRAY, items: { type: Type.STRING } }
                   }
                 },
                 confidence: { type: Type.NUMBER },
                 dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
                 risks: { type: Type.ARRAY, items: { type: Type.STRING } },
                 costEstimate: { type: Type.NUMBER, nullable: true }
               }
             }
           })
         },
         required: ["thoughts", "result", "mediaPrompt"]
       }
    }
  });

  const initialText = initialResponse.text;
  if (!initialText) throw new Error("Agent task failed: AI returned an empty response.");
  let currentData = JSON.parse(initialText.trim());

  if (agent.intelligenceConfig.recursiveRefinement) {
    const passes = agent.intelligenceConfig.refinementPasses || 1;
    for (let i = 0; i < passes; i++) {
      const refinementPrompt = `YOU PREVIOUSLY GENERATED: ${currentData.result}
      
      CRITIQUE THIS OUTPUT BASED ON:
      - Self-Correction & Recursive Logic (RLM Pattern)
      - Domain Excellence (${agent.role})
      - Stylistic Consistency (${agent.personality})
      - Data Accuracy (Relative to MOUNTED DATA and Knowledge Clusters)
      
      Perform a recursive refinement pass. Refine the output to be strictly superior. 
      Return only the updated 'thoughts' and 'result' JSON.`;

      const refinementResponse = await ai.models.generateContent({
        model: modelToUse as any,
        contents: refinementPrompt,
        config: {
          temperature: agent.temperature * 0.8,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              thoughts: { type: Type.ARRAY, items: { type: Type.STRING } },
              result: { type: Type.STRING }
            },
            required: ["thoughts", "result"]
          }
        }
      });
      
      const refinedText = refinementResponse.text;
      if (refinedText) {
        const refinedData = JSON.parse(refinedText.trim());
        currentData.result = refinedData.result;
        currentData.thoughts.push(...refinedData.thoughts.map((t: string) => `[RLM REFINEMENT PASS ${i+1}]: ${t}`));
      }
    }
  }

  let media: MediaAsset | undefined;
  if (enableMedia && agent.enabledTools.includes('mediaSynth') && currentData.mediaPrompt) {
    try {
      const isVideo = agent.toolConfigs.mediaSynth?.generateVideo;
      const url = isVideo 
        ? await generateVideo(currentData.mediaPrompt, agent.intelligenceConfig, agent.toolConfigs.mediaSynth)
        : await generateImage(currentData.mediaPrompt, agent.intelligenceConfig, agent.toolConfigs.mediaSynth);
      
      media = {
        id: Math.random().toString(36).substr(2, 9),
        type: isVideo ? 'video' : 'image',
        url: url,
        prompt: currentData.mediaPrompt,
        timestamp: new Date()
      };
    } catch (err) {
      console.error("Media Synthesis Error:", err);
    }
  }

  // Extract token usage and calculate cost
  const usageMetadata = (initialResponse as any).usageMetadata || {};
  const inputTokens = usageMetadata.promptTokenCount || 0;
  const outputTokens = usageMetadata.candidatesTokenCount || 0;
  const tokensUsed = inputTokens + outputTokens;
  
  const costEstimate = estimateCost(modelToUse, inputTokens, outputTokens);
  
  // Track cost if callback provided
  if (costTracker) {
    const metrics: CostMetrics = {
      modelId: modelToUse,
      inputTokens,
      outputTokens,
      costUSD: costEstimate.total,
      timestamp: new Date(),
      agentName: agent.name
    };
    costTracker(metrics);
  }

  // Build proposal if requested
  let proposal: ProposalOutput | undefined;
  if (requestProposal && currentData.proposal) {
    proposal = {
      id: `proposal-${agent.id}-${Date.now()}`,
      agentId: agent.id,
      agentName: agent.name,
      ...currentData.proposal
    };
  }
  
  return { ...currentData, media, proposal, tokensUsed, costUSD: costEstimate.total };
};

export const synthesizeProject = async (
  prompt: string, 
  projectType: string, 
  agents: Agent[],
  config: IntelligenceConfig
): Promise<SynthesisResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const agentOutputs = agents.map(a => `${a.role} (${a.name}): ${a.output}`).join("\n\n---\n\n");
  
  const response = await ai.models.generateContent({
    model: config.model as any,
    contents: `Based on the original project goal: "${prompt}" and the final agent contributions:
    ${agentOutputs}`,
    config: {
      systemInstruction: `You are the Lead Project Architect. Generate a complete, production-ready file system structure JSON.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          files: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                path: { type: Type.STRING },
                content: { type: Type.STRING },
                language: { type: Type.STRING }
              },
              required: ["path", "content", "language"]
            }
          }
        },
        required: ["files"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Synthesis failed: AI returned an empty response.");
  return JSON.parse(text.trim()) as SynthesisResponse;
};

export const speakText = async (
  text: string, 
  voiceName: string = 'Zephyr', 
  speed: number = 1.0, 
  pitch: number = 1.0,
  elevenLabs?: ElevenLabsConfig,
  globalElevenLabsKey?: string
): Promise<void> => {
  speechQueue.add(async () => {
    const elKey = elevenLabs?.apiKey || globalElevenLabsKey;
    if (elevenLabs?.voiceId && elKey) {
      try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabs.voiceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': elKey
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: elevenLabs.stability,
              similarity_boost: elevenLabs.similarityBoost
            }
          })
        });

        if (response.ok) {
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          return new Promise((resolve) => {
            audio.onended = () => resolve();
            audio.onerror = () => resolve();
            audio.play();
          });
        }
      } catch (err) {
        console.error("ElevenLabs error:", err);
      }
    }

    // Always instantiate a new GoogleGenAI right before the API call.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), audioContext, 24000, 1);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        
        return new Promise((resolve) => {
          source.onended = () => {
            audioContext.close();
            resolve();
          };
          source.start();
        });
      }
    } catch (err: any) {
      if (err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        console.warn("Gemini TTS Quota Exhausted: Silent fallback engaged.");
      } else {
        console.error("Gemini TTS Error:", err);
      }
    }
  });
};

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
