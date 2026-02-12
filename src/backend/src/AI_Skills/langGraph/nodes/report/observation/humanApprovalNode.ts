/**
 * Phase 2: Human Approval (Interrupt Point)
 * 
 * This node checks if the user has approved/rejected the plan.
 * In a full implementation with checkpointing, this would be where we interrupt.
 * For now, we simulate by checking the approvalStatus in state.
 */
export async function humanApprovalNode(state: any) {
  const { approvalStatus, userFeedback } = state;

  console.log(`👤 Human Approval Check: Status = ${approvalStatus}`);

  // Decision logic
  if (approvalStatus === 'APPROVED') {
    return {
      next_step: 'builder', // Changed from 'researcher' since researcher node is commented out
      userFeedback: null, // Clear feedback since plan is approved
    };
  } else if (approvalStatus === 'REJECTED') {
    return {
      next_step: 'architect', // Loop back to planning with feedback
      approvalStatus: 'PENDING', // Reset so architect can propose new plan
      userFeedback: userFeedback,// Keep userFeedback in state so architect can see it
      
    };
  } else {
    // 3. Pending -> Something is wrong
    // If we resumed the graph, the state SHOULD have been updated to APPROVED or REJECTED.
    console.warn('⚠️ Graph resumed but status is still PENDING. Defaulting to REJECTED for safety.');
    return {
        next_step: 'architect',
        userFeedback: "System Error: No approval decision received.",
    };
  }
}
