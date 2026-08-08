// Completion markers for plan2code-loop
const COMPLETION_MARKERS = ['TASK_COMPLETE', 'TASK_BLOCKED', 'LOOP_COMPLETE', 'PREREQ_COMPLETE', 'PREREQ_ASSUMED'] as const;

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

  // Check for PREREQ_COMPLETE with prereq info
  // Format: PREREQ_COMPLETE: P1.1 - Verified Phase 1 complete
  const prereqMatch = output.match(/PREREQ_COMPLETE[:\[\s]+([^\]:\-\s]+)[\]:\-\s]+(.+?)(?:\n|$)/i);
  if (prereqMatch) {
    return {
      completed: true,
      marker: 'PREREQ_COMPLETE',
      taskId: prereqMatch[1],
      taskName: prereqMatch[2].trim(),
    };
  }

  // Check for PREREQ_ASSUMED with prereq info
  // Format: PREREQ_ASSUMED: P2.1 - Design approval (cannot verify)
  const assumedMatch = output.match(/PREREQ_ASSUMED[:\[\s]+([^\]:\-\s]+)[\]:\-\s]+(.+?)(?:\n|$)/i);
  if (assumedMatch) {
    return {
      completed: true,
      marker: 'PREREQ_ASSUMED',
      taskId: assumedMatch[1],
      taskName: assumedMatch[2].trim(),
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

/**
 * Extract ALL completion markers from output (for phase mode).
 * Returns an array of all TASK_COMPLETE/TASK_BLOCKED markers found,
 * plus whether LOOP_COMPLETE or PHASE_COMPLETE was present.
 */
export function checkForAllCompletions(output: string): {
  tasks: CompletionCheckResult[];
  loopComplete: boolean;
  phaseComplete: boolean;
} {
  const tasks: CompletionCheckResult[] = [];
  let loopComplete = false;
  let phaseComplete = false;

  if (output.includes('LOOP_COMPLETE')) {
    loopComplete = true;
  }

  if (output.includes('PHASE_COMPLETE')) {
    phaseComplete = true;
  }

  // Find all TASK_COMPLETE markers with task info
  // Format: TASK_COMPLETE: 1.1 - Task description
  const completeRegex = /TASK_COMPLETE[:\[\s]+(\d+\.\d+)[\]:\-\s]+(.+?)(?:\n|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = completeRegex.exec(output)) !== null) {
    tasks.push({
      completed: true,
      marker: 'TASK_COMPLETE',
      taskId: match[1],
      taskName: match[2].trim(),
    });
  }

  // Find all TASK_BLOCKED markers with task info
  const blockedRegex = /TASK_BLOCKED[:\[\s]+(\d+\.\d+)[\]:\-\s]+(.+?)(?:\n|$)/gi;
  while ((match = blockedRegex.exec(output)) !== null) {
    tasks.push({
      completed: true,
      marker: 'TASK_BLOCKED',
      taskId: match[1],
      reason: match[2].trim(),
    });
  }

  // Find PREREQ_COMPLETE markers
  const prereqRegex = /PREREQ_COMPLETE[:\[\s]+([^\]:\-\s]+)[\]:\-\s]+(.+?)(?:\n|$)/gi;
  while ((match = prereqRegex.exec(output)) !== null) {
    tasks.push({
      completed: true,
      marker: 'PREREQ_COMPLETE',
      taskId: match[1],
      taskName: match[2].trim(),
    });
  }

  // Find PREREQ_ASSUMED markers
  const assumedRegex = /PREREQ_ASSUMED[:\[\s]+([^\]:\-\s]+)[\]:\-\s]+(.+?)(?:\n|$)/gi;
  while ((match = assumedRegex.exec(output)) !== null) {
    tasks.push({
      completed: true,
      marker: 'PREREQ_ASSUMED',
      taskId: match[1],
      taskName: match[2].trim(),
    });
  }

  return { tasks, loopComplete, phaseComplete };
}
