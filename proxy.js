// Ollama CORS proxy — run: node proxy.js
// Forwards requests from any origin to local Ollama with proper CORS headers

const http = require("http");
const httpProxy = require("http").request;

const OLLAMA_PORT = 11434;
const PROXY_PORT = parseInt(process.env.PORT || "8080", 10);

const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    console.log(`  ← CORS preflight OK (${req.headers.origin || "unknown"})`);
    return;
  }

  // Proxy to Ollama — strip origin header to avoid Ollama's CORS rejection
  const headers = { ...req.headers, host: `127.0.0.1:${OLLAMA_PORT}` }
  delete headers.origin
  delete headers.referer
  const proxyReq = httpProxy(
    {
      hostname: "127.0.0.1",
      port: OLLAMA_PORT,
      path: req.url,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        ...proxyRes.headers,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      });
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", (e) => {
    res.writeHead(502, { "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: e.message }));
    console.log(`  ✗ ${e.message}`);
  });

  req.pipe(proxyReq);
});

// Try to bind — if 11434 is taken, kill the old process and retry
const start = () => {
  server.listen(PROXY_PORT, "0.0.0.0", () => {
    console.log(`✓ Ollama CORS proxy running on http://0.0.0.0:${PROXY_PORT}`);
    console.log(`  Forwards to Ollama at 127.0.0.1:${OLLAMA_PORT}`);
    console.log(`  All origins allowed (Access-Control-Allow-Origin: *)`);
  });
};

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.log(`Port ${PROXY_PORT} is in use — killing old process...`);
    const { execSync } = require("child_process");
    try {
      const pid = execSync(`lsof -ti:${PROXY_PORT}`).toString().trim();
      if (pid) {
        execSync(`kill -9 ${pid}`);
        console.log(`Killed PID ${pid}, restarting...`);
        setTimeout(start, 1000);
      }
    } catch {
      console.error(`Can't free port ${PROXY_PORT}. Try: sudo kill -9 $(lsof -ti:${PROXY_PORT})`);
      process.exit(1);
    }
  } else {
    console.error(`Failed to start: ${e.message}`);
    process.exit(1);
  }
});

start();
