import {
  applyPatch,
  structuredPatch,
  type StructuredPatch,
  type StructuredPatchHunk,
} from "diff";

export interface AiProposalHunk extends StructuredPatchHunk {
  id: string;
  accepted: boolean;
}

export interface AiProposal {
  id: string;
  baseSource: string;
  baseSourceHash: string;
  proposedSource: string;
  hunks: AiProposalHunk[];
  createdAt: string;
}

export function sourceHash(source: string): string {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function createId(): string {
  return globalThis.crypto?.randomUUID() ?? `proposal-${Date.now()}`;
}

export function createAiProposal(
  baseSource: string,
  proposedSource: string,
): AiProposal {
  const patch = structuredPatch(
    "current.dbml",
    "proposed.dbml",
    baseSource,
    proposedSource,
    undefined,
    undefined,
    { context: 1 },
  );

  return {
    id: createId(),
    baseSource,
    baseSourceHash: sourceHash(baseSource),
    proposedSource,
    hunks: patch.hunks.map((hunk, index) => ({
      ...hunk,
      id: `hunk-${index + 1}`,
      accepted: true,
    })),
    createdAt: new Date().toISOString(),
  };
}

export function setProposalHunkAccepted(
  proposal: AiProposal,
  hunkId: string,
  accepted: boolean,
): AiProposal {
  return {
    ...proposal,
    hunks: proposal.hunks.map((hunk) =>
      hunk.id === hunkId ? { ...hunk, accepted } : hunk,
    ),
  };
}

export function isProposalStale(
  proposal: AiProposal,
  currentSource: string,
): boolean {
  return proposal.baseSourceHash !== sourceHash(currentSource);
}

export function resolveAiProposal(
  proposal: AiProposal,
  currentSource: string,
): string {
  if (isProposalStale(proposal, currentSource)) {
    throw new Error("AI proposal is stale.");
  }

  const acceptedHunks = proposal.hunks
    .filter((hunk) => hunk.accepted)
    .map((hunk) => ({
      oldStart: hunk.oldStart,
      oldLines: hunk.oldLines,
      newStart: hunk.newStart,
      newLines: hunk.newLines,
      lines: hunk.lines,
    }));
  if (acceptedHunks.length === 0) return currentSource;

  const patch: StructuredPatch = {
    oldFileName: "current.dbml",
    newFileName: "proposed.dbml",
    oldHeader: undefined,
    newHeader: undefined,
    hunks: acceptedHunks,
  };
  const result = applyPatch(currentSource, patch);
  if (result === false) throw new Error("Unable to apply AI proposal.");
  return result;
}
