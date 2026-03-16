## Phase 2 Post-Completion Cleanup

### 1. Link circle UX refinement
Only right (output) circle should appear on initial hover. After clicking, input circles (left side) on all other boxes should appear/highlight. Current CSS approach may need JS state tracking for full "linking mode" behavior beyond what SVAR's `.wx-target` class provides.

### 2. Delete key for dependency deletion
Clicking a dependency shows an 'x' icon (works). Delete/Backspace key should also delete the selected dependency. Needs investigation into whether SVAR fires `delete-link` on keypress natively, or if a manual keydown listener + selected-link tracking is needed.
