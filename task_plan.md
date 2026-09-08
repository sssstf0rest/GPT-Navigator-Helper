# Live native helper investigation

## Current objective
Diagnose and fix the user-reported missing native navigator on the existing helper branch, using the two authorized open Chrome conversations. Preserve main. Do not infer live compatibility from the fixture.

## Current phases
1. Read live diagnostics and distinguish missing controls from a detector failure — complete.
2. Verify root cause against live page behavior and source; select a bounded remedy — complete: both live host states contain four user turns, fail the native five-turn predicate, and have no older cursor.
3. Implement justified fixes and regression cases — deferred beyond this verification: loading cannot overcome the verified host gate. Source was not changed during the user's computer-access check.
4. Report actual capabilities and limits — complete: detailed evidence in output/native-investigation/live-failure-findings.md.

## New evidence
- Native Computer Use permission works. Both provided Chrome tabs are accessible.
- Both report complete history, one observed batch, four observed user prompts, zero detected native controls, viewport 1470 × 802, and a two-second Prepare run.
- The two tabs report 27 and 89 total messages, respectively. UI is Chinese; detector currently recognizes English Prompt N labels only.
- LLM Terms screenshot confirms no visible rail. Need determine whether four prompts is the true selected history count or capture/counting error, and inspect native display conditions.

---

# Native navigator helper implementation

## Current objective
On the user-approved branch `codex/native-navigator-helper`, build a tryable native navigator helper. Keep the original extension preserved on main. Manual, bounded history preparation; host-owned pagination; native navigator detection; cancellation and reading-position restoration. Save the implementation in a local branch commit; remote publication is out of scope.

## Current phases
1. Create branch and specify smallest viable host integration — complete.
2. Implement metadata-only early hook, cancellable loader, native detection, and compact helper UI — complete.
3. Verify with actual production extension and a paginated/virtualized fixture; review UI — complete: 16 unit/18 browser tests passed; light/dark fixture screenshots inspected.
4. Package trial build and update installation/compatibility documentation — complete: version 0.2.0 unpacked folder and ZIP created and integrity-checked; documentation records exact validation limits.

## Current decisions
- User approved implementing the experimental helper after the investigation. Live access remains optional for completing a trial build, but required before any claim of live compatibility.
- The MAIN hook observes history metadata without retaining prompt text. It increases batch size only during an explicit Prepare operation; ChatGPT consumes its own responses.
- Preserve host virtualization and native navigation. No global matchMedia override, private React state mutation, fabricated history boundary, or replacement navigator.
- New UI starts with manual Prepare, Stop and return, and immediate cancellation on page interaction. Automatic loading is deferred until validated.
- Live conversation URL requested asynchronously while independent development proceeds.

## Current errors and resolutions
- First browser run exposed an asynchronous bridge race: an edge scroll could trigger the first history request before batch expansion was enabled. Added a bounded acknowledgement wait before scrolling.
- Native last-prompt test assumed a top offset under 60px, but browser scroll clamping correctly placed it at 62px. Replaced that arbitrary threshold with viewport and hit-test confirmation of the intended message.

---

# Previous extension task plan (preserved record)

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
