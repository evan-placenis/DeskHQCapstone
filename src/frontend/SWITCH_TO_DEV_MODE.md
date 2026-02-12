# Quick Guide: Switch to Dev Mode

## 🎯 Goal
Test your LangGraph observation workflow locally without Trigger.dev.

---

## ✅ What's Already Done

1. ✅ New route created: `/api/report/generate-dev/route.ts`
2. ✅ Uses same `sharedCheckpointer` as resume route
3. ✅ Returns streaming response
4. ✅ Works with Human-in-the-Loop

---

## 🔧 How to Switch

### Option 1: Temporary Frontend Change (Quick)

Find where you call the report generation API (likely `NewReportModal.tsx` or similar) and change:

```typescript
// BEFORE (Production)
const response = await fetch('/api/report/generate', {
  method: 'POST',
  // ...
});

// AFTER (Dev Mode)
const response = await fetch('/api/report/generate-dev', {
  method: 'POST',
  // ...
});
```

That's it! Just change the endpoint.

---

### Option 2: Environment Variable (Better)

**1. Create the constant:**

```typescript
// At the top of your file (e.g., NewReportModal.tsx)
const REPORT_ENDPOINT = process.env.NEXT_PUBLIC_USE_DEV_MODE === 'true'
  ? '/api/report/generate-dev'
  : '/api/report/generate';
```

**2. Use it:**

```typescript
const response = await fetch(REPORT_ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectId,
    workflowType: 'observation',
    selectedImageIds,
    // ... other params
  }),
});
```

**3. Enable dev mode in `.env.local`:**

```bash
NEXT_PUBLIC_USE_DEV_MODE=true
```

**4. To switch back to production:**

```bash
NEXT_PUBLIC_USE_DEV_MODE=false
# or just remove the line
```

---

## 🧪 Test It

1. **Start your Next.js dev server** (if not running):
   ```bash
   npm run dev
   ```

2. **Go to your app** in browser

3. **Generate a report:**
   - Navigate to a project
   - Click "Generate Report"
   - Select workflow: "observation"
   - Add photos
   - Click "Generate"

4. **Watch the console:**
   ```
   🛠️ [DEV MODE] Starting synchronous report generation
   📋 [DEV MODE] Report ID (Thread ID): abc-123-def
   🚀 [DEV MODE] Executing workflow: observation
   ```

5. **Wait for pause:**
   - After ~10-20 seconds, the stream ends
   - Graph paused at `human_approval`

6. **Check pause status manually** (if modal doesn't auto-open):
   ```bash
   curl "http://localhost:3000/api/report/generate-dev?reportId=YOUR_REPORT_ID"
   ```

7. **Open approval modal manually** (or let it auto-open if you have Realtime working)

8. **Approve or reject** → Resume route continues the workflow

---

## ⚠️ Important Notes

### 1. Don't Restart Server During Testing

Dev mode uses `MemorySaver` (in-memory checkpointer). If you:
- Edit backend files (triggers hot reload)
- Restart the server
- The checkpoint state is lost

**Solution:** Generate → Approve/Reject without touching backend files.

---

### 2. Pause Detection

The dev route doesn't automatically broadcast pause events via Supabase Realtime (that's in the Trigger.dev job).

**Two options:**

**A. Manual check** (simple, works immediately):
```typescript
// After stream ends
const statusRes = await fetch(`/api/report/generate-dev?reportId=${reportId}`);
const status = await statusRes.json();

if (status.isPaused) {
  setShowApprovalModal(true);
  setReportPlan(status.reportPlan);
}
```

**B. Add broadcast logic** (more work, but seamless):
See `DEV_MODE_TESTING.md` → "Add Manual Broadcasts" section

---

### 3. One Report at a Time

The dev route runs synchronously and blocks the API route.
- Only one report can generate at a time
- Don't try to generate multiple reports simultaneously

---

## 🔄 Switching Back to Production

When you're done testing:

1. **Change endpoint back:**
   ```typescript
   const response = await fetch('/api/report/generate', { /* ... */ });
   ```

2. **Or disable dev mode:**
   ```bash
   # In .env.local
   NEXT_PUBLIC_USE_DEV_MODE=false
   ```

3. **Restart your server** to clear memory

The production route queues the job to Trigger.dev, which handles:
- Background execution
- Supabase Realtime broadcasts
- Automatic pause detection
- Error recovery

---

## 📊 Comparison

| Feature | Dev Mode (`/api/report/generate-dev`) | Production (`/api/report/generate`) |
|---------|----------------------------------------|-------------------------------------|
| Execution | Synchronous (blocks API route) | Async background job |
| Pause Detection | Manual check | Automatic via Realtime |
| State Persistence | In-memory (lost on restart) | Depends on checkpointer |
| Scalability | Single request at a time | Multiple jobs in parallel |
| Debugging | Easy (logs in terminal) | Trigger.dev dashboard |
| Use Case | Local dev/testing | Production |

---

## ✅ Summary

**To test Human-in-the-Loop locally:**

1. Change endpoint to `/api/report/generate-dev`
2. Generate report
3. Wait for pause
4. Check status manually or use Realtime
5. Approve/Reject via modal
6. Resume route continues execution

**Done!** 🎉

See `DEV_MODE_TESTING.md` for complete documentation.
