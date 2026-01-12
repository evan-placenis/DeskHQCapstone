# 🧠 Chain-of-Thought Chat Architecture

## Overview

This system implements an **Agentic Orchestrator Pattern**. Instead of a single LLM trying to do everything at once, we use a central **Orchestrator** that breaks user requests into a plan and delegates tasks to specialized agents.

## 🔄 The Execution Flow

1.  **User Input**: The user sends a message (e.g., "Find the latest population stats for Canada and update the intro").
2.  **The Planner (Architect)**:
    - Analyzes the request.
    - Generates a sequential **Plan** of steps (e.g., `[RESEARCH_DATA, EDIT_TEXT]`).
3.  **The Orchestrator (The Loop)**:
    - Iterates through the steps one by one.
    - **Step 1 (Research)**: Calls `ResearcherAgent`. The agent scrapes/searches and returns facts. These facts are saved into `accumulatedContext` (hidden from the user).
    - **Step 2 (Edit)**: Calls `EditorAgent`. The Orchestrator passes the _Current Document_ + _Research Findings_. The Editor returns rewritten text.
    - **Diff Calculation**: The system uses `DiffUtils` to compare the _Original_ vs. _Rewritten_ text, generating both visual diffs (red/green) and summary stats.
4.  **Final Output**:
    - The system returns a structured `ChatMessage` object containing the text response AND a structured `EditSuggestion` object (if edits were made).

## 🧩 Key Components

### 1. ChatOrchestrator

The main controller. It maintains the "Short Term Memory" (`accumulatedContext`) during the execution of a plan so that agents can "pass notes" to each other without polluting the user's chat UI.

### 2. The Agents

- **PlannerAgent**: Decides _what_ needs to be done. It outputs a list of intents (`RESEARCH_DATA`, `EDIT_TEXT`, `EXECUTE_TOOL`).
- **ResearcherAgent**: optimized for search and fact-retrieval.
- **EditorAgent**: Optimized for prose, tone, and grammar.
- **ToolAgent**: Handles discrete actions (APIs, calculators, etc.).

### 3. DiffUtils & Data Structure

We do not just return text. We return **Structured Diffs**.

- **`changes`**: An array of diff chunks (`{ value: "old word", removed: true }`). Used for rendering the UI (Red/Green highlights).
- **`stats`**: Summary metrics (`{ added: 5, removed: 2, summary: "+3 words" }`). Used for UI badges.

## 📡 Output Data Schema

The frontend receives this JSON structure:

```json
{
  "id": "msg-123",
  "role": "assistant",
  "content": "I have updated the section based on the new data.",
  "suggestion": {
    "id": "sug-789",
    "targetSectionId": "section-intro",
    "status": "PENDING",
    "stats": {
      "added": 12,
      "removed": 4,
      "changeSummary": "+8 words"
    },
    "changes": [
      { "value": "The population is ", "count": 3 },
      { "value": "38 million", "removed": true },
      { "value": "40 million", "added": true }
    ]
  }
}
```
