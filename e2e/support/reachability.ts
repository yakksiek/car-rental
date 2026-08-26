// core
import type { Locator, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// "Can the admin actually READ this?" — the two measurements `toBeVisible()`
// cannot make, plus the scroll precondition that gives them something to see.
//
// Extracted here in phase 11 of invite-journey-fixes, from
// `staff-admin.spec.ts` where phases 9 and 10 wrote them module-locally. The
// alternative the plan named was duplicating them into `fleet-admin.spec.ts`;
// moving won because these are the DEFINITION of the defect this change keeps
// finding on one surface after another, and two copies can drift into two
// definitions. The move is mechanical — same bodies, same semantics.
//
// Why both halves are always asserted together: an element scrolled off-screen
// and an element buried under a fixed overlay are different failures with the
// same symptom, and each check is blind to the other. Measured on the two
// surfaces this change touched:
//
//   staff  removeEmployee failure, 390×844, scrollY 1298 → top -1033, hit null
//   staff  resetPassword success,  390×844, scrollY  689 → top  -424, hit null
//   fleet  restore failure,        390×844, scrollY 1186 → top  -879, hit null
//
// `toBeVisible()` passed on every one of those.
// ---------------------------------------------------------------------------

/**
 * Does this element actually receive the pixel at the middle of itself?
 *
 * `elementFromPoint` answers with whatever the compositor puts on top, so an
 * element buried under a fixed overlay fails here while passing `toBeVisible()`.
 * Children count — an error row wraps an icon and a text node.
 */
export async function isTopmostAtItsOwnCentre(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return hit !== null && (hit === el || el.contains(hit));
  });
}

/**
 * Is this element inside the viewport at all?
 *
 * The half `isTopmostAtItsOwnCentre` cannot see. When an element is scrolled
 * off-screen, `elementFromPoint` at its centre returns `null` — the point is not
 * covered by something else, it is outside the document's visible box entirely.
 * So "topmost" alone cannot distinguish "readable" from "nowhere near the
 * screen".
 */
export async function isInViewport(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return box.top >= 0 && box.bottom <= window.innerHeight && box.left >= 0 && box.right <= window.innerWidth;
  });
}

/**
 * Scroll the page to the bottom, where the per-row controls still are, and
 * report where it landed. A spec asserting reachability has to prove the page
 * moved first — at a scroll depth of 0 the assertions pass whether or not the
 * fix exists.
 */
export async function scrollToBottom(page: Page): Promise<number> {
  return page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
    return Math.round(window.scrollY);
  });
}
