/**
 * SwarmIDE2 Terminal Backend Server
 * Express + Socket.io server that provides real PTY terminal access.
 * Runs as a separate Node.js process alongside the Vite dev server.
 *
 * Port: 3001 (Vite dev server is on 3000)
 * WebSocket namespace: /terminal
 *
 * Start with: node api/terminal-server.cjs
 *   or:       npm run terminal-server
 */

'use strict';

const http = require('http');
const express = require('express');
const { Server: SocketServer } = require('socket.io');
const pty = require('node-pty');
const simpleGit = require('simple-git');
const path = require('path');
const os = require('os');

// ─── Provider-agnostic LLM caller (fetch, no SDK) ────────────────────────────
// Maps to SwarmIDE2 AIProvider values ('google'|'openai'|'anthropic') plus extras.

const LLM_SYSTEM_PROMPT = `You are a terminal command translator for SwarmIDE2, a multi-agent AI platform.
Convert the user's natural language request into a JSON command object.
Rules:
1. Return ONLY valid JSON — no markdown, no code blocks.
2. JSON shape: {"type":"shell"|"git"|"phase"|"system","command":"...","explanation":"...","confidence":0.0-1.0,"phase":1-7}
3. SwarmIDE2 phase trigger commands: TRIGGER_PHASE_1 through TRIGGER_PHASE_7
4. Use real Unix shell syntax for shell/git commands.
5. NEVER generate destructive commands (rm -rf, etc.).
6. If unsure, set confidence<0.5 and pass the raw prompt as the command.`;

async function callLLM(provider, model, apiKey, prompt, baseUrl) {
  const messages = [
    { role: 'system', content: LLM_SYSTEM_PROMPT },
    { role: 'user',   content: `User request: "${prompt}"` },
  ];

  // ── Google Gemini ──────────────────────────────────────────────────────────
  if (provider === 'google' || provider === 'gemini') {
    const key = apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!key) return null;
    const url = `${baseUrl || 'https://generativelanguage.googleapis.com'}/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${key}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n') }] }],
      generationConfig: { maxOutputTokens: 512, temperature: 0.2 },
    };
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  }

  // ── Anthropic Claude ───────────────────────────────────────────────────────
  if (provider === 'anthropic' || provider === 'claude') {
    const key = apiKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (!key) return null;
    const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));
    const systemMsg = messages.find(m => m.role === 'system')?.content;
    const body = { model: model || 'claude-haiku-4-5-20251001', max_tokens: 512, temperature: 0.2, messages: chatMessages };
    if (systemMsg) body.system = systemMsg;
    const resp = await fetch(`${baseUrl || 'https://api.anthropic.com'}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.content?.[0]?.text ?? null;
  }

  // ── Ollama (local, no key required) ───────────────────────────────────────
  if (provider === 'ollama') {
    const ollamaUrl = baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const combinedPrompt = messages.map(m => m.content).join('\n\n');
    try {
      const resp = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model || 'llama3', prompt: combinedPrompt, stream: false }),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data?.response ?? null;
    } catch {
      return null;
    }
  }

  // ── OpenAI-compatible (openai/gpt, groq, mistral, deepseek, perplexity) ───
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
  const resolvedBase = baseUrl || OPENAI_BASES[provider];
  if (!resolvedBase) return null;
  const resolvedKey = apiKey || (KEY_MAP[provider] || []).map(k => process.env[k]).find(Boolean);
  if (!resolvedKey) return null;

  const DEFAULT_MODELS = { openai: 'gpt-4o-mini', gpt: 'gpt-4o-mini', groq: 'llama3-8b-8192', mistral: 'mistral-small-latest', deepseek: 'deepseek-chat', perplexity: 'llama-3.1-sonar-small-128k-online' };
  const resp = await fetch(`${resolvedBase}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resolvedKey}` },
    body: JSON.stringify({ model: model || DEFAULT_MODELS[provider] || 'gpt-4o-mini', messages, max_tokens: 512, temperature: 0.2 }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content ?? null;
}

/** Pick the best available provider from env vars when the client doesn't specify one. */
function inferProvider() {
  if (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY) return { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' };
  if (process.env.OPENAI_API_KEY)   return { provider: 'openai',    model: 'gpt-4o-mini' };
  if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY) return { provider: 'gemini', model: 'gemini-2.0-flash' };
  if (process.env.GROQ_API_KEY)     return { provider: 'groq',      model: 'llama3-8b-8192' };
  return { provider: 'ollama', model: 'llama3' }; // local fallback
}

const PORT = process.env.TERMINAL_PORT || 3001;
const DEFAULT_SHELL = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash');
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// ─── Express App ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    sessions: Object.keys(sessions).length,
    uptime: process.uptime(),
    platform: process.platform,
    shell: DEFAULT_SHELL,
  });
});

// List sessions
app.get('/sessions', (req, res) => {
  res.json({ sessions: Object.values(sessions).map(s => s.info) });
});

// Git status REST endpoint
app.get('/git/status', async (req, res) => {
  try {
    const repoPath = req.query.path || process.cwd();
    const g = simpleGit.default(repoPath);
    const status = await g.status();
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Git log REST endpoint
app.get('/git/log', async (req, res) => {
  try {
    const repoPath = req.query.path || process.cwd();
    const maxCount = parseInt(req.query.maxCount) || 20;
    const g = simpleGit.default(repoPath);
    const log = await g.log({ maxCount });
    res.json({ success: true, data: log.all });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ─── HTTP + Socket.io ─────────────────────────────────────────────────────────
const httpServer = http.createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  path: '/terminal-ws',
});

// ─── Session Store ────────────────────────────────────────────────────────────
const sessions = {};

function createSession(opts = {}) {
  const id = `term_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const cwd = opts.cwd || os.homedir();
  const cols = opts.cols || 120;
  const rows = opts.rows || 30;

  const ptyProcess = pty.spawn(DEFAULT_SHELL, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      ...(opts.env || {}),
    },
  });

  const info = {
    id,
    pid: ptyProcess.pid,
    cwd,
    shell: DEFAULT_SHELL,
    cols,
    rows,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
  };

  ptyProcess.onData((data) => {
    info.lastActivity = new Date().toISOString();
    io.emit('terminal:data', { sessionId: id, data });
  });

  ptyProcess.onExit(({ exitCode }) => {
    delete sessions[id];
    io.emit('terminal:destroyed', { sessionId: id, exitCode });
  });

  sessions[id] = { process: ptyProcess, info };
  return info;
}

function destroySession(id) {
  const entry = sessions[id];
  if (!entry) return;
  try { entry.process.kill(); } catch {}
  delete sessions[id];
}

// Prune idle sessions
setInterval(() => {
  const now = Date.now();
  for (const [id, { info }] of Object.entries(sessions)) {
    if (now - new Date(info.lastActivity).getTime() > IDLE_TIMEOUT_MS) {
      destroySession(id);
      console.log(`[terminal-server] Pruned idle session ${id}`);
    }
  }
}, 5 * 60 * 1000);

// ─── Socket.io Event Handlers ─────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[terminal-server] Client connected: ${socket.id}`);

  socket.on('terminal:create', (payload) => {
    try {
      const session = createSession(payload || {});
      socket.emit('terminal:created', { session });
      console.log(`[terminal-server] Session created: ${session.id} (pid ${session.pid})`);
    } catch (err) {
      socket.emit('terminal:error', { message: String(err) });
    }
  });

  socket.on('terminal:input', (payload) => {
    const entry = sessions[payload.sessionId];
    if (!entry) return socket.emit('terminal:error', { sessionId: payload.sessionId, message: 'Session not found' });
    try {
      entry.info.lastActivity = new Date().toISOString();
      entry.process.write(payload.data);
    } catch (err) {
      socket.emit('terminal:error', { sessionId: payload.sessionId, message: String(err) });
    }
  });

  socket.on('terminal:resize', (payload) => {
    const entry = sessions[payload.sessionId];
    if (!entry) return;
    try {
      entry.process.resize(payload.cols, payload.rows);
      entry.info.cols = payload.cols;
      entry.info.rows = payload.rows;
    } catch {}
  });

  socket.on('terminal:destroy', (payload) => {
    destroySession(payload.sessionId);
    socket.emit('terminal:destroyed', { sessionId: payload.sessionId });
  });

  socket.on('terminal:list', () => {
    socket.emit('terminal:sessions', { sessions: Object.values(sessions).map(s => s.info) });
  });

  // Git operations
  socket.on('git:operation', async (payload) => {
    const { op, args = {}, sessionId } = payload;
    const repoPath = args.repoPath || process.cwd();
    const g = simpleGit.default(repoPath);

    try {
      let result;
      switch (op) {
        case 'status': result = await g.status(); break;
        case 'log': result = await g.log({ maxCount: args.maxCount || 20 }); break;
        case 'commit': await g.add(args.files || ['.']), result = await g.commit(args.message || 'chore: checkpoint'); break;
        case 'push': result = await g.push(args.remote || 'origin', args.branch); break;
        case 'pull': result = await g.pull(args.remote || 'origin', args.branch); break;
        case 'branch': result = await g.branchLocal(); break;
        case 'diff': result = await (args.staged ? g.diff(['--staged']) : g.diff()); break;
        default: throw new Error(`Unknown git op: ${op}`);
      }
      socket.emit('git:result', { sessionId, result, success: true });
    } catch (err) {
      socket.emit('terminal:error', { sessionId, message: String(err) });
    }
  });

  // Natural language command parsing — provider-agnostic
  socket.on('nl:execute', async (payload) => {
    const { prompt, sessionId, llmConfig } = payload;
    const trimmed = (prompt || '').trim();
    const lower = trimmed.toLowerCase();

    // ── 1. Static rules (instant, no LLM) ─────────────────────────────────
    const STATIC = [
      { p: /^(run|execute|start)?\s*tests?$/i,      r: { type: 'shell',  command: 'npm test',              explanation: 'Run test suite',            confidence: 0.95 } },
      { p: /^(install|npm install)$/i,              r: { type: 'shell',  command: 'npm install',            explanation: 'Install dependencies',       confidence: 0.95 } },
      { p: /^(build|npm run build)$/i,              r: { type: 'shell',  command: 'npm run build',          explanation: 'Build project',              confidence: 0.95 } },
      { p: /^(git\s+)?status$/i,                    r: { type: 'git',    command: 'git status',             explanation: 'Git status',                 confidence: 0.95 } },
      { p: /^(git\s+)?log$/i,                       r: { type: 'git',    command: 'git log --oneline -20',  explanation: 'Show git log',               confidence: 0.95 } },
      { p: /^(ls|list|show)\s*(files?)?$/i,         r: { type: 'shell',  command: 'ls -la',                 explanation: 'List files',                 confidence: 0.95 } },
      { p: /^(pwd|where)$/i,                        r: { type: 'shell',  command: 'pwd',                    explanation: 'Current directory',          confidence: 0.95 } },
      { p: /^clear$/i,                              r: { type: 'system', command: 'clear',                  explanation: 'Clear terminal',             confidence: 0.95 } },
      { p: /^(analyz|cca|code analysis)/i,          r: { type: 'phase',  command: 'TRIGGER_PHASE_3', phase: 3, explanation: 'CCA code analysis',      confidence: 0.9  } },
      { p: /^(ralph|prd|iterate)/i,                 r: { type: 'phase',  command: 'TRIGGER_PHASE_4', phase: 4, explanation: 'Ralph Loop',             confidence: 0.9  } },
      { p: /^(health|monitor)\b/i,                  r: { type: 'phase',  command: 'TRIGGER_PHASE_6', phase: 6, explanation: 'Health monitor',         confidence: 0.9  } },
      { p: /^(compress|rlm|context)/i,              r: { type: 'phase',  command: 'TRIGGER_PHASE_2', phase: 2, explanation: 'RLM compression',        confidence: 0.9  } },
      { p: /^(conflict|resolve|vote)/i,             r: { type: 'phase',  command: 'TRIGGER_PHASE_1', phase: 1, explanation: 'Conflict resolution',    confidence: 0.9  } },
      { p: /^(multi.?model|synthesis)/i,            r: { type: 'phase',  command: 'TRIGGER_PHASE_5', phase: 5, explanation: 'Multi-model synthesis',  confidence: 0.9  } },
    ];

    let parsed = null;
    for (const { p, r } of STATIC) {
      if (p.test(lower)) { parsed = r; break; }
    }

    // ── 2. LLM fallback with configured provider ───────────────────────────
    if (!parsed) {
      const { provider, model, apiKey, baseUrl } = llmConfig || inferProvider();
      let llmText = null;

      try {
        llmText = await callLLM(provider, model, apiKey, trimmed, baseUrl);
      } catch (err) {
        console.error('[terminal-server] LLM call failed:', err.message);
      }

      if (llmText) {
        try {
          const jsonMatch = llmText.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        } catch {
          // ignore parse error
        }
      }

      if (!parsed) {
        // Final passthrough — treat the raw input as a shell command
        parsed = { type: 'shell', command: trimmed, explanation: `Passed through (provider: ${provider || 'none'})`, confidence: 0.3 };
      }
    }

    // ── 3. Execute in PTY if shell/git command ─────────────────────────────
    if ((parsed.type === 'shell' || parsed.type === 'git') && sessionId && sessions[sessionId]) {
      sessions[sessionId].process.write(parsed.command + '\r');
    }

    socket.emit('nl:parsed', { sessionId, command: parsed });
  });

  socket.on('disconnect', () => {
    console.log(`[terminal-server] Client disconnected: ${socket.id}`);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`[terminal-server] SwarmIDE2 Terminal Server running on port ${PORT}`);
  console.log(`[terminal-server] Shell: ${DEFAULT_SHELL}`);
  console.log(`[terminal-server] WebSocket path: /terminal-ws`);
  console.log(`[terminal-server] REST API: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  Object.keys(sessions).forEach(id => destroySession(id));
  httpServer.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  Object.keys(sessions).forEach(id => destroySession(id));
  httpServer.close(() => process.exit(0));
});
