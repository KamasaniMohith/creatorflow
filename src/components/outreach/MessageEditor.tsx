"use client";

import { useState } from "react";
import { Check, Copy, RefreshCw, Sparkles } from "lucide-react";
import type { Creator } from "@/types/creator";

export function MessageEditor({
  creator,
  brand,
  message,
  onChange,
  onGenerate,
}: {
  creator: Creator;
  brand: string;
  message: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopyError("");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error("Unable to copy the outreach message.", error);
      setCopyError("Copy failed. Select and copy the message manually.");
    }
  }

  return (
    <div className="message-editor">
      <div className="message-editor-heading"><span><Sparkles size={14} /> DEMO MESSAGE GENERATOR</span><button className="text-button" onClick={onGenerate}><RefreshCw size={13} /> Regenerate</button></div>
      <textarea aria-label={`Message for ${creator.name}`} rows={6} value={message} onChange={(event) => onChange(event.target.value)} />
      <div className="message-editor-footer"><span>Personalized with {creator.name.split(" ")[0]}, {creator.niche.toLowerCase()} &amp; {brand || "your brand"}</span><button className="button button-secondary button-small" onClick={copyMessage}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy message"}</button></div>
      {copyError && <p className="copy-error" role="alert">{copyError}</p>}
    </div>
  );
}
