"use client";

/**
 * REFERENCE ONLY — this is what a CLIENT WEBAPP builds, not library code.
 *
 * The canvas draws markers and tells you when one is clicked. Everything you
 * see in this file — thread bodies, authors, timestamps, the composer, resolve,
 * persistence — is the consumer's. The package never sees any of it.
 */

import { useEffect, useRef, useState } from "react";
import type { CommentTarget } from "@astronautics44/neura-annotation-canvas";

export interface Thread {
  id: string;
  target: CommentTarget;
  resolved: boolean;
  /**
   * Soft delete. `onCommentUndo` can ask for a thread back, and only we hold the
   * conversation — so a delete tombstones it rather than dropping it.
   */
  deleted: boolean;
  messages: { author: string; text: string; at: string }[];
}

interface Props {
  threads: Thread[];
  selectedThreadId: string | null;
  focusedAnnotationIds: string[];
  describeTarget: (target: CommentTarget) => string;
  onReply: (threadId: string, text: string) => void;
  onToggleResolved: (threadId: string) => void;
  onDelete: (threadId: string) => void;
  onSelect: (threadId: string | null) => void;
}

const C = {
  surface: "#ffffff",
  border: "#e0e0e0",
  subtle: "#f0f0f0",
  text: "#1a1a1a",
  dim: "#666666",
  muted: "#b0b0b0",
  accent: "#2563eb",
  danger: "#ef4444",
};

export function CommentSidebar({
  threads,
  selectedThreadId,
  focusedAnnotationIds,
  describeTarget,
  onReply,
  onToggleResolved,
  onDelete,
  onSelect,
}: Props) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // A newly opened thread means a fresh, focused reply box.
  useEffect(() => { setText(""); }, [selectedThreadId]);

  const selected = threads.find((t) => t.id === selectedThreadId) ?? null;

  // The "which annotation is in focus" channel: onSelectionChange gives ids,
  // and the threads for them load here.
  const focusThreads = threads.filter(
    (t) => t.target.kind === "annotation" && focusedAnnotationIds.includes(t.target.annotationId),
  );

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    if (selected) onReply(selected.id, body);
    setText("");
  };

  return (
    <div style={{ width: 300, flexShrink: 0, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", fontSize: 13, color: C.text, overflow: "hidden" }}>
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: C.dim, display: "flex", justifyContent: "space-between" }}>
        <span>Comments</span>
        <span style={{ color: C.muted }}>{threads.length}</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* The open thread. */}
        {selected && (
          <Block accentBar>
            <Row>
              <Meta>{describeTarget(selected.target)}</Meta>
              <button onClick={() => onSelect(null)} style={linkBtn}>close</button>
            </Row>
            {selected.messages.map((m, i) => (
              <div key={i} style={{ padding: "6px 0", borderTop: i === 0 ? "none" : `1px solid ${C.subtle}` }}>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 2 }}>
                  {m.author} · {m.at}
                </div>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{m.text}</div>
              </div>
            ))}
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
                e.stopPropagation();
              }}
              placeholder="Reply…"
              rows={2}
              style={textareaStyle}
            />
            <Row>
              <Btn onClick={submit} primary disabled={!text.trim()}>Reply</Btn>
              <Btn onClick={() => onToggleResolved(selected.id)}>
                {selected.resolved ? "Reopen" : "Resolve"}
              </Btn>
              <Btn onClick={() => onDelete(selected.id)} danger>Delete</Btn>
            </Row>
          </Block>
        )}

        {/* Threads on whatever is selected on the canvas right now. */}
        {!selected && focusedAnnotationIds.length > 0 && (
          <Block>
            <Meta>
              In focus · {focusedAnnotationIds.length} shape{focusedAnnotationIds.length > 1 ? "s" : ""} selected
            </Meta>
            {focusThreads.length === 0 ? (
              <Empty>
                No threads here. Press <Kbd>M</Kbd> to comment on the selection.
              </Empty>
            ) : (
              focusThreads.map((t) => <ThreadRow key={t.id} thread={t} describeTarget={describeTarget} onSelect={onSelect} />)
            )}
          </Block>
        )}

        {/* Everything else. */}
        {!selected && (
          <Block>
            <Meta>All threads</Meta>
            {threads.length === 0 ? (
              <Empty>
                Pick the <b>speech-bubble tool</b> (<Kbd>M</Kbd>) and click blank paper for a free
                pin, or click a shape to attach one. With a shape selected, the{" "}
                <b>Comment</b> button on the selection bar does the same.
              </Empty>
            ) : (
              threads.map((t) => <ThreadRow key={t.id} thread={t} describeTarget={describeTarget} onSelect={onSelect} />)
            )}
          </Block>
        )}
      </div>
    </div>
  );
}

function ThreadRow({ thread, describeTarget, onSelect }: {
  thread: Thread;
  describeTarget: (t: CommentTarget) => string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      onClick={() => onSelect(thread.id)}
      style={{ padding: "7px 0", borderTop: `1px solid ${C.subtle}`, cursor: "pointer", opacity: thread.resolved ? 0.5 : 1 }}
    >
      <div style={{ fontSize: 11, color: C.dim, display: "flex", gap: 6 }}>
        <span>{describeTarget(thread.target)}</span>
        <span style={{ marginLeft: "auto" }}>
          {thread.messages.length}
          {thread.resolved ? " · resolved" : ""}
        </span>
      </div>
      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {thread.messages[0]?.text ?? ""}
      </div>
    </div>
  );
}

const textareaStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 6, padding: "6px 8px",
  border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13,
  fontFamily: "inherit", resize: "vertical", color: C.text, background: "#fff",
};

const linkBtn: React.CSSProperties = {
  marginLeft: "auto", background: "none", border: "none", color: C.dim,
  fontSize: 11, cursor: "pointer", padding: 0, fontFamily: "inherit",
};

function Block({ children, accentBar }: { children: React.ReactNode; accentBar?: boolean }) {
  return (
    <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, borderLeft: accentBar ? `2px solid ${C.accent}` : "2px solid transparent" }}>
      {children}
    </div>
  );
}
function Meta({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>{children}</div>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, paddingTop: 4 }}>{children}</div>;
}
function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd style={{ padding: "1px 4px", background: "#f0f0f0", border: "1px solid #d0d0d0", borderRadius: 3, fontSize: 10, fontFamily: "monospace" }}>{children}</kbd>;
}
function Btn({ children, onClick, primary, danger, disabled }: {
  children: React.ReactNode; onClick: () => void;
  primary?: boolean; danger?: boolean; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "4px 10px", borderRadius: 4, fontSize: 12, fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        border: `1px solid ${danger ? C.danger : primary ? C.accent : C.border}`,
        background: disabled ? C.subtle : primary ? C.accent : "#fff",
        color: disabled ? C.muted : primary ? "#fff" : danger ? C.danger : C.text,
      }}
    >
      {children}
    </button>
  );
}
