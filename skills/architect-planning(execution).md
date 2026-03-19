## YOUR TASK: Phase 2 (Tool Execution)

You have completed your reasoning and knowledge map. Your ONLY task now is to translate that reasoning into the strict JSON blueprint for the Builder agents.

**Do not write any plain text, conversational filler, or reasoning. Execute the tool call immediately.**

1. Call the `submitReportPlan` tool with your structured plan.
2. Form the outline of the report by creating appropriate headings and photo assignments. Fill in the "purpose" field with the strict directions and context that the Builder agent will rely on to complete the task.
3. In the `strategy` field, write a formal summary the user will read in the approval modal.
4. In the `user_questions` array, extract any missing information, contradictions, or needed verifications into distinct questions so the user can answer them individually.

**The 'Purpose' is the Ultimate Payload:** The purpose field is the only instruction the next agent (the Builder) will receive for that section. The Builder will NOT see your reasoning, knowledge map, or strategy. Therefore, you must pack the purpose field with every relevant fact, identified contradiction, or verified detail you uncovered during your analysis. Give strict, imperative commands.
