// pages/index.js  —  PFAS Client Portal
// NextAuth credentials login → fetch live ClickUp data → render project dashboard

import Head from "next/head";
import { useEffect, useState, useRef } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

// ── ADMIN CONFIG ──────────────────────────────────────────────────────────────
// Change ADMIN_PIN to any 4-digit string you prefer.
// This is a convenience bypass — same security level as the dev picker.
const ADMIN_PIN = "2580";

// IS_DEV is determined client-side only to avoid SSR/hydration mismatch

// ── EMAIL → PROJECT(S) MAP ────────────────────────────────────────────────────
const EMAIL_PROJECT_MAP = {
  // ── Single-project logins ──────────────────────────────────────────────────
  "pcmmdc@pfas.pk":     { name: "PCMMDC",                 projects: [{ slug: "pcmmdc",         label: "HR Manual(PCMMDC)" }] },
  "p4a@pfas.pk":        { name: "P4A",                    projects: [{ slug: "p4a",            label: "Economic & Financial Feasibility Advisory -  Tertiary Care General Hospital P4A" }] },
  "energy@pfas.pk":     { name: "Energy Dept",            projects: [{ slug: "energy",         label: "Strategic Assessment & Design of a Project Management Wing- Energy" }] },
  "fisheries@pfas.pk":  { name: "Fisheries Dept",         projects: [{ slug: "shrimps",        label: "Shrimps Estate Project" }] },
  "tam@pfas.pk":        { name: "TAM",                    projects: [{ slug: "tam",            label: "Time Travel Theme Park" }] },
  "pha@pfas.pk":        { name: "PHA",                    projects: [{ slug: "pha",            label: "PHA" }] },
  "pbf@pfas.pk":        { name: "Punjab Benevolent Fund",      projects: [{ slug: "pbf",            label: "Punjab Govt Employees welfare fund" }] },
  "hed@pfas.pk":        { name: "HED",                    projects: [{ slug: "hed",            label: "Higher Education Department" }] },
  "phimc@pfas.pk":      { name: "PHIMC",                  projects: [{ slug: "phimc",          label: "PHIMC Johar Town — Hospital BOT PPP" }] },
  "lda@pfas.pk":        { name: "LDA",                    projects: [{ slug: "lda",            label: "Economic & Financial Feasibility Advisory -  4 Hospitals (LDA)" }] },

  // ── Combined logins (dropdown appears) ────────────────────────────────────
  "cw@pfas.pk": {
    name: "C&W Department",
    projects: [
      { slug: "bot1",     label: "BOT-1 Depalpur-Pakpattan-Vehari" },
      { slug: "bot2",     label: "BOT-2 Chiragabad Jhang Shorkot" },
      { slug: "bot3",     label: "BOT-3 Muzaffargarh-Alipur-TM" },
      { slug: "bot4",     label: "BOT-4 Sahiwal Samundari" },
      { slug: "bot5",     label: "BOT 5 Bahawalpur-Jhangra sharqi Road" },
      { slug: "om-roads", label: "18 O&M Roads-PPP" },
    ],
  },
  "fiedmc@pfas.pk": {
    name: "FIEDMC",
    projects: [
      { slug: "fiedmc-m3ic", label: "Optimal Fund Utilisation of M3IC Commercial Plot Sale FIEDMC" },
      { slug: "fiedmc-sbp",  label: "Strategic Business Plan FIEDMC" },
    ],
  },
  "finance@pfas.pk": {
    name: "Finance Department",
    projects: [
      { slug: "punjab-onebill", label: "Punjab One Bill Study" },
      { slug: "twilight",            label: "Project Twilight" },
    ],
  },
  "wildlife@pfas.pk": {
    name: "Wildlife Department",
    projects: [
      { slug: "wildlife-bansra", label: "Bansra Gali Wildlife" },
      { slug: "wildlife-changa", label: "Changa Manga Wildlife" },
    ],
  },

  // ── Legacy single-project logins ──────────────────────────────────────────
  "fiedmc-sbp@pfas.pk": { name: "FIEDMC (SBP)",           projects: [{ slug: "fiedmc-sbp",     label: "Strategic Business Plan FIEDMC" }] },
  "cw-bot1@pfas.pk":    { name: "C&W (BOT-1)",            projects: [{ slug: "bot1",           label: "BOT-1 Depalpur-Pakpattan-Vehari" }] },
  "cw-bot2@pfas.pk":    { name: "C&W (BOT-2)",            projects: [{ slug: "bot2",           label: "BOT-2 Chiragabad Jhang Shorkot" }] },
  "cw-bot3@pfas.pk":    { name: "C&W (BOT-3)",            projects: [{ slug: "bot3",           label: "BOT-3 Muzaffargarh-Alipur-TM" }] },
  "cw-bot4@pfas.pk":    { name: "C&W (BOT-4)",            projects: [{ slug: "bot4",           label: "BOT-4 Sahiwal Samundari" }] },
  "cw-bot5@pfas.pk":    { name: "C&W (BOT-5)",            projects: [{ slug: "bot5",           label: "BOT 5 Bahawalpur-Jhangra sharqi Road" }] },
  "cw-om@pfas.pk":      { name: "C&W (18 O&M)",           projects: [{ slug: "om-roads",       label: "18 O&M Roads-PPP" }] },
  "wildlife-b@pfas.pk": { name: "Wildlife (Bansra Gali)", projects: [{ slug: "wildlife-bansra",label: "Bansra Gali Wildlife" }] },
  "wildlife-c@pfas.pk": { name: "Wildlife (Changa)",      projects: [{ slug: "wildlife-changa",label: "Changa Manga Wildlife" }] },
  "vss@pfas.pk":        { name: "Finance (Project Twilight)", projects: [{ slug: "twilight", label: "Project Twilight" }] },
};

// ── Admin client list: all unique clients for the admin picker ────────────────
// Groups projects under their parent client name for a clean admin view.
const ADMIN_CLIENT_LIST = (() => {
  const seen = new Set();
  const list = [];
  // Primary logins only (no legacy duplicates)
  const PRIMARY_EMAILS = [
    "pcmmdc@pfas.pk", "p4a@pfas.pk", "energy@pfas.pk",
    "fisheries@pfas.pk", "tam@pfas.pk", "pha@pfas.pk", "pbf@pfas.pk",
    "hed@pfas.pk", "phimc@pfas.pk", "lda@pfas.pk", "cw@pfas.pk", "fiedmc@pfas.pk",
    "finance@pfas.pk", "wildlife@pfas.pk",
  ];
  PRIMARY_EMAILS.forEach(email => {
    const acc = EMAIL_PROJECT_MAP[email];
    if (acc && !seen.has(acc.name)) {
      seen.add(acc.name);
      list.push({ email, name: acc.name, projects: acc.projects });
    }
  });
  return list;
})();

// All distinct project slugs (for dev picker)
const ALL_PROJECTS = (() => {
  const seen = new Set();
  const list = [];
  Object.values(EMAIL_PROJECT_MAP).forEach(acc => {
    acc.projects.forEach(p => {
      if (!seen.has(p.slug)) {
        seen.add(p.slug);
        list.push({ slug: p.slug, name: p.label });
      }
    });
  });
  return list;
})();


// ── Shared design tokens (inline, apply regardless of external CSS) ────────────
const CARD = {
  background: "#fff",
  border: "1px solid #C9D2DE",
  borderRadius: 16,
  boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)",
  padding: 22,
  marginBottom: 18,
};
const SECTION_TITLE = {
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "#1C2D56",
  marginBottom: 16,
  display: "flex",
  alignItems: "center",
  gap: 9,
};
const TITLE_BAR = {
  width: 4,
  height: 16,
  borderRadius: 3,
  background: "linear-gradient(180deg,#F2BE1A,#D4A716)",
  flexShrink: 0,
};
function SectionCard({ title, children, style, className }) {
  return (
    <div className={`section-card${className ? " " + className : ""}`} style={{ ...CARD, ...style }}>
      {title && <div style={SECTION_TITLE}><span style={TITLE_BAR} />{title}</div>}
      {children}
    </div>
  );
}


// ── Admin PIN modal ───────────────────────────────────────────────────────────
// Shown as an overlay on top of the login screen when "Admin Access" is clicked.
// Four digit boxes, auto-advances, shows shake animation on wrong PIN.
function AdminPinModal({ onSuccess, onClose }) {
  const [digits, setDigits]   = useState(["", "", "", ""]);
  const [error, setError]     = useState(false);
  const [shake, setShake]     = useState(false);
  const inputRefs             = [useRef(), useRef(), useRef(), useRef()];

  // Focus first box on mount
  useEffect(() => { inputRefs[0].current?.focus(); }, []);

  const handleKey = (idx, e) => {
    // Allow only digits
    const val = e.target.value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[idx] = val;
    setDigits(next);
    setError(false);

    if (val && idx < 3) {
      inputRefs[idx + 1].current?.focus();
    }

    // Auto-check when all 4 filled
    if (val && idx === 3) {
      const pin = [...next.slice(0, 3), val].join("");
      checkPin(pin);
    }
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputRefs[idx - 1].current?.focus();
    }
    if (e.key === "Enter") {
      const pin = digits.join("");
      if (pin.length === 4) checkPin(pin);
    }
  };

  const checkPin = (pin) => {
    if (pin === ADMIN_PIN) {
      onSuccess();
    } else {
      setShake(true);
      setError(true);
      setDigits(["", "", "", ""]);
      setTimeout(() => {
        setShake(false);
        inputRefs[0].current?.focus();
      }, 600);
    }
  };

  return (
    <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`admin-modal-card ${shake ? "pin-shake" : ""}`}>
        {/* Header */}
        <div className="admin-modal-header">
          <div className="admin-modal-icon">🔐</div>
          <div className="admin-modal-title">Admin Access</div>
          <div className="admin-modal-sub">Enter your 4-digit admin PIN to access all client portals</div>
        </div>

        {/* PIN dots */}
        <div className="pin-inputs">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={inputRefs[i]}
              className={`pin-box ${error ? "pin-box-error" : d ? "pin-box-filled" : ""}`}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleKey(i, e)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              autoComplete="off"
            />
          ))}
        </div>

        {error && (
          <div className="pin-error-msg">Incorrect PIN. Please try again.</div>
        )}

        <button className="admin-modal-cancel" onClick={onClose}>
          Cancel
        </button>

        <div className="admin-modal-hint">
          Contact your PFAS system administrator if you've forgotten your PIN.
        </div>
      </div>
    </div>
  );
}


// ── Admin client picker ───────────────────────────────────────────────────────
// Full-screen picker shown after successful PIN entry.
// Lists all clients with their projects. Click a client → load their portal.
function AdminClientPicker({ onSelect, onBack }) {
  const [search, setSearch] = useState("");

  const filtered = ADMIN_CLIENT_LIST.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.projects.some(p => p.label.toLowerCase().includes(search.toLowerCase()))
  );

  // Department color tags
  const deptColor = (name) => {
    if (name.includes("C&W"))        return { bg: "#DBEAFE", color: "#1E40AF" };
    if (name.includes("Wildlife"))   return { bg: "#DCFCE7", color: "#166534" };
    if (name.includes("FIEDMC"))     return { bg: "#FEF3C7", color: "#92400E" };
    if (name.includes("Finance"))    return { bg: "#F3E8FF", color: "#6B21A8" };
    if (name.includes("Energy"))     return { bg: "#FEE2E2", color: "#991B1B" };
    if (name.includes("Fisheries"))  return { bg: "#CFFAFE", color: "#155E75" };
    return { bg: "#F1F5F9", color: "#334155" };
  };

  return (
    <div className="admin-picker-overlay">
      {/* Header */}
      <div className="admin-picker-header">
        <div className="admin-picker-brand">
          <img src="/logo-dark.png" alt="PFAS" className="admin-picker-logo" style={{ width: 90, height: 36, objectFit: "contain", objectPosition: "left center" }} />
          <div>
            <div className="admin-picker-eyebrow" style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", letterSpacing: 1, textTransform: "uppercase" }}>Admin Mode</div>
            <div className="admin-picker-title" style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Client Portal Overview</div>
          </div>
        </div>
        <div className="admin-picker-header-right" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="admin-badge">🔐 Admin</span>
          <button className="logout-btn" onClick={onBack}>← Exit Admin</button>
        </div>
      </div>

      {/* Body */}
      <div className="admin-picker-body">
        <div className="admin-picker-meta">
          {ADMIN_CLIENT_LIST.length} clients · {ALL_PROJECTS.length} projects
        </div>

        {/* Search */}
        <div className="admin-search-wrap">
          <span className="admin-search-icon">🔍</span>
          <input
            className="admin-search-input"
            type="text"
            placeholder="Search clients or projects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button className="admin-search-clear" onClick={() => setSearch("")}>✕</button>
          )}
        </div>

        {/* Client cards — single column list, projects collapse into dropdown */}
        <div className="admin-client-grid" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.length === 0 && (
            <div className="admin-no-results">No clients match "{search}"</div>
          )}
          {filtered.map((client, ci) => {
            const dc = deptColor(client.name);
            const initials = client.name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
            return (
              <AdminClientRow key={ci} client={client} dc={dc} initials={initials} onSelect={onSelect} />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Single client row with dropdown project list ───────────────────────────────
function AdminClientRow({ client, dc, initials, onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="admin-client-card" style={{ width: "100%" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
      >
        <div className="admin-card-header" style={{ marginBottom: 0 }}>
          <div className="admin-card-avatar" style={{ background: dc.bg, color: dc.color }}>
            {initials}
          </div>
          <div>
            <div className="admin-card-name">{client.name}</div>
            <div className="admin-card-count">
              {client.projects.length} project{client.projects.length > 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <span style={{ fontSize: 14, color: "#64748B", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s ease", flexShrink: 0 }}>▾</span>
      </button>

      {open && (
        <div className="admin-project-list" style={{ marginTop: 12 }}>
          {client.projects.map((p, pi) => (
            <button
              key={pi}
              className="admin-project-btn"
              onClick={() => onSelect(p.slug, client.name, client.projects)}
            >
              <span className="admin-project-label">{p.label}</span>
              <span className="admin-project-arrow">→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


// ── Dev mode project picker ───────────────────────────────────────────────────
function DevPicker({ onSelect }) {
  const [selected, setSelected] = useState(ALL_PROJECTS[0].slug);
  return (
    <div className="login-overlay">
      <div className="login-card">
        <img src="/logo-dark.png" alt="PFAS" className="login-logo" />
        <div className="dev-banner">
          🛠 Dev mode — Auth0 bypassed on localhost.<br />
          Select a client to preview their portal.
        </div>
        <select
          className="dev-select"
          value={selected}
          onChange={e => setSelected(e.target.value)}
        >
          {ALL_PROJECTS.map(p => (
            <option key={p.slug} value={p.slug}>{p.name}</option>
          ))}
        </select>
        <button
          className="login-btn"
          onClick={() => onSelect(selected, ALL_PROJECTS.find(p => p.slug === selected)?.name)}
        >
          Open Portal →
        </button>
        <div className="login-footer">© 2026 Punjab Financial Advisory Services · DEV</div>
      </div>
    </div>
  );
}

// ── Login screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onAdminClick }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", {
      email: email.toLowerCase().trim(),
      password,
      redirect: false,
    });
    setLoading(false);
    if (!result?.ok) {
      setError("Invalid email or password. Contact your PFAS engagement lead if you need access.");
    }
  };

  return (
    <div className="login-overlay">
      <div className="login-card">
        <img src="/logo-dark.png" alt="PFAS" className="login-logo" />
        <div className="login-title">PFAS Client Portal</div>
        <div className="login-sub">Sign in to access your engagement workspace</div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #C9D2DE", fontSize: 14, outline: "none", fontFamily: "inherit" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #C9D2DE", fontSize: 14, outline: "none", fontFamily: "inherit" }}
          />
          {error && <div className="login-error">{error}</div>}
          <button
            type="submit"
            className="login-btn"
            disabled={loading}
            style={{ marginTop: 4, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Signing in…" : "Sign In →"}
          </button>
        </form>

        <div className="login-footer">
          © 2026 Punjab Financial Advisory Services
          <button className="admin-link-btn" onClick={onAdminClick} title="Admin access">
            🔐 Admin
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{ padding: "40px 28px", maxWidth: 1480, margin: "0 auto" }}>
      <div style={{ background: "#E2E8F0", borderRadius: 16, height: 120, marginBottom: 24, animation: "shimmer 1.5s infinite" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        {[1,2,3,4].map(i => <div key={i} style={{ background: "#E2E8F0", borderRadius: 14, height: 80, animation: "shimmer 1.5s infinite" }} />)}
      </div>
      <div style={{ background: "#E2E8F0", borderRadius: 16, height: 200, animation: "shimmer 1.5s infinite" }} />
    </div>
  );
}

// ── Project switcher dropdown ─────────────────────────────────────────────────
function ProjectSwitcher({ projects, currentSlug, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const current = projects.find(p => p.slug === currentSlug) || projects[0];

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 12px", background: "rgba(255,255,255,0.12)",
          color: "#fff", border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: "pointer", maxWidth: 280,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {current.label}
        </span>
        <span style={{ fontSize: 10, opacity: 0.8 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: "#fff", border: "1px solid #C9D2DE", borderRadius: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)", padding: 6, zIndex: 100,
          minWidth: 280, maxHeight: 360, overflowY: "auto",
        }}>
          <div style={{ fontSize: 10, letterSpacing: 1.2, fontWeight: 700, color: "#94A3B8", padding: "8px 12px 4px", textTransform: "uppercase" }}>
            Switch Project
          </div>
          {projects.map(p => {
            const isActive = p.slug === currentSlug;
            return (
              <button
                key={p.slug}
                onClick={() => { onChange(p.slug); setOpen(false); }}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "10px 12px", background: isActive ? "#F1F5F9" : "transparent",
                  border: "none", borderRadius: 8, fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#1C2D56" : "#334155", cursor: "pointer",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "#F8FAFC"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                {isActive && <span style={{ color: "#276749", marginRight: 6 }}>✓</span>}
                {p.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Top bar ───────────────────────────────────────────────────────────────────
function TopBar({ userName, onLogout, lastUpdated, isDev, onSwitchDev, projects, currentSlug, onProjectChange, isAdmin, onAdminSwitch }) {
  const initial = userName ? userName[0].toUpperCase() : "?";
  const showSwitcher = projects && projects.length > 1;
  return (
    <div className="topbar">
      <div className="brand">
        <img src="/logo-dark.png" alt="PFAS" className="brand-logo" style={{ width: 110, height: 40, objectFit: "contain", objectPosition: "left center", background: "none", border: "none", borderRadius: 0, padding: 0, boxShadow: "none", flexShrink: 0 }} onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
          <div className="brand-logo-fallback" style={{ display: "none", alignItems: "center", justifyContent: "center", background: "#F2BE1A", borderRadius: 8, padding: "4px 10px", fontWeight: 800, fontSize: 15, color: "#1C2D56", letterSpacing: 1 }}>PFAS</div>
        <div>
          <div className="brand-sub">Punjab Financial Advisory Services</div>
          <div className="brand-name">Client Portal</div>
        </div>
      </div>
      <div className="topbar-right">
        {isAdmin && (
          <span className="admin-topbar-badge">🔐 Admin</span>
        )}
        {showSwitcher && (
          <ProjectSwitcher
            projects={projects}
            currentSlug={currentSlug}
            onChange={onProjectChange}
          />
        )}
        <span className="live-badge">
          <span className="live-dot" />
          {lastUpdated ? `Updated ${lastUpdated}` : "LIVE · ClickUp"}
        </span>
        <span className="user-chip">
          <span className="av">{initial}</span>
          <span>{userName}</span>
        </span>
        {isAdmin
          ? <button className="logout-btn" onClick={onAdminSwitch}>← Client List</button>
          : isDev
            ? <button className="logout-btn" onClick={onSwitchDev}>← Switch Client</button>
            : <button className="logout-btn" onClick={onLogout}>Sign Out</button>
        }
      </div>
    </div>
  );
}

// ── Project header ────────────────────────────────────────────────────────────
function ProjectHeader({ project }) {
  return (
    <div className="project-header" style={{ ...CARD, padding: 24, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 3, background: "linear-gradient(90deg,#1C2D56,#F2BE1A)" }} />
      <div className="ph-top">
        <div className="ph-title-block">

          {/* Client name row */}
          <div className="ph-row" style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
            <div className="ph-icon-circle" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#1C2D56,#1C2D56)", flexShrink: 0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="7" r="4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="ph-eyebrow" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#94A3B8", marginBottom: 2 }}>Client</div>
              <div className="ph-name" style={{ fontSize: 22, fontWeight: 800, color: "#1C2D56", letterSpacing: -0.3, lineHeight: 1.1, overflowWrap: "anywhere" }}>{project.clientName}</div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "linear-gradient(90deg,#E2E8F0,transparent)", marginBottom: 14 }} />

          {/* Project name row */}
          <div className="ph-row" style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div className="ph-icon-circle" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#F2BE1A,#D4A716)", flexShrink: 0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="ph-eyebrow" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#94A3B8", marginBottom: 2 }}>Project</div>
              <div className="ph-name" style={{ fontSize: 22, fontWeight: 800, color: "#0A1628", letterSpacing: -0.3, lineHeight: 1.1, overflowWrap: "anywhere" }}>{project.displayName || project.name}</div>
            </div>
          </div>

        </div>
      </div>
      <div className="ph-meta" style={{ display: "none" }} />
    </div>
  );
}

// ── KPI row ───────────────────────────────────────────────────────────────────
function KpiRow({ project }) {
  // Format Received Payments — accepts "75%", 75, "75", or null/undefined
  const formatReceivedPayments = (v) => {
    if (v === null || v === undefined || v === "") return "—";
    const s = String(v).trim();
    if (s.endsWith("%")) return s;
    if (!isNaN(Number(s))) return `${s}%`;
    return s;
  };
  const receivedDisplay = formatReceivedPayments(project.receivedPayments);

  // ClickUp phase names often come back in ALL CAPS (e.g. "PHASE 2 –
  // INSTITUTIONAL & LEGAL FRAMEWORK (D-II)"). Convert to sentence case
  // (capitalize only the first letter) so it reads naturally instead of
  // shouting.
  const toSentenceCase = (str) => {
    if (!str) return str;
    const lower = str.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  };
  const phaseDisplay = toSentenceCase(project.currentPhase);

  const kpis = [
    { label: "Project Progress",   value: `${project.overallPercent}%`,         sub: "Overall completion",        accent: "#1C2D56", bg: "linear-gradient(135deg,#F0F4FA,#FFFFFF)" },
    { label: "Active Tasks",       value: project.activeTasks,                  sub: "Ongoing tasks",              accent: "#B45309", bg: "linear-gradient(135deg,#FFF7ED,#FFFFFF)" },
    { label: "Current Phase",      value: phaseDisplay,                          sub: "In progress",               accent: "#166534", bg: "linear-gradient(135deg,#F0FDF4,#FFFFFF)", small: true },
    { label: "Engagement Value",   value: project.pfasFee || "PKR TBD",         sub: "Total advisory fee",        accent: "#6B21A8", bg: "linear-gradient(135deg,#FAF5FF,#FFFFFF)" },
    { label: "Received Payments",  value: receivedDisplay,                      sub: "Of total fee",              accent: "#0369A1", bg: "linear-gradient(135deg,#EFF6FF,#FFFFFF)" },
  ];
  return (
    <div className="kpi-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 18 }}>
      {kpis.map((k, i) => (
        <div className="kpi" key={i} style={{ ...CARD, marginBottom: 0, padding: 18, background: k.bg, borderLeft: `3px solid ${k.accent}` }}>
          <div className="kpi-label" style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: "#64748B" }}>{k.label}</div>
          <div className="kpi-value" style={{ fontSize: k.small ? 15 : 27, fontWeight: 700, color: k.accent, margin: "8px 0 4px", lineHeight: 1.3, overflowWrap: "anywhere" }}>{k.value}</div>
          <div className="kpi-sub" style={{ fontSize: 12, color: "#94A3B8" }}>{k.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ── Phase progress ────────────────────────────────────────────────────────────
function PhaseList({ phases }) {
  if (!phases?.length) return <p style={{ color: "#94A3B8", fontSize: 13 }}>No phase data available.</p>;

  const sorted = [...phases].sort((a, b) => {
    const rank = (p) => { if (p.pct === 100) return 0; if (p.pct > 0) return 1; return 2; };
    return rank(a) - rank(b) || b.pct - a.pct;
  });

  return (
    <>
      {sorted.map((ph, i) => (
        <div className="phase-row" key={i}>
          <div className="phase-head">
            <div className="phase-name">{(ph.name || "").replace(/^\s*phase\s*[-:.]?\s*/i, "")}</div>
            <div className={`phase-pct pct-${ph.status}`}>{ph.pct}%</div>
          </div>
          <div className={`phase-bar b-${ph.status}`}>
            <span style={{ width: `${ph.pct}%` }} />
          </div>
        </div>
      ))}
    </>
  );
}

// ── PFAS Staff Directory — sourced from Operations_Team.xlsx (authoritative) ──
// All emails are @pfas.pk only. No .com.pk entries — those were legacy and wrong.
const STAFF_DIRECTORY = {
  "azmat.nawaz@pfas.pk":        { designation: "Chief Operating Officer",                                           contact: "0300-4975975" },
  "habeeba.naseer@pfas.pk":     { designation: "Chief Legal Officer",                                               contact: "0300-4416264" },
  "minam.karim@pfas.pk":        { designation: "Senior Manager – Legal / Senior Legal Counsel",                     contact: "0301-8496433" },
  "awais.khan@pfas.pk":         { designation: "Manager – Legal / Associate Legal Counsel",                         contact: "0322-8473455" },
  "wali.muhammad@pfas.pk":      { designation: "Assistant Manager / Senior Analyst Legal",                          contact: "0301-1152222" },
  "mariam.omer@pfas.pk":        { designation: "Law Officer",                                                       contact: "0301-8419960" },
  "aneel.iqbal@pfas.pk":        { designation: "General Manager – Corporate Finance and Risk Management",           contact: "0300-5556417" },
  "husnain.siddique@pfas.pk":   { designation: "Senior Manager / Senior Associate Financial Advisory",              contact: "0342-8119118" },
  "harris.ghaffar@pfas.pk":     { designation: "Manager / Associate Financial Advisory",                           contact: "0333-4558295" },
  "muhammad.aejwat@pfas.pk":    { designation: "Assistant Manager / Senior Analyst Financial Advisory",             contact: "0316-0141617" },
  "ammar.yasar@pfas.pk":        { designation: "Senior Manager / Senior Associate Project Management & TPV",        contact: "0345-4547945" },
  "hamza.naeem@pfas.pk":        { designation: "Manager / Associate Project Management & TPV",                      contact: "0346-6991919" },
  "maryam.tariq@pfas.pk":       { designation: "Assistant Manager / Senior Analyst Project Management & TPV",       contact: "0334-7073889" },
  "amjad.murtaza@pfas.pk":      { designation: "Senior Manager / Senior Associate Transaction Advisory",            contact: "0334-3610333" },
  "syed.rehan@pfas.pk":         { designation: "Manager / Associate Financial Management",                          contact: "0333-4445651" },
  "umar.paracha@pfas.pk":       { designation: "Assistant Manager / Senior Analyst Transaction Advisory",           contact: "0331-0040695" },
  "khalid.safdar@pfas.pk":      { designation: "General Manager / Practice Lead Strategy & Reforms",                contact: "0300-8213214" },
  "hashim.riaz@pfas.pk":        { designation: "Senior Manager / Senior Associate Strategy & Reforms",              contact: "0321-3337118" },
  "fahad.tanveer@pfas.pk":      { designation: "Assistant Manager / Senior Analyst Business Process Reengineering", contact: "0323-4824120" },
  "samiya.mukhtar@pfas.pk":     { designation: "General Manager / Practice Lead PFM & Revenue Management",          contact: "0322-4147173" },
  "hassaan.mallick@pfas.pk":    { designation: "Manager / Associate PFM",                                           contact: "0308-2597799" },
  "bilal.butt@pfas.pk":         { designation: "Assistant Manager / Senior Analyst PFM",                            contact: "0334-5308076" },
  "ahmad.qazi@pfas.pk":         { designation: "General Manager / Practice Lead Energy",                            contact: "0303-4441690" },
  "ahmad.sohail@pfas.pk":       { designation: "Individual Consultant",                                             contact: "0300-0386181" },
  "ali.jibran@pfas.pk":         { designation: "Individual Consultant",                                             contact: "0300-8430503" },
  "abdul.wahab@pfas.pk":        { designation: "Individual Consultant",                                             contact: "0305-2392065" },
  "meiraj.khan@pfas.pk":        { designation: "Individual Consultant",                                             contact: "0322-0227875" },
};

// ── Per-project contact filter ──────────────────────────────────────────────
// Only these staff (matched by first name, case-insensitive) show in the
// "Your PFAS Advisory Team" panel for each project slug. Slugs not listed
// here show the full team unchanged.
const PROJECT_CONTACT_FILTER = {
  // C&W — Husnain Siddique only
  "bot1":     ["husnain"],
  "bot2":     ["husnain"],
  "bot3":     ["husnain"],
  "bot4":     ["husnain"],
  "bot5":     ["husnain"],
  "om-roads": ["husnain"],

  // PHA — Aneel + Harris
  "pha": ["aneel", "harris"],

  // Punjab Benevolent Fund — Aneel + Harris
  "pbf": ["aneel", "harris"],

  // Wildlife (Changa Manga + Bansra Gali) — Aneel + Aejwat
  "wildlife-changa": ["aneel", "aejwat"],
  "wildlife-bansra": ["aneel", "aejwat"],

  // Hashim + Fahad projects — LDA Hospital / PCMMDC and similar
  "pcmmdc": ["hashim", "fahad"],
  "lda":    ["hashim", "fahad"],

  // Punjab One Bill — Samiya + Hassaan
  "punjab-onebill": ["samiya", "hassaan"],

  // Fisheries + TAM — Khalid + Meiraj (Shrimps uses Ammar instead of Khalid)
  "shrimps": ["ammar", "meiraj"],
  "tam":     ["khalid", "meiraj"],
};

function filterTeamForProject(team, slug) {
  const allowList = PROJECT_CONTACT_FILTER[slug];
  if (!allowList || !team?.length) return team;
  return team.filter(m =>
    allowList.some(firstName => (m.name || "").toLowerCase().includes(firstName))
  );
}

// ── Client Representatives (per-project) ────────────────────────────────────
// One primary client-side contact per project. Only projects listed here get
// a "Client Representative" card. Add more entries later as needed.
const CLIENT_REPS = {
  "pcmmdc": {
    name:         "Jazib Saeed Khan",
    designation:  "GM HR & Admin",
    organization: "PCMMDC",
    orgShort:     "PCMMDC",
    email:        "gm.hr@pcmmdc.punjab.gov.pk",
    contact:      "+92-321-8400252",
  },
  "tam": {
    name:         "Syed Waqas Javed",
    designation:  "Secretary",
    organization: "Tourism, Archaeology & Museums Department, Government of the Punjab",
    orgShort:     "TAM",
    email:        "syed.waqasjaved@gmail.com",
    contact:      "+92-300-4009309",
  },
  "wildlife-bansra": {
    name:         "Zauraiz Haider",
    designation:  "Project Manager",
    organization: "Project Management Unit, Punjab Wildlife and Parks Department",
    orgShort:     "WILDLIFE",
    email:        null,
    contact:      "+92-321-4730431",
  },
  "wildlife-changa": {
    name:         "Zauraiz Haider",
    designation:  "Project Manager",
    organization: "Project Management Unit, Punjab Wildlife and Parks Department",
    orgShort:     "WILDLIFE",
    email:        null,
    contact:      "+92-321-4730431",
  },
  "pbf": {
    name:         "Ashfaq Ahmed",
    designation:  "Administrative Officer",
    organization: "Punjab Government Employees Welfare Fund",
    orgShort:     "PBF",
    email:        "faranian@gmail.com",
    contact:      "+92-322-4225969",
  },
  "pha": {
    name:         "Bilal Basra",
    designation:  "Deputy Director Finance",
    organization: "PHA",
    orgShort:     "PHA",
    email:        null,
    contact:      "+92-345-4477554",
  },
  "punjab-onebill": {
    name:         "Capt. (R) Abdul Wahab Khan",
    designation:  "Deputy Secretary - Resources & Admin",
    organization: "Finance Department",
    orgShort:     "FINANCE",
    email:        null,
    contact:      "+92-332-3102103",
  },
};

// ── Team grid ─────────────────────────────────────────────────────────────────
// Converts Pakistani number to wa.me format: "0346-6991919" → "923466991919"
function toWhatsAppNumber(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, ""); // strip dashes, spaces
  if (digits.startsWith("0")) return "92" + digits.slice(1);
  if (digits.startsWith("92")) return digits;
  return null;
}

function TeamGrid({ team }) {
  if (!team?.length) return <p style={{ color: "#94A3B8", fontSize: 13 }}>Team details coming soon.</p>;
  return (
    <div className="team-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
      {team.map((m, i) => {
        const initials = m.name.split(" ").map(n => n[0]).join("").substring(0, 2);
        const staffKey = (m.email || "").toLowerCase().trim();
        const staff    = STAFF_DIRECTORY[staffKey] || {};
        const designation  = staff.designation || m.role || "—";
        const contact      = staff.contact     || null;
        const emailDisplay = m.email && m.email !== "—" ? m.email : null;
        const waNumber     = toWhatsAppNumber(contact);
        const waHref       = waNumber ? `https://wa.me/${waNumber}` : null;
        return (
          <div className="member-card" key={i} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, background: "#fff", border: "1px solid #C9D2DE", borderRadius: 14, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <div className={`avatar av-${m.color}`} style={{ flexShrink: 0, width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 11, letterSpacing: 0.5 }}>
                PFAS
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="member-name" style={{ fontWeight: 700, fontSize: 15, color: "#1E293B", lineHeight: 1.25 }}>{m.name}</div>
                <div className="member-role" style={{ fontSize: 12.5, color: "#64748B", lineHeight: 1.35, marginTop: 2 }}>{designation}</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingTop: 11, borderTop: "1px solid #F1F5F9" }}>
              {emailDisplay && (
                <div className="member-email" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, minWidth: 0 }}>
                  <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="2" y="4" width="20" height="16" rx="3" fill="#1C2D56" fillOpacity="0.12" stroke="#1C2D56" strokeWidth="1.6"/>
                      <path d="M2 8l10 7 10-7" stroke="#1C2D56" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <a href={`mailto:${emailDisplay}`} style={{ color: "#1C2D56", textDecoration: "none", overflowWrap: "anywhere", wordBreak: "break-word" }}>{emailDisplay}</a>
                </div>
              )}
              {contact && (
                <div className="member-contact" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <span style={{ flexShrink: 0, opacity: 0.55 }}>📞</span>
                  <span style={{ color: "#475569" }}>{contact}</span>
                </div>
              )}
            </div>
            {/* Action buttons: Call (blinking) + WhatsApp, side by side */}
            <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
              {contact && (
                <a href={`tel:${contact}`} className="call-blink"
                  style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px", color: "#166534", fontSize: 12.5, fontWeight: 700, borderRadius: 9, textDecoration: "none", border: "1px solid #86EFAC", background: "#DCFCE7" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  Call
                </a>
              )}
              {waHref && (
                <a href={waHref} target="_blank" rel="noreferrer"
                  className="wa-btn"
                  style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px", background: "#fff", color: "#166534", fontSize: 12.5, fontWeight: 700, borderRadius: 9, textDecoration: "none", border: "1px solid #BBF7D0" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.858L.057 23.716a.5.5 0 0 0 .609.61l5.975-1.516A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.523-5.157-1.432l-.36-.214-3.737.949.988-3.648-.235-.375A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                  WhatsApp
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Client Representative card ─────────────────────────────────────────────
// Renders a single client-side contact for a project. Only renders if the
// project's slug has an entry in CLIENT_REPS. Same visual language as the
// PFAS team members but tinted teal to distinguish "client side" from "PFAS side".
function ClientRepCard({ rep }) {
  if (!rep) return null;
  const initials = rep.name.split(" ").map(n => n[0]).join("").substring(0, 2);
  const waNumber = toWhatsAppNumber(rep.contact);
  const waHref   = waNumber ? `https://wa.me/${waNumber}` : null;

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10, padding: 16, background: "linear-gradient(180deg, #F0FDF9 0%, #FFFFFF 60%)", border: "1.5px solid #0E7C66", borderRadius: 14, minWidth: 0, boxShadow: "0 2px 8px rgba(14, 124, 102, 0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#0E7C66,#0A5F4E)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: (rep.orgShort && rep.orgShort.length <= 4) ? 11 : 9.5, letterSpacing: 0.4, textAlign: "center", lineHeight: 1, padding: 2 }}>
          {rep.orgShort || "CLIENT"}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1E293B", lineHeight: 1.25 }}>{rep.name}</div>
          <div style={{ fontSize: 12.5, color: "#64748B", lineHeight: 1.35, marginTop: 2 }}>{rep.designation}</div>
          {rep.organization && (
            <div style={{ fontSize: 11, color: "#0E7C66", fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase", marginTop: 3 }}>{rep.organization}</div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingTop: 11, borderTop: "1px solid #F1F5F9" }}>
        {rep.email && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, minWidth: 0 }}>
            <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="4" width="20" height="16" rx="3" fill="#0E7C66" fillOpacity="0.12" stroke="#0E7C66" strokeWidth="1.6"/>
                <path d="M3 6l9 6 9-6" stroke="#0E7C66" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <a href={`mailto:${rep.email}`} style={{ color: "#0E7C66", textDecoration: "none", overflowWrap: "anywhere", wordBreak: "break-word", fontWeight: 600 }}>{rep.email}</a>
          </div>
        )}
        {rep.contact && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <span style={{ flexShrink: 0 }}>📞</span>
            <a href={`tel:${rep.contact.replace(/\s|-/g,"")}`} style={{ color: "#475569", textDecoration: "none" }}>{rep.contact}</a>
          </div>
        )}
        {waHref && (
          <a href={waHref} target="_blank" rel="noreferrer" className="wa-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4, padding: "6px 10px", background: "#DCFCE7", color: "#166534", fontSize: 12, fontWeight: 600, borderRadius: 8, textDecoration: "none", border: "1px solid #86EFAC", alignSelf: "flex-start" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.858L.057 23.716a.5.5 0 0 0 .609.61l5.975-1.516A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.523-5.157-1.432l-.36-.214-3.737.949.988-3.648-.235-.375A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

// ── Teams discussion panel ────────────────────────────────────────────────────
function formatMsgTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs  = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1)   return "just now";
  if (diffMins < 60)  return `${diffMins}m ago`;
  if (diffHrs  < 24)  return `${diffHrs}h ago`;
  if (diffDays < 7)   return `${diffDays}d ago`;
  return d.toLocaleDateString("en-PK", { day: "numeric", month: "short" });
}

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function TeamsPanel({ project }) {
  const hasLiveChannel = !!(project.teamsChannelId && project.teamsTeamId);
  const [msgs,    setMsgs]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const chatBodyRef = useRef(null);

  useEffect(() => {
    if (!hasLiveChannel) return;
    setLoading(true);
    setError("");
    fetch(`/api/teams-messages?teamId=${project.teamsTeamId}&channelId=${project.teamsChannelId}`)
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(data => { setMsgs(data.messages || []); setLoading(false); })
      .catch(() => { setError("Could not load messages."); setLoading(false); });
  }, [project.teamsTeamId, project.teamsChannelId]);

  useEffect(() => {
    if (chatBodyRef.current && msgs.length > 0) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [msgs]);

  if (!hasLiveChannel) {
    return (
      <div className="chat-card teams-panel">
        <div className="chat-header">
          <div className="chat-avatar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="white" fillOpacity="0.9"/>
            </svg>
          </div>
          <div>
            <div className="chat-title">{project.clientName} ↔ PFAS Team</div>
            <div className="chat-status-pending">
              <span className="pending-dot" /> Connecting to Microsoft Teams…
            </div>
          </div>
        </div>
        <div className="chat-pending-body">
          <div className="teams-logo-wrap">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="#6264A7"/>
              <path d="M30 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" fill="white"/>
              <path d="M34 20h-4.5A6 6 0 0 1 24 34a6 6 0 0 1-5.5-14H14a2 2 0 0 0-2 2v8a10 10 0 0 0 20 0v-8a2 2 0 0 0-2-2z" fill="white" fillOpacity="0.85"/>
            </svg>
          </div>
          <div className="pending-title">Teams channel connecting</div>
          <div className="pending-sub">Live discussion from your project channel will appear here once the Microsoft Teams integration is activated by your PFAS engagement team.</div>
          <div className="pending-steps">
            <div className="pstep pstep-done"><div className="pstep-icon">✓</div><div className="pstep-text">Portal connected to PFAS systems</div></div>
            <div className="pstep pstep-done"><div className="pstep-icon">✓</div><div className="pstep-text">Project channel identified</div></div>
            <div className="pstep pstep-pending"><div className="pstep-icon"><span className="pstep-spinner" /></div><div className="pstep-text">Awaiting Teams channel permission</div></div>
          </div>
          <div className="pending-hint">In the meantime, your team is active on Teams. Open the channel directly to see messages and post updates.</div>
        </div>
        <div className="chat-cta-banner">
          <div className="lbl">Your project channel is live on Teams</div>
          <a className="chat-cta" href={project.teamsChannel || "#"} target="_blank" rel="noreferrer">↗ Open in Microsoft Teams</a>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-card teams-panel">
      <div className="chat-header">
        <div className="chat-avatar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="white" fillOpacity="0.9"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div className="chat-title">{project.clientName} ↔ PFAS Team</div>
          <div className="chat-status">{loading ? "Loading messages…" : `${msgs.length} message${msgs.length !== 1 ? "s" : ""} · Live from Teams`}</div>
        </div>
        <a href={project.teamsChannel || "#"} target="_blank" rel="noreferrer"
           style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", textDecoration: "none", flexShrink: 0 }}>Open ↗</a>
      </div>
      <div className="chat-body" ref={chatBodyRef}>
        {loading && <div className="chat-loading"><div className="chat-loading-dot" /><div className="chat-loading-dot" /><div className="chat-loading-dot" /></div>}
        {error && <div className="chat-error">{error} — <a href={project.teamsChannel || "#"} target="_blank" rel="noreferrer" style={{ color: "#6264A7" }}>open in Teams ↗</a></div>}
        {!loading && !error && msgs.length === 0 && <div className="chat-empty">No messages yet in this channel.</div>}
        {msgs.map((msg, i) => {
          const body = stripHtml(msg.body);
          if (!body) return null;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <div className="msg-sender">{msg.from || "PFAS Team"}</div>
              <div className="msg msg-them">{body}<div className="msg-time" style={{ color: "#94A3B8" }}>{formatMsgTime(msg.createdDateTime)}</div></div>
            </div>
          );
        })}
      </div>
      <div className="chat-cta-banner">
        <div className="lbl">Reply directly in Teams</div>
        <a className="chat-cta" href={project.teamsChannel || "#"} target="_blank" rel="noreferrer">↗ Open in Microsoft Teams</a>
      </div>
    </div>
  );
}

// ── Documents section ─────────────────────────────────────────────────────────
function fileIcon(type) {
  if (type === "pdf")  return { icon: "📄", bg: "#FECACA", color: "#9B2C2C" };
  if (type === "doc" || type === "docx") return { icon: "📝", bg: "#DBEAFE", color: "#1E40AF" };
  if (type === "xls" || type === "xlsx") return { icon: "📊", bg: "#DCFCE7", color: "#276749" };
  if (type === "ppt" || type === "pptx") return { icon: "📋", bg: "#FED7AA", color: "#9A3412" };
  return { icon: "📎", bg: "#E2E8F0", color: "#475569" };
}

function formatFileDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function DocumentsSection({ project, projectSlug }) {
  const sp = getSharePointLinks(project, projectSlug);
  const folderUrl = sp.sharedDocs;
  const [recentFiles, setRecentFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!projectSlug) return;
    setLoading(true);
    fetch(`/api/sharepoint-recent?project=${projectSlug}`)
      .then(r => r.json())
      .then(data => {
        if (data.error || !data.files) {
          setUnavailable(true);
          setRecentFiles([]);
        } else {
          setRecentFiles(data.files);
          setUnavailable(false);
        }
      })
      .catch(() => { setUnavailable(true); setRecentFiles([]); })
      .finally(() => setLoading(false));
  }, [projectSlug]);

  return (
    <div className="section-card docs-card" style={CARD}>
      <div style={SECTION_TITLE}><span style={TITLE_BAR} />Project Documents</div>

      {!loading && !unavailable && recentFiles.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: "#94A3B8", marginBottom: 10 }}>Recently Uploaded</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {recentFiles.map((f, i) => {
              const fi = fileIcon(f.type);
              return (
                <a key={i} className="doc-file-row" href={f.webUrl} target="_blank" rel="noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, border: "1px solid #D6DCE5", textDecoration: "none" }}>
                  <div className="doc-file-icon" style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, background: fi.bg, color: fi.color }}>{fi.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="doc-file-name" style={{ fontSize: 13.5, fontWeight: 600, color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                    <div className="doc-file-meta" style={{ fontSize: 11.5, color: "#94A3B8" }}>{formatFileDate(f.lastModifiedDateTime)}</div>
                  </div>
                  <div style={{ flexShrink: 0, color: "#CBD5E1", fontSize: 13 }}>↗</div>
                </a>
              );
            })}
          </div>
        </>
      )}

      {!loading && (unavailable || recentFiles.length === 0) && (
        <div style={{ fontSize: 12.5, color: "#94A3B8", marginBottom: 14 }}>
          {unavailable ? "Live file list unavailable right now." : "No documents uploaded yet."}
        </div>
      )}

      <a
        href={folderUrl}
        target="_blank" rel="noreferrer"
        className="doc-file-row"
        style={{ display: "flex", alignItems: "center", gap: 13, padding: 15, borderRadius: 12, border: "1px solid #D6DCE5", textDecoration: "none", background: "linear-gradient(135deg,#EFF6FF,#FFFFFF)", borderLeft: "3px solid #2563EB" }}
      >
        <div className="doc-file-icon" style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, background: "#DBEAFE", color: "#1E40AF" }}>📁</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="doc-file-name" style={{ fontSize: 13.5, fontWeight: 700, color: "#1E293B" }}>Browse all project documents</div>
          <div className="doc-file-meta" style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 1 }}>Data for client access · SharePoint</div>
        </div>
        <div style={{ flexShrink: 0, color: "#2563EB", fontSize: 14, opacity: 0.7 }}>→</div>
      </a>
    </div>
  );
}

// ── Book a Meeting panel ──────────────────────────────────────────────────────
// Simple box that opens Microsoft Teams scheduling. A dropdown lets the
// client see which PFAS team members to add once inside Teams — selecting
// a name just copies it to clipboard for convenience, nothing more.
function BookMeetingPanel({ project }) {
  const bookingUrl = project.teamsBookingUrl || project.teamsMeeting || "#";

  return (
    <a
      href={bookingUrl}
      target="_blank" rel="noreferrer"
      className="section-card teams-meeting-card"
      style={{
        ...CARD,
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        cursor: "pointer",
        padding: 16,
      }}
    >
      <div style={SECTION_TITLE}><span style={TITLE_BAR} />Book a Meeting</div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 4px 4px" }}>
        {/* Microsoft Teams glyph — smaller */}
        <div className="teams-icon-pop" style={{ width: 54, height: 54, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="54" height="54" viewBox="0 0 2228.833 2073.333" xmlns="http://www.w3.org/2000/svg">
            <path fill="#5059C9" d="M1554.637,777.5h575.713c54.391,0,98.483,44.092,98.483,98.483v0c0,159.084-118.929,294.296-277.083,310.6-39.083-13.667-81.166-21.083-125-21.083-83.333,0-160.583,27.083-223,72.917v-377.417C1603.75,824.792,1554.637,777.5,1554.637,777.5Z" transform="translate(-128.317 -350.083)"/>
            <circle fill="#5059C9" cx="1746.583" cy="240.75" r="240.75"/>
            <path fill="#7B83EB" opacity="1" d="M1183.083,777.5H707.37c-54.391,0-98.483,44.092-98.483,98.483v500.953c0,278.604,225.871,504.475,504.475,504.475h0c278.604,0,504.475-225.871,504.475-504.475V875.983C1617.837,821.592,1573.745,777.5,1519.354,777.5Z" transform="translate(-128.317 -350.083)"/>
            <circle fill="#7B83EB" cx="945.417" cy="240.75" r="240.75"/>
          </svg>
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E293B" }}>Schedule Meeting</div>
        <div style={{ fontSize: 11, color: "#94A3B8" }}>with PFAS team</div>
      </div>
    </a>
  );
}

// ── SharePoint folder map ────────────────────────────────────────────────────
// DYNAMIC RESOLUTION: every quick action calls /api/sp-folder, which looks up
// the real folder by NAME via Graph API at click time. Matching ignores
// number prefixes ("2. Received from Client" == "Received from Client").
// Fallback chain: exact subfolder -> "Data for client access" -> project root.
// A dead link is impossible. See pages/api/sp-folder.js for the resolver.

const SHAREPOINT_FOLDERS_SLUGS = [
  "wildlife-bansra","wildlife-changa","punjab-onebill","twilight",
  "bot1","bot2","bot3","bot4","bot5","om-roads",
  "pcmmdc","p4a","fiedmc-m3ic","fiedmc-sbp","tam","pha","pbf",
  "energy","hed","phimc","lda","shrimps",
];

// Every quick action resolves the REAL folder by name at click time via
// /api/sp-folder (Graph API lookup, numbering-agnostic, always falls back
// to the project root — never a dead link).
const SHAREPOINT_FOLDERS = Object.fromEntries(
  SHAREPOINT_FOLDERS_SLUGS.map(slug => [slug, {
    sharedDocs:     `/api/sp-folder?slug=${slug}&action=docs`,
    uploadDoc:      `/api/sp-folder?slug=${slug}&action=upload`,
    meetingMinutes: `/api/sp-folder?slug=${slug}&action=minutes`,
    invoices:       `/api/sp-folder?slug=${slug}&action=invoices`,
  }])
);

// Returns the 4 quick-action URLs for a project, falling back to the
// project's existing onedriveUrl (or "#") if the slug isn't mapped at all.
function getSharePointLinks(project, projectSlug) {
  const mapped = SHAREPOINT_FOLDERS[projectSlug];
  if (mapped) return mapped;
  const fallback = project.onedriveUrl || "#";
  return { sharedDocs: fallback, uploadDoc: fallback, meetingMinutes: fallback, invoices: fallback };
}


// ── Quick actions ─────────────────────────────────────────────────────────────
function ActionsGrid({ project, projectSlug }) {
  const sp = getSharePointLinks(project, projectSlug);
  const actions = [
    { href: sp.sharedDocs,     icon: "📁", bg: "#DBEAFE", color: "#1E40AF", accent: "#2563EB", cardBg: "linear-gradient(135deg,#EFF6FF,#FFFFFF)", title: "Project Documents",   desc: "Data for client access" },
    { href: sp.uploadDoc,      icon: "⬆",  bg: "#DCFCE7", color: "#166534", accent: "#16A34A", cardBg: "linear-gradient(135deg,#F0FDF4,#FFFFFF)", title: "Upload Document",     desc: "Received from Client folder" },
    { href: sp.meetingMinutes, icon: "📝", bg: "#F3E8FF", color: "#6B21A8", accent: "#9333EA", cardBg: "linear-gradient(135deg,#FAF5FF,#FFFFFF)", title: "Meeting Minutes",     desc: "Meeting Minutes and Notes" },
    { href: sp.invoices,       icon: "💰", bg: "#CFFAFE", color: "#155E75", accent: "#0891B2", cardBg: "linear-gradient(135deg,#ECFEFF,#FFFFFF)", title: "Invoices & Payments", desc: "Invoices and Payments folder" },
  ];
  return (
    <div className="actions-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
      {actions.map((a, i) => (
        <a key={i} className="action-btn pfas-action-card" href={a.href} target="_blank" rel="noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 13, padding: 15, borderRadius: 12, border: "1px solid #D6DCE5", borderLeft: `3px solid ${a.accent}`, textDecoration: "none", background: a.cardBg, animationDelay: `${i * 70}ms` }}>
          <div className="action-icon" style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, background: a.bg, color: a.color }}>{a.icon}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="action-title" style={{ fontSize: 13.5, fontWeight: 700, color: "#1E293B" }}>{a.title}</div>
            <div className="action-desc" style={{ fontSize: 11.5, color: "#94A3B8", lineHeight: 1.3, marginTop: 1 }}>{a.desc}</div>
          </div>
          <div className="action-arrow" style={{ flexShrink: 0, color: a.accent, fontSize: 14, opacity: 0.55 }}>→</div>
        </a>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ClientPortal() {
  const [authState, setAuthState]         = useState("loading");
  const [authError, setAuthError]         = useState("");
  const [userName, setUserName]           = useState("");
  const [allowedProjects, setAllowedProjects] = useState([]);
  const [projectSlug, setSlug]            = useState("");
  const [project, setProject]             = useState(null);
  const [dataLoading, setDataLoading]     = useState(false);
  const [dataError, setDataError]         = useState("");
  const [isDev, setIsDev]                 = useState(false);
  const [isAdmin, setIsAdmin]             = useState(false);
  const [showPinModal, setShowPinModal]   = useState(false);
  const { data: session, status }         = useSession();

  // ── Boot ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const isLocalhost = window.location.hostname === "localhost";
    if (isLocalhost) {
      setIsDev(true);
      setAuthState("devpicker");
      return;
    }

    if (status === "loading") return; // wait for session

    if (status === "authenticated" && session?.user?.email) {
      const email = session.user.email.toLowerCase();
      const acc   = EMAIL_PROJECT_MAP[email];
      if (!acc) {
        setAuthError("Your account is not linked to any PFAS project. Contact your engagement lead.");
        setAuthState("login");
        return;
      }
      setUserName(acc.name);
      setAllowedProjects(acc.projects);
      setSlug(acc.projects[0].slug);
      setAuthState("app");
    } else if (status === "unauthenticated") {
      setAuthState("login");
    }
  }, [status, session]);

  // ── Fetch live project data ─────────────────────────────────────────────────
  useEffect(() => {
    if (!projectSlug) return;
    setProject(null);
    setDataLoading(true);
    setDataError("");
    fetch(`/api/clickup-client?project=${projectSlug}`)
      .then(r => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then(data => { setProject(data); setDataLoading(false); })
      .catch(() => { setDataError("Could not load live project data. Please refresh."); setDataLoading(false); });
  }, [projectSlug]);

  // ── Auth handlers ───────────────────────────────────────────────────────────
  const handleLogout    = () => signOut({ callbackUrl: "/" });
  const handleDevSelect = (slug, name) => {
    setUserName(name);
    setAllowedProjects([{ slug, label: name }]);
    setSlug(slug);
    setAuthState("app");
  };
  const handleDevSwitch = () => { setAuthState("devpicker"); setProject(null); setSlug(""); };
  const handleProjectChange = (newSlug) => setSlug(newSlug);

  // ── Admin handlers ──────────────────────────────────────────────────────────
  const handleAdminPinSuccess = () => {
    setShowPinModal(false);
    setIsAdmin(true);
    setAuthState("adminpicker");
  };
  const handleAdminSelect = (slug, clientName, projects) => {
    setUserName(clientName);
    setAllowedProjects(projects);
    setSlug(slug);
    setAuthState("app");
  };
  const handleAdminSwitch = () => {
    setAuthState("adminpicker");
    setProject(null);
    setSlug("");
  };
  const handleAdminExit = () => {
    setIsAdmin(false);
    setAuthState("login");
    setProject(null);
    setSlug("");
    setUserName("");
  };

  // ── Shared <Head> ───────────────────────────────────────────────────────────
  const headAndCss = (
    <Head>
      <title>PFAS Client Portal</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        /* ── Logo image sizing ─────────────────────────────────────── */
        .login-logo {
          display: block;
          width: 160px;
          height: auto;
          max-height: 64px;
          object-fit: contain;
          margin: 0 auto 20px;
        }
        .brand-logo {
          width: 110px;
          height: auto;
          max-height: 40px;
          object-fit: contain;
          object-position: left center;
          flex-shrink: 0;
        }

        @keyframes pfas-call-blink {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,163,90,0.55); }
          50%      { box-shadow: 0 0 0 6px rgba(34,163,90,0); }
        }
        @keyframes pfas-call-glow {
          0%, 100% { background: #DCFCE7; border-color: #86EFAC; }
          50%      { background: #BBF7D0; border-color: #22A35A; }
        }
        .call-blink {
          animation: pfas-call-blink 1.4s ease-in-out infinite, pfas-call-glow 1.4s ease-in-out infinite;
        }
        .call-blink:hover { animation-play-state: paused; background: #BBF7D0; }

        /* WhatsApp button — elegant slow breath */
        @keyframes wa-breath {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.35);
          }
          50% {
            transform: scale(1.025);
            box-shadow: 0 0 0 6px rgba(34, 197, 94, 0);
          }
        }
        .wa-btn {
          animation: wa-breath 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          transition: transform 0.2s ease, background 0.2s ease;
          transform-origin: center;
        }
        .wa-btn:hover {
          animation-play-state: paused;
          background: #BBF7D0 !important;
          transform: scale(1.05);
        }

        /* Book a Meeting — elegant slow breath with soft indigo halo */
        @keyframes book-meeting-breath {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 2px 10px rgba(67, 56, 202, 0.12);
          }
          50% {
            transform: scale(1.02);
            box-shadow: 0 6px 22px rgba(67, 56, 202, 0.28);
          }
        }
        .teams-meeting-inline-btn {
          animation: book-meeting-breath 3.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          background: linear-gradient(135deg, #EEF1FF 0%, #E0E7FF 100%) !important;
          transform-origin: center;
        }
        .teams-meeting-inline-btn:hover {
          animation-play-state: paused;
          transform: scale(1.045);
          box-shadow: 0 8px 24px rgba(67, 56, 202, 0.35) !important;
        }

        @media (prefers-reduced-motion: reduce) {
          .call-blink { animation: none; }
          .pfas-action-card { animation: none; opacity: 1; }
          .teams-icon-pop { animation: none; }
          .wa-btn { animation: none; }
          .teams-meeting-inline-btn { animation: none; }
        }
        .pfas-action-card {
          transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
          opacity: 0;
          animation: action-card-in .45s ease forwards;
        }
        .pfas-action-card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(16,24,40,0.10); border-color: #1C2D56; }
        .pfas-action-card:active { transform: translateY(0) scale(0.97); }
        @keyframes action-card-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .action-icon { transition: transform .25s cubic-bezier(.34,1.56,.64,1); }
        .pfas-action-card:hover .action-icon { transform: scale(1.12) rotate(-6deg); }
        .pfas-action-card:active .action-icon { transform: scale(0.94) rotate(0deg); }
        .action-arrow { transition: transform .2s ease, opacity .2s ease; }
        .pfas-action-card:hover .action-arrow { transform: translateX(3px); opacity: 1; }

        /* Hero client name — clean bright gold, no bloom */
        .hero-client {
          color: #F2BE1A;
          font-weight: 900;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }
        .hero-project {
          color: #FFFFFF;
          text-shadow: 0 1px 3px rgba(0,0,0,0.35);
        }

        /* ═══════════════════════════════════════════════════════════════════
           MOBILE OPTIMIZATIONS (≤768px)
           Web/tablet view unchanged. Mobile gets a vertical-stack layout
           with bigger tap targets, hidden tertiary text, and full-width cards.
           ═══════════════════════════════════════════════════════════════════ */
        @media (max-width: 768px) {
          /* Container & body */
          body { font-size: 14px; }
          .container { padding: 12px !important; max-width: 100% !important; }

          /* Top bar: vertical 2-row stack */
          .topbar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
            padding: 12px 14px !important;
          }
          .topbar .brand { gap: 10px !important; }
          .topbar .brand-logo { width: 80px !important; height: 32px !important; }
          .topbar .brand-sub { font-size: 9px !important; letter-spacing: 0.5px !important; }
          .topbar .brand-name { font-size: 15px !important; }

          .topbar-right {
            width: 100% !important;
            flex-wrap: wrap !important;
            justify-content: flex-end !important;
            gap: 8px !important;
          }
          .topbar-right .live-badge {
            display: none !important;  /* hide "Updated X ago" on mobile to save space */
          }
          .topbar-right .user-chip {
            font-size: 11px !important;
            padding: 4px 8px 4px 4px !important;
          }
          .topbar-right .user-chip .av {
            width: 24px !important; height: 24px !important; font-size: 11px !important;
          }
          .topbar-right .logout-btn {
            padding: 6px 10px !important;
            font-size: 11px !important;
          }

          /* Project switcher dropdown — make full width on mobile */
          .project-switcher-btn {
            max-width: 100% !important;
            font-size: 12px !important;
          }

          /* Hero banner: smaller, tighter */
          .hero {
            padding: 18px 16px !important;
            border-radius: 14px !important;
          }
          .hero-title {
            font-size: 18px !important;
            margin: 6px 0 4px !important;
          }
          .hero-sub {
            font-size: 12.5px !important;
            line-height: 1.45 !important;
          }
          .hero-eyebrow { font-size: 9.5px !important; letter-spacing: 2px !important; }
          .hero-client { font-size: 28px !important; }
          .hero-project { font-size: 15.5px !important; }
          .hero-welcome-label { font-size: 15px !important; }
          .live-corner {
            font-size: 9px !important;
            padding: 3px 8px !important;
            top: 12px !important;
            right: 12px !important;
          }

          /* Main grid: single column on mobile (no sidebar split) */
          .main-grid {
            display: block !important;
            grid-template-columns: 1fr !important;
          }
          .sidebar {
            margin-top: 16px !important;
          }

          /* Project header */
          .project-header {
            padding: 18px !important;
          }
          .ph-name {
            font-size: 17px !important;
          }
          .ph-eyebrow {
            font-size: 9px !important;
          }
          .ph-icon-circle {
            width: 30px !important;
            height: 30px !important;
          }
          .ph-icon-circle svg {
            width: 14px !important;
            height: 14px !important;
          }
          .ph-row {
            gap: 9px !important;
          }

          /* KPI row: 2 columns instead of 4 */
          .kpi-row {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px !important;
          }
          .kpi {
            padding: 12px !important;
          }
          .kpi .kpi-label { font-size: 10px !important; }
          .kpi .kpi-value { font-size: 18px !important; }
          .kpi .kpi-sub { font-size: 10.5px !important; }

          /* Section cards */
          .section-card { padding: 16px !important; }
          .section-title { font-size: 14px !important; }

          /* Team grid: single column */
          .team-grid {
            display: flex !important;
            flex-direction: column !important;
            gap: 10px !important;
          }
          .member-card {
            width: 100% !important;
            box-sizing: border-box !important;
            padding: 14px !important;
          }
          .member-card .avatar {
            width: 38px !important;
            height: 38px !important;
            font-size: 13px !important;
          }
          .member-card .member-name { font-size: 14px !important; }
          .member-card .member-role { font-size: 11.5px !important; }
          .member-card .member-email,
          .member-card .member-contact { font-size: 12px !important; }

          /* Teams chat card */
          .chat-card { border-radius: 14px !important; }
          .chat-header { padding: 12px 14px !important; }
          .chat-title { font-size: 13px !important; }
          .chat-status, .chat-status-pending { font-size: 11px !important; }
          .chat-body { min-height: 240px !important; max-height: 320px !important; padding: 14px !important; }
          .chat-pending-body { padding: 20px 16px !important; }
          .pending-title { font-size: 14px !important; }
          .pending-sub { font-size: 12px !important; }
          .pstep-text { font-size: 11.5px !important; }
          .chat-cta-banner { padding: 12px 14px !important; }
          .chat-cta { font-size: 12.5px !important; padding: 9px 14px !important; }

          /* Documents */
          .docs-card { padding: 16px !important; }
          .doc-file-row { padding: 10px !important; gap: 10px !important; }
          .doc-file-icon { width: 30px !important; height: 30px !important; font-size: 14px !important; }
          .doc-file-name { font-size: 12.5px !important; }
          .doc-file-meta { font-size: 10.5px !important; }
          .docs-actions-row {
            flex-direction: column !important;
            gap: 8px !important;
          }
          .docs-browse-btn, .docs-upload-btn {
            width: 100% !important;
            justify-content: center !important;
          }

          /* Quick actions: 1 column instead of 2 */
          .actions-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
          .action-btn { padding: 14px !important; }
          .action-icon { width: 36px !important; height: 36px !important; font-size: 16px !important; }
          .action-title { font-size: 13px !important; }
          .action-desc { font-size: 11px !important; }

          /* Book a Meeting (Teams card) */
          .teams-icon-pop { width: 64px !important; height: 64px !important; }
          .teams-icon-pop svg { width: 64px !important; height: 64px !important; }

          /* Scheduling Log meetings */
          .mtg-card { padding: 16px !important; }
          .mtg-row {
            flex-wrap: wrap !important;
            padding: 12px 0 !important;
          }
          .mtg-title { font-size: 13px !important; }
          .mtg-meta { font-size: 11.5px !important; }

          /* Phase Progress sidebar — make it inline on mobile, not floating */
          .phase-sidebar-card {
            position: static !important;
            margin-top: 0 !important;
          }
          .phase-row { padding: 8px 0 !important; }
          .phase-name { font-size: 12.5px !important; }
          .phase-pct { font-size: 12px !important; }

          /* Login screen */
          .login-overlay { padding: 16px !important; }
          .login-card {
            max-width: 100% !important;
            padding: 28px 22px !important;
          }
          .login-title { font-size: 19px !important; }
          .login-sub { font-size: 13px !important; }
          .login-btn { font-size: 14px !important; padding: 13px !important; }

          /* Advisory Team + Book a Meeting row: stack on mobile */
          .team-meeting-row {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          /* Project Team inline header: stack title + book meeting button on mobile */
          .project-team-header {
            gap: 10px !important;
          }
          .teams-meeting-inline-btn {
            width: 100% !important;
            justify-content: center !important;
            font-size: 12.5px !important;
            padding: 9px 12px !important;
          }

          /* Admin picker */
          .admin-picker-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
            padding: 16px !important;
          }
          .admin-picker-logo { width: 70px !important; height: 28px !important; }
          .admin-picker-eyebrow { font-size: 9.5px !important; }
          .admin-picker-title { font-size: 15px !important; }
          .admin-picker-header-right { width: 100% !important; justify-content: space-between !important; }
          .admin-picker-body { padding: 14px !important; }
          .admin-picker-meta { font-size: 12px !important; margin-bottom: 10px !important; }
          .admin-search-input { font-size: 13px !important; }
          .admin-card-header { gap: 10px !important; }
          .admin-card-avatar { width: 38px !important; height: 38px !important; font-size: 13px !important; }
          .admin-card-name { font-size: 14px !important; }
          .admin-card-count { font-size: 11.5px !important; }
          .admin-project-btn { padding: 10px 12px !important; font-size: 12.5px !important; }
        }

        /* Extra-small phones (≤380px) */
        @media (max-width: 380px) {
          .kpi-row { grid-template-columns: 1fr !important; }
          .topbar { padding: 10px 12px !important; }
          .hero { padding: 16px 14px !important; }
          .hero-title { font-size: 17px !important; }
        }

        @media (max-width: 1180px) and (min-width: 861px) {
          /* Tablet: 3-col row (team | client | meeting) becomes 2-col
             with meeting dropping below the team+client pair */
          .team-meeting-row {
            grid-template-columns: 1fr 1fr !important;
          }
          .team-meeting-row > :last-child {
            grid-column: 1 / -1 !important;
          }
        }

        @media (max-width: 860px) {
          .team-meeting-row { grid-template-columns: 1fr !important; }
        }

        .teams-icon-pop {
          animation: teams-pop 2.4s ease-in-out infinite;
        }
        @keyframes teams-pop {
          0%, 70%, 100% { transform: scale(1) rotate(0deg); }
          80%  { transform: scale(1.08) rotate(-3deg); }
          88%  { transform: scale(0.97) rotate(2deg); }
          94%  { transform: scale(1.03) rotate(-1deg); }
        }
      `}</style>
    </Head>
  );

  // ── Render states ───────────────────────────────────────────────────────────
  if (authState === "loading") {
    return (
      <>
        {headAndCss}
        <div style={{ minHeight: "100vh", background: "#F4F6F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", color: "#475569" }}>
            <img src="/logo-dark.png" alt="PFAS" style={{ width: 120, height: 48, objectFit: "contain", margin: "0 auto 16px", display: "block" }} />
            <p style={{ fontSize: 14 }}>Loading portal…</p>
          </div>
        </div>
      </>
    );
  }

  if (authState === "devpicker") {
    return <>{headAndCss}<DevPicker onSelect={handleDevSelect} /></>;
  }

  if (authState === "login") {
    return (
      <>
        {headAndCss}
        <LoginScreen onAdminClick={() => setShowPinModal(true)} />
        {showPinModal && (
          <AdminPinModal
            onSuccess={handleAdminPinSuccess}
            onClose={() => setShowPinModal(false)}
          />
        )}
      </>
    );
  }

  if (authState === "adminpicker") {
    return (
      <>
        {headAndCss}
        <AdminClientPicker
          onSelect={handleAdminSelect}
          onBack={handleAdminExit}
        />
      </>
    );
  }

  // ── App shell ───────────────────────────────────────────────────────────────
  return (
    <>
      {headAndCss}
      <TopBar
        userName={userName}
        onLogout={handleLogout}
        lastUpdated={project?.lastUpdated}
        isDev={isDev}
        onSwitchDev={handleDevSwitch}
        projects={allowedProjects}
        currentSlug={projectSlug}
        onProjectChange={handleProjectChange}
        isAdmin={isAdmin}
        onAdminSwitch={handleAdminSwitch}
      />
      <div className="container">
        <div className="hero" style={{ position: "relative", overflow: "hidden", borderRadius: 18, padding: "30px 30px 28px", marginBottom: 20, background: "linear-gradient(120deg,#0E1D3A 0%,#1C2D56 55%,#1C2D56 100%)", boxShadow: "0 6px 24px rgba(22,41,74,0.28)" }}>
          {/* soft gold ambient accents, symmetric */}
          <div style={{ position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)", width: 360, height: 260, borderRadius: "50%", background: "radial-gradient(ellipse,rgba(242,190,26,0.10),transparent 70%)", pointerEvents: "none" }} />

          {project ? (
            <div className="hero-center" style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div className="hero-eyebrow" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: "rgba(242,190,26,0.85)", marginBottom: 12 }}>Welcome to your portal</div>
              <div className="hero-client" data-text={project.clientName} style={{ fontSize: 40, lineHeight: 1.08, letterSpacing: -0.5, marginBottom: 8 }}>
                {project.clientName}
              </div>
              <div className="hero-project" style={{ fontSize: 18.5, fontWeight: 600, lineHeight: 1.3 }}>
                {project.displayName || project.name}
              </div>
            </div>
          ) : (
            <div className="hero-center" style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div className="hero-eyebrow" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 12 }}>Project Portfolio Overview</div>
              <div className="hero-title" style={{ fontSize: 27, fontWeight: 800, color: "#fff", margin: "0 0 10px", lineHeight: 1.2 }}>Welcome to your PFAS engagement portal</div>
              <div className="hero-sub" style={{ fontSize: 13.5, color: "rgba(255,255,255,0.78)", maxWidth: 600, lineHeight: 1.5 }}>Track project progress, contact your advisory team directly, access shared documents and meeting minutes, and schedule meetings.</div>
            </div>
          )}
        </div>

        {dataLoading && <LoadingSkeleton />}
        {dataError && (
          <div style={{ background: "#FECACA", border: "1px solid #F87171", borderRadius: 12, padding: "16px 20px", color: "#9B2C2C", marginBottom: 20 }}>
            ⚠ {dataError}
          </div>
        )}

        {project && !dataLoading && (
          <div className="main-grid">
            <div>
              <KpiRow project={project} />

              {/* Project Team + Book a Meeting inline in header */}
              <div className="section-card" style={{ ...CARD, marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }} className="project-team-header">
                  <div style={SECTION_TITLE}>
                    <span style={TITLE_BAR} />Project Team
                  </div>
                  <a
                    href={project.teamsBookingUrl || project.teamsMeeting || "#"}
                    target="_blank" rel="noreferrer"
                    className="teams-meeting-inline-btn"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "11px 20px",
                      color: "#4338CA",
                      fontSize: 14.5,
                      fontWeight: 800,
                      borderRadius: 12,
                      textDecoration: "none",
                      border: "1.5px solid #C7D2FE",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      letterSpacing: 0.2,
                    }}
                  >
                    <span className="teams-icon-pop" style={{ width: 22, height: 22, display: "inline-flex" }}>
                      <svg width="22" height="22" viewBox="0 0 2228.833 2073.333" xmlns="http://www.w3.org/2000/svg">
                        <path fill="#5059C9" d="M1554.637,777.5h575.713c54.391,0,98.483,44.092,98.483,98.483v0c0,159.084-118.929,294.296-277.083,310.6-39.083-13.667-81.166-21.083-125-21.083-83.333,0-160.583,27.083-223,72.917v-377.417C1603.75,824.792,1554.637,777.5,1554.637,777.5Z" transform="translate(-128.317 -350.083)"/>
                        <circle fill="#5059C9" cx="1746.583" cy="240.75" r="240.75"/>
                        <path fill="#7B83EB" opacity="1" d="M1183.083,777.5H707.37c-54.391,0-98.483,44.092-98.483,98.483v500.953c0,278.604,225.871,504.475,504.475,504.475h0c278.604,0,504.475-225.871,504.475-504.475V875.983C1617.837,821.592,1573.745,777.5,1519.354,777.5Z" transform="translate(-128.317 -350.083)"/>
                        <circle fill="#7B83EB" cx="945.417" cy="240.75" r="240.75"/>
                      </svg>
                    </span>
                    <span>Book a Meeting</span>
                    <span style={{ fontSize: 16, marginLeft: 2 }}>↗</span>
                  </a>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                    gap: 14,
                  }}
                >
                  {/* PFAS team members */}
                  {filterTeamForProject(project.team, projectSlug)?.map((m, i) => {
                    const initials = m.name.split(" ").map(n => n[0]).join("").substring(0, 2);
                    const staffKey = (m.email || "").toLowerCase().trim();
                    const staff    = STAFF_DIRECTORY[staffKey] || {};
                    const designation  = staff.designation || m.role || "—";
                    const contact      = staff.contact     || null;
                    const emailDisplay = m.email && m.email !== "—" ? m.email : null;
                    const waNumber     = toWhatsAppNumber(contact);
                    const waHref       = waNumber ? `https://wa.me/${waNumber}` : null;
                    return (
                      <div className="member-card" key={`pfas-${i}`} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10, padding: 16, background: "#fff", border: "1px solid #C9D2DE", borderRadius: 14, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                          <div className={`avatar av-${m.color}`} style={{ flexShrink: 0, width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 11, letterSpacing: 0.5 }}>
                            PFAS
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="member-name" style={{ fontWeight: 700, fontSize: 15, color: "#1E293B", lineHeight: 1.25 }}>{m.name}</div>
                            <div className="member-role" style={{ fontSize: 12.5, color: "#64748B", lineHeight: 1.35, marginTop: 2 }}>{designation}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingTop: 11, borderTop: "1px solid #F1F5F9" }}>
                          {emailDisplay && (
                            <div className="member-email" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, minWidth: 0 }}>
                              <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect x="2" y="4" width="20" height="16" rx="3" fill="#1C2D56" fillOpacity="0.12" stroke="#1C2D56" strokeWidth="1.6"/>
                                  <path d="M3 6l9 6 9-6" stroke="#1C2D56" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </span>
                              <a href={`mailto:${emailDisplay}`} style={{ color: "#1C2D56", textDecoration: "none", overflowWrap: "anywhere", wordBreak: "break-word", fontWeight: 600 }}>{emailDisplay}</a>
                            </div>
                          )}
                          {contact && (
                            <div className="member-contact" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                              <span style={{ flexShrink: 0 }}>📞</span>
                              <a href={`tel:${contact.replace(/\s|-/g,"")}`} style={{ color: "#475569", textDecoration: "none" }}>{contact}</a>
                            </div>
                          )}
                          {waHref && (
                            <a href={waHref} target="_blank" rel="noreferrer" className="wa-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4, padding: "6px 10px", background: "#DCFCE7", color: "#166534", fontSize: 12, fontWeight: 600, borderRadius: 8, textDecoration: "none", border: "1px solid #86EFAC", alignSelf: "flex-start" }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.858L.057 23.716a.5.5 0 0 0 .609.61l5.975-1.516A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.523-5.157-1.432l-.36-.214-3.737.949.988-3.648-.235-.375A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                              WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Client Rep — same row, teal-tinted with CLIENT pill */}
                  {CLIENT_REPS[projectSlug] && (
                    <ClientRepCard rep={CLIENT_REPS[projectSlug]} />
                  )}
                </div>
              </div>

              {/* Quick Actions — now ABOVE Project Documents */}
              <SectionCard title="Quick Actions">
                <ActionsGrid project={project} projectSlug={projectSlug} />
              </SectionCard>

              <DocumentsSection project={project} projectSlug={projectSlug} />
            </div>

            <div className="sidebar">
              <SectionCard title="Phase Progress" className="phase-sidebar-card" style={{ position: "sticky", top: 20 }}>
                <div className="phase-legend" style={{ fontSize: 11.5, color: "#64748B", marginBottom: 14, display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                  <span className="legend-dot dot-green" /> Completed
                  <span className="legend-dot dot-amber" style={{ marginLeft: 12 }} /> In Progress
                  <span className="legend-dot dot-grey"  style={{ marginLeft: 12 }} /> Not Started
                </div>
                <PhaseList phases={project.phases} />
              </SectionCard>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
