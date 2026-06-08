/**
 * capture-server.mjs
 *
 * HTTPS capture server for S1 SSRF PoC.
 * Listens on a random available port on 127.0.0.1 with a self-signed cert.
 * Records all inbound requests and resolves the firstRequest promise
 * when any request arrives.
 *
 * Requires openssl in PATH (available in the Docker image and most Linux envs).
 */

import https from "node:https";
import http from "node:http";
import { execSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Start an HTTPS capture server (self-signed cert).
 * Returns { port, url, certPath, requests, waitForFirstRequest, close }
 */
export function startCaptureServer() {
  return new Promise((resolve, reject) => {
    // Generate a self-signed cert in a temp dir.
    let tmpDir;
    let certFile, keyFile;
    try {
      tmpDir = mkdtempSync(path.join(tmpdir(), "poc-capture-"));
      certFile = path.join(tmpDir, "cert.pem");
      keyFile = path.join(tmpDir, "key.pem");
      execSync(
        `openssl req -new -x509 -days 1 -nodes ` +
          `-out "${certFile}" -keyout "${keyFile}" ` +
          `-subj "/CN=127.0.0.1" 2>/dev/null`,
        { stdio: "pipe" }
      );
    } catch (err) {
      return reject(new Error("openssl cert generation failed: " + err.message));
    }

    const requests = [];
    let resolveFirst = null;
    const firstRequestPromise = new Promise((res) => {
      resolveFirst = res;
    });

    const server = https.createServer(
      {
        key: readFileSync(keyFile),
        cert: readFileSync(certFile),
      },
      (req, res) => {
        const entry = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          timestamp: new Date().toISOString(),
        };
        requests.push(entry);

        // Respond with a minimal JSON-RPC error so @solana/web3.js doesn't hang.
        const body = JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32600, message: "capture" },
          id: 1,
        });
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        });
        res.end(body);

        if (resolveFirst) {
          resolveFirst(entry);
          resolveFirst = null;
        }
      }
    );

    server.on("error", reject);

    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      const url = `https://127.0.0.1:${port}`;

      const close = () =>
        new Promise((res, rej) => {
          server.close((err) => {
            // Clean up temp dir
            try {
              rmSync(tmpDir, { recursive: true, force: true });
            } catch (_) {}
            err ? rej(err) : res();
          });
        });

      resolve({
        port,
        url,
        certFile,
        requests,
        waitForFirstRequest: () => firstRequestPromise,
        close,
      });
    });
  });
}

/**
 * Start a plain HTTP capture server (for non-TLS scenarios / testing).
 */
export function startHttpCaptureServer() {
  const requests = [];
  let resolveFirst = null;
  const firstRequestPromise = new Promise((res) => {
    resolveFirst = res;
  });

  const server = http.createServer((req, res) => {
    const entry = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      timestamp: new Date().toISOString(),
    };
    requests.push(entry);

    const body = JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32600, message: "capture" },
      id: 1,
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(body);

    if (resolveFirst) {
      resolveFirst(entry);
      resolveFirst = null;
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        port,
        url: `http://127.0.0.1:${port}`,
        requests,
        waitForFirstRequest: () => firstRequestPromise,
        close: () =>
          new Promise((res, rej) => server.close((err) => (err ? rej(err) : res()))),
      });
    });
    server.on("error", reject);
  });
}
