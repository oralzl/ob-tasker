import { KeyboardEvent, useEffect, useState } from "react";

export interface InlineEditableTextProps {
  value?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onSave: (value: string) => Promise<void> | void;
}

export function InlineEditableText({
  value = "",
  placeholder = "",
  className = "",
  disabled = false,
  onSave,
}: InlineEditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [editing, value]);

  async function save() {
    setEditing(false);
    const nextValue = draft.trim();
    if (nextValue !== value.trim()) {
      await onSave(nextValue);
    }
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void save();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        className={`tasker-inline-input ${className}`}
        disabled={disabled}
        value={draft}
        onBlur={() => void save()}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <button
      className={`tasker-inline-text ${className}`}
      disabled={disabled}
      type="button"
      onClick={() => setEditing(true)}
    >
      {value.trim() || placeholder}
    </button>
  );
}
