import {
  snippetCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { StreamLanguage, type StringStream } from "@codemirror/language";

const KEYWORDS = [
  "Table",
  "TableGroup",
  "Ref",
  "Enum",
  "Project",
  "Note",
  "indexes",
];

const FIELD_SETTINGS = [
  "pk",
  "not null",
  "unique",
  "increment",
  "default",
  "note",
  "ref",
];

const DATA_TYPES = [
  "bigint",
  "integer",
  "varchar",
  "text",
  "boolean",
  "decimal",
  "date",
  "timestamp",
  "json",
  "uuid",
];

interface DbmlModeState {
  inBlockComment: boolean;
}

export const dbmlLanguage = StreamLanguage.define<DbmlModeState>({
  startState: () => ({ inBlockComment: false }),
  token(stream: StringStream, state: DbmlModeState): string | null {
    if (state.inBlockComment) {
      if (stream.skipTo("*/")) {
        stream.match("*/");
        state.inBlockComment = false;
      } else {
        stream.skipToEnd();
      }
      return "comment";
    }

    if (stream.eatSpace()) return null;
    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match("/*")) {
      state.inBlockComment = true;
      return "comment";
    }
    if (stream.match(/^'(?:[^'\\]|\\.)*'/)) return "string";
    if (stream.match(/^`(?:[^`\\]|\\.)*`/)) return "string";
    if (stream.match(/^#[0-9a-fA-F]{6}\b/)) return "color";
    if (stream.match(/^-?\d+(?:\.\d+)?/)) return "number";
    if (stream.match(/^(?:TableGroup|Table|Ref|Enum|Project|Note|indexes)\b/)) {
      return "keyword";
    }
    if (
      stream.match(
        /^(?:pk|primary key|not null|null|unique|increment|default|note|ref|headercolor)\b/i,
      )
    ) {
      return "propertyName";
    }
    if (
      stream.match(
        /^(?:bigint|integer|int|varchar|text|boolean|decimal|date|timestamp|json|uuid)\b/i,
      )
    ) {
      return "typeName";
    }
    if (stream.match(/^[A-Za-z_][\w.]*/)) return "variableName";
    stream.next();
    return null;
  },
});

function tableNames(source: string): string[] {
  return [...source.matchAll(/\bTable\s+(?:"([^"]+)"|([A-Za-z_][\w.]*))/g)]
    .map((match) => match[1] ?? match[2])
    .filter((name): name is string => Boolean(name));
}

export function dbmlCompletionOptions(source: string): Completion[] {
  const dynamicTables: Completion[] = tableNames(source).map((name) => ({
    label: name,
    type: "class",
    detail: "table",
    boost: 90,
  }));

  return [
    snippetCompletion("Table ${name} {\n  id bigint [pk, increment]\n  ${}\n}", {
      label: "Table",
      type: "keyword",
      detail: "table block",
      boost: 120,
    }),
    snippetCompletion("Ref: ${table.field} > ${table.field}", {
      label: "Ref",
      type: "keyword",
      detail: "many-to-one relation",
      boost: 115,
    }),
    snippetCompletion("Enum ${name} {\n  ${value}\n}", {
      label: "Enum",
      type: "keyword",
      detail: "enum block",
      boost: 110,
    }),
    ...dynamicTables,
    ...KEYWORDS.map((label) => ({
      label,
      type: "keyword",
    })),
    ...FIELD_SETTINGS.map((label) => ({
      label,
      type: "property",
      detail: "field setting",
    })),
    ...DATA_TYPES.map((label) => ({
      label,
      type: "type",
      detail: "data type",
    })),
  ];
}

export function dbmlCompletionSource(
  context: CompletionContext,
): CompletionResult | null {
  const word = context.matchBefore(/[\w.]*/);
  if (!word || (!context.explicit && word.from === word.to)) return null;

  return {
    from: word.from,
    options: dbmlCompletionOptions(context.state.doc.toString()),
    validFor: /^[\w.]*$/,
  };
}
