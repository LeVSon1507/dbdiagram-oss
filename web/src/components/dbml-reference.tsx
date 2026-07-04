"use client";

import { Check, Copy, ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";

interface DbmlReferenceItem {
  title: string;
  keywords: string[];
  description: string;
  example: string;
}

const DBML_REFERENCE: DbmlReferenceItem[] = [
  {
    title: "Project",
    keywords: ["Project", "database_type", "Note"],
    description: "Khai báo metadata và loại database của project.",
    example: `Project ecommerce {
  database_type: 'PostgreSQL'
  Note: 'E-commerce database'
}`,
  },
  {
    title: "Table, schema và alias",
    keywords: ["Table", "as", "headercolor", "note"],
    description:
      "Tạo bảng trong public hoặc schema riêng, đặt alias và màu header.",
    example: `Table auth.users as U [headercolor: #7c3aed] {
  id bigint [pk, increment]
  email varchar(255) [not null, unique]
  Note: 'Application users'
}`,
  },
  {
    title: "Column settings",
    keywords: [
      "pk",
      "primary key",
      "null",
      "not null",
      "unique",
      "increment",
      "default",
      "check",
      "note",
      "ref",
    ],
    description:
      "Thiết lập khóa, nullability, default, validation và quan hệ ngay trên cột.",
    example: `Table products {
  id bigint [pk, increment]
  sku varchar(64) [not null, unique]
  price decimal(12,2) [not null, check: \`price >= 0\`]
  active boolean [default: true]
  created_at timestamp [default: \`now()\`]
}`,
  },
  {
    title: "Indexes",
    keywords: ["indexes", "name", "type", "btree", "hash", "unique", "pk"],
    description:
      "Tạo index đơn, composite, expression, unique hoặc composite primary key.",
    example: `Table orders {
  tenant_id bigint
  order_no varchar
  created_at timestamp

  indexes {
    (tenant_id, order_no) [unique, name: 'uq_order_no']
    created_at [type: btree]
    (\`lower(order_no)\`)
  }
}`,
  },
  {
    title: "Checks",
    keywords: ["checks", "check", "name"],
    description: "Khai báo constraint kiểm tra một hoặc nhiều cột.",
    example: `Table accounts {
  balance decimal
  credit_limit decimal

  checks {
    \`balance >= -credit_limit\` [name: 'chk_credit_limit']
  }
}`,
  },
  {
    title: "Relationships",
    keywords: [
      "Ref",
      "<",
      ">",
      "-",
      "<>",
      "delete",
      "update",
      "cascade",
      "restrict",
      "set null",
      "set default",
      "no action",
      "inactive",
      "color",
    ],
    description:
      "Tạo quan hệ 1-N, N-1, 1-1, N-N và cấu hình hành động foreign key.",
    example: `Ref fk_posts_user: posts.user_id > users.id [
  delete: cascade
  update: no action
  color: #7c3aed
]`,
  },
  {
    title: "Enum",
    keywords: ["Enum", "note"],
    description: "Định nghĩa tập giá trị dùng làm kiểu dữ liệu cho cột.",
    example: `Enum order_status {
  pending [note: 'Waiting for payment']
  paid
  cancelled
}`,
  },
  {
    title: "TablePartial",
    keywords: ["TablePartial", "~"],
    description:
      "Tái sử dụng fields, settings và indexes giữa nhiều bảng.",
    example: `TablePartial timestamps {
  created_at timestamp [default: \`now()\`]
  updated_at timestamp [default: \`now()\`]
}

Table users {
  id bigint [pk]
  ~timestamps
}`,
  },
  {
    title: "Sample records",
    keywords: ["Records", "records", "null", "true", "false"],
    description: "Gắn dữ liệu mẫu dạng CSV vào bảng để làm tài liệu.",
    example: `records users(id, name, active) {
  1, 'Alice', true
  2, 'Bob', false
  3, 'Guest', null
}`,
  },
  {
    title: "Notes",
    keywords: ["Note", "note"],
    description:
      "Thêm mô tả cho project, bảng, cột, index hoặc sticky note trên diagram.",
    example: `Note architecture_note [color: #F4D03F] {
  '''
  Authentication tables are isolated
  in the auth schema.
  '''
}`,
  },
  {
    title: "TableGroup",
    keywords: ["TableGroup", "Note", "note", "color"],
    description: "Nhóm các bảng theo domain để diagram dễ đọc hơn.",
    example: `TableGroup identity [color: #7c3aed] {
  users
  roles
  permissions
  Note: 'Identity and access management'
}`,
  },
  {
    title: "DiagramView",
    keywords: [
      "DiagramView",
      "Tables",
      "Notes",
      "TableGroups",
      "Schemas",
      "*",
    ],
    description:
      "Tạo view chỉ hiển thị những schema, bảng, group hoặc note cần thiết.",
    example: `DiagramView auth_view {
  Tables {
    auth.users
    auth.roles
  }
  TableGroups { identity }
  Notes { architecture_note }
}`,
  },
  {
    title: "Comments và strings",
    keywords: ["//", "/* */", "''' '''", "' '", '" "', "` `"],
    description:
      "Comment một/nhiều dòng, quote identifier, string và SQL expression.",
    example: `// Single-line comment
/*
  Multi-line comment
*/
Note: '''
  Multi-line documentation
'''
created_at timestamp [default: \`now()\`]`,
  },
  {
    title: "Module system",
    keywords: [
      "use",
      "reuse",
      "from",
      "as",
      "table",
      "enum",
      "tablepartial",
      "schema",
      "tablegroup",
    ],
    description:
      "Chia DBML thành nhiều file. Tính năng này dành cho workflow DBML CLI nhiều file.",
    example: `use * from './auth'

use {
  table users as auth_users
  enum user_status
} from './identity'

reuse * from './shared'`,
  },
];

export function filterDbmlReference(query: string): DbmlReferenceItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return DBML_REFERENCE;

  return DBML_REFERENCE.filter((item) =>
    [item.title, item.description, ...item.keywords]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );
}

export function DbmlReference() {
  const [query, setQuery] = useState("");
  const [copiedTitle, setCopiedTitle] = useState<string>();
  const [copyError, setCopyError] = useState(false);
  const items = useMemo(() => filterDbmlReference(query), [query]);

  const copyExample = async (item: DbmlReferenceItem) => {
    try {
      await navigator.clipboard.writeText(item.example);
      setCopiedTitle(item.title);
      setCopyError(false);
      window.setTimeout(() => setCopiedTitle(undefined), 1600);
    } catch {
      setCopyError(true);
    }
  };

  return (
    <section className="dbml-reference">
      <label className="dbml-reference__search">
        <Search />
        <input
          aria-label="Search DBML reference"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search keyword…"
          type="search"
          value={query}
        />
      </label>
      <div className="dbml-reference__meta">
        <span>{items.length} syntax groups</span>
        <a
          href="https://dbml.dbdiagram.io/docs/"
          rel="noreferrer"
          target="_blank"
        >
          Official docs
          <ExternalLink />
        </a>
      </div>
      {copyError ? (
        <p className="dbml-reference__error">
          Clipboard is unavailable. Select the example and copy manually.
        </p>
      ) : null}
      <div className="dbml-reference__list">
        {items.map((item) => (
          <details className="dbml-reference__item" key={item.title}>
            <summary>
              <span>{item.title}</span>
              <small>{item.keywords.slice(0, 3).join(" · ")}</small>
            </summary>
            <div className="dbml-reference__content">
              <p>{item.description}</p>
              <div className="dbml-reference__keywords">
                {item.keywords.map((keyword) => (
                  <code key={keyword}>{keyword}</code>
                ))}
              </div>
              <div className="dbml-reference__example-heading">
                <span>Example</span>
                <button onClick={() => void copyExample(item)} type="button">
                  {copiedTitle === item.title ? <Check /> : <Copy />}
                  {copiedTitle === item.title ? "Copied" : "Copy"}
                </button>
              </div>
              <pre>
                <code>{item.example}</code>
              </pre>
            </div>
          </details>
        ))}
        {items.length === 0 ? (
          <p className="dbml-reference__empty">
            No keyword matches “{query}”.
          </p>
        ) : null}
      </div>
    </section>
  );
}
