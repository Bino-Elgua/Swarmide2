import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Agent } from '../types';

interface Template {
  id: string;
  name: string;
  sector: string;
  description: string;
  prompt: string;
  icon: string;
  color: string;
  difficulty: 'Standard' | 'Tactical' | 'Elite';
  summonedNodes: string[];
  features: string[];
  constraints: string[];
  tags: string[];
  ecosystem?: {
    language?: string;
    framework?: string;
    database?: string;
    deployment?: string;
  };
  outcomes?: {
    success: string;
    failure: string;
  };
  config?: any;
}

interface TemplatesProps {
  registry: Agent[];
  onUseTemplate: (prompt: string, config?: any, summonedNodes?: string[]) => void;
}

type ArchitectSection = 'identity' | 'mission' | 'topology' | 'ecosystem' | 'outcomes' | 'review';

const TEMPLATE_SECTORS = [
  { id: 'web', label: 'Full-Stack Web', icon: 'globe' },
  { id: 'multimedia', label: 'Brand Ecosystems', icon: 'camera-retro' },
  { id: 'research', label: 'Research & Data', icon: 'microscope' },
  { id: 'creative', label: 'Creative IP', icon: 'pen-fancy' },
  { id: 'security', label: 'Security & Oversight', icon: 'shield-halved' },
  { id: 'gaming', label: 'Strategic Gaming', icon: 'gamepad' },
  { id: 'workflow', label: 'Knowledge Architect', icon: 'diagram-project' },
  { id: 'custom', label: 'User Custom', icon: 'user-gear' }
];

const INITIAL_TEMPLATES_DATA: Template[] = [
  // --- WEB SECTOR ---
  {
    id: 't-saas',
    name: 'SaaS Multi-Cloud Dashboard',
    sector: 'web',
    description: 'High-performance monitoring interface with real-time cloud analytics and secure flows.',
    prompt: 'Summon Kernel, Scale, Prism, Maven, and Cipher. Build high-performance SaaS dashboard.',
    icon: 'chart-pie', color: '#6366f1', difficulty: 'Elite',
    summonedNodes: ['Kernel', 'Scale', 'Prism', 'Maven', 'Cipher'],
    features: ['Real-time Websockets', 'Multi-tenant Auth', 'Dynamic Charts'],
    constraints: ['Max latency 200ms'], tags: ['Cloud', 'Enterprise'],
    config: { strategy: 'technical', intensity: 3, platform: 'web' }
  },
  {
    id: 't-ecom',
    name: 'Neural E-Commerce Engine',
    sector: 'web',
    description: 'Next-gen storefront with personalized AI recommendations and semantic product search.',
    prompt: 'Recruit Scale, Nexus, Quartz, and Lyric. Architect e-commerce engine with RAG search.',
    icon: 'cart-shopping', color: '#10b981', difficulty: 'Tactical',
    summonedNodes: ['Scale', 'Nexus', 'Quartz', 'Lyric'],
    features: ['Semantic Search', 'Inventory Sync', 'Checkout Flow'],
    constraints: ['Mobile Responsive'], tags: ['Retail', 'AI Search'],
    config: { strategy: 'balanced', intensity: 2, platform: 'web' }
  },
  {
    id: 't-social',
    name: 'Decentralized Social Graph',
    sector: 'web',
    description: 'Privacy-first social networking layer with encrypted messaging and sovereign identity.',
    prompt: 'Summon Cipher, Nexus, Rogue, and Vault. Design decentralized social graph.',
    icon: 'users-between-lines', color: '#8b5cf6', difficulty: 'Elite',
    summonedNodes: ['Cipher', 'Nexus', 'Rogue', 'Vault'],
    features: ['P2P Protocol', 'E2E Encryption', 'Identity Layer'],
    constraints: ['Zero PII leakage'], tags: ['Web3', 'Privacy'],
    config: { strategy: 'technical', intensity: 3, platform: 'web' }
  },
  {
    id: 't-portfolio',
    name: 'Immersive Dev Portfolio',
    sector: 'web',
    description: 'Highly aesthetic 3D/Interactive portfolio for showcasing high-end engineering work.',
    prompt: 'Recruit Prism, Muse, Motion, and Spark. Build immersive interactive portfolio.',
    icon: 'id-card', color: '#f59e0b', difficulty: 'Standard',
    summonedNodes: ['Prism', 'Muse', 'Motion', 'Spark'],
    features: ['3D WebGL integration', 'Animated Layouts', 'Dark Vibe'],
    constraints: ['Load time < 2s'], tags: ['Frontend', 'Design'],
    config: { strategy: 'creative', intensity: 2, platform: 'web' }
  },

  // --- MULTIMEDIA SECTOR ---
  {
    id: 't-teaser',
    name: 'Cinematic Product Teaser',
    sector: 'multimedia',
    description: '1080p high-fidelity product reveal with storyboarded motion sequences and cinematic score.',
    prompt: 'Recruit Director, Iris, Motion, Lyric, and Viral. Generate cinematic 1080p teaser.',
    icon: 'clapperboard', color: '#ef4444', difficulty: 'Elite',
    summonedNodes: ['Director', 'Iris', 'Motion', 'Lyric', 'Viral'],
    features: ['Veo Motion Sync', 'HD Storyboarding', 'Viral Hook'],
    constraints: ['16:9 Aspect Ratio'], tags: ['Marketing', 'Video'],
    config: { strategy: 'creative', intensity: 3, platform: 'creative', enableMedia: true }
  },
  {
    id: 't-brand-kit',
    name: 'Neural Brand Identity',
    sector: 'multimedia',
    description: 'Comprehensive branding system including logos, typography scales, and mood manifestos.',
    prompt: 'Summon Muse, Pixel, Lyric, and Horizon. Synthesize neural brand identity kit.',
    icon: 'stamp', color: '#ec4899', difficulty: 'Standard',
    summonedNodes: ['Muse', 'Pixel', 'Lyric', 'Horizon'],
    features: ['Vector Logo variants', 'Type Hierarchy', 'Tone Guide'],
    constraints: ['WCAG Compliance'], tags: ['Branding', 'Design'],
    config: { strategy: 'creative', intensity: 2, platform: 'creative' }
  },
  {
    id: 't-social-factory',
    name: 'Social Media Factory',
    sector: 'multimedia',
    description: 'Automated content generator for vertical video platforms and social engagement.',
    prompt: 'Recruit Viral, Lyric, Spark, and Motion. Build social media content factory.',
    icon: 'hashtag', color: '#f472b6', difficulty: 'Tactical',
    summonedNodes: ['Viral', 'Lyric', 'Spark', 'Motion'],
    features: ['9:16 Optimization', 'Trending Hook engine', 'Bulk Export'],
    constraints: ['Engagement-first'], tags: ['Social', 'Growth'],
    config: { strategy: 'fast', intensity: 3, platform: 'creative', enableMedia: true }
  },
  {
    id: 't-motion-lib',
    name: 'UI Motion Library',
    sector: 'multimedia',
    description: 'Physics-based animation library for enhancing interaction feedback in web apps.',
    prompt: 'Summon Motion, Prism, Kernel, and Spark. Design UI motion library specs.',
    icon: 'film', color: '#a855f7', difficulty: 'Tactical',
    summonedNodes: ['Motion', 'Prism', 'Kernel', 'Spark'],
    features: ['Bezier Easing maps', 'State transitions', 'Micro-interactions'],
    constraints: ['60FPS Performance'], tags: ['UI/UX', 'Animation'],
    config: { strategy: 'technical', intensity: 2, platform: 'web' }
  },

  // --- RESEARCH SECTOR ---
  {
    id: 't-scholar',
    name: 'Academic Paper Synthesizer',
    sector: 'research',
    description: 'Deep RAG pipeline for processing vast scientific literature into consolidated reports.',
    prompt: 'Recruit Horizon, Quartz, Veritas, and Sage. Synthesize academic domain report.',
    icon: 'book-open-reader', color: '#06b6d4', difficulty: 'Elite',
    summonedNodes: ['Horizon', 'Quartz', 'Veritas', 'Sage'],
    features: ['Multi-source RAG', 'Citation Mapping', 'Truth Scoring'],
    constraints: ['Grounded references only'], tags: ['Science', 'RAG'],
    config: { strategy: 'technical', intensity: 3, platform: 'science' }
  },
  {
    id: 't-market-intel',
    name: 'Market Intelligence Node',
    sector: 'research',
    description: 'Real-time competitive analysis and trend forecasting for emerging tech markets.',
    prompt: 'Summon Nova, Quartz, Scout, and Horizon. Build market intelligence report.',
    icon: 'magnifying-glass-chart', color: '#14b8a6', difficulty: 'Tactical',
    summonedNodes: ['Nova', 'Quartz', 'Scout', 'Horizon'],
    features: ['Trend extrapolation', 'Competitor tracking', 'Risk modeling'],
    constraints: ['Current year context'], tags: ['Business', 'Intel'],
    config: { strategy: 'balanced', intensity: 2, platform: 'science' }
  },
  {
    id: 't-bio-sim',
    name: 'Biological Process Simulator',
    sector: 'research',
    description: 'Visualization and modeling of molecular interactions and cellular growth patterns.',
    prompt: 'Recruit Simulator, Horizon, Quartz, and Kernel. Design bio-process simulation.',
    icon: 'dna', color: '#10b981', difficulty: 'Elite',
    summonedNodes: ['Simulator', 'Horizon', 'Quartz', 'Kernel'],
    features: ['Physics modeling', 'Molecular visualization', 'Data charts'],
    constraints: ['Scientific accuracy'], tags: ['BioTech', 'Simulation'],
    config: { strategy: 'technical', intensity: 3, platform: 'science', enableMedia: true }
  },
  {
    id: 't-data-viz',
    name: 'Big Data Art Engine',
    sector: 'research',
    description: 'Transforming cold statistical clusters into beautiful, meaningful data visualizations.',
    prompt: 'Summon Iris, Quartz, Prism, and Draft. Synthesize data visualization suite.',
    icon: 'chart-line', color: '#f59e0b', difficulty: 'Standard',
    summonedNodes: ['Iris', 'Quartz', 'Prism', 'Draft'],
    features: ['Interactive Heatmaps', 'D3.js integration', 'Artistic Framing'],
    constraints: ['No data distortion'], tags: ['DataViz', 'Creative'],
    config: { strategy: 'creative', intensity: 2, platform: 'web' }
  },

  // --- CREATIVE SECTOR ---
  {
    id: 't-fiction',
    name: 'Interactive Fiction Engine',
    sector: 'creative',
    description: 'Branching narrative world with character AI and dynamic quest generation.',
    prompt: 'Recruit Weaver, Spark, Lyric, and Muse. Build interactive fiction engine.',
    icon: 'book-bookmark', color: '#8b5cf6', difficulty: 'Tactical',
    summonedNodes: ['Weaver', 'Spark', 'Lyric', 'Muse'],
    features: ['Dynamic Quest-line', 'Character Consistency', 'Lore Buffer'],
    constraints: ['Player choice impact'], tags: ['Storytelling', 'RPG'],
    config: { strategy: 'creative', intensity: 2, platform: 'creative' }
  },
  {
    id: 't-concept-art',
    name: 'Concept Art Forge',
    sector: 'creative',
    description: 'Iterative visual exploration of world-building elements and character designs.',
    prompt: 'Recruit Prism, Muse, Motion, and Spark. Build interactive fiction engine.',
    icon: 'palette', color: '#ec4899', difficulty: 'Standard',
    summonedNodes: ['Iris', 'Spark', 'Muse', 'Director'],
    features: ['Character turnarounds', 'Environment mood-boards', 'Style guide'],
    constraints: ['Consistent Aesthetic'], tags: ['Gaming', 'ConceptArt'],
    config: { strategy: 'creative', intensity: 3, platform: 'creative', enableMedia: true }
  },
  {
    id: 't-world-builder',
    name: 'Recursive World Builder',
    sector: 'creative',
    description: 'Generates cohesive planet history, cultures, and languages for speculative fiction.',
    prompt: 'Recruit Weaver, Horizon, Lyric, and Spark. Architect recursive world-builder.',
    icon: 'globe-europe', color: '#f59e0b', difficulty: 'Elite',
    summonedNodes: ['Weaver', 'Horizon', 'Lyric', 'Spark'],
    features: ['Timeline generation', 'Language proto-logic', 'Cultural artifacts'],
    constraints: ['Internal Logic Cohesion'], tags: ['Speculative', 'Lore'],
    config: { strategy: 'balanced', intensity: 3, platform: 'creative' }
  },
  {
    id: 't-lyric-forge',
    name: 'Melodic Lyric Engine',
    sector: 'creative',
    description: 'AI-assisted songwriting tool focusing on meter, rhyme schemes, and emotional resonance.',
    prompt: 'Summon Lyric, Weaver, Spark, and Lyric. Build melodic lyric engine.',
    icon: 'music', color: '#f472b6', difficulty: 'Standard',
    summonedNodes: ['Lyric', 'Weaver', 'Spark'],
    features: ['Rhyme dictionary', 'Meter analysis', 'Sentiment mapping'],
    constraints: ['Human-like warmth'], tags: ['Music', 'Writing'],
    config: { strategy: 'creative', intensity: 2, platform: 'creative' }
  },

  // --- SECURITY SECTOR ---
  {
    id: 't-pentest',
    name: 'Automated Pentest Auditor',
    sector: 'security',
    description: 'Defensive node cluster designed to identify entry points and logic vulnerabilities.',
    prompt: 'Summon Cipher, Sentry, Vault, and Veritas. Perform automated security audit.',
    icon: 'user-ninja', color: '#ef4444', difficulty: 'Elite',
    summonedNodes: ['Cipher', 'Sentry', 'Vault', 'Veritas'],
    features: ['Logic path fuzzing', 'Secrets scanning', 'OWASP Top 10 check'],
    constraints: ['Non-destructive scan'], tags: ['SecOps', 'Infosec'],
    config: { strategy: 'technical', intensity: 3, platform: 'science' }
  },
  {
    id: 't-zero-trust',
    name: 'Zero-Trust Architecture',
    sector: 'security',
    description: 'Blueprint for highly secure internal networks with continuous identity verification.',
    prompt: 'Recruit Vault, Cipher, General, and Warden. Design Zero-Trust framework.',
    icon: 'lock-open', color: '#334155', difficulty: 'Elite',
    summonedNodes: ['Vault', 'Cipher', 'General', 'Warden'],
    features: ['Identity Bridge', 'Access Policy engine', 'Audit Ledger'],
    constraints: ['100% data encryption'], tags: ['Network', 'Cyber'],
    config: { strategy: 'technical', intensity: 2, platform: 'web' }
  },
  {
    id: 't-compliance',
    name: 'Compliance Guard Node',
    sector: 'security',
    description: 'GDPR/HIPAA monitoring layer for ensuring data privacy compliance at the code level.',
    prompt: 'Summon Sentinel, Warden, Sage, and Justice. Build compliance guard layer.',
    icon: 'scale-balanced', color: '#3b82f6', difficulty: 'Tactical',
    summonedNodes: ['Sentinel', 'Warden', 'Sage', 'Justice'],
    features: ['PII detection', 'Policy validation', 'Reporting engine'],
    constraints: ['Regulatory Accuracy'], tags: ['Law', 'Enterprise'],
    config: { strategy: 'balanced', intensity: 2, platform: 'web' }
  },
  {
    id: 't-malware-scan',
    name: 'Binary Anomaly Engine',
    sector: 'security',
    description: 'Heuristic analysis of file streams to detect suspicious code patterns and backdoors.',
    prompt: 'Recruit Cipher, Kernel, Sentry, and Quartz. Build binary anomaly engine.',
    icon: 'bug-slash', color: '#dc2626', difficulty: 'Tactical',
    summonedNodes: ['Cipher', 'Kernel', 'Sentry', 'Quartz'],
    features: ['Signature matching', 'Heuristic analysis', 'Sandbox testing'],
    constraints: ['Low False-Positive rate'], tags: ['Kernel', 'Security'],
    config: { strategy: 'technical', intensity: 3, platform: 'web' }
  },

  // --- GAMING SECTOR ---
  {
    id: 't-physics',
    name: 'Procedural Physics Sandbox',
    sector: 'gaming',
    description: 'Real-time interactive environment showcasing complex gravity and fluid simulations.',
    prompt: 'Summon Kernel, Simulator, Spark, and Prism. Build physics sandbox.',
    icon: 'atom', color: '#34d399', difficulty: 'Elite',
    summonedNodes: ['Kernel', 'Simulator', 'Spark', 'Prism'],
    features: ['Collision system', 'Fluid dynamics', 'GPU optimization'],
    constraints: ['Web-playable'], tags: ['GameDev', 'Physics'],
    config: { strategy: 'technical', intensity: 3, platform: 'web', enableMedia: true }
  },
  {
    id: 't-npc-ai',
    name: 'Emergent NPC Behavior',
    sector: 'gaming',
    description: 'Deep behavior trees for non-player characters with goals, memories, and emotions.',
    prompt: 'Recruit Weaver, Spark, Sage, and Rogue. Architect NPC behavior graph.',
    icon: 'headset', color: '#8b5cf6', difficulty: 'Tactical',
    summonedNodes: ['Weaver', 'Spark', 'Sage', 'Rogue'],
    features: ['Dynamic Quest-line', 'Character Consistency', 'Lore Buffer'],
    constraints: ['Player choice impact'], tags: ['AI', 'Gaming'],
    config: { strategy: 'creative', intensity: 2, platform: 'creative' }
  },
  {
    id: 't-strat-engine',
    name: 'Grand Strategy Engine',
    sector: 'gaming',
    description: 'Logical framework for turn-based strategy games with complex economy models.',
    prompt: 'Summon General, Orbit, Scale, and Nexus. Design grand strategy engine core.',
    icon: 'chess', color: '#ef4444', difficulty: 'Elite',
    summonedNodes: ['General', 'Orbit', 'Scale', 'Nexus'],
    features: ['Economy simulation', 'Unit Pathfinding', 'State machine'],
    constraints: ['Determinism required'], tags: ['Logic', 'Gaming'],
    config: { strategy: 'technical', intensity: 3, platform: 'science' }
  },
  {
    id: 't-world-gen',
    name: 'Voxel World Generator',
    sector: 'gaming',
    description: 'Procedural terrain generator for infinite explorability and biome diversity.',
    prompt: 'Recruit Kernel, Spark, Iris, and Scale. Build procedural voxel generator.',
    icon: 'cube', color: '#10b981', difficulty: 'Elite',
    summonedNodes: ['Kernel', 'Spark', 'Iris', 'Scale'],
    features: ['Biome logic', 'Noise-based terrain', 'LOD optimization'],
    constraints: ['Infinite generation'], tags: ['Math', 'Graphics'],
    config: { strategy: 'technical', intensity: 3, platform: 'web' }
  },

  // --- WORKFLOW SECTOR ---
  {
    id: 't-rag-docs',
    name: 'Knowledge RAG System',
    sector: 'workflow',
    description: 'Intelligent document processing layer that answers complex queries over huge PDF clusters.',
    prompt: 'Summon Horizon, Quartz, Veritas, and Scribe. Build document RAG pipeline.',
    icon: 'magnifying-glass-chart', color: '#06b6d4', difficulty: 'Tactical',
    summonedNodes: ['Horizon', 'Quartz', 'Veritas', 'Scribe'],
    features: ['Vector Indexing', 'Context Retrieval', 'Source Citation'],
    constraints: ['High accuracy'], tags: ['Automation', 'AI'],
    config: { strategy: 'technical', intensity: 2, platform: 'web' }
  },
  {
    id: 't-proj-mgr',
    name: 'Autonomous Project Manager',
    sector: 'workflow',
    description: 'Smart task dispatcher that tracks node progress and autonomously resolves blockers.',
    prompt: 'Recruit Vanguard, General, Orbit, and Scribe. Architect project management node.',
    icon: 'list-check', color: '#10b981', difficulty: 'Standard',
    summonedNodes: ['Vanguard', 'General', 'Orbit', 'Scribe'],
    features: ['Auto-scheduling', 'Blocker detection', 'Progress summary'],
    constraints: ['Minimal human input'], tags: ['Agile', 'Automation'],
    config: { strategy: 'balanced', intensity: 2, platform: 'web' }
  },
  {
    id: 't-api-relay',
    name: 'Intelligent API Relay',
    sector: 'workflow',
    description: 'Smart gateway that transforms disparate API responses into unified semantic data.',
    prompt: 'Summon Nexus, Nexus, Quartz, and Maven. Build intelligent API relay.',
    icon: 'shuffle', color: '#8b5cf6', difficulty: 'Tactical',
    summonedNodes: ['Nexus', 'Quartz', 'Maven'],
    features: ['Response normalization', 'GraphQL bridge', 'Error handling'],
    constraints: ['High availability'], tags: ['Backend', 'Integration'],
    config: { strategy: 'technical', intensity: 2, platform: 'web' }
  },
  {
    id: 't-logic-audit',
    name: 'Recursive Logic Auditor',
    sector: 'workflow',
    description: 'A structural code-review cluster that checks for circular logic and anti-patterns.',
    prompt: 'Recruit Confucius, Veritas, Cipher, and Maven. Design logic audit pipeline.',
    icon: 'microscope', color: '#fbbf24', difficulty: 'Elite',
    summonedNodes: ['Confucius', 'Veritas', 'Cipher', 'Maven'],
    features: ['RLM pattern check', 'Dependency audit', 'Refactor advice'],
    constraints: ['Deep recursive scan'], tags: ['Quality', 'DevOps'],
    config: { strategy: 'technical', intensity: 3, platform: 'web' }
  }
];

const ARCHETYPE_DIFFICULTY = ['Standard', 'Tactical', 'Elite'];

const ICON_GROUPS = {
  Technical: ['microchip', 'server', 'terminal', 'code', 'database', 'key', 'gear', 'bolt', 'bug-slash', 'cube', 'shuffle'],
  Creative: ['palette', 'wand-magic-sparkles', 'clapperboard', 'pen-fancy', 'music', 'camera', 'brain', 'feather', 'book-bookmark', 'stamp', 'id-card'],
  Strategic: ['chess-knight', 'shield-halved', 'map', 'gavel', 'bullhorn', 'scroll', 'landmark', 'users-viewfinder', 'globe', 'lock-open', 'scale-balanced', 'chart-pie', 'id-card', 'users-between-lines']
};

const COLOR_SPECTRUM = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#14b8a6', 
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef'
];

const TECH_STACKS = {
  languages: ['TypeScript', 'Python', 'Rust', 'Go', 'Solidity', 'C++', 'Swift'],
  frameworks: ['React + Vite', 'Next.js', 'FastAPI', 'PyTorch', 'Unity', 'Tailwind CSS', 'Three.js', 'Ethers.js'],
  databases: ['PostgreSQL', 'MongoDB', 'Pinecone (Vector)', 'Redis', 'SQLite', 'Supabase'],
  deployments: ['Vercel Edge', 'AWS Lambda', 'GCP Kubernetes', 'Tauri Local Desktop', 'Docker Cluster']
};

const AGENT_CATEGORY_ICONS: Record<string, string> = {
  engineering: 'microchip',
  discovery: 'microscope',
  creative: 'pen-fancy',
  tactical: 'chess-knight',
  imaging: 'camera',
  motion: 'clapperboard',
  security: 'shield-halved',
  ethics: 'gavel',
  custom: 'user-gear'
};

const Templates: React.FC<TemplatesProps> = ({ registry, onUseTemplate }) => {
  const [activeSector, setActiveSector] = useState('web');
  const [stackIndex, setStackIndex] = useState(0);
  const [showArchitect, setShowArchitect] = useState(false);
  const [activeArchitectSection, setActiveArchitectSection] = useState<ArchitectSection>('identity');
  
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false, initialX: 0, initialY: 0 });
  const [swipingOut, setSwipingOut] = useState<{ dir: 'left' | 'right' | null }>({ dir: null });

  const [customTemplates, setCustomTemplates] = useState<Template[]>(() => {
    const saved = localStorage.getItem('vibe_custom_templates');
    return saved ? JSON.parse(saved) : [];
  });

  const [formTemplate, setFormTemplate] = useState<Partial<Template>>({
    name: '', sector: 'custom', description: '', prompt: '', icon: 'rocket', color: '#6366f1', difficulty: 'Standard',
    summonedNodes: [], features: [], constraints: [], tags: [],
    ecosystem: { language: 'TypeScript', framework: 'React + Vite', database: 'PostgreSQL', deployment: 'Vercel Edge' },
    outcomes: { success: 'Complete loop.', failure: 'Pivot.' },
    config: { strategy: 'balanced', intensity: 2, platform: 'web', enableMedia: false }
  });

  const [expandedTopologySectors, setExpandedTopologySectors] = useState<string[]>(['engineering']);

  useEffect(() => { localStorage.setItem('vibe_custom_templates', JSON.stringify(customTemplates)); }, [customTemplates]);
  const allTemplates = useMemo(() => [...INITIAL_TEMPLATES_DATA, ...customTemplates], [customTemplates]);
  const filteredTemplates = useMemo(() => allTemplates.filter(t => t.sector === activeSector), [allTemplates, activeSector]);
  
  const groupedRegistry = useMemo(() => {
    const groups: Record<string, Agent[]> = {};
    registry.forEach(a => {
      if (!groups[a.category]) groups[a.category] = [];
      groups[a.category].push(a);
    });
    return groups;
  }, [registry]);

  useEffect(() => { setStackIndex(0); }, [activeSector]);

  const handleSwipe = (dir: 'left' | 'right') => {
    if (filteredTemplates.length === 0) return;
    const t = filteredTemplates[stackIndex];
    if (dir === 'right') {
      onUseTemplate(t.prompt, t.config, t.summonedNodes);
    }
    setSwipingOut({ dir });
    setTimeout(() => {
      setStackIndex(prev => (prev + 1) % filteredTemplates.length);
      setSwipingOut({ dir: null });
      setDrag({ x: 0, y: 0, active: false, initialX: 0, initialY: 0 });
    }, 300);
  };

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (filteredTemplates.length === 0) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setDrag({ x: 0, y: 0, active: true, initialX: clientX, initialY: clientY });
  };
  const onDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drag.active) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setDrag(prev => ({ ...prev, x: clientX - prev.initialX, y: clientY - prev.initialY }));
  };
  const onDragEnd = () => {
    if (!drag.active) return;
    if (drag.x > 100) handleSwipe('right'); else if (drag.x < -100) handleSwipe('left'); else setDrag({ x: 0, y: 0, active: false, initialX: 0, initialY: 0 });
  };

  const handleOpenArchitect = () => {
    setFormTemplate({ 
      name: '', sector: 'custom', description: '', prompt: '', icon: 'rocket', color: '#6366f1', difficulty: 'Standard', 
      summonedNodes: [], features: [], constraints: [], tags: [], 
      ecosystem: { language: 'TypeScript', framework: 'React + Vite', database: 'PostgreSQL', deployment: 'Vercel Edge' }, 
      outcomes: { success: 'Complete loop.', failure: 'Pivot.' }, 
      config: { strategy: 'balanced', intensity: 2, platform: 'web', enableMedia: false } 
    });
    setActiveArchitectSection('identity'); setShowArchitect(true);
  };

  const handleSaveTemplate = () => {
    if (!formTemplate.name || !formTemplate.prompt) return;
    setCustomTemplates(prev => [...prev, { ...formTemplate as Template, id: `custom-t-${Date.now()}` }]);
    setShowArchitect(false); setActiveSector('custom');
  };

  const toggleNodeSelection = (name: string) => {
    setFormTemplate(prev => { 
      const curr = (prev.summonedNodes as string[]) || []; 
      return { ...prev, summonedNodes: curr.includes(name) ? curr.filter(n => n !== name) : [...curr, name] }; 
    });
  };

  const toggleTopologySector = (sector: string) => {
    setExpandedTopologySectors(prev => prev.includes(sector) ? prev.filter(s => s !== sector) : [...prev, sector]);
  };

  const handleArchitectNext = () => {
    const sections: ArchitectSection[] = ['identity', 'mission', 'topology', 'ecosystem', 'outcomes', 'review'];
    const currIdx = sections.indexOf(activeArchitectSection);
    if (currIdx < sections.length - 1) setActiveArchitectSection(sections[currIdx + 1]);
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6 animate-fade-in overflow-y-auto custom-scrollbar relative">
      <div className="flex items-end justify-between shrink-0">
        <div className="space-y-1">
          <h1 className="text-xl font-black text-white uppercase tracking-tighter" style={{ color: 'var(--text-bold)' }}>Foundations</h1>
          <p className="text-[11px] font-medium opacity-60 italic" style={{ color: 'var(--text-dim)' }}>"Swipe blueprints into active production manifest."</p>
        </div>
        <button onClick={handleOpenArchitect} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[9px] uppercase tracking-widest rounded-xl shadow-lg active:scale-95 flex items-center space-x-3">
          <i className="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
          <span>Architect Mission</span>
        </button>
      </div>

      <div className="flex space-x-2 shrink-0 overflow-x-auto pb-2 no-scrollbar relative z-10">
        {TEMPLATE_SECTORS.map(sec => (
          <button key={sec.id} onClick={() => setActiveSector(sec.id)} className={`flex items-center space-x-2 px-4 py-2 rounded-xl border transition-all shrink-0 ${activeSector === sec.id ? 'shadow-md border-indigo-500' : 'opacity-40 hover:opacity-100 hover:bg-white/5'}`} style={activeSector === sec.id ? { backgroundColor: 'var(--accent)', color: 'white' } : { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-dim)' }}>
            <i className={`fa-solid fa-${sec.icon} text-[10px]`}></i>
            <span className="text-[9px] font-black uppercase tracking-widest">{sec.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative min-h-[450px] pb-20">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
           <i className={`fa-solid fa-${TEMPLATE_SECTORS.find(s => s.id === activeSector)?.icon || 'box'} text-[20rem]`} />
        </div>

        {filteredTemplates.length === 0 ? (
          <div className="p-12 text-center bg-white/5 border border-dashed border-white/10 rounded-3xl opacity-30">
             <i className="fa-solid fa-box-open text-4xl mb-4"></i>
             <p className="text-sm font-black uppercase tracking-widest">Sector Empty</p>
          </div>
        ) : (
          <div className="relative w-full max-w-sm h-[400px] flex items-center justify-center touch-none select-none" onMouseDown={onDragStart} onMouseMove={onDragMove} onMouseUp={onDragEnd} onMouseLeave={onDragEnd} onTouchStart={onDragStart} onTouchMove={onDragMove} onTouchEnd={onDragEnd}>
            {filteredTemplates.map((template, idx) => {
              const diff = (idx - stackIndex + filteredTemplates.length) % filteredTemplates.length;
              if (diff > 3) return null;
              const isTop = diff === 0;
              const scale = 1 - (diff * 0.05);
              const dragRotate = isTop ? (drag.x / 20) : 0;
              const dragTranslateX = isTop ? drag.x : 0;
              const isSwipingOut = swipingOut.dir !== null && isTop;
              const finalTranslateX = isSwipingOut ? (swipingOut.dir === 'right' ? 1000 : -1000) : dragTranslateX;

              return (
                <div key={template.id} className={`absolute inset-0 p-6 rounded-3xl border flex flex-col h-[400px] overflow-hidden transition-all shadow-xl ${isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
                  style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', transform: `translate(${finalTranslateX}px, ${isTop ? drag.y : diff * -15}px) rotate(${isSwipingOut ? (swipingOut.dir === 'right' ? 45 : -45) : dragRotate}deg) scale(${isTop ? 1 : scale})`, zIndex: filteredTemplates.length - diff, opacity: isSwipingOut ? 0 : 1 - (diff * 0.2), filter: `blur(${isTop ? 0 : diff * 2}px)`, transition: drag.active ? 'none' : 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)' }}>
                  <div className="absolute top-4 right-6"><span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shadow-sm`} style={{ color: template.difficulty === 'Elite' ? '#ef4444' : template.difficulty === 'Tactical' ? '#f59e0b' : '#10b981', borderColor: 'currentColor' }}>{template.difficulty}</span></div>
                  <div className="flex items-center space-x-4 mb-6 mt-2"><div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-inner border" style={{ backgroundColor: `${template.color}15`, color: template.color, borderColor: `${template.color}30` }}><i className={`fa-solid fa-${template.icon}`}></i></div><div><h3 className="text-sm font-black uppercase tracking-tight leading-none mb-1" style={{ color: 'var(--text-bold)' }}>{template.name}</h3><p className="text-[9px] font-black uppercase opacity-60" style={{ color: 'var(--accent)' }}>{template.sector}</p></div></div>
                  <div className="flex-1 space-y-4 overflow-hidden"><p className="text-[11px] leading-relaxed font-bold italic line-clamp-3 opacity-80">"{template.description}"</p><div className="space-y-3"><div className="flex flex-wrap gap-1.5">{template.summonedNodes.map(node => (<span key={node} className="px-1.5 py-0.5 rounded-md bg-black/40 border border-white/5 text-[8px] font-black uppercase text-indigo-400">{node}</span>))}</div><div className="space-y-1 h-20 overflow-y-auto no-scrollbar">{template.features.map(feat => (<div key={feat} className="flex items-center space-x-2"><i className="fa-solid fa-circle-check text-[6px] text-emerald-500"></i><span className="text-[9px] font-bold uppercase text-slate-500 truncate">{feat}</span></div>))}</div></div></div>
                  {isTop && (
                    <div className="mt-4 flex space-x-2 shrink-0">
                       <button onClick={() => handleSwipe('left')} className="flex-1 py-3 rounded-xl border border-white/5 bg-black/20 hover:bg-red-500/10 hover:border-red-500/30 text-slate-500 hover:text-red-400 transition-all font-black text-[9px] uppercase tracking-widest">Discard</button>
                       <button onClick={() => handleSwipe('right')} className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all font-black text-[9px] uppercase tracking-widest">Summon Node</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showArchitect && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-xl p-6">
           <div className="w-full max-w-5xl bg-[#0d1117] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col h-[85vh] animate-scale-in">
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#161b22]">
                 <div className="flex items-center space-x-4"><div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg"><i className="fa-solid fa-diagram-project text-white text-lg"></i></div><div><h2 className="text-lg font-black text-white uppercase tracking-tight">Mission Architect</h2><p className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Blueprint Protocol</p></div></div>
                 <button onClick={() => setShowArchitect(false)} className="w-10 h-10 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all text-sm"><i className="fa-solid fa-times"></i></button>
              </div>
              <div className="flex-1 overflow-hidden flex">
                 <div className="w-48 border-r border-slate-800 p-4 space-y-1.5 bg-[#0d1117] overflow-y-auto no-scrollbar shrink-0">
                    {(['identity', 'mission', 'topology', 'ecosystem', 'outcomes', 'review'] as ArchitectSection[]).map(s => (
                      <button key={s} onClick={() => setActiveArchitectSection(s)} className={`w-full text-left px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeArchitectSection === s ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-800/50'}`}>{s}</button>
                    ))}
                 </div>
                 <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-slate-900/30">
                    {activeArchitectSection === 'identity' && (
                      <div className="space-y-10 animate-fade-in">
                        <div className="space-y-4">
                           <h3 className="text-sm font-black uppercase text-indigo-400 border-b border-white/5 pb-2">Cluster Signature</h3>
                           <div className="grid grid-cols-2 gap-8">
                             <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Blueprint Label</label><input type="text" value={formTemplate.name} onChange={e => setFormTemplate(p => ({ ...p, name: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-[12px] text-white outline-none focus:ring-1 focus:ring-indigo-500" placeholder="e.g. NEURAL_GATEWAY_V1" /></div>
                             <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Vertical Classification</label><select value={formTemplate.sector} onChange={e => setFormTemplate(p => ({ ...p, sector: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-[12px] text-white outline-none focus:ring-1 focus:ring-indigo-500">{TEMPLATE_SECTORS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
                           </div>
                        </div>
                        <div className="space-y-4">
                           <h3 className="text-sm font-black uppercase text-indigo-400 border-b border-white/5 pb-2">Visual Encoding</h3>
                           <div className="grid grid-cols-2 gap-10">
                              <div className="space-y-3">
                                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Chromatic Profile</label>
                                 <div className="p-5 bg-slate-950 rounded-2xl flex flex-wrap gap-3 border border-white/5 shadow-inner">
                                   {COLOR_SPECTRUM.map(c => <button key={c} onClick={() => setFormTemplate(p => ({ ...p, color: c }))} className={`w-7 h-7 rounded-full border-2 transition-all ${formTemplate.color === c ? 'border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'border-transparent opacity-40 hover:opacity-100 hover:scale-105'}`} style={{ backgroundColor: c }} />)}
                                 </div>
                              </div>
                              <div className="space-y-3">
                                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Symbolic ID</label>
                                 <div className="p-5 bg-slate-950 rounded-2xl grid grid-cols-6 gap-3 border border-white/5 shadow-inner max-h-[140px] overflow-y-auto no-scrollbar">
                                   {(ICON_GROUPS.Technical.concat(ICON_GROUPS.Creative, ICON_GROUPS.Strategic)).map(icon => (<button key={icon} onClick={() => setFormTemplate(p => ({ ...p, icon }))} className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${formTemplate.icon === icon ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg' : 'bg-black/40 border-slate-800 text-slate-600 hover:text-slate-300'}`}><i className={`fa-solid fa-${icon} text-sm`} /></button>))}
                                 </div>
                              </div>
                           </div>
                        </div>
                      </div>
                    )}
                    {activeArchitectSection === 'mission' && (
                       <div className="space-y-8 animate-fade-in">
                          <h3 className="text-sm font-black uppercase text-indigo-400 border-b border-white/5 pb-2">Intelligence Directive</h3>
                          <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Core Neural Prompt (Mission Logic)</label><textarea value={formTemplate.prompt} onChange={e => setFormTemplate(p => ({ ...p, prompt: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 text-[13px] text-white outline-none h-48 resize-none leading-relaxed focus:ring-1 focus:ring-indigo-500 font-medium" placeholder="Instruct the orchestrator on how to spawn the cluster and what the primary technical deliverables are..." /></div>
                          <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Blueprint Summary</label><input type="text" value={formTemplate.description} onChange={e => setFormTemplate(p => ({ ...p, description: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-[12px] text-white outline-none focus:ring-1 focus:ring-indigo-500" placeholder="A brief one-liner explaining the foundation..." /></div>
                          <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Deployment Difficulty</label><div className="flex space-x-3">{ARCHETYPE_DIFFICULTY.map(d => (<button key={d} onClick={() => setFormTemplate(p => ({ ...p, difficulty: d as any }))} className={`flex-1 py-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all ${formTemplate.difficulty === d ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl scale-105' : 'bg-slate-950 border-white/5 text-slate-600'}`}>{d}</button>))}</div></div>
                       </div>
                    )}
                    {activeArchitectSection === 'topology' && (
                      <div className="space-y-8 animate-fade-in">
                         <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black uppercase text-indigo-400 border-b border-white/5 pb-2 flex-1 mr-6">Node Cluster Topology</h3>
                            <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-[10px] font-black text-indigo-400 uppercase tracking-widest">{(formTemplate.summonedNodes as string[] | undefined)?.length || 0} Nodes Linked</span>
                         </div>
                         
                         <div className="space-y-3">
                            {Object.entries(groupedRegistry).map(([category, agents]) => (
                               <div key={category} className="border border-white/5 rounded-2xl overflow-hidden bg-black/20">
                                  <button 
                                    onClick={() => toggleTopologySector(category)}
                                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors group"
                                  >
                                     <div className="flex items-center space-x-4">
                                        <div className="w-9 h-9 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                                           <i className={`fa-solid fa-${AGENT_CATEGORY_ICONS[category] || 'users'}`} />
                                        </div>
                                        <div className="text-left">
                                           <div className="text-[11px] font-black uppercase tracking-widest text-slate-300">{category} Sector</div>
                                           <div className="text-[9px] text-slate-600 font-bold uppercase">{agents.length} Available Specialists</div>
                                        </div>
                                     </div>
                                     <i className={`fa-solid fa-chevron-down text-slate-700 transition-transform duration-300 ${expandedTopologySectors.includes(category) ? 'rotate-180 text-indigo-500' : ''}`} />
                                  </button>
                                  
                                  {expandedTopologySectors.includes(category) && (
                                     <div className="p-4 bg-slate-950/50 border-t border-white/5 grid grid-cols-2 gap-3 animate-fade-in">
                                        {agents.map(a => {
                                          const isSelected = (formTemplate.summonedNodes as string[] | undefined)?.includes(a.name);
                                          return (
                                            <button 
                                              key={a.id} 
                                              onClick={() => toggleNodeSelection(a.name)} 
                                              className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all group/node ${isSelected ? 'bg-indigo-600/20 border-indigo-500/50 text-white shadow-lg' : 'bg-black/40 border-slate-800/50 text-slate-500 hover:border-slate-700'}`}
                                            >
                                               <div className="flex items-center space-x-3 overflow-hidden">
                                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-900 border-slate-800 opacity-60'}`}>
                                                     <i className={`fa-solid fa-${a.icon} text-[9px]`} />
                                                  </div>
                                                  <div className="flex flex-col truncate">
                                                     <span className="text-[10px] font-black uppercase tracking-tight truncate">{a.name}</span>
                                                     <span className="text-[8px] font-bold uppercase opacity-40 truncate">{a.role}</span>
                                                  </div>
                                               </div>
                                               <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${isSelected ? 'bg-indigo-500 border-white/20' : 'bg-slate-900 border-slate-800'}`}>
                                                  <i className={`fa-solid ${isSelected ? 'fa-check text-[10px] text-white' : 'fa-plus text-[8px] text-slate-800 group-hover/node:text-slate-400'}`} />
                                               </div>
                                            </button>
                                          );
                                        })}
                                     </div>
                                  )}
                               </div>
                            ))}
                         </div>
                      </div>
                    )}
                    {activeArchitectSection === 'ecosystem' && (
                       <div className="space-y-10 animate-fade-in">
                          <h3 className="text-sm font-black uppercase text-indigo-400 border-b border-white/5 pb-2">Technical Foundations</h3>
                          <div className="grid grid-cols-2 gap-x-12 gap-y-10">
                             <div className="space-y-3"><label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Core Execution Language</label><select value={formTemplate.ecosystem?.language} onChange={e => setFormTemplate(p => ({ ...p, ecosystem: { ...p.ecosystem, language: e.target.value } }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-[12px] text-white outline-none focus:ring-1 focus:ring-indigo-500">{TECH_STACKS.languages.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
                             <div className="space-y-3"><label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Project Architecture (Framework)</label><select value={formTemplate.ecosystem?.framework} onChange={e => setFormTemplate(p => ({ ...p, ecosystem: { ...p.ecosystem, framework: e.target.value } }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-[12px] text-white outline-none focus:ring-1 focus:ring-indigo-500">{TECH_STACKS.frameworks.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                             <div className="space-y-3"><label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Data Storage Protocol</label><select value={formTemplate.ecosystem?.database} onChange={e => setFormTemplate(p => ({ ...p, ecosystem: { ...p.ecosystem, database: e.target.value } }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-[12px] text-white outline-none focus:ring-1 focus:ring-indigo-500">{TECH_STACKS.databases.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                             <div className="space-y-3"><label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Target Deployment Cloud</label><select value={formTemplate.ecosystem?.deployment} onChange={e => setFormTemplate(p => ({ ...p, ecosystem: { ...p.ecosystem, deployment: e.target.value } }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-[12px] text-white outline-none focus:ring-1 focus:ring-indigo-500">{TECH_STACKS.deployments.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                          </div>
                          <div className="p-6 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl flex items-start space-x-4">
                             <div className="w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 shrink-0 mt-1"><i className="fa-solid fa-circle-info" /></div>
                             <div className="space-y-1">
                                <h4 className="text-[11px] font-black text-white uppercase tracking-widest">Architect's Note</h4>
                                <p className="text-[10px] text-slate-500 leading-relaxed italic font-medium">"The chosen stack will heavily influence the 'IDE Sandbox' experience and the specific tools assigned to recruited nodes during synthesis."</p>
                             </div>
                          </div>
                       </div>
                    )}
                    {activeArchitectSection === 'outcomes' && (
                       <div className="space-y-8 animate-fade-in">
                          <h3 className="text-sm font-black uppercase text-indigo-400 border-b border-white/5 pb-2">Strategic Forecast</h3>
                          <div className="space-y-3"><label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Success Criteria (Expected Outcome)</label><textarea value={formTemplate.outcomes?.success} onChange={e => setFormTemplate(p => ({ ...p, outcomes: { ...p.outcomes, success: e.target.value } }))} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-[12px] text-white h-28 resize-none outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed font-mono" placeholder="Define what a 100% mission success looks like..." /></div>
                          <div className="space-y-3"><label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Fallback / Pivot Strategy</label><textarea value={formTemplate.outcomes?.failure} onChange={e => setFormTemplate(p => ({ ...p, outcomes: { ...p.outcomes, failure: e.target.value } }))} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-[12px] text-white h-28 resize-none outline-none focus:ring-1 focus:ring-red-500 leading-relaxed font-mono" placeholder="What should nodes do if they hit a logic blocker or resource bottleneck?" /></div>
                       </div>
                    )}
                    {activeArchitectSection === 'review' && (
                       <div className="space-y-10 animate-fade-in pb-10">
                          <div className="p-10 rounded-[2.5rem] bg-indigo-600 text-white shadow-2xl relative overflow-hidden group">
                             <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform duration-700 pointer-events-none"><i className={`fa-solid fa-${formTemplate.icon} text-[8rem]`} /></div>
                             <div className="relative z-10">
                                <div className="flex items-center space-x-3 mb-4"><span className="px-3 py-1 bg-white/10 border border-white/20 rounded-full text-[10px] font-black uppercase tracking-[0.3em]">{formTemplate.difficulty} Tier Blueprint</span></div>
                                <h3 className="text-4xl font-black uppercase mb-4 tracking-tighter">{formTemplate.name || 'UNNAMED_PROTOTYPE'}</h3>
                                <p className="text-base opacity-90 leading-relaxed italic max-w-2xl mb-12">"{formTemplate.description || 'No mission summary provided.'}"</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-10 border-t border-white/20">
                                   <div className="space-y-1"><span className="text-[10px] font-black uppercase opacity-60 tracking-[0.2em]">Swarm Size</span><div className="text-xl font-black">{(formTemplate.summonedNodes as string[] | undefined)?.length || 0} Nodes Linked</div></div>
                                   <div className="space-y-1"><span className="text-[10px] font-black uppercase opacity-60 tracking-[0.2em]">Foundation</span><div className="text-base font-black uppercase truncate">{formTemplate.ecosystem?.framework}</div></div>
                                   <div className="space-y-1"><span className="text-[10px] font-black uppercase opacity-60 tracking-[0.2em]">Deployment</span><div className="text-base font-black uppercase truncate">{formTemplate.ecosystem?.deployment}</div></div>
                                   <div className="space-y-1"><span className="text-[10px] font-black uppercase opacity-60 tracking-[0.2em]">Storage</span><div className="text-base font-black uppercase truncate">{formTemplate.ecosystem?.database}</div></div>
                                </div>
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-8">
                             <div className="p-8 bg-slate-950 rounded-3xl border border-slate-800 shadow-inner flex flex-col space-y-6">
                                <h5 className="text-xs font-black text-indigo-400 uppercase tracking-[0.3em] flex items-center"><i className="fa-solid fa-microchip mr-3" />Cluster Topology</h5>
                                <div className="flex flex-wrap gap-2 overflow-y-auto max-h-[160px] no-scrollbar">
                                   {/* Fix: Added explicit type assertion to resolve unknown type map error for summonedNodes. */}
                                   {(formTemplate.summonedNodes as string[] | undefined) && (formTemplate.summonedNodes as string[]).length > 0 ? (formTemplate.summonedNodes as string[]).map(n => {
                                     const agent = registry.find(a => a.name === n);
                                     return (
                                       <div key={n} className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 group hover:bg-indigo-500/20 transition-all">
                                          <i className={`fa-solid fa-${agent?.icon || 'user-gear'} text-[10px] text-indigo-400`} />
                                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tight">{n}</span>
                                       </div>
                                     );
                                   }) : <span className="text-[11px] font-bold text-slate-700 italic">No node overrides defined.</span>}
                                </div>
                             </div>
                             <div className="p-8 bg-slate-950 rounded-3xl border border-slate-800 shadow-inner flex flex-col space-y-6">
                                <h5 className="text-xs font-black text-emerald-400 uppercase tracking-[0.3em] flex items-center"><i className="fa-solid fa-code-merge mr-3" />Environment Spec</h5>
                                <div className="space-y-3">
                                   <div className="flex items-center justify-between"><span className="text-[10px] font-black text-slate-600 uppercase">Primary Language</span><span className="text-[11px] font-bold text-slate-200">{formTemplate.ecosystem?.language}</span></div>
                                   <div className="flex items-center justify-between"><span className="text-[10px] font-black text-slate-600 uppercase">Framework Path</span><span className="text-[11px] font-bold text-slate-200">{formTemplate.ecosystem?.framework}</span></div>
                                   <div className="flex items-center justify-between"><span className="text-[10px] font-black text-slate-600 uppercase">Data Gateway</span><span className="text-[11px] font-bold text-slate-200">{formTemplate.ecosystem?.database}</span></div>
                                   <div className="flex items-center justify-between"><span className="text-[10px] font-black text-slate-600 uppercase">Target Infrastructure</span><span className="text-[11px] font-bold text-slate-200">{formTemplate.ecosystem?.deployment}</span></div>
                                </div>
                             </div>
                          </div>
                       </div>
                    )}
                 </div>
              </div>
              <div className="p-8 border-t border-slate-800 flex justify-between bg-[#161b22] shrink-0 items-center">
                 <div className="flex items-center space-x-2">{(['identity', 'mission', 'topology', 'ecosystem', 'outcomes', 'review'] as ArchitectSection[]).map(s => <div key={s} className={`h-1 rounded-full transition-all duration-500 ${activeArchitectSection === s ? 'w-8 bg-indigo-500' : 'w-2 bg-slate-800'}`} />)}</div>
                 <div className="flex space-x-4">
                   <button onClick={() => setShowArchitect(false)} className="px-8 py-3 border border-slate-800 rounded-xl text-slate-500 font-black uppercase text-[10px] hover:text-white transition-colors">Abort Construction</button>
                   {activeArchitectSection !== 'review' ? (
                     <button onClick={handleArchitectNext} className="px-12 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-xl transition-all active:scale-95 flex items-center space-x-2">
                       <span>Proceed Phase</span>
                       <i className="fa-solid fa-arrow-right text-[8px]" />
                     </button>
                   ) : (
                     <button onClick={handleSaveTemplate} className="px-12 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-xl transition-all active:scale-95 flex items-center space-x-2">
                       <i className="fa-solid fa-dna mr-2 text-[10px]" />
                       <span>Commit Global Blueprint</span>
                     </button>
                   )}
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Templates;