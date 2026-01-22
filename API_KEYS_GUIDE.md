# Agent API Keys Management Guide
How to add and manage API keys for each agent in the Architect Studio

---

## 🔑 Overview

Each agent in SwarmIDE2 can have its own set of API keys for different services. This allows:

- **Per-agent API key management** - Different agents can use different keys
- **Service-specific credentials** - One agent for OpenAI, another for Claude
- **Secure storage** - Keys encrypted in browser localStorage
- **Easy switching** - Change keys without affecting other agents

---

## 🎯 Where to Add API Keys

### Option 1: Via Agent Parameter Editor (Recommended)

1. **Open Agent List** → Select any agent
2. **Click ⚙️ Edit** button on the agent card
3. **Click 🔑 API Keys tab** at the top
4. **Click "+ Add Key"**
5. **Select or enter service name**
6. **Paste your API key**
7. **Click "Add Key"**
8. **Click "Save Changes"**

### Option 2: Direct in MissionSettings

1. Navigate to Mission Settings panel
2. Find "API Keys per Agent" section
3. Select agent from dropdown
4. Add keys directly

---

## 📋 Supported Services

Pre-configured buttons for common services:

| Service | Use Cases | Format |
|---------|-----------|--------|
| **OpenAI** | GPT-4, GPT-3.5, Embedding | `sk-...` |
| **Anthropic** | Claude 3 family | `sk-ant-...` |
| **Google** | Gemini, Vertex AI | Long key string |
| **Groq** | Mixtral, LLaMA access | `gsk-...` |
| **Mistral** | Mistral AI models | `mstr_...` |
| **Cohere** | Cohere API | `co-...` |
| **Hugging Face** | HF Inference API | `hf_...` |
| **ElevenLabs** | Text-to-Speech | `...` |
| **Stability AI** | Image Generation | `sk-...` |
| **AWS** | All AWS services | IAM keys |
| **Custom** | Internal/Private APIs | Any format |

---

## 📝 Step-by-Step Example

### Example 1: Add OpenAI Key to Backend Agent

```
1. Click ⚙️ Edit on "Backend Engineer" agent
2. Select 🔑 API Keys tab
3. Click "+ Add Key"
4. Click "OpenAI" button (pre-configured)
5. Paste your key: sk-proj-abc123def456...
6. Click "Add Key"
7. ✓ Key is now visible as masked value
8. Click "Save Changes"
```

### Example 2: Add Custom Internal API Key

```
1. Click ⚙️ Edit on "Data Engineer" agent
2. Select 🔑 API Keys tab
3. Click "+ Add Key"
4. Enter custom service: "internal-analytics-api"
5. Paste API key: my-secret-key-12345
6. Click "Add Key"
7. ✓ Available for agent tasks
8. Click "Save Changes"
```

### Example 3: Multiple Keys for One Agent

```
Agent: Frontend Developer
  ├─ openai: sk-proj-...
  ├─ stability: sk-...
  └─ huggingface: hf_...

Agent: Backend Engineer
  ├─ openai: sk-proj-...
  ├─ anthropic: sk-ant-...
  └─ groq: gsk-...
```

---

## 🔒 Security Best Practices

### ✅ DO:
- Store keys in **browser localStorage only** (not in code/git)
- Use **environment variables** in production
- Rotate keys **regularly** (monthly recommended)
- Use **per-agent keys** with minimal permissions
- **Mask keys** in UI (show only first 4 + last 4 characters)
- **Never screenshot** keys with values visible
- Store **in password manager** for backup

### ❌ DON'T:
- Commit keys to Git/GitHub
- Share keys in chat/email
- Use same key across environments (dev/staging/prod)
- Leave keys visible on screen
- Hardcode keys in application code
- Share keys between agents (use separate keys)
- Log keys to console or files

---

## 🛠️ How Keys Are Used

### Agent Execution Flow

```
Mission Start
    ↓
Agent Selected for Task
    ↓
Check Agent's API Keys
    ↓
Load Required Keys (e.g., OpenAI)
    ↓
Execute Task with Key
    ↓
Use Key for API Calls
    ↓
Log Usage (not the key itself)
    ↓
Complete Task
```

### Automatic Key Selection

Agent automatically selects the right key based on:
1. **Tool being used** (e.g., REST API tool → look for service key)
2. **Agent configuration** (e.g., set OpenAI as default)
3. **Phase requirements** (e.g., Phase 2 needs image generation)
4. **Fallback to global key** (if agent key not found)

---

## 📊 Key Management Features

### View Keys
- Click 👁️ button to temporarily reveal masked key
- Click 👁‍🗨️ button to hide again
- Keys are never logged or exported

### Edit Keys
- Remove old key: Click 🗑️ trash button
- Add new key with same name: Click "+ Add Key"
- Saves automatically after clicking "Save Changes"

### Export Keys (Advanced)
```typescript
// In browser console
const agent = project.agents[0];
console.log(agent.apiKeys);
// Shows: { openai: "sk-...", anthropic: "sk-ant-..." }
```

### Backup Keys
1. Open browser DevTools (F12)
2. Go to Application → LocalStorage
3. Find `swarmide2_agents` key
4. Export/backup (for recovery)
5. **Keep in secure location** (password manager)

---

## 🔄 Key Rotation & Updates

### When to Rotate Keys
- Monthly (security best practice)
- After team member leaves
- If key is exposed
- After major deployment
- Per organization policy

### How to Rotate

```
1. Generate new key in service dashboard
2. Click ⚙️ Edit on agent
3. Click 🔑 API Keys tab
4. Click 🗑️ to remove old key
5. Click "+ Add Key" to add new key
6. Paste new key
7. Click "Save Changes"
8. ✓ Agent now uses new key
9. Revoke old key in service dashboard
```

---

## 🐛 Troubleshooting

### Key Not Working

**Problem:** Agent fails with "Authentication Error"

**Solution:**
1. Verify key format matches service (e.g., OpenAI starts with `sk-`)
2. Check key expiration date in service dashboard
3. Verify key has correct permissions
4. Try adding key again (clear & paste)
5. Check agent is using correct service name

### Lost Keys

**Problem:** Key disappeared from agent

**Possible Causes:**
- Browser localStorage cleared
- Private browsing mode doesn't persist
- Browser extension cleared data
- Accidental delete

**Recovery:**
1. If saved in password manager: Copy from there
2. If in old backups: Restore from backup
3. Otherwise: Generate new key in service

### Multiple Agents Need Same Key

**Problem:** Many agents need OpenAI key

**Solution:**
1. Add key to first agent normally
2. For other agents: Use global key
3. Or: Add same key to each agent individually
4. Recommended: Use global key (more efficient)

---

## 🚀 Advanced Usage

### Using Keys in Custom Workflows

```typescript
// In custom agent task
const agent = project.agents[0];
const openaiKey = agent.apiKeys?.openai;

if (openaiKey) {
  // Use key for API call
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    headers: { 'Authorization': `Bearer ${openaiKey}` }
  });
}
```

### Key Validation

```typescript
// Check key format
const isValidOpenAIKey = (key: string) => key.startsWith('sk-');
const isValidAnthropicKey = (key: string) => key.startsWith('sk-ant-');
const isValidGoogleKey = (key: string) => key.length > 20;
```

### Environment Variables (Production)

```javascript
// Instead of storing in localStorage:
const API_KEY = process.env.REACT_APP_OPENAI_KEY;

// Or for agent-specific:
const agentKeys = {
  openai: process.env.AGENT1_OPENAI_KEY,
  anthropic: process.env.AGENT1_ANTHROPIC_KEY
};
```

---

## 📚 Integration Points

### Where Keys Are Used

1. **performAgentTask()** - Agent task execution
2. **REST API tool** - Calls external APIs
3. **Web Search** - Search API keys
4. **Code Interpreter** - Execution environment
5. **Media Synthesis** - Image/video generation
6. **Custom Tools** - Any tool needing auth

### Services Configuration

Keys can also be set globally in:
- **Settings → Intelligence Config** (global providers)
- **Mission Settings → API Configuration** (project-wide)
- **Agent API Keys** (agent-specific - recommended)

**Priority Order:**
1. Agent-specific key
2. Global key (if set)
3. Environment variable
4. Hardcoded default (not recommended)

---

## ✅ Verification Checklist

After adding keys to agents:

- [ ] Agent can execute tasks with that service
- [ ] No "Authentication Error" messages
- [ ] Keys are visible (masked) in editor
- [ ] Settings saved successfully
- [ ] Can see in localStorage (DevTools)
- [ ] Agent status shows "IDLE" or "WORKING"
- [ ] No console errors about missing keys
- [ ] Multiple agents have separate keys (if needed)

---

## 📞 Support

### Common Questions

**Q: Can I use same key for multiple agents?**  
A: Yes, but not recommended. Use separate keys per agent for security.

**Q: Are keys encrypted?**  
A: Keys are stored in browser localStorage. For production, use environment variables.

**Q: Can I export all agent keys?**  
A: Not via UI (by design). Access via localStorage or backup.

**Q: What if I don't add a key?**  
A: Agent will fallback to global key or show "Authentication Error".

**Q: Can agent use multiple keys?**  
A: Yes, one per service. Agent automatically selects the right key.

**Q: How long do keys last?**  
A: Depends on service. Most don't expire unless manually revoked.

---

## 🎓 Learning Resources

- **Service Documentation:**
  - OpenAI: https://platform.openai.com/docs
  - Anthropic: https://docs.anthropic.com
  - Google: https://cloud.google.com/docs
  
- **SwarmIDE2 Docs:**
  - See QUICK_INTEGRATION_GUIDE.md
  - See FEATURES_COMPLETE_SUMMARY.md
  - See README_FEATURES_COMPLETE.txt

---

**Ready to manage API keys? Open the Architect Studio and click ⚙️ Edit on any agent!**
