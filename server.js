import { serve } from "bun";
import { Database } from "bun:sqlite";
import { resolve } from "path";

// Initialize SQLite database
const db = new Database("app.sqlite", { create: true });

// Create tables for agents and messages
db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT,
    behavior TEXT,
    state TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT,
    receiver_id TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Simple file storage (in-memory for now)
const files = new Map();

// Process agent behaviors (simple interpreter)
function processAgentBehavior(agent, message) {
  const behavior = JSON.parse(agent.behavior);
  const content = JSON.parse(message.content);
  
  // Example: If message matches behavior's "onMessage", execute action
  if (behavior.onMessage === content.type) {
    if (behavior.action === "respond") {
      // Queue a response message
      const responseId = crypto.randomUUID();
      db.query("INSERT INTO messages (id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)")
        .run(responseId, agent.id, message.sender_id, JSON.stringify({ type: "response", value: behavior.value }));
      return { id: responseId, type: "response", value: behavior.value };
    }
  }
  return null;
}

// WebSocket clients for real-time updates
const wsClients = new Set();

serve({
  port: 3013,
  websocket: {
    open(ws) {
      wsClients.add(ws);
    },
    close(ws) {
      wsClients.delete(ws);
    },
    message(ws, message) {
      // Broadcast messages to all clients
      wsClients.forEach(client => client.send(message));
    },
  },
  async fetch(req, server) {
    const url = new URL(req.url);

    // Upgrade to WebSocket for real-time messaging
    if (url.pathname === "/ws") {
      if (server.upgrade(req)) {
        return;
      }
      return new Response("WebSocket upgrade failed", { status: 500 });
    }

    // API to create an agent
    if (url.pathname === "/api/agents" && req.method === "POST") {
      const body = await req.json();
      const id = crypto.randomUUID();
      db.query("INSERT INTO agents (id, name, behavior, state) VALUES (?, ?, ?, ?)")
        .run(id, body.name, JSON.stringify(body.behavior || {}), JSON.stringify(body.state || {}));
      const agent = { id, name: body.name, behavior: body.behavior, state: body.state };
      wsClients.forEach(client => client.send(JSON.stringify({ type: "agent_created", agent })));
      return new Response(JSON.stringify(agent), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // API to list agents
    if (url.pathname === "/api/agents" && req.method === "GET") {
      const rows = db.query("SELECT id, name, behavior, state FROM agents").all();
      const agents = rows.map(row => ({
        id: row.id,
        name: row.name,
        behavior: JSON.parse(row.behavior),
        state: JSON.parse(row.state),
      }));
      return new Response(JSON.stringify(agents), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // API to send a message to an agent
    if (url.pathname === "/api/messages" && req.method === "POST") {
      const body = await req.json();
      const id = crypto.randomUUID();
      db.query("INSERT INTO messages (id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)")
        .run(id, body.sender_id, body.receiver_id, JSON.stringify(body.content));
      
      // Process the message for the receiver
      const receiver = db.query("SELECT id, behavior FROM agents WHERE id = ?")
        .get(body.receiver_id);
      let response = null;
      if (receiver) {
        response = processAgentBehavior(receiver, { sender_id: body.sender_id, content: JSON.stringify(body.content) });
      }

      const message = { id, sender_id: body.sender_id, receiver_id: body.receiver_id, content: body.content };
      wsClients.forEach(client => client.send(JSON.stringify({ type: "message", message, response })));
      return new Response(JSON.stringify({ message, response }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // API to list messages
    if (url.pathname === "/api/messages" && req.method === "GET") {
      const rows = db.query("SELECT id, sender_id, receiver_id, content FROM messages").all();
      const messages = rows.map(row => ({
        id: row.id,
        sender_id: row.sender_id,
        receiver_id: row.receiver_id,
        content: JSON.parse(row.content),
      }));
      return new Response(JSON.stringify(messages), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // API to store a file
    if (url.pathname === "/api/files" && req.method === "POST") {
      const id = crypto.randomUUID();
      const body = await req.text();
      files.set(id, body);
      return new Response(JSON.stringify({ id }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Serve static files
    if (url.pathname === "/" || url.pathname.startsWith("/static")) {
      const filePath = url.pathname === "/" 
        ? "static/index.html" 
        : `static${url.pathname.replace("/static", "")}`;
      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file, {
          headers: { "Content-Type": filePath.endsWith(".html") ? "text/html" : file.type },
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log("Server running at http://localhost:3013");