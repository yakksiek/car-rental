// core
import { describe, expect, it } from "vitest";

// others
import { damagePhotoPath, pdfPath, photoPath, signaturePath } from "./storage";

// S-05 backward-compat guard. `storage.ts` re-points its path builders at the
// shared `protocol-storage-paths` module with `kind` bound to 'issue' (S-06). The
// shipped issue flow (ProtocolForm) calls these two/one-arg wrappers, so a
// regression in the indirection — a wrong bound kind, a swapped arg — must not
// silently change the byte paths S-05 already wrote to storage. These assert the
// exact strings S-05 shipped, independent of the module's own kind-aware tests.

const ID = "11111111-1111-1111-1111-111111111111";

describe("storage.ts issue path wrappers (S-05 backward-compat)", () => {
  it("keeps the exact issue/ object keys the issue flow has always produced", () => {
    expect(photoPath(ID, "front")).toBe(`issue/${ID}/photo-front.jpg`);
    expect(photoPath(ID, "dashboard")).toBe(`issue/${ID}/photo-dashboard.jpg`);
    expect(damagePhotoPath(ID, "d1", 2)).toBe(`issue/${ID}/damage-d1-2.jpg`);
    expect(signaturePath(ID)).toBe(`issue/${ID}/signature.png`);
    expect(pdfPath(ID)).toBe(`issue/${ID}/protocol.pdf`);
  });
});
