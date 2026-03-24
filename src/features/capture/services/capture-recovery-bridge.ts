/**
 * When the user chooses an action in the global session recovery prompt,
 * we pass it to the capture session page via sessionStorage (same origin).
 */
export const CAPTURE_RECOVERY_ACTION_KEY = "deskhq-capture-recovery-action";

export type CaptureRecoveryAction = "resume" | "retry-upload";
