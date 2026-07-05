export function Panel({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
          <div className="panel-title">{title}</div>
        </div>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}

export function Chip({
  variant,
  children,
}: {
  variant: "real" | "mock" | "error" | "busy" | "neutral";
  children: React.ReactNode;
}) {
  const withDot = variant === "real" || variant === "mock" || variant === "error" || variant === "busy";
  return (
    <span className={`chip chip-${variant}`}>
      {withDot ? <span className="dot" /> : null}
      {children}
    </span>
  );
}

export function ServiceChip({ real }: { real: boolean }) {
  return real ? (
    <Chip variant="real">Thực · đã kết nối</Chip>
  ) : (
    <Chip variant="mock">Mock · offline</Chip>
  );
}

export function Metric({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="metric">
      <div className="m-label">{label}</div>
      <div className={`m-value${small ? " small" : ""}`}>{value}</div>
    </div>
  );
}

export function Kv({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="kv">
      <span className="k">{label}</span>
      <span className={`v${mono ? " mono" : ""}`}>{value}</span>
    </div>
  );
}

export function StepCard({
  label,
  room,
  detail,
  status,
}: {
  label: string;
  room: string;
  detail?: string;
  status: string;
}) {
  const isDone = status === "done" || status === "completed";
  const statusLabel =
    status === "done" || status === "completed"
      ? "xong"
      : status === "in_progress"
        ? "đang thực hiện"
        : status === "skipped"
          ? "đã bỏ qua"
          : "chưa tới lượt";
  return (
    <div className={`step-card${isDone ? " done" : ""}`}>
      <div className="sc-top">
        <span className="sc-label">{label}</span>
        <Chip variant={isDone ? "real" : status === "in_progress" ? "busy" : "neutral"}>{statusLabel}</Chip>
      </div>
      <div className="sc-room">{room}</div>
      {detail ? <div className="sc-detail">{detail}</div> : null}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}
