export interface Point {
  x: number;
  y: number;
}

export interface DiagramDocument {
  id: string;
  name: string;
  source: string;
  positions: Record<string, Point>;
  updatedAt: string;
}

export type Theme = "light" | "dark";

export interface Workspace {
  currentDocumentId: string;
  documents: DiagramDocument[];
  theme: Theme;
}

export const LEGACY_STORAGE_KEY = "dbdiagram-local.workspace.v1";

export const SAMPLE_SOURCE = `Project personal_blog {
  database_type: 'PostgreSQL'
  Note: 'A local-first database design'
}

Table users [headercolor: #8e6a3f] {
  id bigint [pk, increment]
  email varchar(255) [not null, unique]
  display_name varchar(120)
  created_at timestamp [not null, default: \`now()\`]
}

Table posts [headercolor: #648a5d] {
  id bigint [pk, increment]
  author_id bigint [not null]
  title varchar(240) [not null]
  body text
  status post_status [not null, default: 'draft']
  published_at timestamp
}

Table comments [headercolor: #9a856c] {
  id bigint [pk, increment]
  post_id bigint [not null]
  author_id bigint [not null]
  body text [not null]
  created_at timestamp [not null, default: \`now()\`]
}

Enum post_status {
  draft
  published
  archived
}

Ref: posts.author_id > users.id
Ref: comments.post_id > posts.id
Ref: comments.author_id > users.id
`;

function createId(): string {
  return globalThis.crypto?.randomUUID() ?? `diagram-${Date.now()}`;
}

export function createDocument(
  name = "Untitled diagram",
  source = SAMPLE_SOURCE,
): DiagramDocument {
  return {
    id: createId(),
    name,
    source,
    positions: {},
    updatedAt: new Date().toISOString(),
  };
}

export function createWorkspace(): Workspace {
  const document = createDocument("Personal blog");
  return {
    currentDocumentId: document.id,
    documents: [document],
    theme: "dark",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPoint(value: unknown): value is Point {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number"
  );
}

function isDocument(value: unknown): value is DiagramDocument {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.source === "string" &&
    typeof value.updatedAt === "string" &&
    isRecord(value.positions) &&
    Object.values(value.positions).every(isPoint)
  );
}

export function isWorkspace(value: unknown): value is Workspace {
  return (
    isRecord(value) &&
    typeof value.currentDocumentId === "string" &&
    Array.isArray(value.documents) &&
    value.documents.length > 0 &&
    value.documents.every(isDocument) &&
    (value.theme === "light" || value.theme === "dark") &&
    value.documents.some(
      (document) => document.id === value.currentDocumentId,
    )
  );
}

export function readLegacyWorkspace(storage: Storage): Workspace | undefined {
  const raw = storage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return undefined;

  try {
    const value: unknown = JSON.parse(raw);
    return isWorkspace(value) ? value : undefined;
  } catch {
    return undefined;
  }
}
