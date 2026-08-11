#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");
const ROOT = path.resolve(process.env.CHANGES_MEMORY_ROOT || DEFAULT_ROOT);
const CHANGES_PATH = path.resolve(
  process.env.CHANGES_MEMORY_PATH || path.join(ROOT, ".codex", "changes.md")
);
const SERVER_INFO = {
  name: "changes-memory-mcp",
  version: "0.1.0"
};
const SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05"
];
const SERVER_INSTRUCTIONS =
  "Consulta get_relevant_changes antes de implementar, revisar o corregir codigo; usa add_change solo cuando el usuario pida guardar un aprendizaje reutilizable.";

function ensureStore() {
  fs.mkdirSync(path.dirname(CHANGES_PATH), { recursive: true });

  if (!fs.existsSync(CHANGES_PATH)) {
    fs.writeFileSync(
      CHANGES_PATH,
      "# Changes Memory\n\n",
      "utf8"
    );
  }
}

function readStore() {
  ensureStore();
  return fs.readFileSync(CHANGES_PATH, "utf8");
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

function parseEntries(markdown) {
  const matches = [...markdown.matchAll(/^##\s+(CHG-[^\n]+)\n```json\n([\s\S]*?)\n```\n?/gm)];
  const entries = [];

  for (const match of matches) {
    try {
      const entry = JSON.parse(match[2]);
      entry._heading = match[1];
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

function appendEntry(entry) {
  ensureStore();
  const current = readStore();
  const needsSeparator = current.trimEnd().length > 0 && !current.endsWith("\n\n");
  const prefix = needsSeparator ? "\n" : "";
  appendText(`${prefix}${renderEntry(entry)}\n`);
}

function appendText(text) {
  fs.appendFileSync(CHANGES_PATH, text, "utf8");
}

function serializeEntry(entry) {
  return [
    `ID: ${entry.id}`,
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

function searchEntries(query, limit) {
  const entries = parseEntries(readStore());
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
  return [
    {
      name: "add_change",
      title: "Guardar Cambio",
      description: "Guarda una nueva correccion o criterio aprendido en .codex/changes.md",
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
          scope: { type: "string", enum: ["global", "repo"] },
          tags: {
            oneOf: [
              { type: "array", items: { type: "string" } },
              { type: "string" }
            ]
          },
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
        required: ["title", "summary", "requestedChange", "rationale"]
      }
    },
    {
      name: "list_changes",
      title: "Listar Cambios",
      description: "Lista los cambios guardados",
      annotations: {
        readOnlyHint: true
      },
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 100 }
        }
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

function handleToolCall(name, args) {
  const entries = parseEntries(readStore());

  if (name === "add_change") {
    const entry = {
      id: createId(args.title, entries.length),
      createdAt: new Date().toISOString(),
      title: String(args.title).trim(),
      summary: String(args.summary).trim(),
      requestedChange: String(args.requestedChange).trim(),
      rationale: String(args.rationale).trim(),
      kind: args.kind || "anti-pattern",
      scope: args.scope || "global",
      tags: normalizeArray(args.tags),
      relatedPaths: normalizeArray(args.relatedPaths),
      before: args.before ? String(args.before).trim() : "",
      after: args.after ? String(args.after).trim() : "",
      examples: normalizeArray(args.examples)
    };

    appendEntry(entry);
    return success(`Cambio guardado.\n\n${serializeEntry(entry)}`);
  }

  if (name === "list_changes") {
    const limit = Math.max(1, Math.min(Number(args?.limit || 20), 100));
    const sorted = [...entries]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);

    if (sorted.length === 0) {
      return success("No hay cambios guardados.");
    }

    return success(sorted.map(serializeEntry).join("\n\n---\n\n"));
  }

  if (name === "get_change") {
    const entry = entries.find((item) => item.id === args.id);
    if (!entry) {
      throw new Error(`No existe el cambio con id ${args.id}`);
    }

    return success(serializeEntry(entry));
  }

  if (name === "search_changes") {
    const limit = Math.max(1, Math.min(Number(args?.limit || 5), 20));
    const results = searchEntries(args.query, limit);

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
    const results = searchEntries(args.task, limit);

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
        `- ${entry.id} | ${entry.title} | score=${score}`,
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
  ensureStore();

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
