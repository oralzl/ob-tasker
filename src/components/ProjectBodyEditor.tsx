import { useCallback, useEffect, useState } from "react";

type SaveStatus = "saved" | "dirty" | "saving" | "error";

export interface ProjectBodyEditorProps {
  body: string;
  disabled: boolean;
  onSave: (body: string) => Promise<void>;
}

export function ProjectBodyEditor({ body, disabled, onSave }: ProjectBodyEditorProps) {
  const [draft, setDraft] = useState(body);
  const [lastSaved, setLastSaved] = useState(body);
  const [status, setStatus] = useState<SaveStatus>("saved");

  useEffect(() => {
    setDraft(body);
    setLastSaved(body);
    setStatus("saved");
  }, [body]);

  const save = useCallback(async () => {
    if (draft === lastSaved || disabled) {
      return;
    }

    setStatus("saving");
    try {
      await onSave(draft);
      setLastSaved(draft);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, [disabled, draft, lastSaved, onSave]);

  useEffect(() => {
    if (draft === lastSaved || disabled) {
      return undefined;
    }

    setStatus("dirty");
    const timeout = window.setTimeout(() => {
      void save();
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [disabled, draft, lastSaved, save]);

  return (
    <section className="tasker-body-editor">
      <div className="tasker-body-editor-bar">
        <div>
          <h2>项目正文</h2>
          <p>这里编辑项目背景、决策和备注，任务区由左侧管理。</p>
        </div>
        <div className="tasker-save-controls">
          <span className={`tasker-save-status is-${status}`}>{statusLabel(status)}</span>
          <button className="tasker-secondary-button" type="button" disabled={disabled} onClick={() => void save()}>
            保存
          </button>
        </div>
      </div>
      <textarea
        className="tasker-body-textarea"
        disabled={disabled}
        spellCheck={false}
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
      />
    </section>
  );
}

function statusLabel(status: SaveStatus): string {
  if (status === "dirty") {
    return "有未保存更改";
  }

  if (status === "saving") {
    return "正在保存";
  }

  if (status === "error") {
    return "保存失败";
  }

  return "已保存";
}
