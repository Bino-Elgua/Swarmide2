# API Setup Guide — Intelligence Configuration

## 🎯 Quick Start

### Step 1: Open Mission Settings
1. Start the dev server: `npm run dev`
2. Visit: http://localhost:3000
3. Look for the **gear icon** in the bottom-right corner
4. Click it to open **Mission Settings**

### Step 2: Find Intelligence Section
Inside Mission Settings panel, you'll see several sections:
- Strategy Preset
- Fleet Intensity
- Deployment Platform
- **⭐ INTELLIGENCE** ← Click here!
- Cost & Conflicts
- Terminal Settings

Click on **INTELLIGENCE** to expand it.

### Step 3: Configure API Keys
You'll see two required fields:

#### 🔑 Logic Hub API Key (Orchestrator)
- This is your **PRIMARY** API key
- Used for agent orchestration and reasoning
- **Required** to run the system
- Placeholder: `sk-...`

#### 🔑 Synthesis Pass API Key (Refinement)
- This is your **SECONDARY** API key
- Used for final output refinement
- **Optional** - can be same as Logic Hub
- Placeholder: `sk-...`

### Step 4: Get Your API Keys

Choose your LLM provider and get an API key:

| Provider | URL | Steps |
|----------|-----|-------|
| **Gemini** (Free tier) | https://go.dev/genai | 1. Sign in with Google<br>2. Click "Get API Key"<br>3. Copy key |
| **OpenAI** | https://platform.openai.com | 1. Sign up/login<br>2. Go to API Keys<br>3. Create new secret key |
| **Claude** (Anthropic) | https://console.anthropic.com | 1. Sign up/login<br>2. Go to API Keys<br>3. Create new key |
| **Groq** | https://console.groq.com | 1. Sign up/login<br>2. Go to API Keys<br>3. Create new key |

### Step 5: Paste Your Keys
1. In Intelligence section, paste your API key into:
   - **Logic Hub API Key** field (required)
   - **Synthesis Pass API Key** field (optional)
2. Select your model from dropdown:
   - Gemini 3 Pro
   - Gemini 3 Flash
   - GPT-4o
   - Claude 3.5 Sonnet
3. When configured correctly, you'll see:
   - **✓ Key configured** (green checkmark)
   - Border turns **cyan** when focused

### Step 6: Test the Setup
1. Close Mission Settings (click X or click outside)
2. Enter a prompt in the main textarea
3. Click "Engage" to start orchestration
4. If API keys are working, agents will execute
5. Watch the terminal for execution logs

---

## 🔍 Detailed API Key Setup

### Gemini (Recommended - Free Trial)

**Advantages:**
- Free tier with generous limits
- Fast responses
- Good for testing
- Easy setup

**Steps:**
1. Go to https://go.dev/genai
2. Click "Get API Key"
3. Sign in with Google
4. Create API key in new project
5. Copy the key (starts with `AIza...`)
6. Paste into Logic Hub field

**Cost Estimation:**
- Gemini 3 Flash: ~$0.00075/1k input tokens
- Gemini 3 Pro: ~$0.005/1k input tokens

### OpenAI (GPT-4o)

**Advantages:**
- Most capable models
- Stable API
- Good documentation
- Paid credits required

**Steps:**
1. Go to https://platform.openai.com
2. Sign in or create account
3. Go to "API Keys" section
4. Click "Create new secret key"
5. Copy the key (starts with `sk-`)
6. Add to OpenAI account billing

**Cost Estimation:**
- GPT-4o: ~$0.015/1k input tokens
- GPT-4 Turbo: ~$0.03/1k input tokens

### Claude (Anthropic)

**Advantages:**
- Strong reasoning
- Large context window
- Good for analysis
- Paid credits required

**Steps:**
1. Go to https://console.anthropic.com
2. Sign up or login
3. Click "API Keys"
4. Create new API key
5. Copy the key (starts with `sk-ant-`)
6. Set up billing

**Cost Estimation:**
- Claude 3.5 Sonnet: ~$0.003/1k input tokens
- Claude 3 Opus: ~$0.015/1k input tokens

### Groq (High Speed)

**Advantages:**
- Extremely fast inference
- Free tier available
- Good for real-time apps
- Limited models

**Steps:**
1. Go to https://console.groq.com
2. Sign in or create account
3. Create new API key
4. Copy the key
5. Free tier limits: check docs

**Cost Estimation:**
- Mixtral 8x7B: Free tier available
- LLaMA 2 70B: Free tier available

---

## ✅ Verification Checklist

After entering API keys, verify:

- [ ] Logic Hub key field shows **✓ Key configured** in green
- [ ] Synthesis key field shows **✓ Key configured** in green (if used)
- [ ] Model dropdown shows selected model
- [ ] No red warnings visible
- [ ] Can close and reopen Mission Settings
- [ ] Keys persist (saved in browser localStorage)
- [ ] Can click "Engage" without errors

---

## 🚨 Troubleshooting

### Problem: "API key not working"
**Solution:**
- Verify key is copied completely (no extra spaces)
- Check key is for the correct provider
- Verify account has billing set up (if paid API)
- Try a fresh API key (maybe old one was revoked)

### Problem: "Key lost after refresh"
**Solution:**
- Keys are stored in browser localStorage
- Try clearing browser cache: Settings → Clear browsing data
- Re-enter key in Intelligence section
- Keys should persist after that

### Problem: "Can't find Intelligence section"
**Solution:**
1. Click gear icon (⚙️) in bottom-right
2. Scroll down in Mission Settings panel
3. Look for section with 🧠 brain icon
4. Should say "INTELLIGENCE" in cyan text
5. Click to expand

### Problem: "Getting 401/403 errors"
**Solution:**
- Invalid API key (typo or wrong key)
- API key for wrong provider
- Credentials expired (create new key)
- Check API key format matches provider

### Problem: "Model not available"
**Solution:**
- Verify account has access to model
- Some models require higher tier
- Check model name spelling
- Some models might be in beta

---

## 🔐 Security Notes

### How Keys Are Stored
- **Client-side only** — Keys stored in browser localStorage
- **Not sent to SwarmIDE2 servers** — Only sent to LLM provider APIs
- **Not logged or tracked** — Only visible to you
- **Persisted locally** — Survive page refresh

### Best Practices
1. **Use a dedicated API key** for development
2. **Monitor usage** in your provider dashboard
3. **Set monthly spending limits** if available
4. **Rotate keys periodically** for security
5. **Never commit keys to version control**
6. **Use .env files** for local development (not in Mission Settings for prod)

---

## 💰 Cost Estimation

### Per Agent Task (Typical)
```
Input tokens: 50,000 (approx)
Output tokens: 2,000 (approx)

Gemini 3 Flash:   $0.04 total
Gemini 3 Pro:     $0.30 total
OpenAI GPT-4o:    $0.90 total
Claude Sonnet:    $0.18 total
Groq (Free):      $0.00 total
```

### Per Full Run (3 agents, 1 phase)
```
Without optimization:
- 3 agents × $0.30 = $0.90 (Gemini Pro)
- 3 agents × $1.50 = $4.50 (GPT-4o)

With budget control (Phase 1):
- Set budget to $2 or $5
- Get warnings at 80%
- Hard cutoff at 100%
```

---

## 🚀 Next Steps After Setup

1. **Close Mission Settings** (click X or outside)
2. **Enter a test prompt:**
   ```
   "Build a React dashboard with TypeScript"
   ```
3. **Select 2+ agents** (Kernel, Scale, Nexus)
4. **Click "Engage"**
5. **Watch terminal logs** for execution
6. **Monitor CostTracker** (bottom-right)

---

## 📞 Common Questions

**Q: Can I use the same key for both Logic Hub and Synthesis?**
A: Yes! You can use the same API key for both fields.

**Q: What if I don't have an API key?**
A: Start with free Gemini tier at https://go.dev/genai

**Q: Can I change keys mid-run?**
A: Yes, but it won't affect the current execution. Changes apply to next run.

**Q: Are there rate limits?**
A: Yes, depends on your API provider:
- Gemini Free: 60 requests/minute
- OpenAI: Depends on tier
- Check your provider's dashboard

**Q: How do I know which model to choose?**
A: For testing: **Gemini 3 Flash** (fastest, cheapest)
For quality: **Gemini 3 Pro** or **GPT-4o** (more capable)

**Q: Can I use multiple providers?**
A: Yes! Use one for Logic Hub, different for Synthesis Pass.

---

## 📚 Further Reading

- [README.md](README.md) — Project overview
- [PHASE1_USER_GUIDE.md](PHASE1_USER_GUIDE.md) — Feature guide
- [ALL_PHASES_OVERVIEW.md](ALL_PHASES_OVERVIEW.md) — Architecture

---

**Last Updated:** Jan 18, 2026
**Status:** ✅ API Setup Working
**Next:** [PHASE1_USER_GUIDE.md](PHASE1_USER_GUIDE.md)
