# Health Check & Error Reporting System

SwarmIDE2 now includes comprehensive health monitoring, error tracking, and API diagnostics.

## Overview

Three new systems work together to provide complete visibility into application health:

1. **Health Check Service** (`healthCheck.ts`) — Monitors system and API health
2. **API Error Handler** (`apiErrorHandler.ts`) — Centralized error handling with retry logic
3. **Monitoring Components** — UI dashboards for real-time monitoring

## Features

### Health Check Service

Monitors 5 critical areas:

- **API Key** — Validates Gemini API key is present and correctly formatted
- **Gemini API** — Tests connectivity and response times (~1 min cache)
- **localStorage** — Verifies storage availability and estimates usage
- **Network** — Checks internet connectivity
- **Memory** — Monitors JavaScript heap usage

```typescript
import { healthCheck } from '@/services/healthCheck';

// Run full health check
const metrics = await healthCheck.runFullCheck();
console.log(metrics.status); // 'healthy' | 'degraded' | 'unhealthy'
console.log(metrics.checks);
console.log(metrics.errors);
console.log(metrics.warnings);
```

### Error Logging & Context

Log errors with full context for debugging:

```typescript
healthCheck.logError(
  'gemini_api',           // category
  'high',                 // severity: 'low' | 'medium' | 'high' | 'critical'
  'Failed to generate content',
  {
    model: 'gemini-2.0-flash',
    tokens: 5000,
    status: 503
  },
  error.stack              // optional stack trace
);

// Log warnings
healthCheck.logWarning(
  'rate_limit_warning',
  'Approaching rate limit: 95% of quota used',
  { quotaUsed: 95 }
);
```

### API Error Handler

Wraps all API calls with automatic retry logic:

```typescript
import { apiErrorHandler, withErrorHandling } from '@/services/apiErrorHandler';

// Option 1: Direct wrapper
const result = await apiErrorHandler.executeWithRetry(
  'gemini',
  'generateContent',
  () => ai.models.generateContent(request),
  {
    maxRetries: 3,
    timeout: 30000
  }
);

// Option 2: Convenience function
const result = await withErrorHandling(
  'gemini',
  'generateContent',
  () => ai.models.generateContent(request)
);
```

**Automatically handles:**
- Network errors (retryable)
- Rate limiting (429, retryable with backoff)
- Auth errors (401/403, not retryable)
- Server errors (5xx, retryable)
- Timeout errors (retryable)
- Invalid JSON responses
- Exponential backoff: 1s → 2s → 5s

### API Call Tracking

Track all API calls for monitoring and debugging:

```typescript
// Get call history
const history = apiErrorHandler.getCallHistory();
const geminiCalls = apiErrorHandler.getCallHistory('gemini');
const recent = apiErrorHandler.getCallHistory('gemini', 10);

// Get statistics
const stats = apiErrorHandler.getStats();
console.log(stats);
// {
//   total: 42,
//   successful: 40,
//   failed: 2,
//   successRate: '95.24%',
//   avgDuration: '1200ms',
//   totalCost: '0.45',
//   totalTokens: 15000
// }

// Export logs
const json = apiErrorHandler.exportLogs();
```

## UI Components

### Health Monitor

Real-time health status and error dashboard.

**Usage:**
```tsx
import HealthMonitor from '@/components/HealthMonitor';

<HealthMonitor 
  isVisible={true}
  autoRefresh={30000}  // 30 seconds
/>
```

**Features:**
- ✅ Overall status indicator (healthy/degraded/unhealthy)
- ✅ Individual health check results with latency
- ✅ Active error log with severity levels
- ✅ Warning list
- ✅ Expandable error details with stack traces
- ✅ Export diagnostics as JSON
- ✅ Fixed position (bottom-right)

**Status Colors:**
- 🟢 **Healthy** — All systems OK
- 🟡 **Degraded** — 1+ warnings or 1+ errors
- 🔴 **Unhealthy** — 2+ errors or critical issue

### API Monitor

Real-time API call tracking and performance metrics.

**Usage:**
```tsx
import APIMonitor from '@/components/APIMonitor';

<APIMonitor 
  isVisible={true}
  autoRefresh={5000}   // 5 seconds
/>
```

**Features:**
- ✅ Request count and success rate
- ✅ Average response time
- ✅ Cost tracking
- ✅ Token usage
- ✅ Recent API calls with status
- ✅ Filter by success/error
- ✅ Expandable call details
- ✅ Export logs as JSON
- ✅ Fixed position (top-right)

## Integration with Services

### Integrate with Gemini Service

Update `geminiService.ts` to use error handling:

```typescript
import { withErrorHandling } from '@/services/apiErrorHandler';
import { healthCheck } from '@/services/healthCheck';

export const orchestrateTeam = async (...) => {
  return withErrorHandling('gemini', 'orchestrateTeam', async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({...});
    return response;
  });
};

export const performAgentTask = async (...) => {
  return withErrorHandling('gemini', 'performAgentTask', async () => {
    // Your API call here
    const response = await ai.models.generateContent({...});
    
    // Track cost
    const metrics: CostMetrics = {
      modelId: model,
      inputTokens: response.usageMetadata?.promptTokenCount || 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
      costUSD: cost,
      timestamp: new Date(),
    };
    
    onCostMetric?.(metrics);
    return response;
  });
};
```

### Add to App Component

```tsx
import HealthMonitor from '@/components/HealthMonitor';
import APIMonitor from '@/components/APIMonitor';

export default function App() {
  return (
    <div>
      {/* Main app content */}
      <YourMainComponent />
      
      {/* Monitoring overlays */}
      <HealthMonitor isVisible={true} autoRefresh={30000} />
      <APIMonitor isVisible={true} autoRefresh={5000} />
    </div>
  );
}
```

## Error Categories

Errors are categorized for better tracking:

| Category | Service | Typical Causes |
|----------|---------|---|
| `gemini_api` | Gemini | Auth, rate limit, server error |
| `gemini_api_check` | Health check | Connectivity, API key |
| `network_offline` | Network | No internet connectivity |
| `json_parse` | Response parsing | Invalid JSON response |
| `retry` | Any service | Temporary failure |

## Severity Levels

| Level | Use Case | Action |
|-------|----------|--------|
| **critical** | System down, auth failed | Alert user, stop execution |
| **high** | API error, budget exceeded | Log & retry if possible |
| **medium** | Rate limited, slow response | Retry with backoff |
| **low** | Minor warning | Log for debugging |

## Diagnostic Exports

Export complete diagnostics for analysis:

```typescript
// Export health metrics
const health = await healthCheck.runFullCheck();
const json = JSON.stringify(health, null, 2);

// Export API logs
const logs = apiErrorHandler.exportLogs();

// Export all diagnostics
const diagnostics = healthCheck.exportDiagnostics();
```

**Diagnostic includes:**
- Health check results (all 5 areas)
- Active errors with context
- Recent warnings
- API call history (last 100)
- Performance statistics
- Timestamps for correlation

## Common Issues & Solutions

### Issue: "API key not found"
**Cause:** `GEMINI_API_KEY` or `API_KEY` env variable missing
**Fix:** Add to `.env.local`:
```
VITE_GEMINI_API_KEY=your-api-key-here
```

### Issue: "Gemini API: Authentication failed"
**Cause:** Invalid or expired API key
**Fix:** Verify key in Google Cloud Console, regenerate if needed

### Issue: "Rate limit exceeded"
**Cause:** Too many requests in short time
**Fix:** Wait, then retry. System automatically implements backoff.

### Issue: "localStorage: Near limit"
**Cause:** Browser storage quota (5MB) almost full
**Fix:** Clear old data, enable cloud storage

### Issue: "Memory: Critical"
**Cause:** Long-running app with many API calls
**Fix:** Reload page, clear call history with `apiErrorHandler.clearOldCalls()`

## Performance Tips

### 1. Clear Old Logs Periodically

```typescript
// Clear calls older than 1 hour
apiErrorHandler.clearOldCalls();

// Clear errors older than 1 hour
healthCheck.clearOldErrors();
```

### 2. Monitor High-Load Operations

```typescript
const result = await withErrorHandling(
  'gemini',
  'largeGeneration',
  () => ai.models.generateContent(largeRequest),
  {
    maxRetries: 5,
    timeout: 60000  // 60s for large requests
  }
);
```

### 3. Use Health Checks Strategically

```typescript
// Check health before expensive operations
const health = await healthCheck.runFullCheck();
if (health.status === 'unhealthy') {
  // Wait or notify user
}
```

## Testing

### Test Health Check

```typescript
// Force health check
const metrics = await healthCheck.runFullCheck();
console.assert(metrics.status === 'healthy');

// Test specific checks
console.assert(metrics.checks.apiKey.status === 'ok');
console.assert(metrics.checks.network.status === 'ok');
```

### Test Error Handling

```typescript
// Test retry logic
const result = await apiErrorHandler.executeWithRetry(
  'test',
  'failThenSucceed',
  async () => {
    if (Math.random() < 0.5) throw new Error('Simulated error');
    return 'success';
  }
);
```

## Dashboard Setup

To enable both monitoring dashboards:

```tsx
// In App.tsx
<>
  <div className="flex">
    {/* Main content */}
    <MainComponent />
  </div>
  
  {/* Fixed overlays */}
  <HealthMonitor isVisible={showHealth} autoRefresh={30000} />
  <APIMonitor isVisible={showAPI} autoRefresh={5000} />
</>
```

## Logging Best Practices

### Do's ✅
- Log API errors with full context
- Include error code, status, message
- Log before throwing
- Use appropriate severity levels
- Clean up old logs periodically

### Don'ts ❌
- Don't log sensitive data (API keys, tokens)
- Don't log entire large objects
- Don't use critical for warnings
- Don't forget to resolve errors when fixed

## Troubleshooting

### Enable Debug Logging

```typescript
// All console.log/warn calls are automatically captured
// View in browser DevTools → Console

healthCheck.logError('debug', 'high', 'Debug message', {
  step: 'orchestration',
  data: debugData
});
```

### Check Environment

```typescript
console.log('API_KEY set:', !!process.env.API_KEY);
console.log('GEMINI_API_KEY set:', !!process.env.GEMINI_API_KEY);

// Run full health check
const health = await healthCheck.runFullCheck();
console.table(health.checks);
```

## Next Steps

1. ✅ Enable Health Monitor in App.tsx
2. ✅ Enable API Monitor in App.tsx
3. ✅ Wrap critical API calls with error handling
4. ✅ Test all error scenarios
5. ✅ Export diagnostics and review
6. ✅ Set up periodic log cleanup

---

**Status:** ✅ Ready for Production  
**Last Updated:** Jan 18, 2026  
**Components:** 2 (HealthMonitor, APIMonitor)  
**Services:** 2 (healthCheck, apiErrorHandler)
