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

test("stores memory under the process cwd by default", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "changes-memory-cwd-"));

  const messages = await callServer({
    cwd: root,
    calls: [
      {
        name: "add_change",
        arguments: {
          title: "Cwd memory",
          summary: "Store under cwd.",
          requestedChange: "Use cwd by default.",
          rationale: "npx packages run from npm cache.",
        },
      },
    ],
  });

  assert.equal(messages[0].result.serverInfo.name, "changes-memory-mcp");
  assert.equal(messages[1].result.content[0].text.split("\n")[0], "Cambio guardado.");
  assert.match(
    fs.readFileSync(path.join(root, ".codex", "changes.md"), "utf8"),
    /Cwd memory/
  );
});

test("supports --memory-root for Codex project config", async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "changes-memory-run-"));
  const memoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "changes-memory-root-"));

  await callServer({
    cwd,
    args: [`--memory-root=${memoryRoot}`],
    calls: [
      {
        name: "add_change",
        arguments: {
          title: "Explicit root",
          summary: "Store under explicit root.",
          requestedChange: "Respect --memory-root.",
          rationale: "Codex may start MCPs from another cwd.",
        },
      },
    ],
  });

  assert.equal(fs.existsSync(path.join(cwd, ".codex", "changes.md")), false);
  assert.match(
    fs.readFileSync(path.join(memoryRoot, ".codex", "changes.md"), "utf8"),
    /Explicit root/
  );
});
