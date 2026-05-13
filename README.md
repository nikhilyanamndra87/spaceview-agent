# ⚡ ARIA — AI Reasoning & Interactive Agent

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-6366f1?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![Claude](https://img.shields.io/badge/Claude-Sonnet_4-orange?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge)

**A fully client-side AI agent with persistent memory, live web search, and an in-browser app builder — running entirely in a React artifact.**

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Live Demo](#live-demo)
- [Features](#features)
- [Architecture](#architecture)
- [Technologies Used](#technologies-used)
- [Implementation Details](#implementation-details)
- [Agentic Loop](#agentic-loop)
- [Tool System](#tool-system)
- [Design System](#design-system)
- [Performance & Metrics](#performance--metrics)
- [Getting Started](#getting-started)
- [File Structure](#file-structure)
- [Configuration](#configuration)
- [Extension Guide](#extension-guide)
- [Known Limitations](#known-limitations)
- [Contributing](#contributing)

---

## Overview

ARIA is a production-grade AI agent built as a React artifact for Claude.ai. It demonstrates a complete agentic AI pattern — multi-turn memory, real-time web search, and live code execution — entirely within a single React component with no backend required.

The agent uses the **Anthropic Messages API** directly from the browser, implementing a self-contained tool-use loop that handles both server-side tools (web search) and client-side tools (app builder).

---

## Live Demo

Run directly in Claude.ai by opening `src/Agent.jsx` as an artifact, or embed in any React environment with an Anthropic API key.

**Example prompts to try:**
- `"Build me a Pomodoro timer with dark mode"`
- `"What's happening in AI this week?"`
- `"Create a budget tracker with charts"`
- `"Make a snake game with a high score board"`
- `"Search for the latest Python 3.13 features and explain them"`

---

## Features

| Feature | Description |
|---------|-------------|
| 🧠 **Persistent Memory** | Full conversation history sent with every API call — no context loss across turns |
| 🔍 **Web Search** | Real-time internet access via Anthropic's native `web_search_20250305` tool |
| 🔨 **App Builder** | Generates and renders complete HTML/CSS/JS apps live in a sandboxed iframe |
| 🔄 **Agentic Loop** | Autonomous tool-use iteration — Claude calls tools, receives results, continues reasoning |
| 💬 **Markdown Rendering** | Custom lightweight parser — code blocks, headings, lists, bold, inline code |
| 🎨 **Polished UI** | Dark theme with animated logo, status pills, slide-in messages, and auto-growing input |
| 📱 **Responsive** | Works across screen sizes; tabs switch cleanly between chat and preview |
| ♿ **Accessible** | Keyboard navigation (Enter to send, Shift+Enter for newline), disabled states |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          ARIA Architecture                          │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────┐     User types & presses Enter
  │   User   │ ─────────────────────────────────────────────────────►
  └──────────┘                                                        │
                                                                      ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │                         send() function                             │
  │                                                                     │
  │  1. Append user message to UI (msgs state)                         │
  │  2. Append to API history (hist state)                             │
  │  3. Enter agentic loop ──────────────────────────────────────────► │
  └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │              Anthropic Messages API  /v1/messages                   │
  │                                                                     │
  │  POST {                                                             │
  │    model: "claude-sonnet-4-20250514",                              │
  │    system: SYS,           ← behavioral guidelines                  │
  │    tools: TOOLS,          ← web_search + build_app                 │
  │    messages: hist         ← full conversation history              │
  │  }                                                                  │
  └─────────────────────────────────────────────────────────────────────┘
                                    │
              ┌─────────────────────┴─────────────────────┐
              │                                           │
         stop_reason                               stop_reason
         "end_turn"                                "tool_use"
              │                                           │
              ▼                                           ▼
    ┌──────────────────┐                  ┌───────────────────────────┐
    │  Render text to  │                  │    Identify tool(s)       │
    │  chat UI.        │                  │    invoked by Claude      │
    │  Save to history.│                  └───────────────────────────┘
    │  Done.           │                       │              │
    └──────────────────┘                       │              │
                                        web_search       build_app
                                               │              │
                                      ┌────────┘    ┌─────────┴──────────┐
                                      │             │  Extract HTML from  │
                                      │             │  tool input.        │
                                      │             │  Render in iframe.  │
                                      │             │  Return tool_result │
                                      │             │  to API history.    │
                                      │             └────────────────────┘
                                      │                        │
                              Server-side;              Loop back to
                              no client action          API call ──────►
                              needed. Loop back.
```

### State Flow

```
msgs  ──► UI rendering only (display layer)
hist  ──► API calls only   (data layer, Anthropic format)

Both grow together per turn but serve separate concerns.
This separation means UI can be freely modified without touching API logic.
```

---

## Technologies Used

### Core Runtime

| Technology | Version | Role |
|-----------|---------|------|
| **React** | 18.x | Component model, state management, effects |
| **Anthropic Messages API** | v1 | LLM inference, tool use, web search |
| **Claude Sonnet 4** | `claude-sonnet-4-20250514` | Language model |

### Anthropic API Features Used

| Feature | API Identifier | Notes |
|---------|---------------|-------|
| Multi-turn messages | `messages[]` array | Full history sent each request |
| System prompts | `system` field | Injected per-request, not in history |
| Server-side tools | `type: "web_search_20250305"` | Executed by Anthropic infrastructure |
| Custom tools | `input_schema` (JSON Schema) | Client-side execution in send() loop |
| Tool results | `type: "tool_result"` | Returned as user role messages |
| Stop reason routing | `stop_reason` field | `"end_turn"` vs `"tool_use"` branching |

### UI & Styling

| Technology | Role |
|-----------|------|
| **Inline React styles** | Zero-dependency styling — no CSS-in-JS library |
| **CSS keyframes** (via `<style>` tag) | `pulse`, `slideUp`, `glow` animations |
| **DM Sans** (Google Fonts) | Primary UI typeface — modern, legible |
| **JetBrains Mono** (Google Fonts) | Code block monospace font |
| **iframe srcdoc** | Secure sandboxed app preview |

### Design Tokens

```javascript
// Color palette
const colors = {
  bg:        "#06060e",   // Page background
  surface:   "#0d0d1a",   // Message bubbles, input
  border:    "#131325",   // Subtle dividers
  accent:    "#6366f1",   // Indigo — primary brand color
  accentAlt: "#3b82f6",   // Blue — gradient pair
  text:      "#e2e8f0",   // Primary text
  muted:     "#94a3b8",   // Secondary text
  dim:       "#334155",   // Placeholder, disabled
};

// Typography scale
const type = {
  xs:   11,   // Labels, badges
  sm:   12,   // Buttons, metadata
  base: 13.5, // Chat messages, body
  md:   15,   // Headings
  lg:   17,   // Section titles
};
```

---

## Implementation Details

### Conversation Memory

Memory is maintained via React state (`hist`) that accumulates messages in the Anthropic API format:

```javascript
// Each turn appends two entries:
hist = [
  ...prevHist,
  { role: "user",      content: "Build me a todo app" },
  { role: "assistant", content: [{ type: "text", text: "..." }] },
];
```

The **entire history is sent** with every request. Claude has no server-side memory — all context is passed by the client. This is the standard stateless pattern for the Anthropic API.

> **Scaling consideration:** History grows linearly. For sessions exceeding ~50 turns, implement a sliding window or summarisation step to stay within the model's context window (~200k tokens for Sonnet 4).

### Markdown Renderer

A custom `MD` component parses a limited Markdown subset without any external library. This keeps the artifact self-contained and avoids loading `react-markdown` (~40kb) in the artifact sandbox.

**Supported syntax:**

| Markdown | Output |
|----------|--------|
| ` ```js ... ``` ` | Syntax-highlighted code block with language label |
| `## Heading` | `<h2>` styled heading |
| `### Heading` | `<h3>` styled heading |
| `- item` | Bullet list item with `›` marker |
| `**bold**` | Bold `<strong>` span |
| `` `code` `` | Inline code span |
| Blank line | Vertical spacer `<div>` |

### Auto-growing Textarea

```javascript
useEffect(() => {
  if (taRef.current) {
    taRef.current.style.height = "44px";   // reset first
    taRef.current.style.height =
      Math.min(taRef.current.scrollHeight, 130) + "px";
  }
}, [input]);
```

Resets to minimum height before measuring `scrollHeight` to handle content deletion correctly. Capped at 130px to prevent the input from dominating the viewport.

### iframe Sandboxing

Generated apps are rendered via `srcdoc` with restricted sandbox permissions:

```html
<iframe
  srcDoc={app.html}
  sandbox="allow-scripts allow-same-origin"
/>
```

| Permission | Granted | Reason |
|-----------|---------|--------|
| `allow-scripts` | ✅ | Required to run JavaScript in generated apps |
| `allow-same-origin` | ✅ | Required for localStorage in generated apps |
| `allow-forms` | ❌ | Not needed; prevents form-based navigation |
| `allow-top-navigation` | ❌ | Prevents iframe from escaping to parent |
| `allow-popups` | ❌ | Prevents unexpected popups |

---

## Agentic Loop

The core of ARIA is a `while (true)` loop inside `send()` that continues until Claude returns `stop_reason: "end_turn"`.

```javascript
outer: while (true) {
  const data = await callAPI(history);

  if (data.stop_reason === "end_turn") {
    // Extract text, render, exit loop
    break;
  }

  if (data.stop_reason === "tool_use") {
    // Identify which tools Claude invoked
    const toolUses = data.content.filter(b => b.type === "tool_use");

    // Add assistant's tool-use message to history
    history.push({ role: "assistant", content: data.content });

    // Execute client-side tools, collect results
    const results = toolUses
      .filter(u => u.name === "build_app")
      .map(u => handleBuildApp(u));   // renders iframe, returns tool_result

    // Return results to Claude
    history.push({ role: "user", content: results });

    // Loop — Claude will now produce a closing message
  }
}
```

**Why this pattern?**

Claude may invoke multiple tools per turn (e.g. search then build), and each tool result may prompt further reasoning. The loop ensures Claude always gets the opportunity to respond after each tool execution, producing a natural conversation rather than abruptly stopping.

---

## Tool System

### Tool 1: `web_search` (Server-Side)

```javascript
{ type: "web_search_20250305", name: "web_search" }
```

- **Execution:** Fully handled by Anthropic's infrastructure
- **Client action:** None — results are injected into Claude's context server-side
- **Latency:** Adds ~1–3s to response time depending on query complexity
- **Rate limit:** Subject to the account's API rate limits

### Tool 2: `build_app` (Client-Side)

```javascript
{
  name: "build_app",
  input_schema: {
    type: "object",
    properties: {
      title:       { type: "string" },
      description: { type: "string" },
      html:        { type: "string" }   // complete HTML file
    }
  }
}
```

- **Execution:** Client-side — extracted from `tool_use.input.html`
- **Rendering:** Set as `iframe.srcdoc` — no server upload, no external URLs
- **Client action:** Store in `app` state, switch to preview tab, send `tool_result`

**Adding a new tool:**

1. Add the tool definition to `TOOLS` array
2. Handle the tool name in the `for (const u of uses)` loop inside `send()`
3. Push a `{ type: "tool_result", tool_use_id: u.id, content: "..." }` to `results`

---

## Design System

### Visual Direction

ARIA uses a **dark-futuristic terminal** aesthetic — deep navy/black backgrounds, indigo-to-blue gradient accents, and JetBrains Mono for code. The design avoids generic "AI chatbot" patterns (white backgrounds, neutral grays) in favour of a premium developer tool feel.

### Component Patterns

| Pattern | Implementation |
|---------|---------------|
| **Message bubbles** | User: gradient fill, rounded right. Assistant: dark surface, rounded left. |
| **Typing indicator** | Three indigo dots with staggered `pulse` animation (0ms, 220ms, 440ms delay) |
| **Status pill** | Animated in header during API calls; disappears on completion |
| **Preview chrome** | Faux macOS browser — traffic light dots + URL bar — for app iframe |
| **Tab switcher** | Indigo gradient pill on active; only visible when an app exists |
| **Send button** | Gradient when enabled; dark + disabled when empty or loading |

### Animation Timing

| Animation | Duration | Easing | Trigger |
|-----------|---------|--------|---------|
| `slideUp` | 250ms | ease | New message appears |
| `pulse` | 1200ms | ease | Typing indicator dots |
| `glow` | 3000ms | ease-in-out | Logo breathe loop |
| Status pill | 200ms | ease | API call starts |
| Tab hover | 180ms | ease | Mouse enter |

---

## Performance & Metrics

### Bundle Impact

| Metric | Value |
|--------|-------|
| Component LOC | ~450 (with docs) |
| External dependencies | 0 (runtime) |
| External fonts | 2 (DM Sans, JetBrains Mono via Google Fonts) |
| Total JS payload | React 18 only (provided by artifact host) |

### API Call Characteristics

| Scenario | Typical Latency | Token Usage |
|----------|----------------|-------------|
| Simple chat reply | 1–3s | ~500–1500 tokens |
| Web search + response | 3–8s | ~2000–4000 tokens |
| App build (simple) | 5–12s | ~3000–6000 tokens |
| App build (complex) | 10–25s | ~5000–8000 tokens |

> Latency depends on Anthropic API load and search result processing time.

### Memory Growth

```
History size per turn:
  User message:      ~50–200 tokens average
  Assistant reply:   ~500–4000 tokens average
  Tool use block:    ~100–400 tokens
  Tool result:       ~50–100 tokens

After 20 turns:  ~10,000–30,000 tokens in history
After 50 turns:  ~25,000–75,000 tokens in history
Context limit:   ~200,000 tokens (Claude Sonnet 4)
```

---

## Getting Started

### Option 1: Claude.ai Artifact (Recommended)

1. Open Claude.ai
2. Start a new conversation
3. Paste the contents of `src/Agent.jsx` and ask Claude to run it as an artifact
4. The agent starts immediately — no API key required (uses your Claude.ai session)

### Option 2: Standalone React App

```bash
# 1. Create a new Vite + React project
npm create vite@latest aria-agent -- --template react
cd aria-agent

# 2. Copy the source file
cp path/to/src/Agent.jsx src/

# 3. Update src/main.jsx
# import Agent from './Agent'
# ReactDOM.createRoot(document.getElementById('root')).render(<Agent />)

# 4. Set your Anthropic API key
# Create src/config.js:
# export const ANTHROPIC_KEY = "sk-ant-..."

# 5. Update the fetch call in Agent.jsx to include the Authorization header:
# headers: {
#   "Content-Type": "application/json",
#   "x-api-key": ANTHROPIC_KEY,
#   "anthropic-version": "2023-06-01"
# }

# 6. Run
npm install && npm run dev
```

> ⚠️ **Security:** Never expose your Anthropic API key in client-side code for production. Use a backend proxy (FastAPI, Express, etc.) to hold the key.

---

## File Structure

```
aria-agent/
│
├── src/
│   └── Agent.jsx          # Main component — all logic, styles, and rendering
│
├── docs/
│   ├── DESIGN.md          # Design decisions and visual system rationale
│   ├── ARCHITECTURE.md    # Detailed architecture and data flow diagrams
│   └── API.md             # Anthropic API integration reference
│
├── README.md              # This file
├── CONTRIBUTING.md        # Contribution guidelines
└── .gitignore
```

---

## Configuration

All configuration lives at the top of `Agent.jsx`:

```javascript
// Model to use — pin to a specific version for reproducibility
const MODEL = "claude-sonnet-4-20250514";

// Token budget per response
// Increase for larger apps; decrease to reduce latency
const MAX_TOKENS = 8000;

// System prompt — edit to change ARIA's personality and capabilities
const SYS = `...`;

// Tool definitions — add/remove tools here
const TOOLS = [...];
```

### Switching Models

```javascript
// Faster, cheaper — good for chat-heavy usage
const MODEL = "claude-haiku-4-5-20251001";

// Highest capability — for complex app generation
const MODEL = "claude-opus-4-6";
```

---

## Extension Guide

### Add a New Tool

1. **Define the tool** in the `TOOLS` array:
   ```javascript
   {
     name: "run_python",
     description: "Execute Python code and return the result",
     input_schema: {
       type: "object",
       properties: {
         code: { type: "string", description: "Python code to run" }
       },
       required: ["code"]
     }
   }
   ```

2. **Handle it in the loop** inside `send()`:
   ```javascript
   if (u.name === "run_python") {
     handled = true;
     const result = await executePython(u.input.code); // your implementation
     results.push({
       type: "tool_result",
       tool_use_id: u.id,
       content: result
     });
   }
   ```

3. **Update the system prompt** to describe when Claude should use the new tool.

### Add Message Persistence

To save conversations across page reloads, persist `hist` to localStorage:

```javascript
// Load on mount
const [hist, setHist] = useState(() => {
  try {
    return JSON.parse(localStorage.getItem("aria_hist") || "[]");
  } catch { return []; }
});

// Save on change
useEffect(() => {
  localStorage.setItem("aria_hist", JSON.stringify(hist));
}, [hist]);
```

### Add Streaming Responses

Switch to streaming for progressive text rendering:

```javascript
const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ...payload, stream: true })
});

const reader = res.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  // Parse SSE chunks and append to UI
}
```

---

## Known Limitations

| Limitation | Details | Workaround |
|-----------|---------|-----------|
| No streaming | Full response waits before rendering | Implement SSE streaming (see Extension Guide) |
| History grows unboundedly | Very long sessions may exceed context | Add sliding window or summarisation |
| No file upload | Cannot process PDFs or images | Add base64 image blocks to message content |
| API key in client | Not suitable for production without proxy | Use FastAPI/Express backend to hold the key |
| iframe limitations | Generated apps cannot access camera/mic | Not a use case for this tool |
| No app persistence | Built apps reset on page reload | Save `app.html` to localStorage |

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork** the repository and create a feature branch
2. **Document** all new functions with JSDoc comments
3. **Test** with at least three different prompt types (chat, search, build)
4. **Keep** the zero-external-dependency constraint for the core component
5. **Open a PR** with a clear description of what changed and why

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide.

---

## Author

**Nikhil Yanamandra**
Python Backend Developer & GenAI/Agentic AI Engineer @ TCS
GitHub: [@nikhilyanamndra87](https://github.com/nikhilyanamndra87)

---

## License

MIT — see [LICENSE](./LICENSE) for details.

---

<div align="center">
  <sub>Built with ⚡ using the Anthropic Claude API</sub>
</div>
