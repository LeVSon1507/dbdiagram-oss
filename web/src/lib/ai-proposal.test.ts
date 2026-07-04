import { describe, expect, it } from "vitest";

import {
  createAiProposal,
  isProposalStale,
  resolveAiProposal,
  setProposalHunkAccepted,
} from "./ai-proposal";

const base = `Table users {
  id bigint [pk]
  email varchar
}

Table posts {
  id bigint [pk]
  title varchar
}
`;

const proposed = `Table users {
  id bigint [pk]
  email varchar [not null, unique]
}

Table posts {
  id bigint [pk]
  title varchar(240) [not null]
}
`;

describe("AI proposals", () => {
  it("creates line hunks and applies all by default", () => {
    const proposal = createAiProposal(base, proposed);

    expect(proposal.hunks.length).toBeGreaterThan(0);
    expect(resolveAiProposal(proposal, base)).toBe(proposed);
  });

  it("accepts and rejects individual hunks", () => {
    let proposal = createAiProposal(base, proposed);
    expect(proposal.hunks).toHaveLength(2);
    proposal = setProposalHunkAccepted(
      proposal,
      proposal.hunks[1].id,
      false,
    );

    const result = resolveAiProposal(proposal, base);
    expect(result).toContain("email varchar [not null, unique]");
    expect(result).toContain("title varchar\n");
  });

  it("returns the base when all hunks are rejected", () => {
    let proposal = createAiProposal(base, proposed);
    proposal.hunks.forEach((hunk) => {
      proposal = setProposalHunkAccepted(proposal, hunk.id, false);
    });
    expect(resolveAiProposal(proposal, base)).toBe(base);
  });

  it("rejects stale proposals", () => {
    const proposal = createAiProposal(base, proposed);
    const current = `${base}\n// edited`;

    expect(isProposalStale(proposal, current)).toBe(true);
    expect(() => resolveAiProposal(proposal, current)).toThrow(
      "AI proposal is stale.",
    );
  });
});
