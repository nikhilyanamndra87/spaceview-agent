/**
 * @file Agent.jsx
 * @description ARIA — AI Reasoning & Interactive Agent
 *
 * A fully client-side AI agent built as a React artifact for Claude.ai.
 * Features persistent conversation memory, live web search, and an
 * in-browser app builder powered by the Anthropic Messages API.
 *
 * @author  Nikhil Yanamandra
 * @version 1.0.0
 * @license MIT
 *
 * ──────────────────────────────────────────────────────────────────────────
 * ARCHITECTURE OVERVIEW
 * ──────────────────────────────────────────────────────────────────────────
 *
 *   User Input
 *       │
 *       ▼
 *   send()  ──►  Anthropic /v1/messages  (full history + tools)
 *                       │
 *              ┌─────────┴──────────┐
 *              │                    │
 *         stop_reason           stop_reason
 *         "end_turn"            "tool_use"
 *              │                    │
 *         Render text         ┌─────┴──────┐
 *                             │            │
 *                       web_search     build_app
 *                       (server-side)  (client-side)
 *                             │            │
 *                             │      Render iframe
 *                             │      + add tool_result
 *                             │            │
 *                             └────────────┘
 *                                    │
 *                             Loop again ──►  /v1/messages
 *
 * ──────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Model identifier for the Anthropic API.
 * Always pin to a specific version for reproducibility.
 */
const MODEL = "claude-sonnet-4-20250514";

/**
 * Maximum tokens for each API response.
 * Set high enough to accommodate full HTML app generation (~6–8k tokens).
 */
const MAX_TOKENS = 8000;

/**
 * System prompt that defines ARIA's capabilities and behavioral guidelines.
 * Injected with every API call (not stored in message history).
 *
 * Key behavioral directives:
 *  - Use web_search for any real-time / current-event queries
 *  - Use build_app to produce self-contained HTML apps
 *  - Produce visually polished, production-quality output
 */
const SYS = `You are ARIA — an elite AI assistant and full-stack builder agent with three superpowers:

1. CONVERSATION — Answer any question, explain complex topics, reason through problems
2. WEB SEARCH — Use web_search for real-time information, current events, latest data
3. BUILD APPS — Use build_app to create complete, beautiful web applications

When building apps:
- Design visually stunning UIs with gradients, animations, and modern polish
- Write fully-functional code covering all requested features
- Self-contained single HTML file with embedded <style> and <script>
- Use CDN libraries via unpkg when needed (e.g. chart.js, three.js, tone.js)
- Make it production-quality and impressive

Always be creative, proactive, and exceed expectations.`;

/**
 * Tool definitions sent to the Anthropic API on every request.
 *
 * Tool 1 — web_search (type: "web_search_20250305")
 *   A first-party Anthropic server-side tool. When Claude invokes it,
 *   the API executes the search internally and injects results into the
 *   context before returning the response. No client-side handling needed.
 *
 * Tool 2 — build_app (custom tool)
 *   A client-side tool. When Claude invokes it, the agent extracts the
 *   generated HTML, renders it in an <iframe> via srcdoc, and returns a
 *   tool_result back to the API to let Claude produce a closing message.
 */
const TOOLS = [
  /**
   * Native Anthropic web search tool.
   * Executes searches server-side; results are transparent to the client.
   */
  { type: "web_search_20250305", name: "web_search" },

  /**
   * Custom app-builder tool.
   * Claude returns a complete HTML file; the agent renders it live.
   */
  {
    name: "build_app",
    description:
      "Build a complete, self-contained web application as a single HTML file. " +
      "Use for any app, game, tool, dashboard, calculator, visualisation, or " +
      "interactive experience the user requests.",
    input_schema: {
      type: "object",
      properties: {
        /** Human-readable name shown in the preview tab */
        title: { type: "string", description: "App name" },
        /** Brief description of what the app does */
        description: { type: "string", description: "What it does" },
        /**
         * The full HTML payload.
         * Must be a self-contained file — all CSS inside <style> tags,
         * all JS inside <script> tags. External CDN links are allowed.
         */
        html: {
          type: "string",
          description:
            "Complete HTML file with all CSS in <style> tags and JS in <script> tags",
        },
      },
      required: ["title", "description", "html"],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MARKDOWN RENDERER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lightweight Markdown-to-JSX renderer.
 *
 * Supported syntax:
 *  - ``` fenced code blocks (with optional language label)
 *  - ## and ### headings
 *  - - / * unordered list items
 *  - **bold** inline spans
 *  - `inline code` spans
 *  - Blank lines as vertical spacers
 *
 * No external dependencies — intentionally kept minimal so the artifact
 * remains fully self-contained.
 *
 * @param {object} props
 * @param {string} props.text - Raw markdown string to render
 * @returns {JSX.Element|null}
 */
function MD({ text }) {
  if (!text) return null;

  const lines = text.split("\n");
  const out = [];
  let i = 0,
    k = 0; // line pointer and JSX key counter

  while (i < lines.length) {
    const l = lines[i];

    // ── Fenced code block ──────────────────────────────────────────────────
    if (l.startsWith("```")) {
      const lang = l.slice(3).trim(); // e.g. "javascript", "python"
      const code = [];
      i++;
      // Collect lines until closing fence
      while (i < lines.length && !lines[i].startsWith("```"))
        code.push(lines[i++]);

      out.push(
        <div
          key={k++}
          style={{
            background: "#080810",
            border: "1px solid #1e1e30",
            borderRadius: 10,
            margin: "10px 0",
            overflow: "hidden",
          }}
        >
          {/* Language label */}
          {lang && (
            <div
              style={{
                padding: "4px 14px",
                background: "#10101e",
                color: "#6366f1",
                fontSize: 11,
                fontWeight: 700,
                borderBottom: "1px solid #1e1e30",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {lang}
            </div>
          )}
          <pre
            style={{
              margin: 0,
              padding: "12px 16px",
              overflowX: "auto",
              fontSize: 12.5,
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              color: "#7dd3fc",
              lineHeight: 1.65,
            }}
          >
            <code>{code.join("\n")}</code>
          </pre>
        </div>
      );

    // ── H2 heading ─────────────────────────────────────────────────────────
    } else if (l.startsWith("## ")) {
      out.push(
        <h2
          key={k++}
          style={{
            color: "#f1f5f9",
            fontSize: 15,
            fontWeight: 700,
            margin: "16px 0 6px",
          }}
        >
          {fmt(l.slice(3))}
        </h2>
      );

    // ── H3 heading ─────────────────────────────────────────────────────────
    } else if (l.startsWith("### ")) {
      out.push(
        <h3
          key={k++}
          style={{
            color: "#e2e8f0",
            fontSize: 13.5,
            fontWeight: 700,
            margin: "12px 0 4px",
          }}
        >
          {fmt(l.slice(4))}
        </h3>
      );

    // ── Unordered list item ────────────────────────────────────────────────
    } else if (l.match(/^[\-\*] /)) {
      out.push(
        <div
          key={k++}
          style={{ display: "flex", gap: 8, margin: "4px 0 4px 6px" }}
        >
          <span style={{ color: "#6366f1", flexShrink: 0, marginTop: 1 }}>
            ›
          </span>
          <span style={{ color: "#94a3b8", fontSize: 13.5, lineHeight: 1.65 }}>
            {fmt(l.slice(2))}
          </span>
        </div>
      );

    // ── Blank line spacer ──────────────────────────────────────────────────
    } else if (l.trim() === "") {
      out.push(<div key={k++} style={{ height: 6 }} />);

    // ── Regular paragraph ──────────────────────────────────────────────────
    } else {
      out.push(
        <p
          key={k++}
          style={{
            margin: "3px 0",
            color: "#94a3b8",
            fontSize: 13.5,
            lineHeight: 1.7,
          }}
        >
          {fmt(l)}
        </p>
      );
    }
    i++;
  }

  return <>{out}</>;
}

/**
 * Inline markdown formatter — handles **bold** and `code` spans.
 *
 * Uses a greedy-first-match loop so mixed inline elements work correctly
 * regardless of order (e.g. "**bold `code` here**" is parsed properly).
 *
 * @param {string} text - Raw inline markdown string
 * @returns {Array<string|JSX.Element>} Mixed array of strings and elements
 */
function fmt(text) {
  const res = [];
  let rem = text,
    k = 0;

  while (rem) {
    const b = rem.match(/\*\*(.+?)\*\*/);   // **bold**
    const c = rem.match(/`([^`]+)`/);        // `code`

    // Pick whichever pattern appears earlier in the string
    let first = null;
    if (b && (!c || b.index <= c.index)) first = { m: b, type: "b" };
    else if (c) first = { m: c, type: "c" };

    // No more patterns — append remaining text and exit
    if (!first) { res.push(rem); break; }

    // Text before the match
    if (first.m.index > 0) res.push(rem.slice(0, first.m.index));

    // Matched element
    if (first.type === "b")
      res.push(
        <strong key={k++} style={{ color: "#e2e8f0", fontWeight: 700 }}>
          {first.m[1]}
        </strong>
      );
    else
      res.push(
        <code
          key={k++}
          style={{
            background: "#13131f",
            color: "#7dd3fc",
            padding: "1px 7px",
            borderRadius: 5,
            fontSize: "0.88em",
            fontFamily: "monospace",
            border: "1px solid #1e1e30",
          }}
        >
          {first.m[1]}
        </code>
      );

    // Advance past the matched portion
    rem = rem.slice(first.m.index + first.m[0].length);
  }

  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Agent — root React component for the ARIA chatbot.
 *
 * State shape:
 * ┌──────────────┬────────────────────────────────────────────────────────────┐
 * │ msgs         │ UI messages array — {role, text, app?}                     │
 * │ hist         │ API history array — {role, content} (Anthropic format)     │
 * │ input        │ Current textarea value                                     │
 * │ loading      │ Whether an API call is in flight                           │
 * │ status       │ Short status string shown in the header pill               │
 * │ app          │ Most recently built app — {title, description, html}       │
 * │ tab          │ Active panel — "chat" | "preview"                          │
 * └──────────────┴────────────────────────────────────────────────────────────┘
 */
export default function Agent() {
  // ── State ──────────────────────────────────────────────────────────────────

  /** UI-layer messages rendered in the chat panel */
  const [msgs, setMsgs] = useState([
    {
      role: "assistant",
      text:
        "Hey! I'm **ARIA** — your AI agent.\n\n" +
        "I can chat with you, **search the web** for real-time info, and **build any app** " +
        "you need — games, tools, dashboards, calculators, visualisations, anything.\n\n" +
        "Try:\n" +
        "- *\"Build me a Pomodoro timer\"*\n" +
        "- *\"What are today's top AI news?\"*\n" +
        "- *\"Create a snake game\"*\n" +
        "- *\"Make a budget tracker app\"*",
    },
  ]);

  /**
   * Full conversation history in Anthropic API format.
   * Sent verbatim with every request to maintain context across turns.
   * Grows linearly; consider trimming older turns for very long sessions.
   */
  const [hist, setHist] = useState([]);

  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  /** Last successfully built app. Persists across turns. */
  const [app, setApp] = useState(null);

  /** Active panel tab */
  const [tab, setTab] = useState("chat");

  // ── Refs ───────────────────────────────────────────────────────────────────
  const endRef = useRef(null);   // scroll anchor at bottom of message list
  const taRef  = useRef(null);   // textarea reference for auto-grow

  // ── Effects ────────────────────────────────────────────────────────────────

  /** Auto-scroll to newest message on each update */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  /**
   * Auto-grow textarea height based on content.
   * Resets to min height first to shrink when content is deleted.
   */
  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "44px";
      taRef.current.style.height =
        Math.min(taRef.current.scrollHeight, 130) + "px";
    }
  }, [input]);

  // ── Core: Agentic send loop ────────────────────────────────────────────────

  /**
   * Sends the user's message and runs the agentic tool-use loop.
   *
   * Flow:
   *  1. Append user message to UI and API history
   *  2. Call Claude with full history + tool definitions
   *  3. If stop_reason === "end_turn" → render text response, exit loop
   *  4. If stop_reason === "tool_use":
   *       a. web_search  → server-side, no action needed (API handles it)
   *       b. build_app   → extract HTML, render iframe, send tool_result back
   *  5. Repeat from step 2 until "end_turn"
   *
   * @returns {Promise<void>}
   */
  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    // Reset input and enter loading state
    setInput("");
    setLoading(true);

    // Append user message to UI
    setMsgs((p) => [...p, { role: "user", text }]);

    // Build initial API history for this turn
    let h = [...hist, { role: "user", content: text }];

    try {
      let finalText = "";
      let newApp    = null;
      let lastData  = null; // last raw API response (for saving to history)

      // ── Agentic loop ─────────────────────────────────────────────────────
      outer: while (true) {
        setStatus("Thinking…");

        // Call the Anthropic Messages API
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model:      MODEL,
            max_tokens: MAX_TOKENS,
            system:     SYS,
            tools:      TOOLS,
            messages:   h,     // full conversation history
          }),
        });

        // Surface API-level errors (auth, quota, etc.)
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error?.message || `HTTP ${res.status}`);
        }

        lastData = await res.json();

        // Extract any text blocks from this response
        const texts = (lastData.content || []).filter((b) => b.type === "text");
        if (texts.length) finalText = texts.map((b) => b.text).join("\n");

        // ── Terminal: natural end ─────────────────────────────────────────
        if (lastData.stop_reason === "end_turn") break;

        // ── Tool use: handle each invocation ─────────────────────────────
        if (lastData.stop_reason === "tool_use") {
          const uses = (lastData.content || []).filter(
            (b) => b.type === "tool_use"
          );

          // Append assistant's tool-use turn to history
          h = [...h, { role: "assistant", content: lastData.content }];

          const results  = []; // tool_result blocks to return
          let   handled  = false;

          for (const u of uses) {
            if (u.name === "build_app") {
              // ── Client-side tool: build_app ────────────────────────────
              handled = true;
              setStatus(`Building ${u.input.title}…`);

              // Store the generated app for iframe rendering
              newApp = u.input; // { title, description, html }

              // Return success signal to Claude so it can write a closing message
              results.push({
                type:        "tool_result",
                tool_use_id: u.id,
                content:     `App "${u.input.title}" has been built and is displayed in the preview panel.`,
              });
            }
            // web_search blocks are handled server-side by Anthropic;
            // they do NOT appear as tool_use in stop_reason === "tool_use"
            // under the native web_search_20250305 type.
          }

          if (handled) {
            // Add tool results and loop back to get Claude's closing message
            h = [...h, { role: "user", content: results }];
          } else {
            // Unexpected tool use (shouldn't happen); exit cleanly
            break outer;
          }
        } else {
          // Unexpected stop_reason; exit loop
          break;
        }
      }
      // ── End agentic loop ─────────────────────────────────────────────────

      // Save the final assistant turn to API history for next request
      if (lastData)
        h = [...h, { role: "assistant", content: lastData.content }];
      setHist(h);

      // Show built app in preview panel
      if (newApp) {
        setApp(newApp);
        setTab("preview");
      }

      // Append assistant's text reply to UI
      setMsgs((p) => [
        ...p,
        {
          role: "assistant",
          text: finalText || "✅ Done!",
          app:  newApp || null, // attach app metadata for the "tap to preview" badge
        },
      ]);
    } catch (err) {
      // Surface errors gracefully in the chat
      setMsgs((p) => [
        ...p,
        { role: "assistant", text: `❌ Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
      setStatus("");
    }
  }

  const hasApp = !!app;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display:    "flex",
        flexDirection: "column",
        height:     "100vh",
        background: "#06060e",
        color:      "#e2e8f0",
        fontFamily: '"DM Sans", "Geist", -apple-system, BlinkMacSystemFont, sans-serif',
        overflow:   "hidden",
      }}
    >
      {/* ── Global styles & keyframe animations ─────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;600&display=swap');

        /* Loading dot pulse */
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

        /* New message slide-in */
        @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

        /* Logo glow breathe */
        @keyframes glow { 0%,100%{box-shadow:0 0 20px #6366f133} 50%{box-shadow:0 0 40px #6366f166} }

        /* Scrollbar styling */
        *::-webkit-scrollbar { width: 4px }
        *::-webkit-scrollbar-track { background: transparent }
        *::-webkit-scrollbar-thumb { background: #1e1e30; border-radius: 4px }

        textarea::placeholder { color: #334155 }
        textarea:focus { border-color: #6366f144 !important; }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "12px 20px",
          borderBottom:   "1px solid #0f0f1e",
          background:     "#08081296",
          backdropFilter: "blur(20px)",
          zIndex:         10,
        }}
      >
        {/* Brand + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Animated logo */}
          <div
            style={{
              width:          36,
              height:         36,
              borderRadius:   10,
              background:     "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              fontSize:       17,
              flexShrink:     0,
              animation:      "glow 3s ease-in-out infinite",
            }}
          >
            ⚡
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#f8fafc", letterSpacing: "-0.02em" }}>
              ARIA
            </div>
            <div style={{ fontSize: 11, color: "#334155", fontWeight: 500, letterSpacing: "0.05em" }}>
              AI AGENT
            </div>
          </div>

          {/* Loading status pill — visible only during API calls */}
          {loading && (
            <div
              style={{
                display:    "flex",
                alignItems: "center",
                gap:        7,
                background: "#0f0f20",
                border:     "1px solid #6366f130",
                padding:    "5px 12px",
                borderRadius: 20,
                animation:  "slideUp 0.2s ease",
              }}
            >
              <div style={{ display: "flex", gap: 3 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width:       5,
                      height:      5,
                      borderRadius: "50%",
                      background:  "#6366f1",
                      animation:   `pulse 1.2s ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: 12, color: "#818cf8", fontWeight: 500 }}>
                {status || "Thinking…"}
              </span>
            </div>
          )}
        </div>

        {/* Chat / Preview toggle — only visible when an app has been built */}
        {hasApp && (
          <div
            style={{
              display:      "flex",
              background:   "#0c0c18",
              border:       "1px solid #1a1a2e",
              borderRadius: 10,
              padding:      3,
              gap:          2,
            }}
          >
            {[
              { id: "chat",    icon: "💬", label: "Chat" },
              { id: "preview", icon: "🖥️", label: "Preview" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding:      "6px 14px",
                  borderRadius: 8,
                  border:       tab === t.id ? "1px solid #6366f130" : "1px solid transparent",
                  cursor:       "pointer",
                  fontSize:     12,
                  fontWeight:   600,
                  display:      "flex",
                  alignItems:   "center",
                  gap:          5,
                  background:   tab === t.id
                    ? "linear-gradient(135deg,#6366f120,#3b82f620)"
                    : "transparent",
                  color:        tab === t.id ? "#818cf8" : "#334155",
                  transition:   "all 0.18s",
                  fontFamily:   "inherit",
                }}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>

        {/* ── Chat panel ──────────────────────────────────────────────── */}
        {/*
          Hidden (display:none) when the preview tab is active to preserve
          scroll position and avoid remounting the message list.
        */}
        <div
          style={{
            display:       tab === "preview" && hasApp ? "none" : "flex",
            flexDirection: "column",
            flex:          1,
            overflow:      "hidden",
          }}
        >
          {/* Message list */}
          <div
            style={{
              flex:          1,
              overflowY:     "auto",
              padding:       "20px 20px 10px",
              display:       "flex",
              flexDirection: "column",
              gap:           16,
            }}
          >
            {msgs.map((m, i) => (
              <div
                key={i}
                style={{
                  display:        "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                  alignItems:     "flex-end",
                  gap:            10,
                  animation:      "slideUp 0.25s ease",
                }}
              >
                {/* Assistant avatar */}
                {m.role === "assistant" && (
                  <div
                    style={{
                      width:          30,
                      height:         30,
                      borderRadius:   9,
                      background:     "linear-gradient(135deg,#6366f1,#3b82f6)",
                      display:        "flex",
                      alignItems:     "center",
                      justifyContent: "center",
                      fontSize:       14,
                      flexShrink:     0,
                      marginBottom:   2,
                    }}
                  >
                    ⚡
                  </div>
                )}

                {/* Message bubble */}
                <div
                  style={{
                    maxWidth:     "80%",
                    padding:      m.role === "user" ? "10px 16px" : "13px 16px",
                    borderRadius: m.role === "user"
                      ? "18px 18px 4px 18px"
                      : "4px 18px 18px 18px",
                    background: m.role === "user"
                      ? "linear-gradient(135deg,#6366f1,#4f46e5)"
                      : "#0d0d1a",
                    border:     m.role === "user" ? "none" : "1px solid #131325",
                    fontSize:   13.5,
                    boxShadow:  m.role === "user"
                      ? "0 4px 20px #6366f133"
                      : "0 2px 12px #00000066",
                  }}
                >
                  {m.role === "user" ? (
                    <span style={{ color: "#fff", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {m.text}
                    </span>
                  ) : (
                    <>
                      <MD text={m.text} />
                      {/* App preview badge — shown when this message triggered a build */}
                      {m.app && (
                        <div
                          onClick={() => setTab("preview")}
                          style={{
                            display:      "inline-flex",
                            alignItems:   "center",
                            gap:          7,
                            marginTop:    12,
                            background:   "#0f0f20",
                            border:       "1px solid #6366f140",
                            padding:      "7px 14px",
                            borderRadius: 22,
                            fontSize:     12,
                            color:        "#818cf8",
                            cursor:       "pointer",
                            fontWeight:   600,
                            transition:   "all 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background   = "#1a1a30";
                            e.currentTarget.style.borderColor  = "#6366f166";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background   = "#0f0f20";
                            e.currentTarget.style.borderColor  = "#6366f140";
                          }}
                        >
                          🖥️{" "}
                          <span>
                            <strong style={{ color: "#a5b4fc" }}>{m.app.title}</strong>
                            {" "}— tap to view →
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator — shown while API call is in flight */}
            {loading && (
              <div
                style={{
                  display:    "flex",
                  alignItems: "flex-end",
                  gap:        10,
                  animation:  "slideUp 0.2s ease",
                }}
              >
                <div
                  style={{
                    width:          30,
                    height:         30,
                    borderRadius:   9,
                    background:     "linear-gradient(135deg,#6366f1,#3b82f6)",
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    fontSize:       14,
                    flexShrink:     0,
                  }}
                >
                  ⚡
                </div>
                <div
                  style={{
                    background:   "#0d0d1a",
                    border:       "1px solid #131325",
                    padding:      "12px 16px",
                    borderRadius: "4px 18px 18px 18px",
                    display:      "flex",
                    gap:          5,
                    alignItems:   "center",
                  }}
                >
                  {[0, 1, 2].map((n) => (
                    <div
                      key={n}
                      style={{
                        width:        7,
                        height:       7,
                        borderRadius: "50%",
                        background:   "#6366f1",
                        animation:    `pulse 1.2s ${n * 0.22}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={endRef} />
          </div>

          {/* ── Input bar ─────────────────────────────────────────────── */}
          <div
            style={{
              padding:      "12px 20px 16px",
              borderTop:    "1px solid #0f0f1e",
              background:   "#06060e",
              display:      "flex",
              gap:          10,
              alignItems:   "flex-end",
            }}
          >
            {/*
              Auto-growing textarea.
              Enter submits; Shift+Enter inserts a newline.
              Height is managed via the useEffect above.
            */}
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask anything or say 'build me a…' — Enter to send"
              style={{
                flex:        1,
                background:  "#0d0d1a",
                border:      "1px solid #1a1a2e",
                borderRadius: 14,
                color:       "#e2e8f0",
                padding:     "11px 16px",
                fontSize:    13.5,
                resize:      "none",
                outline:     "none",
                fontFamily:  "inherit",
                minHeight:   44,
                maxHeight:   130,
                lineHeight:  1.55,
                transition:  "border-color 0.2s",
              }}
            />

            {/* Send button */}
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                width:       44,
                height:      44,
                borderRadius: 12,
                border:      loading || !input.trim() ? "1px solid #1a1a2e" : "none",
                flexShrink:  0,
                background:  loading || !input.trim()
                  ? "#0d0d1a"
                  : "linear-gradient(135deg,#6366f1,#4f46e5)",
                color:       loading || !input.trim() ? "#1e1e30" : "#fff",
                cursor:      loading || !input.trim() ? "not-allowed" : "pointer",
                fontSize:    18,
                display:     "flex",
                alignItems:  "center",
                justifyContent: "center",
                transition:  "all 0.2s",
                boxShadow:   loading || !input.trim()
                  ? "none"
                  : "0 0 20px #6366f155",
              }}
            >
              ➤
            </button>
          </div>
        </div>

        {/* ── Preview panel ────────────────────────────────────────────── */}
        {/*
          Sandboxed iframe displaying the generated app via srcdoc.
          sandbox="allow-scripts allow-same-origin" is the minimum required
          to run JavaScript while preventing navigation away from the page.
        */}
        {tab === "preview" && hasApp && (
          <div
            style={{
              flex:          1,
              display:       "flex",
              flexDirection: "column",
              background:    "#fff",
              animation:     "slideUp 0.2s ease",
            }}
          >
            {/* Faux browser chrome */}
            <div
              style={{
                padding:      "10px 16px",
                borderBottom: "1px solid #e5e7eb",
                background:   "#f9fafb",
                display:      "flex",
                alignItems:   "center",
                gap:          10,
              }}
            >
              {/* Traffic light dots */}
              <div style={{ display: "flex", gap: 6 }}>
                {["#ef4444", "#f59e0b", "#22c55e"].map((c) => (
                  <div
                    key={c}
                    style={{ width: 11, height: 11, borderRadius: "50%", background: c }}
                  />
                ))}
              </div>

              {/* URL-bar style app title */}
              <div
                style={{
                  flex:         1,
                  background:   "#f1f5f9",
                  border:       "1px solid #e2e8f0",
                  borderRadius: 7,
                  padding:      "4px 12px",
                  fontSize:     12,
                  color:        "#64748b",
                  fontWeight:   500,
                }}
              >
                🖥️ {app.title}
              </div>

              {/* Close / back to chat */}
              <button
                onClick={() => setTab("chat")}
                style={{
                  background: "transparent",
                  border:     "none",
                  cursor:     "pointer",
                  color:      "#94a3b8",
                  fontSize:   18,
                  lineHeight: 1,
                  padding:    2,
                }}
                title="Back to chat"
              >
                ✕
              </button>
            </div>

            {/* The generated app */}
            <iframe
              srcDoc={app.html}
              sandbox="allow-scripts allow-same-origin"
              style={{ flex: 1, border: "none", width: "100%" }}
              title={app.title}
            />
          </div>
        )}
      </div>
    </div>
  );
}
