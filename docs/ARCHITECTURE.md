# ARIA — Architecture Document

> **Audience:** Engineers maintaining, extending, or porting ARIA to other environments.

---

## Overview

ARIA is a **single-component React application** — deliberately monolithic to run in the Claude.ai artifact sandbox, which cannot import local modules or install packages.

All logic (API calls, tool execution, state management, rendering) lives in `src/Agent.jsx`. This is an intentional constraint, not a design flaw. If porting to a full application, split according to the module breakdown in the [Refactoring Guide](#refactoring-guide) below.

---

## State Machine

The component has two parallel state layers:

```
┌─────────────────────────────────────────────────────────────────────┐
│  UI Layer (display)          API Layer (data)                       │
│                                                                     │
│  msgs[]                      hist[]                                 │
│  ─────────────────────       ─────────────────────────────────────  │
│  { role, text, app? }        { role: "user"|"assistant",            │
│                                content: string | ContentBlock[] }   │
│                                                                     │
│  Grows on each turn.         Grows on each turn.                    │
│  Drives chat rendering.      Sent verbatim to Anthropic API.        │
└─────────────────────────────────────────────────────────────────────┘
```

They stay in sync but serve different masters. `msgs` can be freely reformatted for the UI. `hist` must stay in valid Anthropic API format.

### Loading State Machine

```
idle ──[user sends]──► loading
                           │
                    ┌──────┴────────┐
                    │               │
              end_turn         tool_use
                    │               │
                    │         ┌─────┴──────┐
                    │         │            │
                    │   web_search     build_app
                    │   (server)       (client)
                    │         │            │
                    │         └─────┬──────┘
                    │               │
                    │         loop back to
                    │         API call
                    │               │
                    └───────────────┘
                           │
                        idle
```

---

## Data Formats

### UI Message (`msgs` array item)

```typescript
interface UIMessage {
  role: "user" | "assistant";
  text: string;          // Markdown string for display
  app?: {                // Present only when build_app was invoked
    title: string;
    description: string;
    html: string;
  };
}
```

### API Message (`hist` array item)

```typescript
// User turn — simple string
interface UserMessage {
  role: "user";
  content: string;
}

// Assistant turn — content block array
interface AssistantMessage {
  role: "assistant";
  content: ContentBlock[];
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };
```

### API Request Payload

```typescript
interface AnthropicRequest {
  model:      string;           // "claude-sonnet-4-20250514"
  max_tokens: number;           // 8000
  system:     string;           // SYS constant
  tools:      ToolDefinition[]; // TOOLS array
  messages:   APIMessage[];     // full hist array
}
```

### API Response Payload

```typescript
interface AnthropicResponse {
  id:           string;
  type:         "message";
  role:         "assistant";
  content:      ContentBlock[];
  model:        string;
  stop_reason:  "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
  usage: {
    input_tokens:  number;
    output_tokens: number;
  };
}
```

---

## Tool Execution Model

### Server-Side Tools (web_search)

```
Client ──► POST /v1/messages ──► Anthropic API
                                      │
                                 Detects search intent
                                      │
                                 Executes search internally
                                      │
                                 Injects results into context
                                      │
                                 Generates response with results
                                      │
Client ◄── JSON response ◄──── Returns stop_reason: "end_turn"
```

The client never sees the search queries or raw results — only Claude's synthesised response incorporating them. This is the "server-side tool" pattern.

### Client-Side Tools (build_app)

```
Client ──► POST /v1/messages ──► Anthropic API
                                      │
                                 Generates tool invocation
                                      │
Client ◄── stop_reason: "tool_use" ◄─┘
    │
    ├── Extract tool_use block from content
    ├── Execute locally (store HTML, render iframe)
    ├── Construct tool_result block
    │
    └──► POST /v1/messages (with tool_result in hist)
                                      │
                                 Generates closing message
                                      │
Client ◄── stop_reason: "end_turn" ◄─┘
```

This is the "client-side tool" or "function calling" pattern. The client owns execution and must return a result for the model to continue.

---

## Critical Implementation Notes

### 1. History Format on Tool-Use Turns

When `stop_reason === "tool_use"`, the history update must happen in this exact order:

```javascript
// Step 1: Append assistant's tool-use content
hist.push({ role: "assistant", content: data.content });
//         └── includes tool_use blocks

// Step 2: Execute tools, collect results

// Step 3: Append tool results as a USER message
hist.push({ role: "user", content: toolResults });
//         └── array of { type: "tool_result", tool_use_id, content }
```

Reversing steps 1 and 3, or omitting step 1, causes a 400 Bad Request from the API. The assistant message containing the `tool_use` block MUST precede the `tool_result` user message.

### 2. Capturing Final Text Across Loop Iterations

`finalText` is reassigned (not appended) on each loop iteration:

```javascript
let finalText = "";

while (true) {
  const data = await callAPI(hist);
  const texts = data.content.filter(b => b.type === "text");
  if (texts.length) finalText = texts.map(b => b.text).join("\n");
  // Overwrites previous — correct, because text blocks accumulate per-turn,
  // not across turns. Only the final turn's text is shown in the UI.
  ...
}
```

This is correct because we want the text from the *final* assistant turn — the closing message after all tools are done — not from an intermediate turn.

### 3. Saving Final Turn to History

After `break`ing out of the loop, `lastData` holds the last API response. We must add it to `hist` before saving:

```javascript
if (lastData)
  h = [...h, { role: "assistant", content: lastData.content }];
setHist(h);
```

If this step is skipped, the next message will not have context of Claude's last reply, causing incoherent follow-ups.

### 4. Infinite Loop Prevention

The `break outer` in the else branch handles any unexpected `stop_reason` values:

```javascript
outer: while (true) {
  ...
  if (stop_reason === "end_turn") break;
  if (stop_reason === "tool_use") {
    ...
    if (handled) continue;  // loop back — we sent tool results
    else break outer;       // unknown tools — exit cleanly
  }
  break; // unknown stop_reason — exit
}
```

Without this, a malformed response or unexpected stop reason could spin the loop indefinitely.

---

## Refactoring Guide

To port this from a monolithic artifact to a full application:

```
src/
├── api/
│   └── anthropic.js       # fetch wrapper, TOOLS, MODEL, MAX_TOKENS constants
│
├── hooks/
│   ├── useAgent.js        # send() logic + all state (msgs, hist, loading, etc.)
│   └── useAutoGrow.js     # textarea auto-grow effect
│
├── components/
│   ├── Agent.jsx           # Root layout only — composes everything
│   ├── Header.jsx          # Logo, status pill, tab switcher
│   ├── MessageList.jsx     # Scrolling message list
│   ├── MessageBubble.jsx   # User + assistant bubble variants
│   ├── TypingIndicator.jsx # Animated dots
│   ├── InputBar.jsx        # Textarea + send button
│   └── PreviewPanel.jsx    # Browser chrome + iframe
│
├── renderers/
│   └── Markdown.jsx        # MD component + fmt helper
│
└── constants/
    ├── styles.js            # Design tokens (colours, spacing, type)
    └── prompts.js           # SYS prompt
```

### Extracting `useAgent`

The `send()` function and its state (`msgs`, `hist`, `loading`, `status`, `app`, `tab`) should move to a custom hook:

```javascript
// hooks/useAgent.js
export function useAgent() {
  const [msgs, setMsgs] = useState([...]);
  const [hist, setHist] = useState([]);
  // ...

  async function send(text) { /* current send() body */ }

  return { msgs, hist, loading, status, app, tab, setTab, send };
}
```

The component then becomes:

```jsx
export default function Agent() {
  const agent = useAgent();
  return (
    <Layout>
      <Header status={agent.status} ... />
      <MessageList msgs={agent.msgs} ... />
      <InputBar onSend={agent.send} loading={agent.loading} />
      {agent.app && <PreviewPanel app={agent.app} />}
    </Layout>
  );
}
```

---

## Security Considerations

### API Key Exposure

In the Claude.ai artifact context, authentication is handled by the platform — no key is embedded in the code. For standalone deployments:

- **Never** put `sk-ant-...` keys in client-side JavaScript
- Use a backend proxy:
  ```
  Browser ──► /api/chat (your server) ──► Anthropic API
                    └── key stored in env var
  ```
- Rate-limit and authenticate your proxy endpoint

### iframe Sandbox

The `sandbox="allow-scripts allow-same-origin"` attribute is the minimum required. Consider the implications:

- `allow-same-origin` is required for apps using `localStorage`
- Without `allow-same-origin`, scripts still run but storage APIs fail
- The generated HTML comes from Claude, which is generally safe, but always treat external HTML as untrusted

### Content Security Policy

For production deployments, add a CSP that restricts `frame-src` to `'self'` and sets appropriate `script-src` policies.

---

## Testing Recommendations

### Manual Test Matrix

| Scenario | Expected outcome |
|----------|-----------------|
| Simple question ("What is React?") | Single API call, text response, no tools |
| Web search ("latest AI news today") | Single API call, search executes, text with citations |
| Simple app build ("make a counter") | Tool use loop: tool_use → tool_result → end_turn |
| Complex app build ("make a chess game") | Same loop, higher token usage, ~15s latency |
| Follow-up on built app ("add dark mode") | History carries app context, Claude modifies and rebuilds |
| Very long conversation (20+ turns) | History grows, responses still coherent |
| API error (disconnect network) | Error message appears in chat, loading state cleared |
| Empty input submission | Button disabled, no API call |

### Automated Testing

For the `send()` function logic:

```javascript
// Mock fetch to return controlled responses
global.fetch = jest.fn()
  .mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({
      stop_reason: "tool_use",
      content: [{
        type: "tool_use",
        id: "tu_001",
        name: "build_app",
        input: { title: "Counter", description: "A counter", html: "<h1>0</h1>" }
      }]
    })
  })
  .mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Here's your counter app!" }]
    })
  });
```

Test assertions:
- `msgs` contains the assistant response after both API calls resolve
- `hist` length is correct (user + tool-use assistant + tool-result user + final assistant = 4 entries)
- `app` state is set to the built app
- `loading` returns to `false` after completion
