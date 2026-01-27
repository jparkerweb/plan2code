// Completion markers for plan2code-loop
const COMPLETION_MARKERS = ['TASK_COMPLETE', 'TASK_BLOCKED', 'LOOP_COMPLETE'] as const;

export type CompletionMarker = (typeof COMPLETION_MARKERS)[number];

export interface CompletionCheckResult {
  completed: boolean;
  marker?: CompletionMarker;
  taskId?: string;      // e.g., "1.1", "2.3"
  taskName?: string;    // e.g., "Initialize project structure"
  reason?: string;      // For TASK_BLOCKED: reason
}

export function checkForCompletion(output: string): CompletionCheckResult {
  // Check for LOOP_COMPLETE first (highest priority)
  if (output.includes('LOOP_COMPLETE')) {
    return { completed: true, marker: 'LOOP_COMPLETE' };
  }

  // Check for TASK_COMPLETE with task info
  // Format: TASK_COMPLETE: 1.1 - Task description
  // Or: TASK_COMPLETE: 1.1: Task description
  // Or: TASK_COMPLETE[1.1]: Task description
  const completeMatch = output.match(/TASK_COMPLETE[:\[\s]+(\d+\.\d+)[\]:\-\s]+(.+?)(?:\n|$)/i);
  if (completeMatch) {
    return {
      completed: true,
      marker: 'TASK_COMPLETE',
      taskId: completeMatch[1],
      taskName: completeMatch[2].trim(),
    };
  }

  // Simple TASK_COMPLETE without structured info - try to extract task from context
  if (output.includes('TASK_COMPLETE')) {
    // Try to find task info nearby
    const taskMatch = output.match(/(?:task|completed?)\s+(\d+\.\d+)[:\s]+([^\n]{5,80})/i);
    return {
      completed: true,
      marker: 'TASK_COMPLETE',
      taskId: taskMatch?.[1],
      taskName: taskMatch?.[2]?.trim(),
    };
  }

  // Check for TASK_BLOCKED with task info and reason
  // Format: TASK_BLOCKED: 1.1 - Reason why blocked
  const blockedWithTaskMatch = output.match(/TASK_BLOCKED[:\[\s]+(\d+\.\d+)[\]:\-\s]+(.+?)(?:\n|$)/i);
  if (blockedWithTaskMatch) {
    return {
      completed: true,
      marker: 'TASK_BLOCKED',
      taskId: blockedWithTaskMatch[1],
      reason: blockedWithTaskMatch[2].trim(),
    };
  }

  // TASK_BLOCKED with just reason (no task ID)
  const blockedMatch = output.match(/TASK_BLOCKED:\s*(.+?)(?:\n|$)/);
  if (blockedMatch) {
    return {
      completed: true,
      marker: 'TASK_BLOCKED',
      reason: blockedMatch[1].trim()
    };
  }

  // Simple TASK_BLOCKED without any info
  if (output.includes('TASK_BLOCKED')) {
    return { completed: true, marker: 'TASK_BLOCKED', reason: 'No reason provided' };
  }

  return { completed: false };
}
