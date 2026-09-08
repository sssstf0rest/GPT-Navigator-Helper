# Task plan

## Objective
Implement the agreed risk-first extension plan. Deliver the compatibility probe and first working MV3 capture → branch-aware index → prompt sidebar → verified historical jump, with a real-browser fixture suite. Live compatibility must be reported separately.

## Assessment phases (completed)
1. Read the prompt and inspect repository context — complete.
2. Inspect reference implementations and current primary browser/tooling documentation — complete.
3. Assess feasibility, architecture gaps, and development/testing gates — complete.
4. Deliver a cited assessment and revised implementation brief — complete.

## Implementation phases
1. Check browser/runtime and establish compatibility evidence — complete (live check pending access).
2. Scaffold MV3/TypeScript/CRXJS and implement bounded page capture, route bridge, and domain model — complete.
3. Implement mounted registry, cancellable search/verification, and minimal sidebar — complete.
4. Build virtualized browser fixtures; test complete extension and fix failures — complete (14 unit tests and 20 browser tests passed).
5. Document installation, diagnostics, supported/unknown behavior, and next live gate — complete.

## Next development gate
Run the prototype against a user-selected authenticated long ChatGPT conversation. This gate remains open because no connected authenticated conversation is available. Do not label production compatibility verified or implement speculative authenticated backfill to bypass this evidence gap.

## Decisions
- Distinguish verified reference behavior from assumptions about the current authenticated ChatGPT application.
- Prioritize proving full-conversation acquisition and navigation to unmounted targets before UI polish.
- The user approved implementation after the assessment. Keep publication out of scope.
- Recommend risk-first vertical slices, with testing beginning at the first feasibility spike.
- Keep the prompt's Vite/CRXJS direction, but explicitly require a synchronous document_start MAIN-world hook bundle.
- No unconditional universal-navigation claim: distinguish supported, partial, unavailable, ambiguous, and timed-out states.

## Errors encountered
- Reused-container browser regression correctly returned source-incomplete after a page edit; the test expected not-reachable. Updated the assertion to the intended explicit failure category.
- Added timing extraction initially used innerText on a closed details element, yielding empty JSON despite successful jumps; changed the test collector to textContent and an explicit data-ready assertion.
- TypeScript 7 narrowed HTMLElement.matches('article') false branch to never; changed the ancestor boundary check to tagName.
- Playwright browser download hit connection resets and 30-second timeouts; retrying with a longer per-download connection timeout while fixture work proceeds.
- Browser download succeeded with the longer timeout. Initial 14 real-extension browser tests passed.
- Live-tail unit case exposed an invalid test fixture reusing the original node alias; corrected the fixture to represent a truly distinct old-branch node. Explicit DOM message IDs now outrank container aliases.
- Implementation discovery: a glob search encountered no matching AGENTS file; repository inventory was checked separately. A zsh unmatched /tmp glob was replaced by a bounded directory inventory; the Luna clone source prefix is being located before further reads.
- Initial file discovery returned exit 1 because no matching repository files were found; inspect the directory and git status separately.
- One browser fetch of a Toolkit source permalink failed; use the repository-relative path verified by the source reviewer instead of assuming a src/ prefix.
