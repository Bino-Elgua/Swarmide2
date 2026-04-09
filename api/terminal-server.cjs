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

  // Natural language command parsing
  socket.on('nl:execute', async (payload) => {
    const { prompt, sessionId } = payload;
    const trimmed = (prompt || '').trim().toLowerCase();

    // Static rule matching
    const rules = [
      { pattern: /^(run|execute|start)?\s*tests?$/, command: 'npm test', explanation: 'Run test suite' },
      { pattern: /^(install|npm install)$/, command: 'npm install', explanation: 'Install dependencies' },
      { pattern: /^(build|npm run build)$/, command: 'npm run build', explanation: 'Build project' },
      { pattern: /^(git\s+)?status$/, command: 'git status', explanation: 'Git status' },
      { pattern: /^(ls|list|show)\s*(files?)?$/, command: 'ls -la', explanation: 'List files' },
      { pattern: /^(pwd|where)$/, command: 'pwd', explanation: 'Current directory' },
      { pattern: /^clear$/, command: 'clear', explanation: 'Clear terminal' },
      { pattern: /^(git\s+)?log$/, command: 'git log --oneline -20', explanation: 'Show git log' },
    ];

    let parsed = null;
    for (const rule of rules) {
      if (rule.pattern.test(trimmed)) {
        parsed = { type: 'shell', command: rule.command, explanation: rule.explanation, confidence: 0.95 };
        break;
      }
    }

    if (!parsed) {
      // Phase trigger detection
      if (/analyz|cca|code analysis/.test(trimmed)) {
        parsed = { type: 'phase', command: 'TRIGGER_PHASE_3', phase: 3, explanation: 'Trigger CCA analysis', confidence: 0.9 };
      } else if (/ralph|prd|iterate/.test(trimmed)) {
        parsed = { type: 'phase', command: 'TRIGGER_PHASE_4', phase: 4, explanation: 'Trigger Ralph Loop', confidence: 0.9 };
      } else if (/health|monitor/.test(trimmed)) {
        parsed = { type: 'phase', command: 'TRIGGER_PHASE_6', phase: 6, explanation: 'Show health monitor', confidence: 0.9 };
      } else {
        // Passthrough as raw shell command
        parsed = { type: 'shell', command: prompt, explanation: 'Passed through as shell command', confidence: 0.5 };
      }
    }

    // Execute in PTY if it's a shell command
    if (parsed.type === 'shell' && sessionId && sessions[sessionId]) {
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
