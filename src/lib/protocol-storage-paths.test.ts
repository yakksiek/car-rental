// core
import { describe, expect, it } from "vitest";

// others
import {
  damagePhotoPath,
  isValidObjectPath,
  objectFolder,
  pdfPath,
  photoPath,
  signaturePath,
} from "./protocol-storage-paths";

const ID = "11111111-1111-1111-1111-111111111111";

describe("protocol-storage-paths", () => {
  it.each(["issue", "return"] as const)("keys every builder under <%s>/<protocolId>/", (kind) => {
    const folder = `${kind}/${ID}/`;
    expect(objectFolder(kind, ID)).toBe(folder);
    expect(photoPath(kind, ID, "front")).toBe(`${folder}photo-front.jpg`);
    expect(damagePhotoPath(kind, ID, "d1", 2)).toBe(`${folder}damage-d1-2.jpg`);
    expect(signaturePath(kind, ID)).toBe(`${folder}signature.png`);
    expect(pdfPath(kind, ID)).toBe(`${folder}protocol.pdf`);
  });

  it("preserves the issue prefix exactly as S-05 shipped it", () => {
    expect(photoPath("issue", ID, "dashboard")).toBe(`issue/${ID}/photo-dashboard.jpg`);
    expect(signaturePath("issue", ID)).toBe(`issue/${ID}/signature.png`);
    expect(pdfPath("issue", ID)).toBe(`issue/${ID}/protocol.pdf`);
  });

  it("accepts a path the builders produce for the same kind + protocol", () => {
    expect(isValidObjectPath("return", ID, signaturePath("return", ID))).toBe(true);
    expect(isValidObjectPath("return", ID, photoPath("return", ID, "left"))).toBe(true);
    expect(isValidObjectPath("return", ID, pdfPath("return", ID))).toBe(true);
  });

  it("rejects a path under the wrong kind — the return guard must not accept an issue/ path", () => {
    expect(isValidObjectPath("return", ID, `issue/${ID}/signature.png`)).toBe(false);
    expect(isValidObjectPath("issue", ID, `return/${ID}/signature.png`)).toBe(false);
  });

  it("rejects a path pointing at another protocol's folder", () => {
    const other = "99999999-9999-9999-9999-999999999999";
    expect(isValidObjectPath("return", ID, `return/${other}/signature.png`)).toBe(false);
  });

  it("rejects a sibling folder whose name has this id as a strict prefix (trailing-slash boundary)", () => {
    // `startsWith` without the trailing slash would accept these; objectFolder
    // appends "/", so it must not. This pins that boundary against a refactor.
    expect(isValidObjectPath("return", ID, `return/${ID}-evil/signature.png`)).toBe(false);
    expect(isValidObjectPath("return", ID, `return/${ID}extra/signature.png`)).toBe(false);
    expect(isValidObjectPath("return", ID, `return/${ID}`)).toBe(false);
  });
});
