import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const serverPath = path.resolve("src/index.js");

function callServer({ cwd, args = [], calls }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath, ...args], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const messages = [];
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      let index;

      while ((index = stdout.indexOf("\n")) !== -1) {
        const line = stdout.slice(0, index).trim();
        stdout = stdout.slice(index + 1);

        if (line) {
          messages.push(JSON.parse(line));
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", reject);

    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test", version: "0" },
        },
      })}\n`
    );

    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      })}\n`
    );

    let id = 2;
    for (const call of calls) {
      child.stdin.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: call,
        })}\n`
      );
      id += 1;
    }

    setTimeout(() => {
      child.kill();

      if (stderr) {
        reject(new Error(stderr));
        return;
      }

      resolve(messages);
    }, 300);
  });
}

test("stores project and global memory under one store root", async () => {
  const storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "changes-memory-store-"));
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "changes-memory-project-"));

  const messages = await callServer({
    cwd: projectRoot,
    args: [`--store-root=${storeRoot}`, `--project-path=${projectRoot}`],
    calls: [
      {
        name: "add_change",
        arguments: {
          title: "Project memory",
          summary: "Store under project scope.",
          requestedChange: "Use add_change for project criteria.",
          rationale: "Project-specific criteria should not pollute global memory.",
        },
      },
      {
        name: "add_change_global",
        arguments: {
          title: "Global memory",
          summary: "Store under global scope.",
          requestedChange: "Use add_change_global for reusable criteria.",
          rationale: "Global criteria should be available to every project.",
        },
      },
      {
        name: "get_relevant_changes",
        arguments: {
          task: "project global criteria",
        },
      },
    ],
  });

  assert.equal(messages[0].result.serverInfo.name, "changes-memory-mcp");
  assert.equal(messages[1].result.content[0].text.split("\n")[0], "Cambio guardado en memoria de proyecto.");
  assert.equal(messages[2].result.content[0].text.split("\n")[0], "Cambio guardado en memoria global.");

  const projectFiles = fs.readdirSync(path.join(storeRoot, "projects"));
  assert.equal(projectFiles.length, 1);
  assert.match(fs.readFileSync(path.join(storeRoot, "projects", projectFiles[0], "changes.md"), "utf8"), /Project memory/);
  assert.match(fs.readFileSync(path.join(storeRoot, "global", "changes.md"), "utf8"), /Global memory/);

  const relevantText = messages[3].result.content[0].text;
  assert.match(relevantText, /store=project/);
  assert.match(relevantText, /store=global/);
});

test("supports projectPath argument for multiple projects in one server", async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "changes-memory-run-"));
  const storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "changes-memory-store-"));
  const projectA = fs.mkdtempSync(path.join(os.tmpdir(), "changes-memory-a-"));
  const projectB = fs.mkdtempSync(path.join(os.tmpdir(), "changes-memory-b-"));

  const messages = await callServer({
    cwd,
    args: [`--store-root=${storeRoot}`],
    calls: [
      {
        name: "add_change",
        arguments: {
          projectPath: projectA,
          title: "Project A",
          summary: "Only project A.",
          requestedChange: "Keep project A separate.",
          rationale: "One MCP can serve several projects.",
        },
      },
      {
        name: "add_change",
        arguments: {
          projectPath: projectB,
          title: "Project B",
          summary: "Only project B.",
          requestedChange: "Keep project B separate.",
          rationale: "One MCP can serve several projects.",
        },
      },
      {
        name: "search_changes",
        arguments: {
          projectPath: projectA,
          query: "Project",
          includeGlobal: false,
        },
      },
    ],
  });

  const searchText = messages[3].result.content[0].text;
  assert.match(searchText, /Project A/);
  assert.doesNotMatch(searchText, /Project B/);
});
