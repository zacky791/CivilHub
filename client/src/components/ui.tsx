import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Inbox,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { dateLabel, download, money } from "../lib/finance";
import { useWorkspace } from "../services/repository";
import { addFiles, getFile, removeFile } from "../services/files";
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? "brand-small" : ""}`}>
      <span className="brand-symbol">
        <svg viewBox="0 0 40 40" fill="none">
          <path
            d="M28 11a12 12 0 1 0 0 18M20 11v18M12 20h16"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {!small && (
        <span>
          Civil<span className="brand-light">Hub</span>
          <span className="brand-dot">.</span>
        </span>
      )}
    </div>
  );
}
export function IconButton({
  label,
  children,
  onClick,
  className = "",
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`icon-button ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Empty({
  title = "Nothing here yet",
  text = "Your records will appear here.",
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={25} />
      </span>
      <strong>{title}</strong>
      <p>{text}</p>
      {action}
    </div>
  );
}
let openModals = 0;
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    id = useRef(`dialog-${crypto.randomUUID()}`),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    openModals++;
    document.body.style.overflow = "hidden";
    const el = ref.current;
    const firstInput = el?.querySelector<HTMLElement>(
      'input:not([type="file"]),select,textarea',
    );
    (firstInput ?? el)?.focus();
    function key(e: KeyboardEvent) {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs.item(dialogs.length - 1) !== el) return;
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab" && el) {
        const all = [
          ...el.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select,textarea,a[href],[tabindex="0"]',
          ),
        ].filter((x) => x.offsetParent !== null);
        const first = all[0],
          last = all.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === el)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      openModals--;
      document.body.style.overflow = openModals > 0 ? "hidden" : "";
      document.removeEventListener("keydown", key);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id.current}
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-heading">
          <div>
            <h2 id={id.current}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={19} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
type ToastFn = (message: string, error?: boolean) => void;
const ToastContext = createContext<ToastFn>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<
    { id: string; message: string; error: boolean }[]
  >([]);
  const toast: ToastFn = (message, error = false) => {
    const id = crypto.randomUUID();
    setItems((a) => [...a, { id, message, error }]);
    setTimeout(() => setItems((a) => a.filter((x) => x.id !== id)), 5000);
  };
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.error ? "toast-error" : ""}`}>
            {t.error ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}
            <span>{t.message}</span>
            <IconButton
              label="Dismiss notification"
              onClick={() => setItems((a) => a.filter((x) => x.id !== t.id))}
            >
              <X size={15} />
            </IconButton>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
export function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "issues" in error)
    return "Please check the required fields and amounts.";
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
export function StatCard({
  label,
  value,
  note,
  type = "jobs",
  accent = false,
}: {
  label: string;
  value: string;
  note?: string;
  type?: "jobs" | "value" | "expense" | "balance";
  accent?: boolean;
}) {
  const Icon = {
    jobs: BriefcaseBusiness,
    value: ArrowDownLeft,
    expense: ArrowUpRight,
    balance: Wallet,
  }[type];
  return (
    <div className={`stat-card ${accent ? "stat-accent" : ""}`}>
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${type}`}>
          <Icon size={17} />
        </span>
      </div>
      <div className="stat-value">{value}</div>
      {note && (
        <div className="stat-note">
          {type === "balance" ? (
            <span className="mini-dot" />
          ) : (
            <span className="note-check">
              <Check size={11} />
            </span>
          )}
          {note}
        </div>
      )}
    </div>
  );
}
export function Status({ status }: { status: string }) {
  return (
    <span
      className={`status status-${status.toLowerCase().replace(/ /g, "-")}`}
    >
      <span />
      {status}
    </span>
  );
}
export function CompanyMark({
  initials,
  color,
  light,
  small = false,
}: {
  initials: string;
  color: string;
  light: string;
  small?: boolean;
}) {
  return (
    <span
      className={`company-mark ${small ? "mark-small" : ""}`}
      style={{ color, background: light }}
    >
      {initials}
    </span>
  );
}
export function MoneyInput({
  name = "amount",
  defaultValue,
  required = true,
}: {
  name?: string;
  defaultValue?: number;
  required?: boolean;
}) {
  return (
    <span className="money-input">
      <span>RM</span>
      <input
        name={name}
        aria-label={name === "price" ? "Job price (RM)" : "Amount (RM)"}
        inputMode="decimal"
        placeholder="0.00"
        defaultValue={
          defaultValue !== undefined
            ? (defaultValue / 100).toFixed(2)
            : undefined
        }
        required={required}
        pattern="[0-9,]+(\.[0-9]{1,2})?"
        maxLength={18}
      />
    </span>
  );
}
export function SelectWrap({ children }: { children: ReactNode }) {
  return (
    <span className="select-wrap">
      {children}
      <ChevronDown size={14} />
    </span>
  );
}
export function Attachments({ ownerId }: { ownerId: string }) {
  const w = useWorkspace(),
    toast = useToast();
  const [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState<string | null>(null),
    [preview, setPreview] = useState<{
      url: string;
      mime: string;
      name: string;
    } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const attachments = w.attachments.filter((a) => a.ownerId === ownerId);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      await addFiles(ownerId, Array.from(files));
      toast(`${files.length} attachment${files.length > 1 ? "s" : ""} saved`);
    } catch (e) {
      toast(errorMessage(e), true);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="attachments">
      <div className="section-heading">
        <h3>
          Attachments <span className="count">{attachments.length}</span>
        </h3>
        <button
          type="button"
          className="button button-small button-ghost"
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          {busy ? <Loader2 className="spin" size={15} /> : <Plus size={15} />}{" "}
          Add attachment
        </button>
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          multiple
          hidden
          onChange={(e) => upload(e.target.files)}
        />
      </div>
      {!attachments.length ? (
        <button
          type="button"
          className="upload-area"
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          <Upload size={23} />
          <strong>Upload a supporting document</strong>
          <span>PDF, JPG or PNG · up to 5 MB each</span>
        </button>
      ) : (
        <div className="file-list">
          {attachments.map((a) => (
            <div className="file-row" key={a.id}>
              <span className="file-icon">
                <FileText size={19} />
              </span>
              <div>
                <button
                  type="button"
                  className="text-button"
                  onClick={async () => {
                    try {
                      const blob = await getFile(a.id);
                      setPreview({
                        url: URL.createObjectURL(blob),
                        mime: a.mime,
                        name: a.name,
                      });
                    } catch (e) {
                      toast(errorMessage(e), true);
                    }
                  }}
                >
                  {a.name}
                </button>
                <small>
                  {Math.max(1, Math.round(a.size / 1024))} KB ·{" "}
                  {dateLabel(a.createdAt)} · {a.uploader}
                </small>
              </div>
              <IconButton
                label={`Download ${a.name}`}
                onClick={async () => {
                  try {
                    download(await getFile(a.id), a.name);
                  } catch (e) {
                    toast(errorMessage(e), true);
                  }
                }}
              >
                <Download size={15} />
              </IconButton>
              <IconButton
                label={`Delete ${a.name}`}
                onClick={() => setConfirm(a.id)}
              >
                <Trash2 size={15} />
              </IconButton>
            </div>
          ))}
        </div>
      )}
      {confirm && (
        <Confirm
          title="Delete attachment?"
          text="This file will be removed from your workspace."
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            try {
              await removeFile(confirm);
              setConfirm(null);
              toast("Attachment deleted");
            } catch (e) {
              toast(errorMessage(e), true);
            }
          }}
        />
      )}{" "}
      {preview && (
        <div className="file-preview">
          <div className="section-heading">
            <strong>{preview.name}</strong>
            <IconButton label="Close preview" onClick={() => setPreview(null)}>
              <X size={18} />
            </IconButton>
          </div>
          {preview.mime === "application/pdf" ? (
            <iframe src={preview.url} title={preview.name} />
          ) : (
            <img src={preview.url} alt={preview.name} />
          )}
        </div>
      )}
    </div>
  );
}
export function Confirm({
  title,
  text,
  onClose,
  onConfirm,
}: {
  title: string;
  text: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={onClose}>
      <div className="modal-body">
        <div className="confirm-symbol">
          <Trash2 size={24} />
        </div>
        <p>{text}</p>
      </div>
      <div className="modal-footer">
        <button className="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button button-danger"
          onClick={confirm}
          disabled={busy}
        >
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </Modal>
  );
}
export function FinancialStrip({
  price,
  spent,
}: {
  price: number;
  spent: number;
}) {
  return (
    <div className="financial-strip">
      <div>
        <span>Original job value</span>
        <strong>{money(price, true)}</strong>
      </div>
      <div>
        <span>Direct expenses</span>
        <strong className="text-rose">{money(spent, true)}</strong>
      </div>
      <div>
        <span>Remaining balance</span>
        <strong className={price - spent < 0 ? "text-rose" : "text-green"}>
          {money(price - spent, true)}
        </strong>
      </div>
    </div>
  );
}
export { Paperclip };
