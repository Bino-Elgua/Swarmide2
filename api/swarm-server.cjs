/**
 * SwarmIDE2 Swarm WebSocket Server
 * Real-time event hub for agent thoughts, narrations, cost tracking,
 * phase transitions, and conflict events.
 *
 * Port: 3002  (terminal-server is 3001, Vite dev is 3000)
 * Socket.io path: /swarm-ws
 *
 * Start with: node api/swarm-server.cjs
 *   or:       npm run swarm-server
 *   or:       npm run dev:full  (runs all three together)
 *
 * Client events received:
 *   swarm:thought          — relay thought to all other clients
 *   swarm:request_narration — generate LLM narration and broadcast result
 *   swarm:set_audience     — update socket's preferred narration audience
 *   swarm:broadcast        — relay any payload to all clients (generic)
 *
 * Server events emitted to clients:
 *   swarm:thought          — agent thought payload
 *   swarm:narration        — generated narration event
 *   swarm:cost             — live cost tick
 *   swarm:phase            — phase transition
 *   swarm:conflict         — conflict detected
 *   swarm:resolved         — conflict resolved
 *   swarm:agent_status     — agent status update
 *   swarm:hydrate          — initial state dump on connect
 */

'use strict';

const http    = require('http');
const express = require('express');
const { Server: SocketServer } = require('socket.io');

const PORT    = 3002;
const WS_PATH = '/swarm-ws';

// ─── Ring buffers — hydrate newly-connected clients ──────────────────────────

const MAX_THOUGHTS   = 50;
const MAX_NARRATIONS = 30;
const MAX_COST       = 20;
const MAX_PHASES     = 10;

const thoughtsBuffer    = [];   // SwarmThoughtPayload[]
const narrationsBuffer  = [];   // NarrationEvent[]
const costBuffer        = [];   // SwarmCostPayload[]
const phaseBuffer       = [];   // SwarmPhasePayload[]
const activeConflicts   = new Map(); // `${aId}:${bId}` → SwarmConflictPayload

// Per-socket audience preference
const socketAudiences   = new Map(); // socketId → NarrationAudience

// ─── Audience prompt fragments ────────────────────────────────────────────────

const AUDIENCE_FRAGMENTS = {
  technical:   `You narrate for senior engineers. Use precise technical language.
Reference design patterns, data structures, and algorithmic trade-offs.
Be specific about what the agent is doing and why it chose this approach.`,

  executive:   `You narrate for business stakeholders. No code or jargon.
Frame everything in terms of value delivered, risk mitigated, or cost saved.
Keep it to 1-2 sentences. Lead with the business outcome.`,

  educational: `You narrate for developers learning AI orchestration.
Explain what the agent is doing AND why it's doing it that way.
Use analogies. Connect the action to the broader orchestration goal.
Keep it encouraging and demystifying.`,

  debug:       `You are a debug narrator. Enumerate the agent's decision path:
what input it received, what it inferred, what options it considered,
and what it chose. Be exhaustive. This is for troubleshooting.`,
};

const TONE_HINTS = {
  academic:  'Write in formal, precise language.',
  casual:    'Write casually and accessibly.',
  playful:   'Add wit and lightness.',
  brutal:    'Be completely direct, no fluff.',
  concise:   'Use the fewest words possible.',
  poetic:    'Use evocative, narrative prose.',
  socratic:  'Frame the narration as a question that reveals an insight.',
};

// ─── Provider-agnostic LLM caller ─────────────────────────────────────────────

async function callNarrationLLM(provider, model, apiKey, systemPrompt, userPrompt, baseUrl) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ];

  try {
    // ── Google Gemini ────────────────────────────────────────────────────────
    if (provider === 'google' || provider === 'gemini') {
      const key = apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!key) return null;
      const url = `${baseUrl || 'https://generativelanguage.googleapis.com'}/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${key}`;
      const body = {
        contents: [{
          role: 'user',
          parts: [{ text: messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n') }],
        }],
        generationConfig: { maxOutputTokens: 200, temperature: 0.7 },
      };
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
    }

    // ── Anthropic Claude ─────────────────────────────────────────────────────
    if (provider === 'anthropic' || provider === 'claude') {
      const key = apiKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
      if (!key) return null;
      const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));
      const systemMsg = messages.find(m => m.role === 'system')?.content;
      const body = { model: model || 'claude-haiku-4-5-20251001', max_tokens: 200, temperature: 0.7, messages: chatMessages };
      if (systemMsg) body.system = systemMsg;
      const resp = await fetch(`${baseUrl || 'https://api.anthropic.com'}/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data?.content?.[0]?.text?.trim() ?? null;
    }

    // ── Ollama (local, no key required) ─────────────────────────────────────
    if (provider === 'ollama') {
      const ollamaUrl = baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const combinedPrompt = messages.map(m => m.content).join('\n\n');
      const resp = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model || 'llama3', prompt: combinedPrompt, stream: false }),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data?.response?.trim() ?? null;
    }

    // ── OpenAI-compatible (openai, groq, mistral, deepseek, perplexity) ──────
    const OPENAI_BASES = {
      openai:     'https://api.openai.com/v1',
      gpt:        'https://api.openai.com/v1',
      groq:       'https://api.groq.com/openai/v1',
      mistral:    'https://api.mistral.ai/v1',
      deepseek:   'https://api.deepseek.com/v1',
      perplexity: 'https://api.perplexity.ai',
    };
    const KEY_MAP = {
      openai:     ['OPENAI_API_KEY'],
      gpt:        ['OPENAI_API_KEY'],
      groq:       ['GROQ_API_KEY'],
      mistral:    ['MISTRAL_API_KEY'],
      deepseek:   ['DEEPSEEK_API_KEY'],
      perplexity: ['PERPLEXITY_API_KEY'],
    };

    const base = baseUrl || OPENAI_BASES[provider];
    const envKeys = KEY_MAP[provider] || [];
    const key = apiKey || envKeys.map(k => process.env[k]).find(Boolean);
    if (!base || !key) return null;

    const DEFAULT_MODELS = { openai: 'gpt-4o-mini', gpt: 'gpt-4o-mini', groq: 'llama-3.3-70b-versatile', mistral: 'mistral-small-latest', deepseek: 'deepseek-chat', perplexity: 'llama-3.1-sonar-small-128k-online' };
    const resp = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: model || DEFAULT_MODELS[provider] || 'gpt-4o-mini',
        messages,
        max_tokens: 200,
        temperature: 0.7,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content?.trim() ?? null;

  } catch (err) {
    console.error(`[swarm-server] LLM call failed (${provider}):`, err.message);
    return null;
  }
}

/** Infer best available provider from environment. */
function inferProvider() {
  if (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY) return { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' };
  if (process.env.OPENAI_API_KEY)    return { provider: 'openai',    model: 'gpt-4o-mini' };
  if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) return { provider: 'gemini', model: 'gemini-2.0-flash' };
  if (process.env.GROQ_API_KEY)      return { provider: 'groq',      model: 'llama-3.3-70b-versatile' };
  if (process.env.MISTRAL_API_KEY)   return { provider: 'mistral',   model: 'mistral-small-latest' };
  if (process.env.DEEPSEEK_API_KEY)  return { provider: 'deepseek',  model: 'deepseek-chat' };
  // Fallback: try Ollama (no key needed)
  return { provider: 'ollama', model: 'llama3' };
}

// ─── Template fallback narrations ────────────────────────────────────────────

function buildTemplateLine(agentName, action, audience) {
  switch (audience) {
    case 'executive':   return `${agentName} is making progress on the task.`;
    case 'educational': return `${agentName} is now ${action.toLowerCase()} — this step helps the swarm move forward.`;
    case 'debug':       return `[TRACE] agent=${agentName} action=${action} ts=${Date.now()}`;
    default:            return `${agentName} is executing ${action}.`; // technical
  }
}

// ─── Dedup cache ──────────────────────────────────────────────────────────────

const recentNarrationKeys = new Map(); // key → timestamp
const DEDUP_WINDOW_MS = 3000;

function isDuplicate(key) {
  const last = recentNarrationKeys.get(key);
  if (last && Date.now() - last < DEDUP_WINDOW_MS) return true;
  recentNarrationKeys.set(key, Date.now());
  return false;
}

// ─── Ring buffer helper ───────────────────────────────────────────────────────

function ringPush(arr, item, max) {
  arr.push(item);
  if (arr.length > max) arr.shift();
}

// ─── Express + Socket.io ──────────────────────────────────────────────────────

const app = express();
app.use(express.json());

const httpServer = http.createServer(app);
const io = new SocketServer(httpServer, {
  path: WS_PATH,
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

// ─── REST endpoints ───────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    port: PORT,
    path: WS_PATH,
    clients: io.sockets.sockets.size,
    buffers: {
      thoughts:   thoughtsBuffer.length,
      narrations: narrationsBuffer.length,
      cost:       costBuffer.length,
      phases:     phaseBuffer.length,
      conflicts:  activeConflicts.size,
    },
  });
});

app.get('/narrations', (_req, res) => {
  res.json(narrationsBuffer);
});

app.get('/thoughts', (_req, res) => {
  res.json(thoughtsBuffer);
});

// ─── HTTP broadcast endpoints (for TypeScript services that can't import CJS) ─

/** POST /broadcast/thought  { agentId, agentName, agentColor, thought, phase? } */
app.post('/broadcast/thought', (req, res) => {
  const payload = { ...req.body, timestamp: req.body.timestamp || new Date().toISOString() };
  ringPush(thoughtsBuffer, payload, MAX_THOUGHTS);
  io.emit('swarm:thought', payload);
  res.json({ ok: true });
});

/** POST /broadcast/narration  NarrationEvent shape */
app.post('/broadcast/narration', (req, res) => {
  const payload = { ...req.body, timestamp: req.body.timestamp || new Date().toISOString() };
  ringPush(narrationsBuffer, payload, MAX_NARRATIONS);
  io.emit('swarm:narration', payload);
  res.json({ ok: true });
});

/** POST /broadcast/cost  SwarmCostPayload */
app.post('/broadcast/cost', (req, res) => {
  const payload = { ...req.body, timestamp: req.body.timestamp || new Date().toISOString() };
  ringPush(costBuffer, payload, MAX_COST);
  io.emit('swarm:cost', payload);
  res.json({ ok: true });
});

/** POST /broadcast/phase  SwarmPhasePayload */
app.post('/broadcast/phase', (req, res) => {
  const payload = { ...req.body, timestamp: req.body.timestamp || new Date().toISOString() };
  ringPush(phaseBuffer, payload, MAX_PHASES);
  io.emit('swarm:phase', payload);
  res.json({ ok: true });
});

/** POST /broadcast/conflict  SwarmConflictPayload */
app.post('/broadcast/conflict', (req, res) => {
  const payload = { ...req.body, timestamp: req.body.timestamp || new Date().toISOString() };
  const key = `${payload.agentAId}:${payload.agentBId}`;
  activeConflicts.set(key, payload);
  io.emit('swarm:conflict', payload);
  res.json({ ok: true });
});

/** POST /broadcast/resolved  { agentAId, agentBId } */
app.post('/broadcast/resolved', (req, res) => {
  const { agentAId, agentBId } = req.body;
  activeConflicts.delete(`${agentAId}:${agentBId}`);
  io.emit('swarm:resolved', { agentAId, agentBId });
  res.json({ ok: true });
});

/** POST /broadcast/agent_status  SwarmAgentStatusPayload */
app.post('/broadcast/agent_status', (req, res) => {
  const payload = { ...req.body, timestamp: req.body.timestamp || new Date().toISOString() };
  io.emit('swarm:agent_status', payload);
  res.json({ ok: true });
});

// ─── Socket.io connection handler ─────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[swarm-server] client connected: ${socket.id} (total: ${io.sockets.sockets.size})`);

  // Set default audience
  socketAudiences.set(socket.id, 'technical');

  // Hydrate new client with buffered history
  socket.emit('swarm:hydrate', {
    thoughts:   thoughtsBuffer.slice(-MAX_THOUGHTS),
    narrations: narrationsBuffer.slice(-MAX_NARRATIONS),
    costTicks:  costBuffer.slice(-MAX_COST),
    phases:     phaseBuffer.slice(-MAX_PHASES),
    conflicts:  Array.from(activeConflicts.values()),
  });

  // ── Relay thought from one client to all others ──────────────────────────
  socket.on('swarm:thought', (payload) => {
    const enriched = { ...payload, timestamp: payload.timestamp || new Date().toISOString() };
    ringPush(thoughtsBuffer, enriched, MAX_THOUGHTS);
    socket.broadcast.emit('swarm:thought', enriched);
  });

  // ── Set audience preference ──────────────────────────────────────────────
  socket.on('swarm:set_audience', ({ audience }) => {
    if (['technical', 'executive', 'educational', 'debug'].includes(audience)) {
      socketAudiences.set(socket.id, audience);
      console.log(`[swarm-server] ${socket.id} audience → ${audience}`);
    }
  });

  // ── Generate narration on request ────────────────────────────────────────
  socket.on('swarm:request_narration', async ({ agentId, agentName, agentIcon, agentColor, action, context, audience, tone, provider, model, apiKey }) => {
    const aud  = audience || socketAudiences.get(socket.id) || 'technical';
    const tStr = tone || 'concise';

    const dupKey = `${agentId}:${(action || '').slice(0, 40)}`;
    if (isDuplicate(dupKey)) return; // silently drop duplicate

    const audienceFrag = AUDIENCE_FRAGMENTS[aud] || AUDIENCE_FRAGMENTS.technical;
    const toneHint     = TONE_HINTS[tStr] || '';
    const systemPrompt = `You are the SwarmIDE2 Swarm Narrator.\n${audienceFrag}\n${toneHint}\nNEVER invent facts. Only narrate what the context says.`;
    const userPrompt   = [
      `Agent: ${agentName || agentId}`,
      `Action: ${action}`,
      `Context: ${(context || '').slice(0, 500)}`,
      `Respond in 1-2 sentences only.`,
    ].join('\n');

    // Determine LLM config: use explicit from client, else infer from env
    const { provider: envProvider, model: envModel } = inferProvider();
    const llmProvider = provider || envProvider;
    const llmModel    = model    || envModel;

    let narrationText = null;
    narrationText = await callNarrationLLM(llmProvider, llmModel, apiKey || null, systemPrompt, userPrompt, null);

    if (!narrationText) {
      narrationText = buildTemplateLine(agentName || agentId, action, aud);
    }

    const event = {
      id:         `nar_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      agentId:    agentId || 'unknown',
      agentName:  agentName || 'Agent',
      agentIcon:  agentIcon || 'robot',
      agentColor: agentColor || '#6366f1',
      action:     action || '',
      narration:  narrationText,
      audience:   aud,
      toneStyle:  tStr,
      timestamp:  new Date().toISOString(),
    };

    ringPush(narrationsBuffer, event, MAX_NARRATIONS);

    // Broadcast to ALL clients (not just requester) so narrator panels stay in sync
    io.emit('swarm:narration', event);
  });

  // ── Generic broadcast relay ───────────────────────────────────────────────
  socket.on('swarm:broadcast', ({ event, payload }) => {
    if (typeof event === 'string' && event.startsWith('swarm:')) {
      socket.broadcast.emit(event, payload);
    }
  });

  // ── Cleanup ───────────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    socketAudiences.delete(socket.id);
    console.log(`[swarm-server] client disconnected: ${socket.id} (reason: ${reason})`);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  const { provider, model } = inferProvider();
  console.log(`\n[swarm-server] Swarm WebSocket server running`);
  console.log(`  Port   : ${PORT}`);
  console.log(`  WS Path: ${WS_PATH}`);
  console.log(`  LLM    : ${provider} / ${model}`);
  console.log(`  REST   : GET /health  GET /narrations  GET /thoughts`);
  console.log(`           POST /broadcast/{thought,narration,cost,phase,conflict,resolved,agent_status}\n`);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

function shutdown(signal) {
  console.log(`\n[swarm-server] ${signal} received — shutting down`);
  io.close(() => {
    httpServer.close(() => {
      console.log('[swarm-server] Server closed.');
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
