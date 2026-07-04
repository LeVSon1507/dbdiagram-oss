import { describe, expect, it } from "vitest";

import type { DiagramDocument } from "./workspace";
import {
  commitHistory,
  createSessionHistory,
  redoHistory,
  undoHistory,
} from "./session-history";

const document: DiagramDocument = {
  id: "one",
  name: "Example",
  source: "Table users {}",
  positions: {},
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("session history", () => {
  it("coalesces typing within 400 ms", () => {
    const initial = createSessionHistory(document);
    const first = commitHistory(
      initial,
      { ...document, source: "Table users { i }" },
      "typing",
      1000,
    );
    const second = commitHistory(
      first,
      { ...document, source: "Table users { id }" },
      "typing",
      1300,
    );

    expect(second.past).toHaveLength(1);
    expect(undoHistory(second).present.source).toBe("Table users {}");
  });

  it("creates separate checkpoints for typing outside the window and drag", () => {
    let history = createSessionHistory(document);
    history = commitHistory(
      history,
      { ...document, source: "Table users { id int }" },
      "typing",
      1000,
    );
    history = commitHistory(
      history,
      { ...history.present, source: "Table users { id bigint }" },
      "typing",
      1500,
    );
    history = commitHistory(
      history,
      { ...history.present, positions: { users: { x: 10, y: 20 } } },
      "drag",
      1600,
    );

    expect(history.past).toHaveLength(3);
  });

  it("supports undo and redo", () => {
    const changed = commitHistory(
      createSessionHistory(document),
      { ...document, source: "Table accounts {}" },
      "ai",
    );
    const undone = undoHistory(changed);
    const redone = redoHistory(undone);

    expect(undone.present.source).toBe("Table users {}");
    expect(redone.present.source).toBe("Table accounts {}");
  });

  it("keeps at most 100 checkpoints", () => {
    let history = createSessionHistory(document);
    for (let index = 0; index < 105; index += 1) {
      history = commitHistory(
        history,
        { ...history.present, name: `Example ${index}` },
        "rename",
        index * 1000,
      );
    }
    expect(history.past).toHaveLength(100);
  });
});
