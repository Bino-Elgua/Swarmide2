# SwarmIDE2 Quick Fixes — Priority Action Items

**Audit Date:** January 23, 2026  
**Target:** Production-Ready by Week End  

---

## 🔴 CRITICAL (Do Today)

### 1. Add Auth Middleware to Main Server — 30 min
**File:** `api/server.ts`

```typescript
// ADD AT TOP (after imports):
import { apiGateway } from '../services/apiGatewayService';
import { advancedLogger } from '../services/advancedLoggingService';

// ADD AFTER cors middleware (line 14):
// Logging
app.use((req, res, next) => {
  const traceId = advancedLogger.generateTraceId();
  advancedLogger.info('api', `${req.method} ${req.path}`, { traceId }, traceId);
  (req as any).traceId = traceId;
  next();
});

// API Gateway: Auth & Rate Limiting
app.use(async (req, res, next) => {
  try {
    const gatewayResult = await apiGateway.processRequest({
      id: `${Date.now()}-${Math.random()}`,
      method: req.method,
      path: req.path,
      headers: Object.fromEntries(
        Object.entries(req.headers).map(([k, v]) => [k, String(v)])
      ),
      body: req.body,
    });

    if (gatewayResult.statusCode !== 200) {
      return res.status(gatewayResult.statusCode).json(gatewayResult.body);
    }

    if (gatewayResult.rateLimitStatus) {
      res.set({
        'X-RateLimit-Limit': String(gatewayResult.rateLimitStatus.limit),
        'X-RateLimit-Remaining': String(gatewayResult.rateLimitStatus.remaining),
        'X-RateLimit-Reset': String(gatewayResult.rateLimitStatus.resetAt),
      });
    }

    (req as any).userId = gatewayResult.body.userId;
    next();
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Status:** ⏳ Ready to implement  
**Testing:** `curl -H "X-API-Key: test" http://localhost:3000/health`

---

### 2. Add Admin Routes — 45 min
**File:** `api/server.ts` (add at end, before error handlers)

```typescript
// ═══════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD ROUTES
// ═══════════════════════════════════════════════════════════════════════

import { adminDashboard } from '../services/adminDashboardService';

app.get('/admin/overview', (req: Request, res: Response) => {
  try {
    const overview = adminDashboard.getSystemOverview();
    res.json(overview);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/tenants', (req: Request, res: Response) => {
  try {
    const tenants = adminDashboard.getTenants();
    res.json(tenants);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/tenants/:id', (req: Request, res: Response) => {
  try {
    const tenant = adminDashboard.getTenantDetails(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/analytics', (req: Request, res: Response) => {
  try {
    const { days = '30' } = req.query;
    const analytics = adminDashboard.getAnalytics(Number(days));
    res.json(analytics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/costs', (req: Request, res: Response) => {
  try {
    const costs = adminDashboard.getCostInsights();
    res.json(costs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/audit-log', (req: Request, res: Response) => {
  try {
    const { limit = '100' } = req.query;
    const logs = adminDashboard.getAuditLog(Number(limit));
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

**Testing:**
```bash
curl http://localhost:3000/admin/overview
curl http://localhost:3000/admin/tenants
curl http://localhost:3000/admin/analytics?days=30
```

---

### 3. Add File Upload Endpoint — 45 min
**File:** `api/server.ts`

```typescript
// ADD TO package.json dependencies:
// "multer": "^1.4.5-lts.1"

import multer from 'multer';
import { fileStorageService } from '../services/fileStorageService';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 * 1024 } // 5GB
});

// ADD AFTER existing file routes:
app.post('/api/files/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { tenantId } = req.body;
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId required' });
    }

    const file = await fileStorageService.uploadFile(
      tenantId,
      req.file.originalname,
      req.file.buffer,
      req.file.mimetype
    );

    advancedLogger.info('storage', 'File uploaded', { fileId: file.id, tenantId }, (req as any).traceId);

    res.json(file);
  } catch (error: any) {
    advancedLogger.error('storage', 'Upload failed', { error: error.message }, (req as any).traceId);
    res.status(400).json({ error: error.message });
  }
});
```

**Testing:**
```bash
curl -F "file=@myfile.pdf" -F "tenantId=tenant-123" http://localhost:3000/api/files/upload
```

---

## 🟠 HIGH (This Week)

### 4. Implement OAuth2 — 3-4 hours
**Files:** `services/authService.ts` line 170-173

**Steps:**
1. Register app with Google & GitHub
2. Install `axios` or use `fetch`
3. Implement token exchange:

```typescript
async exchangeOAuth2Token(provider: string, code: string, redirectUri: string): Promise<User> {
  let tokenUrl: string;
  let userUrl: string;
  let clientId = process.env[`${provider.toUpperCase()}_OAUTH_ID`];
  let clientSecret = process.env[`${provider.toUpperCase()}_OAUTH_SECRET`];

  if (provider === 'google') {
    tokenUrl = 'https://oauth2.googleapis.com/token';
    userUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';
  } else if (provider === 'github') {
    tokenUrl = 'https://github.com/login/oauth/access_token';
    userUrl = 'https://api.github.com/user';
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }

  // Exchange code for token
  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri
    })
  });

  const { access_token } = await tokenResponse.json();

  // Get user info
  const userResponse = await fetch(userUrl, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });

  const userData = await userResponse.json();

  // Create/update user
  const email = userData.email || userData.login;
  let user = this.users.get(email);

  if (!user) {
    user = await this.register(
      email,
      `oauth-${provider}-${userData.id}`,
      ['user']
    );
  }

  return user;
}
```

**Setup:**
```bash
# Google OAuth
# 1. Go to https://console.cloud.google.com
# 2. Create OAuth 2.0 credentials
# 3. Add to .env:
export GOOGLE_OAUTH_ID="xxx.apps.googleusercontent.com"
export GOOGLE_OAUTH_SECRET="xxxxx"

# GitHub OAuth
# 1. Go to Settings → Developer settings → OAuth Apps
# 2. Create new app
# 3. Add to .env:
export GITHUB_OAUTH_ID="xxxxx"
export GITHUB_OAUTH_SECRET="xxxxx"
```

---

### 5. Connect Elasticsearch — 2 hours
**File:** `services/advancedLoggingService.ts`

```bash
npm install @elastic/elasticsearch
```

```typescript
import { Client } from '@elastic/elasticsearch';

private elasticsearchClient: Client | null = null;

private initElasticsearch(url: string): void {
  this.elasticsearchClient = new Client({ node: url });
  console.log(`✅ Elasticsearch connected at ${url}`);
}

private async indexToElasticsearch(entry: LogEntry): Promise<void> {
  if (!this.elasticsearchClient) return;

  try {
    const indexName = `logs-${new Date().toISOString().split('T')[0]}`;
    await this.elasticsearchClient.index({
      index: indexName,
      body: {
        ...entry,
        '@timestamp': new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to index to Elasticsearch:', error);
  }
}
```

**Setup:**
```bash
# Local Elasticsearch (Docker)
docker run -d -p 9200:9200 -p 9300:9300 \
  -e "discovery.type=single-node" \
  docker.elastic.co/elasticsearch/elasticsearch:8.0.0

# Environment
export ELASTICSEARCH_URL="http://localhost:9200"
```

---

### 6. Implement Real Email Delivery — 2 hours
**File:** `services/emailNotificationService.ts`

```typescript
private async deliverEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error('SENDGRID_API_KEY not set');

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: message.to }],
          cc: message.cc?.map(c => ({ email: c })),
          bcc: message.bcc?.map(b => ({ email: b })),
        }
      ],
      from: { email: process.env.SENDGRID_FROM_EMAIL },
      subject: message.subject,
      content: [{ type: 'text/html', value: message.body }],
      attachments: message.attachments?.map(a => ({
        content: a.content.toString('base64'),
        filename: a.filename,
        type: a.mimeType
      }))
    })
  });

  if (!response.ok) {
    throw new Error(`SendGrid error: ${response.status} ${response.statusText}`);
  }

  message.deliveredAt = Date.now();
}
```

**Setup:**
```bash
# Get SendGrid API key from https://sendgrid.com
export SENDGRID_API_KEY="SG.xxx"
export SENDGRID_FROM_EMAIL="noreply@example.com"
```

---

## 🟡 MEDIUM (Next 2 Weeks)

### 7. Real Webhook HTTP Delivery — 1 hour
**File:** `services/webhookEventService.ts` line 155

```typescript
private async sendWebhookRequest(
  config: WebhookConfig,
  event: WebhookEvent
): Promise<{ statusCode: number; body: string }> {
  const payload = JSON.stringify(event);
  const signature = this.generateSignature(payload, config.secret);

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(signature && { 'X-Webhook-Signature': signature }),
        'User-Agent': 'SwarmIDE2/1.0',
      },
      body: payload,
      timeout: 30000,
    });

    const body = await response.text();

    return {
      statusCode: response.status,
      body
    };
  } catch (error: any) {
    throw new Error(`Webhook delivery failed: ${error.message}`);
  }
}
```

---

### 8. MFA Implementation — 2 hours
**File:** `services/authService.ts` line 187

```bash
npm install speakeasy qrcode
```

```typescript
import speakeasy from 'speakeasy';

private generateMFASecret(): string {
  const secret = speakeasy.generateSecret({
    name: 'SwarmIDE2',
    issuer: 'SwarmIDE',
    length: 32
  });
  return secret.base32;
}

verifyMFA(mfaSecret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret: mfaSecret,
    encoding: 'base32',
    token: token,
    window: 2 // Allow 2-step drift
  });
}
```

---

## Testing Each Fix

```bash
# 1. Auth Middleware
curl -v http://localhost:3000/admin/overview
# Should return 401 without token

curl -v -H "Authorization: Bearer $(JWT_TOKEN)" http://localhost:3000/admin/overview
# Should return overview

# 2. File Upload
curl -F "file=@test.txt" -F "tenantId=tenant-1" http://localhost:3000/api/files/upload

# 3. Admin Routes
curl http://localhost:3000/admin/analytics?days=7

# 4. Email (check logs)
npm run dev
# Check terminal for "✅ Email sent" messages

# 5. Webhooks (use webhook.cool or RequestBin)
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"type":"test.event","data":{}}'
```

---

## Implementation Order

**Day 1:** Auth middleware + Admin routes + File upload (2.5 hours)  
**Day 2:** OAuth2 + Email delivery (4-5 hours)  
**Day 3:** Elasticsearch + Webhooks (3 hours)  
**Day 4:** Testing & fixes (4 hours)  
**Day 5:** Production readiness review  

**Total:** ~16-18 hours of focused work

---

## Success Criteria

- [ ] Auth middleware validates tokens
- [ ] Rate limiting returns 429 when exceeded
- [ ] Admin dashboard shows system health
- [ ] File uploads work with multipart
- [ ] Emails actually send
- [ ] Webhooks call external URLs
- [ ] Logs appear in Elasticsearch
- [ ] OAuth2 login works
- [ ] All services tested end-to-end

---

**Status:** Ready to start immediately  
**Next:** Pick one critical fix and begin implementation
