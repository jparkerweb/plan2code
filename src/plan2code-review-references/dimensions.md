# Dimension Checklists
> Part of plan2code-review — loaded during Step 3 (Analyze).

Non-obvious check items, anti-patterns, and "don't flag" guidance for each review dimension. Focus on what LLMs commonly miss.

---

## 1. Correctness

1. Trace variable mutations through async paths — can a value change between check and use?
2. Check type coercion at boundaries — string-to-number, truthy/falsy assumptions on `0`/`""`/`false`
3. Check that map/filter/reduce callbacks handle all element shapes (null members, missing keys)
4. Verify copy operations produce deep copies when mutation independence is required
5. Check array bounds — does code handle empty arrays and out-of-range indices?
6. Verify regex patterns reject edge cases (empty string, special chars, Unicode)
7. Check for race conditions — shared mutable state across async reads/writes
8. Verify error handling paths return/throw correctly — no silent swallowing

**Anti-patterns:** `catch(e) {}` silent suppression · `if (value)` when `0`/`""`/`false` are valid · `indexOf > 0` instead of `!== -1` · Mutating arguments instead of returning new values

**Don't flag:** Intentional `==` for null coalescing (`if (x == null)`) · Missing switch default with TypeScript `never` exhaustive check · Optional chaining `?.` returning undefined

---

## 2. Completeness

1. Search for TODO, FIXME, HACK, XXX, TEMP — each must be intentional or tracked
2. Check cleanup/teardown exists for every setup/initialization
3. Verify rollback/undo logic for multi-step operations that can partially fail
4. Check event listeners and subscriptions have corresponding unsubscribe/cleanup
5. Verify all file/resource handles closed in both success and error paths
6. Check all enum/union type values have handling — no missing cases
7. Verify pagination — does code fetch all pages or just the first?
8. Check retry logic has backoff and maximum retry count

**Anti-patterns:** Happy-path-only functions that return undefined on error · Event listeners without cleanup · Missing else in critical chains where the "impossible" case can occur

**Don't flag:** TODOs with linked ticket numbers · Features explicitly "not in scope" · Bare `throw` in catch blocks (intentional re-throw)

---

## 3. Security

1. Check for injection — string concatenation in queries instead of parameterized
2. Search for hardcoded secrets, API keys, tokens in source files and configs
3. Verify sensitive data (passwords, tokens, PII) is not logged, even at debug level
4. Check file path operations prevent traversal — no unsanitized `../` from user input
5. Check for mass assignment — `Object.assign`/spread from user input without allow-list
6. Verify error responses don't leak stack traces, internal paths, or system info
7. Verify session tokens use cryptographic randomness, not `Math.random()`
8. Check dependency versions against known CVEs

**Anti-patterns:** Dynamic code evaluation with user-influenced input · Plaintext password storage · JWT `none` algorithm accepted

**Don't flag:** Hardcoded non-sensitive values (page sizes, route paths) · Internal tools documented as trusted-environment-only · Test fixture credentials in `.test.`/`.fixture.` files

---

## 4. Performance

1. Check for N+1 queries — loops issuing a query per iteration instead of batching
2. Check for synchronous blocking in async contexts (fs.readFileSync in server request handlers)
3. Check for memory leaks — growing arrays/maps without bounds, unclosed streams
4. Check for quadratic complexity — nested iterations over the same collection
5. Verify bulk operations used where available (bulk insert vs individual)
6. Check regex for catastrophic backtracking potential (nested quantifiers)
7. Verify connection pools for database and HTTP clients, not per-request connections
8. Check event handlers debounced/throttled for high-frequency events

**Anti-patterns:** `await` in `for` loops instead of `Promise.all` · Loading entire tables to filter in app code · New regex instances inside loops

**Don't flag:** `readFileSync` at startup/module load · Loading small files (<100KB) once · Missing caching in one-shot scripts/CLI tools

---

## 5. Standards

1. Check function length — functions over 50 lines warrant scrutiny
2. Verify DRY applied judiciously — shared logic extracted, not over-abstracted
3. Check magic numbers/strings are extracted to named constants
4. Verify comments explain "why" not "what"
5. Check file organization matches project conventions
6. Verify consistent async/await vs callbacks vs promises within a module
7. Check naming conventions consistent (camelCase, snake_case, PascalCase)
8. Verify linting rules not disabled without justification

**Anti-patterns:** Mixed naming conventions in one module · God objects/functions · Deep nesting (>3 levels) instead of early returns

**Don't flag:** Framework-imposed patterns · Single-use helpers for readability · Comments on complex algorithms/regex

---

## 6. Tech Debt

1. Check for deprecated API usage — verify against current library versions
2. Identify commented-out code blocks — should be removed or tracked
3. Check for copy-paste blocks that could be shared utilities
4. Look for dead feature flags — always true/false with no toggle
5. Check for orphaned files — modules with no imports from the codebase
6. Verify error messages reference current code, not stale names
7. Check for inconsistent abstraction levels — mixing orchestration with low-level ops
8. Look for workarounds with "temporary" comments that persisted

**Anti-patterns:** `TODO: remove after migration` with no date/ticket · Wrapper functions that just forward args · Multiple implementations of the same utility

**Don't flag:** Intentional per-platform duplication · Verbose code prioritizing clarity · Deprecated APIs with tracked migration tickets

---

## 7. Test Quality

1. Check assertions are meaningful — not just `toBeTruthy()` on objects
2. Verify tests are isolated — no shared mutable state between cases
3. Check error case tests actually trigger the error path, not just catch any error
4. Verify async tests properly await results — no fire-and-forget assertions
5. Check for tests that pass for wrong reason — wrong assertion target, always-true conditions
6. Verify mock/stub scope is minimal — only mock what's necessary
7. Check test descriptions describe behavior, not implementation
8. Verify critical paths have coverage — happy path, error path, edge cases

**Anti-patterns:** `expect(fn).not.toThrow()` without checking return value · Mocking the module under test · Assertions in callbacks that may never execute

**Don't flag:** Shared test utility files · Missing tests for generated/scaffolded code · Integration tests using real databases when project prefers it

---

## 8. Maintainability

1. Check cyclomatic complexity — functions with >10 branch paths are hard to maintain
2. Verify dependencies between modules are explicit, not implicit through globals
3. Check for tight coupling — can this module be tested independently?
4. Verify data transformations are traceable — can you follow a value from input to output?
5. Check file length — files over 500 lines warrant scrutiny
6. Verify similar operations use consistent approaches throughout
7. Check boolean parameters are replaced with enums or option objects for clarity
8. Verify function/variable names describe purpose without needing comments

**Anti-patterns:** Functions requiring implementation knowledge to call · Circular dependencies · God files · Stringly-typed APIs

**Don't flag:** Long cohesive files (comprehensive test suites) · Inherently complex domain functions · Coupling between genuinely related modules

---

## 9. Spec Compliance

1. Verify every acceptance criterion has corresponding implementation
2. Check file paths, names, directory structures match spec exactly
3. Verify implementation doesn't add undocumented behavior beyond spec
4. Check all spec-defined edge cases have explicit handling
5. Verify task completion state in phase files matches actual implementation
6. Check integration points match spec contracts
7. Verify function signatures match spec definitions
8. Check data formats match spec (JSON schema, file formats)

**Anti-patterns:** Implementing a "better" approach without raising the divergence · Assuming spec intent on ambiguous points · Marking tasks complete when implementation differs

**Don't flag:** Minor naming variations preserving intent · Defensive coding beyond spec · Details spec leaves to developer judgment

---

## 10. UX/DX

1. Verify error messages are actionable — tell user what to do, not just what went wrong
2. Check empty states have clear messaging — not blank pages or silent failures
3. Verify configuration has sensible defaults — zero-config produces working setup
4. Check breaking changes are communicated — deprecation warnings, migration guides
5. Verify CLI tools have `--help`, consistent flags, meaningful exit codes
6. Check bulk operations provide progress feedback and handle partial failures
7. Verify documentation examples are runnable, not pseudo-code
8. Check loading states exist for operations over 1 second

**Anti-patterns:** Stack traces shown to end users · Required config with no example file · 200 OK with error in body · Silent failures

**Don't flag:** Verbose debug output · Internal tooling with minimal polish · CLI tools requiring initial setup

---

## 11. Improvements

1. Check for manual implementations of standard library functionality
2. Identify error-prone patterns replaceable with safer abstractions
3. Look for synchronous operations that could be parallelized
4. Identify complex conditionals clearer as lookup tables or strategy patterns
5. Check for hardcoded limits that should be configurable
6. Look for opportunities to improve test coverage on critical paths
7. Identify documentation gaps — undocumented public APIs
8. Check for opportunities to use newer language features improving clarity

**Anti-patterns:** Rewrites for aesthetic reasons · Patterns from different ecosystems · Optimizations without evidence of problems · Premature DRY abstractions

**Don't flag:** Correct code written differently than you'd write it · Performance appropriate for actual load · Features tracked in backlog
