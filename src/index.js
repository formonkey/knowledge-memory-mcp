#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

function parseCliArgs(argv) {
  const args = {};

  for (const item of argv) {
    const [key, ...rest] = item.split("=");
    const value = rest.join("=");

    if (key === "--memory-root" && value) {
      args.memoryRoot = value;
    }

    if (key === "--memory-path" && value) {
      args.memoryPath = value;
    }

    if (key === "--project-path" && value) {
      args.projectPath = value;
    }

    if (key === "--global-path" && value) {
      args.globalPath = value;
    }
  }

  return args;
}

const CLI_ARGS = parseCliArgs(process.argv.slice(2));
const GLOBAL_CHANGES_PATH = path.resolve(
  CLI_ARGS.globalPath ||
    process.env.CHANGES_MEMORY_GLOBAL_PATH ||
    path.join(os.homedir(), ".codex", "changes.md")
);
const DEFAULT_PROJECT_PATH = path.resolve(
  CLI_ARGS.projectPath ||
    CLI_ARGS.memoryRoot ||
    process.env.CHANGES_MEMORY_PROJECT_PATH ||
    process.env.CHANGES_MEMORY_ROOT ||
    process.cwd()
);
const DEFAULT_PROJECT_MEMORY_PATH = CLI_ARGS.memoryPath || process.env.CHANGES_MEMORY_PATH || "";
const SERVER_INFO = {
  name: "knowledge-memory-mcp",
  version: "0.1.0"
};
const SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05"
];
const TAG_CATALOG = [
  "api",
  "backend",
  "codex",
  "components",
  "config",
  "database",
  "docker",
  "docs",
  "frontend",
  "git",
  "i18n",
  "json",
  "mcp",
  "migration",
  "mongo",
  "naming",
  "opensearch",
  "performance",
  "security",
  "styles",
  "tests"
];
const TAG_GUIDANCE =
  "Use 2-5 tags from this catalog when possible: " + TAG_CATALOG.join(", ") + ".";
const SERVER_INSTRUCTIONS =
  "Consulta list_change_index antes de implementar, revisar o corregir codigo. Usa add_local para memoria del proyecto y add_global solo cuando el usuario pida guardar un aprendizaje reutilizable transversal. Incluye tags del catalogo al guardar memoria.";

function resolveProjectPath(args = {}) {
  return path.resolve(args.projectPath || DEFAULT_PROJECT_PATH);
}

function globalChangesPath() {
  return GLOBAL_CHANGES_PATH;
}

function projectChangesPath(args = {}) {
  if (DEFAULT_PROJECT_MEMORY_PATH && !args.projectPath) {
    return path.resolve(DEFAULT_PROJECT_MEMORY_PATH);
  }

  return path.join(resolveProjectPath(args), ".codex", "changes.md");
}

function ensureStore(changesPath) {
  fs.mkdirSync(path.dirname(changesPath), { recursive: true });

  if (!fs.existsSync(changesPath)) {
    fs.writeFileSync(
      changesPath,
      "# Changes Memory\n\n",
      "utf8"
    );
  }
}

function readStore(changesPath) {
  ensureStore(changesPath);
  return fs.readFileSync(changesPath, "utf8");
}

function normalizeArray(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

function createId(title, existingCount) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = String(existingCount + 1).padStart(3, "0");
  return `CHG-${date}-${suffix}-${slugify(title) || "item"}`;
}

function parseEntries(markdown, source = {}) {
  const matches = [...markdown.matchAll(/^##\s+(CHG-[^\n]+)\n```json\n([\s\S]*?)\n```\n?/gm)];
  const entries = [];

  for (const match of matches) {
    try {
      const entry = JSON.parse(match[2]);
      entry._heading = match[1];
      entry._store = source.store || "";
      entry._projectPath = source.projectPath || "";
      entry._path = source.path || "";
      entries.push(entry);
    } catch {
      // Ignora bloques corruptos para no romper el servidor entero.
    }
  }

  return entries;
}

function renderEntry(entry) {
  return `## ${entry.id} | ${entry.title}\n\`\`\`json\n${JSON.stringify(entry, null, 2)}\n\`\`\`\n`;
}

function appendEntry(entry, changesPath) {
  ensureStore(changesPath);
  const current = readStore(changesPath);
  const needsSeparator = current.trimEnd().length > 0 && !current.endsWith("\n\n");
  const prefix = needsSeparator ? "\n" : "";
  appendText(changesPath, `${prefix}${renderEntry(entry)}\n`);
}

function appendText(changesPath, text) {
  fs.appendFileSync(changesPath, text, "utf8");
}

function readGlobalEntries() {
  const changesPath = globalChangesPath();
  return parseEntries(readStore(changesPath), {
    store: "global",
    path: changesPath
  });
}

function readProjectEntries(args = {}) {
  const changesPath = projectChangesPath(args);
  const projectPath = resolveProjectPath(args);
  return parseEntries(readStore(changesPath), {
    store: "project",
    projectPath,
    path: changesPath
  });
}

function readScopedEntries(args = {}) {
  const includeGlobal = args.includeGlobal !== false;
  const includeProject = args.includeProject !== false;
  const entries = [];

  if (includeProject) {
    entries.push(...readProjectEntries(args));
  }

  if (includeGlobal) {
    entries.push(...readGlobalEntries());
  }

  return entries;
}

function serializeEntry(entry) {
  return [
    `ID: ${entry.id}`,
    `Store: ${entry._store || entry.scope || "-"}`,
    entry._projectPath ? `Proyecto: ${entry._projectPath}` : "",
    `Titulo: ${entry.title}`,
    `Resumen: ${entry.summary}`,
    `Cambio pedido: ${entry.requestedChange}`,
    `Por que: ${entry.rationale}`,
    `Tipo: ${entry.kind}`,
    `Scope: ${entry.scope}`,
    `Tags: ${entry.tags.join(", ") || "-"}`,
    `Rutas: ${entry.relatedPaths.join(", ") || "-"}`,
    `Antes: ${entry.before || "-"}`,
    `Ahora: ${entry.after || "-"}`,
    `Ejemplos: ${entry.examples.join(" | ") || "-"}`,
    `Fecha: ${entry.createdAt}`
  ].filter(Boolean).join("\n");
}

function serializeIndexEntry(entry) {
  const tags = normalizeArray(entry.tags).join(", ") || "-";
  const paths = normalizeArray(entry.relatedPaths).join(", ") || "-";
  return [
    `- ${entry.id} | ${entry.title}`,
    `  Store: ${entry._store || entry.scope || "-"}`,
    `  Kind: ${entry.kind || "-"}`,
    `  Tags: ${tags}`,
    `  Paths: ${paths}`,
    entry.summary ? `  Summary: ${entry.summary}` : ""
  ].filter(Boolean).join("\n");
}

function serializeTagCatalog() {
  return [
    "Recommended tags:",
    "",
    ...TAG_CATALOG.map((tag) => `- ${tag}`),
    "",
    "Use 2-5 tags per saved memory entry. Prefer existing tags; add a freeform tag only when the catalog cannot describe the criterion clearly."
  ].join("\n");
}

function searchableText(entry) {
  return [
    entry.id,
    entry.title,
    entry.summary,
    entry.requestedChange,
    entry.rationale,
    entry.kind,
    entry.scope,
    ...(entry.tags || []),
    ...(entry.relatedPaths || []),
    entry.before,
    entry.after,
    ...(entry.examples || [])
  ]
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();
}

function scoreEntry(entry, terms) {
  if (terms.length === 0) {
    return 0;
  }

  const haystack = searchableText(entry);
  let score = 0;

  for (const term of terms) {
    if (!term) {
      continue;
    }

    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = haystack.match(new RegExp(escaped, "g"));
    if (matches) {
      score += matches.length;
    }
  }

  if (haystack.includes("anti-pattern")) {
    score += 0.25;
  }

  return score;
}

function searchEntries(query, limit, args = {}) {
  const entries = readScopedEntries(args);
  const terms = String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);

  return entries
    .map((entry) => ({
      entry,
      score: scoreEntry(entry, terms)
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || right.entry.createdAt.localeCompare(left.entry.createdAt))
    .slice(0, limit);
}

function listTools() {
  const projectSelectors = {
    projectPath: {
      type: "string",
      description: "Ruta absoluta del proyecto cuya memoria local se quiere usar. Si se omite, se usa el cwd o --project-path del servidor."
    }
  };
  const includeSelectors = {
    includeGlobal: {
      type: "boolean",
      description: "Incluye la memoria global. Por defecto true."
    },
    includeProject: {
      type: "boolean",
      description: "Incluye la memoria del proyecto. Por defecto true."
    }
  };
  const tagsSchema = {
    description: TAG_GUIDANCE,
    oneOf: [
      {
        type: "array",
        items: {
          type: "string",
          enum: TAG_CATALOG
        }
      },
      {
        type: "string",
        description: "Comma-separated tags. Prefer values from the recommended catalog."
      }
    ]
  };

  return [
    {
      name: "add_local",
      title: "Guardar Local",
      description: "Guarda una nueva correccion o criterio aprendido en la memoria del proyecto.",
      annotations: {
        readOnlyHint: false
      },
      inputSchema: {
        type: "object",
        properties: {
          ...projectSelectors,
          title: { type: "string" },
          summary: { type: "string" },
          requestedChange: { type: "string" },
          rationale: { type: "string" },
          kind: { type: "string", enum: ["preference", "repo-convention", "domain-fact", "anti-pattern"] },
          tags: tagsSchema,
          relatedPaths: {
            oneOf: [
              { type: "array", items: { type: "string" } },
              { type: "string" }
            ]
          },
          before: { type: "string" },
          after: { type: "string" },
          examples: {
            oneOf: [
              { type: "array", items: { type: "string" } },
              { type: "string" }
            ]
          }
        },
        required: ["title", "summary", "requestedChange", "rationale", "tags"]
      }
    },
    {
      name: "add_global",
      title: "Guardar Global",
      description: "Guarda una correccion o criterio transversal en la memoria global.",
      annotations: {
        readOnlyHint: false
      },
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          requestedChange: { type: "string" },
          rationale: { type: "string" },
          kind: { type: "string", enum: ["preference", "repo-convention", "domain-fact", "anti-pattern"] },
          tags: tagsSchema,
          relatedPaths: {
            oneOf: [
              { type: "array", items: { type: "string" } },
              { type: "string" }
            ]
          },
          before: { type: "string" },
          after: { type: "string" },
          examples: {
            oneOf: [
              { type: "array", items: { type: "string" } },
              { type: "string" }
            ]
          }
        },
        required: ["title", "summary", "requestedChange", "rationale", "tags"]
      }
    },
    {
      name: "list_changes",
      title: "Listar Cambios",
      description: "Lista los cambios guardados en la memoria del proyecto y la global.",
      annotations: {
        readOnlyHint: true
      },
      inputSchema: {
        type: "object",
        properties: {
          ...projectSelectors,
          ...includeSelectors,
          limit: { type: "integer", minimum: 1, maximum: 100 }
        }
      }
    },
    {
      name: "list_change_index",
      title: "Listar Indice",
      description: "Lista un indice compacto de cambios con id, titulo, store, tipo, tags y rutas para decidir que consultar despues.",
      annotations: {
        readOnlyHint: true
      },
      inputSchema: {
        type: "object",
        properties: {
          ...projectSelectors,
          ...includeSelectors,
          query: {
            type: "string",
            description: "Filtro textual opcional sobre titulo, resumen, tags, rutas y contenido."
          },
          limit: { type: "integer", minimum: 1, maximum: 200 }
        }
      }
    },
    {
      name: "list_tag_catalog",
      title: "Listar Tags",
      description: "Lista el catalogo recomendado de tags para usar al guardar memoria con add_local o add_global.",
      annotations: {
        readOnlyHint: true
      },
      inputSchema: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "get_change",
      title: "Obtener Cambio",
      description: "Recupera un cambio exacto por id",
      annotations: {
        readOnlyHint: true
      },
      inputSchema: {
        type: "object",
        properties: {
          ...projectSelectors,
          ...includeSelectors,
          id: { type: "string" }
        },
        required: ["id"]
      }
    },
    {
      name: "search_changes",
      title: "Buscar Cambios",
      description: "Busca cambios por texto libre",
      annotations: {
        readOnlyHint: true
      },
      inputSchema: {
        type: "object",
        properties: {
          ...projectSelectors,
          ...includeSelectors,
          query: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 20 }
        },
        required: ["query"]
      }
    },
    {
      name: "get_relevant_changes",
      title: "Cambios Relevantes",
      description: "Devuelve los cambios mas relevantes para una tarea o riesgo concreto",
      annotations: {
        readOnlyHint: true
      },
      inputSchema: {
        type: "object",
        properties: {
          ...projectSelectors,
          ...includeSelectors,
          task: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 20 }
        },
        required: ["task"]
      }
    }
  ];
}

function success(text) {
  return {
    content: [
      {
        type: "text",
        text
      }
    ]
  };
}

function buildEntry(args, existingCount, scope) {
  const tags = normalizeArray(args.tags);
  if (tags.length === 0) {
    throw new Error("tags is required. Use 2-5 tags from list_tag_catalog.");
  }

  return {
    id: createId(args.title, existingCount),
    createdAt: new Date().toISOString(),
    title: String(args.title).trim(),
    summary: String(args.summary).trim(),
    requestedChange: String(args.requestedChange).trim(),
    rationale: String(args.rationale).trim(),
    kind: args.kind || "anti-pattern",
    scope,
    tags,
    relatedPaths: normalizeArray(args.relatedPaths),
    before: args.before ? String(args.before).trim() : "",
    after: args.after ? String(args.after).trim() : "",
    examples: normalizeArray(args.examples)
  };
}

function handleToolCall(name, args) {
  args = args || {};

  if (name === "add_local") {
    const changesPath = projectChangesPath(args);
    const entries = readProjectEntries(args);
    const entry = buildEntry(args, entries.length, "repo");

    appendEntry(entry, changesPath);
    entry._store = "project";
    entry._projectPath = resolveProjectPath(args);
    entry._path = changesPath;
    return success(`Cambio guardado en memoria de proyecto.\n\n${serializeEntry(entry)}`);
  }

  if (name === "add_global") {
    const changesPath = globalChangesPath();
    const entries = readGlobalEntries();
    const entry = buildEntry(args, entries.length, "global");

    appendEntry(entry, changesPath);
    entry._store = "global";
    entry._path = changesPath;
    return success(`Cambio guardado en memoria global.\n\n${serializeEntry(entry)}`);
  }

  if (name === "list_changes") {
    const entries = readScopedEntries(args);
    const limit = Math.max(1, Math.min(Number(args?.limit || 20), 100));
    const sorted = [...entries]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);

    if (sorted.length === 0) {
      return success("No hay cambios guardados.");
    }

    return success(sorted.map(serializeEntry).join("\n\n---\n\n"));
  }

  if (name === "list_change_index") {
    const limit = Math.max(1, Math.min(Number(args?.limit || 50), 200));
    const query = String(args.query || "").trim();
    const items = query
      ? searchEntries(query, limit, args)
          .map(({ entry, score }) => ({ entry, score }))
      : readScopedEntries(args)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .slice(0, limit)
          .map((entry) => ({ entry, score: null }));

    if (items.length === 0) {
      return success(query ? `No se encontraron cambios para: ${query}` : "No hay cambios guardados.");
    }

    return success(
      items
        .map(({ entry, score }) => {
          const suffix = score === null ? "" : `\n  Score: ${score}`;
          return `${serializeIndexEntry(entry)}${suffix}`;
        })
        .join("\n")
    );
  }

  if (name === "list_tag_catalog") {
    return success(serializeTagCatalog());
  }

  if (name === "get_change") {
    const entries = readScopedEntries(args);
    const entry = entries.find((item) => item.id === args.id);
    if (!entry) {
      throw new Error(`No existe el cambio con id ${args.id}`);
    }

    return success(serializeEntry(entry));
  }

  if (name === "search_changes") {
    const limit = Math.max(1, Math.min(Number(args?.limit || 5), 20));
    const results = searchEntries(args.query, limit, args);

    if (results.length === 0) {
      return success(`No se encontraron cambios para: ${args.query}`);
    }

    return success(
      results
        .map(({ entry, score }) => `${serializeEntry(entry)}\nScore: ${score}`)
        .join("\n\n---\n\n")
    );
  }

  if (name === "get_relevant_changes") {
    const limit = Math.max(1, Math.min(Number(args?.limit || 5), 20));
    const results = searchEntries(args.task, limit, args);

    if (results.length === 0) {
      return success(
        `No hay criterios guardados claramente relevantes para esta tarea:\n${args.task}`
      );
    }

    const response = [
      `Tarea analizada: ${args.task}`,
      "",
      "Cambios relevantes:"
    ];

    for (const { entry, score } of results) {
      response.push(
        `- ${entry.id} | ${entry.title} | store=${entry._store || "-"} | score=${score}`,
        `  Cambio pedido: ${entry.requestedChange}`,
        `  Por que: ${entry.rationale}`
      );
    }

    return success(response.join("\n"));
  }

  throw new Error(`Tool no soportada: ${name}`);
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function sendResult(id, result) {
  send({
    jsonrpc: "2.0",
    id,
    result
  });
}

function sendError(id, code, message) {
  send({
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message
    }
  });
}

function handleMessage(message) {
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.method === "initialize") {
    const requestedVersion = message.params?.protocolVersion;
    const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion)
      ? requestedVersion
      : SUPPORTED_PROTOCOL_VERSIONS[0];

    sendResult(message.id, {
      protocolVersion,
      serverInfo: SERVER_INFO,
      capabilities: {
        tools: {}
      },
      instructions: SERVER_INSTRUCTIONS
    });
    return;
  }

  if (message.method === "notifications/initialized") {
    return;
  }

  if (message.method === "ping") {
    sendResult(message.id, {});
    return;
  }

  if (message.method === "tools/list") {
    sendResult(message.id, {
      tools: listTools()
    });
    return;
  }

  if (message.method === "tools/call") {
    try {
      const result = handleToolCall(message.params?.name, message.params?.arguments || {});
      sendResult(message.id, result);
    } catch (error) {
      sendError(message.id, -32000, error instanceof Error ? error.message : String(error));
    }
    return;
  }

  if (message.id !== undefined) {
    sendError(message.id, -32601, `Metodo no soportado: ${message.method}`);
  }
}

function start() {
  ensureStore(globalChangesPath());

  let buffer = "";
  process.stdin.setEncoding("utf8");

  process.stdin.on("data", (chunk) => {
    buffer += chunk;

    while (true) {
      const lineBreakIndex = buffer.indexOf("\n");
      if (lineBreakIndex === -1) {
        break;
      }

      const line = buffer.slice(0, lineBreakIndex).trim();
      buffer = buffer.slice(lineBreakIndex + 1);

      if (!line) {
        continue;
      }

      try {
        handleMessage(JSON.parse(line));
      } catch (error) {
        sendError(null, -32700, error instanceof Error ? error.message : "JSON invalido");
      }
    }
  });
}

start();
