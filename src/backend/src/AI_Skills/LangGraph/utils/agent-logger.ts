import fs from 'fs/promises'; // <-- CHANGED to promises
import path from 'path';

// Memory Leak Fix: Use a Map to store timestamps so we can clean up old runs
const activeAgents = new Map<string, number>();
const MAX_AGENT_CACHE_AGE_MS = 1000 * 60 * 60; // 1 hour

function cleanupOldAgents() {
  const now = Date.now();
  for (const [key, timestamp] of activeAgents.entries()) {
    if (now - timestamp > MAX_AGENT_CACHE_AGE_MS) {
      activeAgents.delete(key);
    }
  }
}

// Ensure the function is async
export async function dumpAgentContext(
  reportId: string, 
  agentName: string, 
  messages: any[],
  stage: 'INPUT' | 'OUTPUT' = 'INPUT',
  isNewTask?: boolean
) {
  try {
    // Run memory cleanup occasionally (roughly 10% of the time to save CPU)
    if (Math.random() < 0.1) cleanupOldAgents();

    const agentKey = `${reportId}_${agentName}`;
    const isNewAgent = !activeAgents.has(agentKey) && stage === 'INPUT';
    
    // 1. Create a clean, sortable timestamp FIRST
    const now = new Date();
    
    // 2. Create the dedicated folder
    const safeReportId = reportId.replace(/[^a-z0-9-]/gi, '_');
    const logsDir = path.join(process.cwd(), '.logs', `Report_${safeReportId}`);

    // fs.promises.mkdir with recursive: true replaces fs.existsSync safely
    await fs.mkdir(logsDir, { recursive: true });

    // 3. Create filename: Timestamp FIRST for perfect chronological sorting in your OS
    const filename = `${agentName}_${stage}.txt`;
    const filepath = path.join(logsDir, filename);

    // 4. Format the Context Dump
    let output = `====================================================\n`;
    output += `AGENT: ${agentName.toUpperCase()}\n`;
    output += `STAGE: ${stage} ${stage === 'INPUT' ? '(What the AI sees)' : '(What the AI decided)'}\n`;
    output += `TIMESTAMP: ${now.toLocaleString()}\n`;
    output += `TOTAL MESSAGES: ${messages.length}\n`;
    if (isNewTask !== undefined) {
      output += `IS NEW Task: ${isNewTask}\n`;
    }
    output += `====================================================\n\n`;

    if (isNewAgent) {
      activeAgents.set(agentKey, Date.now()); // Store with timestamp
      output += `🤖 NEW [Agent]: [${agentName}] for report ${reportId.substring(0,8)}\n`;
    }

    messages.forEach((msg, index) => {
      const role = msg._getType ? msg._getType().toUpperCase() : (msg.type || 'UNKNOWN').toUpperCase();
      output += `[MESSAGE ${index + 1}] Role: ${role} --------------------------------\n\n`;

      // Handle Text vs. Multimodal arrays safely
      if (typeof msg.content === 'string') {
        output += msg.content + '\n';
      } else if (Array.isArray(msg.content)) {
        msg.content.forEach((part: any) => {
          if (part.type === 'text') output += part.text + '\n';
          else if (part.type === 'image_url') output += `[🖼️ IMAGE DETECTED: Base64 string omitted]\n`;
          else output += JSON.stringify(part, null, 2) + '\n';
        });
      } else {
        output += JSON.stringify(msg.content, null, 2) + '\n';
      }

      // Explicitly highlight Tool Calls in the OUTPUT
      if (msg.tool_calls && msg.tool_calls.length > 0) {
         output += `\n🛠️ AI IS CALLING THESE TOOLS:\n`;
         msg.tool_calls.forEach((tool: any) => {
             output += `   -> Tool: ${tool.name}\n`;
             output += `   -> Args: ${JSON.stringify(tool.args, null, 2)}\n`;
         });
      }

      // Explicitly highlight Tool Results in the INPUT
      if (role === 'TOOL' && msg.name) {
         output += `\n📥 RESULT FROM TOOL: ${msg.name}\n`;
      }

      output += `\n---------------------------------------------------------------\n\n`;
    });

    // 5. Write to disk ASYNCHRONOUSLY
    await fs.writeFile(filepath, output);

  } catch (error) {
    console.error(`❌ [Debug Logger] Failed to dump context:`, error);
  }
}