import { lazy, Suspense, useState, useRef, type FormEvent } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  MapPin,
  Navigation,
  Save,
} from "lucide-react";
import { companies, companyById, locations, workTypes } from "../lib/constants";
import type { CompanyId, Job, JobStatus } from "../lib/types";
import { cents, today } from "../lib/finance";
import { repository, useWorkspace } from "../services/repository";
import {
  CompanyMark,
  errorMessage,
  Modal,
  MoneyInput,
  SelectWrap,
  useToast,
} from "./ui";
const MapPicker = lazy(() => import("./MapPicker"));
export function CompanyChooser({
  onSelect,
  onClose,
}: {
  onSelect: (id: CompanyId) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title="A new job starts here"
      subtitle="Choose the company this job belongs to."
      onClose={onClose}
    >
      <div className="modal-body company-chooser">
        {companies.map((c) => (
          <button key={c.id} onClick={() => onSelect(c.id)}>
            <CompanyMark {...c} />
            <span>{c.name}</span>
            <ArrowRight size={17} />
          </button>
        ))}
      </div>
      <div className="modal-tip">
        <BriefcaseBusiness size={16} /> One workspace. Five companies.
        Everything connected.
      </div>
    </Modal>
  );
}
export default function JobForm({
  companyId,
  job,
  onClose,
  onSaved,
}: {
  companyId: CompanyId;
  job?: Job;
  onClose: () => void;
  onSaved?: (job: Job) => void;
}) {
  const company = companyById(companyId),
    w = useWorkspace(),
    toast = useToast();
  const [work, setWork] = useState(
    job && workTypes.includes(job.workType)
      ? job.workType
      : job
        ? "Other"
        : "Resurface",
  );
  const [location, setLocation] = useState(job?.location ?? "");
  const [coordinates, setCoordinates] = useState([
    job?.lat ?? 3.0738,
    job?.lng ?? 101.5183,
  ]);
  const [mapOpen, setMapOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const requestId = useRef(crypto.randomUUID());
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const f = new FormData(e.currentTarget);
      const saved = await repository.saveJob(
        {
          companyId,
          workType:
            work === "Other" ? String(f.get("customWork") ?? "").trim() : work,
          client: String(f.get("client") ?? "").trim(),
          price: cents(String(f.get("price"))),
          location,
          lat: coordinates[0],
          lng: coordinates[1],
          date: String(f.get("date")),
          description: String(f.get("description") ?? ""),
          status: String(f.get("status") ?? "Active") as JobStatus,
        },
        job?.id,
        requestId.current,
      );
      toast(
        job
          ? "Job updated successfully"
          : `${saved.number} registered successfully`,
      );
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${job ? "Edit" : "New"} Job — ${company.name}`}
      subtitle={
        job
          ? `Update ${job.number}. All financial views will stay in sync.`
          : "Add the details. We’ll take care of keeping everything connected."
      }
      onClose={onClose}
      wide
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          <div className="form-company">
            <CompanyMark {...company} small />
            <div>
              <strong>{company.name}</strong>
              <span>Job will be registered under this company</span>
            </div>
            <Check size={17} />
          </div>
          <div className="form-grid">
            <label>
              Jenis Kerja <span>*</span>
              <SelectWrap>
                <select value={work} onChange={(e) => setWork(e.target.value)}>
                  {workTypes.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </SelectWrap>
            </label>
            <label>
              Client <span>*</span>
              <input
                name="client"
                list="client-list"
                defaultValue={job?.client ?? "Sunway"}
                placeholder="Select or type a client"
                required
                maxLength={160}
              />
              <datalist id="client-list">
                {w.clients.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <small>Select an existing client or enter a new one.</small>
            </label>
            {work === "Other" && (
              <label className="full-width">
                Describe the work <span>*</span>
                <input
                  name="customWork"
                  defaultValue={job?.workType}
                  required
                  maxLength={160}
                  placeholder="e.g. Drainage improvement"
                />
              </label>
            )}
            <label>
              Harga / Job price <span>*</span>
              <MoneyInput name="price" defaultValue={job?.price} />
            </label>
            <label>
              Job date <span>*</span>
              <input
                type="date"
                name="date"
                defaultValue={job?.date ?? today()}
                required
              />
            </label>
            <label className="full-width">
              Location <span>*</span>
              <div className="location-field">
                <MapPin size={17} />
                <input
                  name="location"
                  list="location-list"
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    const l = locations.find((x) => x.name === e.target.value);
                    if (l) setCoordinates([l.lat, l.lng]);
                  }}
                  required
                  placeholder="Search a location or enter an address"
                  maxLength={500}
                />
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setMapOpen(!mapOpen)}
                >
                  <Navigation size={14} />
                  {mapOpen ? "Hide map" : "Pin on map"}
                </button>
              </div>
              <datalist id="location-list">
                {locations.map((l) => (
                  <option value={l.name} key={l.name} />
                ))}
              </datalist>
              <small>
                Suggested Malaysian locations, or type any address and adjust
                the map pin.
              </small>
            </label>
            {mapOpen && (
              <div className="full-width">
                <Suspense fallback={<div className="map-loading skeleton" />}>
                  <MapPicker
                    lat={coordinates[0]}
                    lng={coordinates[1]}
                    onChange={(lat, lng) => setCoordinates([lat, lng])}
                  />
                </Suspense>
                <small className="coordinates">
                  {coordinates[0].toFixed(5)}, {coordinates[1].toFixed(5)}
                </small>
              </div>
            )}
            <label className="full-width">
              Description <small className="inline-optional">Optional</small>
              <textarea
                name="description"
                rows={3}
                defaultValue={job?.description}
                placeholder="Scope of work, site notes or any helpful details…"
                maxLength={5000}
              />
            </label>
            {job && (
              <label>
                Status
                <SelectWrap>
                  <select name="status" defaultValue={job.status}>
                    <option>Active</option>
                    <option>Completed</option>
                    <option>On hold</option>
                  </select>
                </SelectWrap>
              </label>
            )}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <span className="footer-note">
            {job
              ? "Changes are saved to your workspace."
              : "A unique Job ID will be generated automatically."}
          </span>
          <button className="button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button-primary"
            type="submit"
            disabled={busy}
          >
            <Save size={16} />
            {busy ? "Saving…" : job ? "Save changes" : "Save job"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
