import { describe, it, expect } from 'vitest';
import { validateEdit, parseProposalFromResponse } from './improver.js';
import type { PromptEdit } from './types.js';

// ── Shared fixtures ───────────────────────────────────────────────────────────

const PROMPT_CONTENTS: Record<string, string> = {
  'plan2code-1-plan.md': 'This is the plan prompt content. It has some text here.',
  'plan2code-2-document.md': 'Document prompt with repeated text. repeated text. Done.',
  'plan2code-3-implement.md': 'Implement prompt content.',
};

function makeEdit(overrides: Partial<PromptEdit> = {}): PromptEdit {
  return {
    file: 'plan2code-1-plan.md',
    rationale: 'test rationale',
    expected_metric_impact: 'test impact',
    char_count_before: PROMPT_CONTENTS['plan2code-1-plan.md'].length,
    char_count_after: PROMPT_CONTENTS['plan2code-1-plan.md'].length,
    char_count_delta: 0,
    old_text: 'some text',
    new_text: 'better text',
    ...overrides,
  };
}

// ── validateEdit() ────────────────────────────────────────────────────────────

describe('validateEdit', () => {
  it('valid edit passes with no errors', () => {
    const result = validateEdit(makeEdit(), PROMPT_CONTENTS);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects path traversal (../ in file path)', () => {
    const result = validateEdit(makeEdit({ file: '../etc/passwd' }), PROMPT_CONTENTS);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/path traversal/i);
  });

  it('rejects absolute paths', () => {
    const result = validateEdit(makeEdit({ file: '/etc/passwd' }), PROMPT_CONTENTS);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/path traversal|absolute/i);
  });

  it('errors when file not found in promptContents', () => {
    const result = validateEdit(makeEdit({ file: 'nonexistent.md' }), PROMPT_CONTENTS);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/not found/i);
  });

  it('errors when old_text not found in file content', () => {
    const result = validateEdit(makeEdit({ old_text: 'hallucinated text' }), PROMPT_CONTENTS);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/not found verbatim/i);
  });

  it('warns when old_text appears multiple times', () => {
    const edit = makeEdit({
      file: 'plan2code-2-document.md',
      old_text: 'repeated text',
      char_count_before: PROMPT_CONTENTS['plan2code-2-document.md'].length,
      char_count_after: PROMPT_CONTENTS['plan2code-2-document.md'].length,
    });
    const result = validateEdit(edit, PROMPT_CONTENTS);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => /appears.*times/i.test(w))).toBe(true);
  });

  it('errors when edit would exceed 11,500 char limit', () => {
    const bigText = 'x'.repeat(12_000);
    const edit = makeEdit({ new_text: bigText });
    const result = validateEdit(edit, PROMPT_CONTENTS);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /exceed.*11.?500/i.test(e))).toBe(true);
  });

  it('warns when reported char counts diverge from actual (>10 chars off)', () => {
    const edit = makeEdit({
      char_count_before: 999,
      char_count_after: 999,
    });
    const result = validateEdit(edit, PROMPT_CONTENTS);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => /char_count_before.*differs/i.test(w))).toBe(true);
  });
});

// ── parseProposalFromResponse() ───────────────────────────────────────────────

describe('parseProposalFromResponse', () => {
  const sampleEdit = {
    file: 'test.md',
    rationale: 'r',
    expected_metric_impact: 'e',
    char_count_before: 100,
    char_count_after: 110,
    char_count_delta: 10,
    old_text: 'old',
    new_text: 'new',
  };

  it('parses JSON from markdown code block (```json ... ```)', () => {
    const response = `Here is my proposal:\n\n\`\`\`json\n${JSON.stringify([sampleEdit])}\n\`\`\`\n\nDone.`;
    const result = parseProposalFromResponse(response);
    expect(result).toHaveLength(1);
    expect(result![0].file).toBe('test.md');
  });

  it('parses JSON from bare code block (``` ... ```)', () => {
    const response = `Proposal:\n\n\`\`\`\n${JSON.stringify([sampleEdit])}\n\`\`\``;
    const result = parseProposalFromResponse(response);
    expect(result).toHaveLength(1);
    expect(result![0].old_text).toBe('old');
  });

  it('parses bare JSON array with old_text field', () => {
    const response = `Some preamble\n${JSON.stringify([sampleEdit])}\nSome postamble`;
    const result = parseProposalFromResponse(response);
    expect(result).toHaveLength(1);
  });

  it('returns null for non-JSON response', () => {
    const result = parseProposalFromResponse('No changes needed at this time.');
    expect(result).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    const result = parseProposalFromResponse('```json\n{broken json]\n```');
    expect(result).toBeNull();
  });

  it('returns null for empty response', () => {
    const result = parseProposalFromResponse('');
    expect(result).toBeNull();
  });
});
