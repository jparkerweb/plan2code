// All TypeScript interfaces for plan2code-metrics

export interface PromptVersions {
  plan: string;           // sha256:... plan2code-1--plan.md
  revise_plan: string;    // plan2code-1b--revise-plan.md
  document: string;       // plan2code-2--document.md
  implement: string;      // plan2code-3--implement.md
  finalize: string;       // plan2code-4--finalize.md
  init: string;           // plan2code---init.md
  init_update: string;    // plan2code---init-update.md
  quick_task: string;     // plan2code---quick-task.md
}

export interface Step1PlanMetrics {
  present: boolean;
  final_confidence: number | null;
  confidence_breakdown: {
    requirements: number | null;
    feasibility: number | null;
    integration: number | null;
    risk: number | null;
  } | null;
  clarification_rounds: number | null;
  tech_stack_revision_rounds: number | null;
  verification_gaps_found: number | null;
  functional_requirements_count: number | null;
  non_functional_requirements_count: number | null;
  risk_count: number | null;
  phase_count: number | null;
}

export interface Step2DocumentMetrics {
  present: boolean;
  total_tasks: number | null;
  tasks_per_phase: number[] | null;
  phase_count: number | null;
  parallel_groups_identified: number | null;
  requirement_coverage_percent: number | null;
  verification_items_added: number | null;
}

export interface Step3ImplementMetrics {
  present: boolean;
  used_loop_mode: boolean;
  loop_mode: 'task' | 'phase' | null;
  task_completion_rate: number | null;
  tasks_completed: number | null;
  tasks_total: number | null;
  blocker_count: number | null;
  blocker_categories: string[] | null;
  total_iterations: number | null;
  avg_iteration_duration_ms: number | null;
  exit_code_distribution: Record<string, number> | null;
  completion_marker_success_rate: number | null;
}

export interface Step4FinalizeMetrics {
  present: boolean;
  completion_rate_at_audit: number | null;
  verification_failures_found: number | null;
  documentation_updates_needed: number | null;
  archival_succeeded: boolean | null;
}

export interface UserFeedback {
  overall_rating: number;   // 1-10
  rating_reason: string;
  what_went_well: string;
  what_went_poorly: string;
}

export interface RunMetrics {
  schema_version: '1.0';
  run_id: string;
  plan2code_version: string;
  prompt_versions: PromptVersions;
  project: {
    name: string;
    started_at: string | null;
    completed_at: string | null;
  };
  step1_plan: Step1PlanMetrics;
  step2_document: Step2DocumentMetrics;
  step3_implement: Step3ImplementMetrics;
  step4_finalize: Step4FinalizeMetrics;
  user_feedback: UserFeedback | null;
}

export interface PromptEdit {
  file: string;
  rationale: string;
  expected_metric_impact: string;
  char_count_before: number;
  char_count_after: number;
  char_count_delta: number;
  old_text: string;
  new_text: string;
}

export interface PromptProposal {
  proposal_id: string;
  created_at: string;
  based_on_runs: string[];
  analyst_model: string;
  proposals: PromptEdit[];
  status: 'pending' | 'applied' | 'rejected';
  diagnosis_file: string | null;
}

// Aggregated metrics schema
export interface CohortMetrics {
  cohort_key: string;          // hash of sorted prompt_versions
  prompt_versions: PromptVersions;
  run_count: number;
  run_ids: string[];
  first_seen: string;
  last_seen: string;

  // Step 1 averages
  avg_confidence: number | null;
  avg_clarification_rounds: number | null;
  avg_verification_gaps_found: number | null;
  avg_functional_requirements_count: number | null;
  avg_non_functional_requirements_count: number | null;
  avg_risk_count: number | null;
  avg_phase_count_step1: number | null;

  // Step 2 averages
  avg_total_tasks: number | null;
  avg_phase_count_step2: number | null;
  avg_parallel_groups: number | null;
  avg_requirement_coverage_percent: number | null;
  avg_verification_items_added: number | null;

  // Step 3 averages (loop only)
  loop_run_count: number;
  avg_task_completion_rate: number | null;
  avg_blocker_count: number | null;
  avg_total_iterations: number | null;
  avg_iteration_duration_ms: number | null;
  avg_completion_marker_success_rate: number | null;

  // Step 4 averages
  avg_completion_rate_at_audit: number | null;
  avg_verification_failures_found: number | null;
  avg_documentation_updates_needed: number | null;
  archival_success_rate: number | null;

  // User feedback
  avg_user_rating: number | null;
  feedback_count: number;
}

export interface AggregatedMetrics {
  schema_version: '1.0';
  last_updated: string;
  total_runs: number;
  cohorts: CohortMetrics[];
  current_cohort_key: string | null;
}

// Metric targets for health assessment
export const METRIC_TARGETS = {
  avg_confidence: { target: 90, direction: 'gte' as const },
  avg_clarification_rounds: { target: 2.0, direction: 'lte' as const },
  avg_verification_gaps_found: { target: 2.0, direction: 'lte' as const },
  avg_parallel_groups: { target: 0.5, direction: 'gte' as const },
  avg_verification_items_added: { target: 1.5, direction: 'lte' as const },
  avg_task_completion_rate: { target: 0.95, direction: 'gte' as const },
  avg_blocker_count: { target: 1.5, direction: 'lte' as const },
  avg_completion_marker_success_rate: { target: 0.95, direction: 'gte' as const },
  avg_verification_failures_found: { target: 1.0, direction: 'lte' as const },
  archival_success_rate: { target: 0.99, direction: 'gte' as const },
  avg_user_rating: { target: 7.0, direction: 'gte' as const },
} as const;
