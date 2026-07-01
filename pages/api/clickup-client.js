// pages/api/clickup-client.js — updated 2026-07-01
// PFAS Client Portal — Live ClickUp data feed
// Returns ONLY client-safe fields. Never exposes internal notes, budgets, or PM data.
//
// Usage:  GET /api/clickup-client?project=shrimps-estate-project
// Returns: { name, clientName, type, overallPercent, activeTasks, overdueTasks,
//            pfasFee, receivedPayments, currentPhase, health, phases[], members[], lastUpdated }

const CU_TOKEN = process.env.CLICKUP_API_TOKEN;
const SPACE_ID = "901810857664";
const PROJECT_DIR_LIST_ID = "901817826150";

// Maps the client portal project slug → ClickUp list name (lowercased, trimmed)
// These must match exactly what's in your ClickUp workspace
// List names verified against live ClickUp workspace on 22 Jun 2026
const SLUG_TO_LIST_NAME = {
  "shrimps":          "shrimps estate project",
  "pcmmdc":           "hr manual(pcmmdc)",
  "p4a":              "economic & financial feasibility advisory -  tertiary care general hospital p4a",
  "fiedmc-m3ic":      "optimal fund utilisation of m3ic commercial plot sale fiedmc",
  "fiedmc-sbp":       "strategic business plan fiedmc",
  "energy":           "strategic assessment & design of a project management wing- energy",
  "bot1":             "bot-1 depalpur-pakpattan-vehari",
  "bot2":             "bot-2 chiragabad jhang shorkot",
  "bot3":             "bot-3 muzaffargarh-alipur-tm",
  "bot4":             "bot-4 sahiwal samundari",
  "bot5":             "bot 5 bahawalpur-jhangra sharqi road",
  "om-roads":         "18 o&m roads-ppp",
  "wildlife-bansra":  "bansra gali wildlife",
  "wildlife-changa":  "changa manga wildlife",
  "tam":              "time travel theme park",
  "pha":              "pha",
  "pbf":              "punjab govt employees welfare fund",
  "punjab-onebill":   "punjab one bill study",
  "twilight":         "project twilight",
  "hed":              "higher education department",
  "phimc":            "phimc johar town — hospital bot ppp",
  "lda":              "economic & financial feasibility advisory -  4 hospitals (lda)",
};

// Static metadata that doesn't live in ClickUp — Teams links, OneDrive links, team contacts
// Keyed by slug. Add new projects here when onboarding clients.
const PROJECT_META = {
  "shrimps": {
    type: "Leasing Model & Financial Feasibility",
    onedriveUrl: "https://pfaspk-my.sharepoint.com/:f:/g/personal/hamza_naeem_pfas_pk/IgCqTpi_G5uURooyJBe2Wcx7AeHoAcmCRAJ-CBsxk5-Hsas?e=bM3UOd",
    teamsChannel: "https://teams.microsoft.com/l/channel/Shrimps%20Estate%20Project/Fisheries",
    teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%20Shrimps%20Estate%20Project%20%7C%20Review",
    team: [
      { name: "Ammar Yasar",        role: "Team Lead",        email: "ammar.yasar@pfas.pk",       color: "navy"   },
      { name: "Khalid Safdar",      role: "Senior Analyst",   email: "khalid.safdar@pfas.pk",     color: "gold"   },
      { name: "Meiraj Najam Khan",  role: "Analyst",          email: "meiraj.khan@pfas.pk",       color: "green"  },
      { name: "Habeeba Naseer",     role: "Legal Counsel",    email: "habeeba.naseer@pfas.pk",    color: "purple" }
    ]
  },
  "pcmmdc": {
    type: "HR Restructuring Advisory",
    onedriveUrl: "https://pfaspk-my.sharepoint.com/:f:/g/personal/hamza_naeem_pfas_pk/IgAIioMgxuNmSIiqijomYjrCAUCzUlrnmB-1_i78v2L2a-M?e=QWFKTg",
    teamsChannel: "https://teams.microsoft.com/l/channel/HR%20Manual%20%26%20Policy%20Compendium/PCMMDC",
    teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%20PCMMDC%20HR%20Manual%20%7C%20Review",
    team: [
      { name: "Muhammad Fahad Tanveer",  role: "Project Manager",  email: "fahad.tanveer@pfas.pk",  color: "navy"   },
      { name: "Hashim Riaz",             role: "Senior Advisor",   email: "hashim.riaz@pfas.pk",    color: "gold"   },
      { name: "Qamar Sb",                role: "HR Expert",        email: "—",                      color: "green"  }
    ]
  },
  "p4a": {
    type: "Economic & Financial Feasibility",
    onedriveUrl: "https://pfaspk-my.sharepoint.com/:f:/g/personal/hamza_naeem_pfas_pk/IgAYhriqzbPgS6GsZaO8JcsOAdNku4tGqSB5C6wZ6Tr5tE4?e=mpwXk0",
    teamsChannel: "https://teams.microsoft.com/l/channel/Tertiary%20Care%20Hospital/P4A",
    teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%20P4A%20Tertiary%20Care",
    team: [
      { name: "Hashim Riaz",            role: "Team Lead",            email: "hashim.riaz@pfas.pk",   color: "navy"   },
      { name: "Muhammad Fahad Tanveer", role: "PM Team",              email: "fahad.tanveer@pfas.pk",     color: "gold"   },
      { name: "Shehzad Leghari",        role: "Healthcare Consultant",email: "—",                         color: "purple" }
    ]
  },
  "fiedmc-m3ic": {
    type: "Optimal Fund Utilisation Advisory",
    onedriveUrl: "https://pfaspk-my.sharepoint.com/:f:/g/personal/hamza_naeem_pfas_pk/IgBsumuXRajrR68p1lVoyk9fAXSzT8AjpCaraSizNyGvS-A?e=gFo5iI",
    teamsChannel: "https://teams.microsoft.com/l/channel/M3IC%20Commercial%20Plot%20Sale/FIEDMC",
    teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%20FIEDMC%20M3IC%20%7C%20Review",
    team: [
      { name: "Muhammad Fahad Tanveer", role: "Project Lead",    email: "fahad.tanveer@pfas.pk",    color: "navy" },
      { name: "Hashim Riaz",            role: "Senior Advisor",  email: "hashim.riaz@pfas.pk",  color: "gold" }
    ]
  },
  "fiedmc-sbp": {
    type: "Strategic Advisory",
    onedriveUrl: "https://pfaspk-my.sharepoint.com/:f:/g/personal/hamza_naeem_pfas_pk/IgBsumuXRajrR68p1lVoyk9fAXSzT8AjpCaraSizNyGvS-A?e=gFo5iI",
    teamsChannel: "https://teams.microsoft.com/l/channel/Strategic%20Business%20Plan/FIEDMC",
    teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%20FIEDMC%20SBP",
    team: [
      { name: "Muhammad Fahad Tanveer", role: "Project Lead",    email: "fahad.tanveer@pfas.pk",    color: "navy" },
      { name: "Hashim Riaz",            role: "Senior Advisor",  email: "hashim.riaz@pfas.pk",  color: "gold" }
    ]
  },
  "energy": {
    type: "Project Management Wing Restructuring",
    onedriveUrl: "https://pfaspk-my.sharepoint.com/:f:/g/personal/hamza_naeem_pfas_pk/IgAP0fwlxoZcSaBjo-3Nhe-8ASdBglItdkiDqd329IHzhC0?e=5ekc3e",
    teamsChannel: "https://teams.microsoft.com/l/channel/PMW%20Strategic%20Design/Energy",
    teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%20Energy%20PMW",
    team: [
      { name: "Muhammad Fahad Tanveer", role: "Project Lead",    email: "fahad.tanveer@pfas.pk",  color: "navy"  },
      { name: "Hashim Riaz",            role: "Senior Advisor",  email: "hashim.riaz@pfas.pk",    color: "gold"  }
    ]
  },
  "bot1":  { type: "Dualization BOT-PPP",        onedriveUrl: "https://pfaspk-my.sharepoint.com/personal/hamza_naeem_pfas_pk/Documents/PFAS%20Operations/C%26W/BOT-1%20Dualization%20of%20Deplapur-Pakpattan-Vehari%20Road", teamsChannel: "https://teams.microsoft.com/l/channel/BOT-1%20Depalpur-Pakpattan/C%26W%20Roads", teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%20BOT-1%20Discussion", team: [{ name: "Abdul Wahab", role: "Project Lead", email: "abdul.wahab@pfas.pk", color: "navy" }, { name: "Umar Paracha", role: "Senior Analyst", email: "umar.paracha@pfas.pk", color: "gold" }, { name: "Husnain Siddique", role: "Senior Associate", email: "husnain.siddique@pfas.pk", color: "green" }, { name: "Ali Jibran", role: "Analyst", email: "ali.jibran@pfas.pk", color: "purple" }] },
  "bot2":  { type: "Dualization BOT-PPP",        onedriveUrl: "https://pfaspk-my.sharepoint.com/personal/hamza_naeem_pfas_pk/Documents/PFAS%20Operations/C%26W/BOT-2-%20Dualization%20of%20Chiragabad-Jhan-Shorkot%20Road", teamsChannel: "https://teams.microsoft.com/l/channel/BOT-2%20Chiragabad-Jhang/C%26W%20Roads",   teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%20BOT-2%20Discussion", team: [{ name: "Abdul Wahab", role: "Project Lead", email: "abdul.wahab@pfas.pk", color: "navy" }, { name: "Umar Paracha", role: "Senior Analyst", email: "umar.paracha@pfas.pk", color: "gold" }, { name: "Husnain Siddique", role: "Senior Associate", email: "husnain.siddique@pfas.pk", color: "green" }, { name: "Ali Jibran", role: "Analyst", email: "ali.jibran@pfas.pk", color: "purple" }] },
  "bot3":  { type: "Dualization BOT-PPP",        onedriveUrl: "https://pfaspk-my.sharepoint.com/personal/hamza_naeem_pfas_pk/Documents/PFAS%20Operations/C%26W/BOT-3-%20Dualization%20of%20Muzaffargarh-Alipur-TM%20panah%20road", teamsChannel: "https://teams.microsoft.com/l/channel/BOT-3%20Muzaffargarh-Alipur/C%26W%20Roads", teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%20BOT-3%20Discussion", team: [{ name: "Abdul Wahab", role: "Project Lead", email: "abdul.wahab@pfas.pk", color: "navy" }, { name: "Umar Paracha", role: "Senior Analyst", email: "umar.paracha@pfas.pk", color: "gold" }, { name: "Husnain Siddique", role: "Senior Associate", email: "husnain.siddique@pfas.pk", color: "green" }, { name: "Ali Jibran", role: "Analyst", email: "ali.jibran@pfas.pk", color: "purple" }] },
  "bot4":  { type: "Add Carriageway BOT-PPP",    onedriveUrl: "https://pfaspk-my.sharepoint.com/personal/hamza_naeem_pfas_pk/Documents/PFAS%20Operations/C%26W/BOT-4-%20Add%20Carriageway%20of%20sahiwal-samundari%20%20Road", teamsChannel: "https://teams.microsoft.com/l/channel/BOT-4%20Sahiwal-Samundari/C%26W%20Roads",   teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%20BOT-4%20Discussion", team: [{ name: "Abdul Wahab", role: "Project Lead", email: "abdul.wahab@pfas.pk", color: "navy" }, { name: "Umar Paracha", role: "Senior Analyst", email: "umar.paracha@pfas.pk", color: "gold" }, { name: "Husnain Siddique", role: "Senior Associate", email: "husnain.siddique@pfas.pk", color: "green" }, { name: "Ali Jibran", role: "Analyst", email: "ali.jibran@pfas.pk", color: "purple" }] },
  "bot5":  { type: "Add Carriageway BOT-PPP",    onedriveUrl: "https://pfaspk-my.sharepoint.com/personal/hamza_naeem_pfas_pk/Documents/PFAS%20Operations/C%26W/BOT%205%20Add%20Carriageway%20to%20Bahawalpur-Jhangra%20sharqi%20Road", teamsChannel: "https://teams.microsoft.com/l/channel/BOT-5%20Bahawalpur-Jhangra/C%26W%20Roads",  teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%20BOT-5%20Discussion", team: [{ name: "Abdul Wahab", role: "Project Lead", email: "abdul.wahab@pfas.pk", color: "navy" }, { name: "Umar Paracha", role: "Senior Analyst", email: "umar.paracha@pfas.pk", color: "gold" }, { name: "Husnain Siddique", role: "Senior Associate", email: "husnain.siddique@pfas.pk", color: "green" }, { name: "Ali Jibran", role: "Analyst", email: "ali.jibran@pfas.pk", color: "purple" }] },
  "om-roads": { type: "Operations & Maintenance PPP", onedriveUrl: "https://pfaspk-my.sharepoint.com/personal/hamza_naeem_pfas_pk/Documents/PFAS%20Operations/C%26W/18%20O%26M%20Roads-PPP", teamsChannel: "https://teams.microsoft.com/l/channel/18%20O%26M%20Roads/C%26W%20Roads", teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%2018%20O%26M%20Roads%20Discussion", team: [{ name: "Abdul Wahab", role: "Project Lead", email: "abdul.wahab@pfas.pk", color: "navy" }, { name: "Husnain Siddique", role: "Senior Associate", email: "husnain.siddique@pfas.pk", color: "gold" }, { name: "Umar Paracha", role: "Senior Analyst", email: "umar.paracha@pfas.pk", color: "green" }, { name: "Ali Jibran", role: "Analyst", email: "ali.jibran@pfas.pk", color: "purple" }] },
  "wildlife-bansra": { type: "Site Advisory", onedriveUrl: "https://pfaspk-my.sharepoint.com/personal/hamza_naeem_pfas_pk/Documents/PFAS%20Operations/Wildlife/Bansara%20Gali%20Wildlife", teamsChannel: "https://teams.microsoft.com/l/channel/Bansra%20Gali%20Wildlife/Wildlife", teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%20Bansra%20Gali", team: [{ name: "Aneel Iqbal", role: "General Manager", email: "aneel.iqbal@pfas.pk", color: "navy" }, { name: "Muhammad Aejwat", role: "Senior Analyst", email: "muhammad.aejwat@pfas.pk", color: "gold" }, { name: "Ahmad Sohail", role: "Individual Consultant", email: "ahmad.sohail@pfas.pk", color: "green" }] },
  "wildlife-changa": { type: "Site Advisory", onedriveUrl: "https://pfaspk-my.sharepoint.com/personal/hamza_naeem_pfas_pk/Documents/PFAS%20Operations/Wildlife/Changa%20Manga%20wildlife", teamsChannel: "https://teams.microsoft.com/l/channel/Changa%20Manga%20Wildlife/Wildlife", teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%20Changa%20Manga", team: [{ name: "Muhammad Aejwat", role: "Senior Analyst", email: "muhammad.aejwat@pfas.pk", color: "navy" }, { name: "Ahmad Sohail", role: "Individual Consultant", email: "ahmad.sohail@pfas.pk", color: "gold" }] },
  "tam":  { type: "Project Advisory", onedriveUrl: "https://pfaspk-my.sharepoint.com/personal/hamza_naeem_pfas_pk/Documents/PFAS%20Operations/TAM/Time%20Travel%20Park", teamsChannel: "https://teams.microsoft.com/l/channel/Time%20Travel%20Theme%20Park/TAM", teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%20TAM%20Theme%20Park", team: [{ name: "Ammar Yasar", role: "Team Lead", email: "ammar.yasar@pfas.pk", color: "navy" }, { name: "Khalid Safdar", role: "Senior Analyst", email: "khalid.safdar@pfas.pk", color: "gold" }, { name: "Meiraj N. Khan", role: "Analyst", email: "meiraj.khan@pfas.pk", color: "green" }, { name: "Azmat Nawaz", role: "Chief Operating Officer", email: "azmat.nawaz@pfas.pk", color: "purple" }] },
  "pha":  { type: "Financial Sustainability Advisory", onedriveUrl: "https://pfaspk-my.sharepoint.com/personal/hamza_naeem_pfas_pk/Documents/PFAS%20Operations/PHA", teamsChannel: "https://teams.microsoft.com/l/channel/PHA%20Lahore/PHA", teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%20PHA%20Lahore", team: [{ name: "Hashim Riaz", role: "Project Lead", email: "hashim.riaz@pfas.pk", color: "navy" }] },
  "pbf":  { type: "Welfare Fund Advisory", onedriveUrl: "https://pfaspk-my.sharepoint.com/personal/hamza_naeem_pfas_pk/Documents/PFAS%20Operations/Punjab%20Benevolent%20Fund/Punjab%20Govt%20Employees%20welfare%20fund", teamsChannel: "https://teams.microsoft.com/l/channel/Employees%20Welfare%20Fund/Punjab%20Benevolent%20Fund", teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%20PBF%20Welfare", team: [{ name: "Aneel Iqbal", role: "General Manager", email: "aneel.iqbal@pfas.pk", color: "navy" }, { name: "Muhammad Aejwat", role: "Senior Analyst", email: "muhammad.aejwat@pfas.pk", color: "gold" }, { name: "Harris Ghaffar", role: "Associate Financial Advisory", email: "harris.ghaffar@pfas.pk", color: "green" }] },
  "punjab-onebill": { type: "Revenue Consolidation Study", onedriveUrl: "https://pfaspk-my.sharepoint.com/personal/hamza_naeem_pfas_pk/Documents/PFAS%20Operations/Finance%20Department/Punjab%20One%20Bill%20Study", teamsChannel: "https://teams.microsoft.com/l/channel/Punjab%20One%20Bill%20Study/Finance%20Department", teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%20Punjab%20One%20Bill", team: [{ name: "Samiya Mukhtar", role: "Practice Lead PFM", email: "samiya.mukhtar@pfas.pk", color: "navy" }, { name: "Hassaan Mallick", role: "Associate PFM", email: "hassaan.mallick@pfas.pk", color: "gold" }, { name: "Habeeba Ahmad Naseer", role: "Chief Legal Officer", email: "habeeba.naseer@pfas.pk", color: "green" }] },
  "twilight": { type: "Project Twilight", onedriveUrl: "https://pfaspk-my.sharepoint.com/personal/hamza_naeem_pfas_pk/Documents/PFAS%20Operations/Finance%20Department", teamsChannel: "https://teams.microsoft.com/l/channel/VSS%20Engagement/Finance%20Department", teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%20Project%20Twilight", team: [{ name: "Hashim Riaz", role: "Team Lead", email: "hashim.riaz@pfas.pk", color: "navy" }, { name: "Muhammad Fahad Tanveer", role: "Project Manager", email: "fahad.tanveer@pfas.pk", color: "gold" }] },
  "hed":  { type: "Strategic Advisory", onedriveUrl: "https://pfaspk-my.sharepoint.com/personal/hamza_naeem_pfas_pk/Documents/PFAS%20Operations", teamsChannel: "https://teams.microsoft.com/l/channel/HED%20Engagement/Higher%20Education%20Dept", teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%20HED", team: [{ name: "Husnain Siddique", role: "Senior Associate", email: "husnain.siddique@pfas.pk", color: "navy" }, { name: "Ali Jibran", role: "Analyst", email: "ali.jibran@pfas.pk", color: "gold" }] },
  "phimc":{ type: "Healthcare Feasibility Advisory", onedriveUrl: "https://pfaspk-my.sharepoint.com/personal/hamza_naeem_pfas_pk/Documents/PFAS%20Operations", teamsChannel: "https://teams.microsoft.com/l/channel/6%20Hospitals%20Feasibility/PHIMC", teamsMeeting: "https://teams.microsoft.com/l/meeting/new?subject=PFAS%20%E2%80%94%20PHIMC%206%20Hospitals", team: [{ name: "Hashim Riaz", role: "Team Lead", email: "hashim.riaz@pfas.pk", color: "navy" }, { name: "Muhammad Fahad Tanveer", role: "Project Manager", email: "fahad.tanveer@pfas.pk", color: "gold" }, { name: "Awais Khan", role: "Analyst", email: "awais.khan@pfas.pk", color: "green" }, { name: "Abdul Wahab", role: "Analyst", email: "abdul.wahab@pfas.pk", color: "purple" }] },
};

// ── ClickUp helpers ──────────────────────────────────────────────────────────

async function cuJson(url) {
  const res = await fetch(url, { headers: { Authorization: CU_TOKEN } });
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 1200));
    const r2 = await fetch(url, { headers: { Authorization: CU_TOKEN } });
    return r2.json();
  }
  return res.json();
}

function getStatus(task) {
  const s = task?.status;
  if (!s) return "";
  if (typeof s === "string") return s.toLowerCase().trim();
  return (s.status || "").toLowerCase().trim();
}

function isDone(task) {
  const s = getStatus(task);
  return ["complete", "closed", "done", "completed"].includes(s);
}

function isPhase(task) {
  return getStatus(task) === "phases";
}

function isActive(task) {
  const s = getStatus(task);
  return s === "ongoing" || s === "need to start working on";
}

function isOverdue(task) {
  if (!task.due_date) return false;
  return Date.now() > parseInt(task.due_date) && !isDone(task);
}

// ── Project Directory lookup ─────────────────────────────────────────────────

async function fetchProjectDirEntry(listName) {
  // Fetch all tasks in Project Directory, find matching by name
  const data = await cuJson(
    `https://api.clickup.com/api/v2/list/${PROJECT_DIR_LIST_ID}/task?archived=false&subtasks=false`
  );
  const tasks = data.tasks || [];
  const match = tasks.find(t => t.name.toLowerCase().trim() === listName.toLowerCase().trim());
  if (!match) return { pfasFee: "PKR TBD", oneDriveUrl: null, receivedPayments: null };

  const feeField              = "7e823284-632f-4e8a-8562-63aee2cc970d";
  const oneDriveField         = "90882fc8-a254-48bb-9f2e-517582c8e4d7";
  const receivedPaymentsField = "1890ea78-2be4-42ff-a90f-ac6cd8bcff38";

  let pfasFee = "PKR TBD";
  let oneDriveUrl = null;
  let receivedPayments = null;

  (match.custom_fields || []).forEach(f => {
    if (f.id === feeField && f.value)      pfasFee     = f.value;
    if (f.id === oneDriveField && f.value) oneDriveUrl = f.value;

    // Received Payments is a DROPDOWN — value is the option ID (UUID).
    // Map UUID → label (e.g. "75%") using the field's options array.
    if (f.id === receivedPaymentsField && f.value !== null && f.value !== undefined) {
      const opts = f.type_config?.options || [];
      const opt = opts.find(o => o.id === f.value || o.orderindex === f.value);
      if (opt) receivedPayments = opt.name;
    }
  });

  return { pfasFee, oneDriveUrl, receivedPayments };
}

// ── Main project data builder ────────────────────────────────────────────────

async function buildClientProject(listId, listName, clientName, slug) {
  const meta = PROJECT_META[slug] || {};

  // Fetch all tasks (with subtasks)
  const data = await cuJson(
    `https://api.clickup.com/api/v2/list/${listId}/task?archived=false&subtasks=true&include_closed=true`
  );
  const rawTasks = data.tasks || [];

  // Separate phase headers from subtasks
  const phaseTasks  = rawTasks.filter(t => isPhase(t));
  const regularTasks = rawTasks.filter(t => !isPhase(t));

  // Build phase → children map by parent ID
  const childrenByParent = {};
  regularTasks.forEach(t => {
    const pid = t.parent || "__root__";
    if (!childrenByParent[pid]) childrenByParent[pid] = [];
    childrenByParent[pid].push(t);
  });

  // Build phases array
  const phases = phaseTasks.map(ph => {
    const children = childrenByParent[ph.id] || [];
    const total     = children.length;
    const completed = children.filter(t => isDone(t)).length;
    const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
    const hasBlocker = children.some(t => getStatus(t) === "blockers");
    const hasActive  = children.some(t => isActive(t));

    let status = "grey";
    if (pct === 100)      status = "green";
    else if (hasBlocker)  status = "red";
    else if (hasActive)   status = "amber";
    else if (pct > 0)     status = "amber";

    // Due date = latest due_date among children
    const dueDates = children.filter(t => t.due_date).map(t => parseInt(t.due_date));
    const dueDate  = dueDates.length ? Math.max(...dueDates) : null;

    return { name: ph.name, pct, status, dueDate, id: ph.id };
  });

  // Overall progress
  const allSubtasks   = regularTasks;
  const totalSubs     = allSubtasks.length;
  const completedSubs = allSubtasks.filter(t => isDone(t)).length;
  const overallPct    = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;

  // KPI counts
  const activeTasks  = allSubtasks.filter(t => isActive(t)).length;
  const overdueTasks = allSubtasks.filter(t => isOverdue(t)).length;
  const blockers     = allSubtasks.filter(t => getStatus(t) === "blockers").length;

  // Current phase = first non-100% phase
  const currentPhase = phases.find(p => p.pct < 100)?.name
    || phases[phases.length - 1]?.name
    || "—";

  // Health: red if any blocker, amber if overdue, else green
  let health = "green";
  if (blockers > 0 || overdueTasks > 3) health = "red";
  else if (overdueTasks > 0 || activeTasks === 0 && totalSubs > 0) health = "amber";

  // Last updated = most recently updated task
  const lastUpdated = allSubtasks.length
    ? new Date(Math.max(...allSubtasks.map(t => parseInt(t.date_updated || 0)))).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  // Fetch pfasFee + receivedPayments from Project Directory (overrides meta only if found)
  const dirEntry         = await fetchProjectDirEntry(listName);
  const pfasFee          = dirEntry.pfasFee;
  const receivedPayments = dirEntry.receivedPayments;

  return {
    slug,
    name:         listName,
    displayName:  rawTasks[0]?.list?.name || listName,
    clientName,
    type:         meta.type || "Advisory",
    health,
    pfasFee,
    receivedPayments,
    currentPhase,
    overallPercent: overallPct,
    activeTasks,
    overdueTasks,
    blockers,
    phases,
    lastUpdated,
    // Static meta
    team:         meta.team || [],
    onedriveUrl:  meta.onedriveUrl || dirEntry.oneDriveUrl || "#",
    teamsChannel: meta.teamsChannel || "#",
    teamsMeeting: meta.teamsMeeting || "#",
  };
}

// ── Discover list ID from slug ───────────────────────────────────────────────

const LEGAL_SPACE_ID = "90189129438";

async function findListForSlug(slug) {
  const targetName = SLUG_TO_LIST_NAME[slug];
  if (!targetName) return null;

  // Search both spaces — most projects are in PFAS Operations,
  // PHIMC is in LEGAL space
  const spacesToSearch = [SPACE_ID, LEGAL_SPACE_ID];

  for (const spaceId of spacesToSearch) {
    const foldersData = await cuJson(
      `https://api.clickup.com/api/v2/space/${spaceId}/folder?archived=false`
    );
    const folders = foldersData.folders || [];

    for (const folder of folders) {
      const listsData = await cuJson(
        `https://api.clickup.com/api/v2/folder/${folder.id}/list?archived=false`
      );
      const lists = listsData.lists || [];
      const match = lists.find(l => l.name.toLowerCase().trim() === targetName);
      if (match) return { listId: match.id, listName: match.name, clientName: folder.name };
    }
  }
  return null;
}

// ── API handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  let { project } = req.query;
  if (!project) return res.status(400).json({ error: "project slug required" });

  // Slug aliases — handle renames without breaking old bookmarked slugs
  const SLUG_ALIASES = { "vss": "twilight" };
  if (SLUG_ALIASES[project]) project = SLUG_ALIASES[project];

  if (!SLUG_TO_LIST_NAME[project]) return res.status(404).json({ error: "unknown project slug" });

  try {
    const found = await findListForSlug(project);
    if (!found) {
      return res.status(404).json({ error: `ClickUp list not found for slug: ${project}` });
    }

    const data = await buildClientProject(
      found.listId,
      found.listName,
      found.clientName,
      project
    );

    // Cache for 5 minutes — enough for a client session without hammering ClickUp
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
    return res.status(200).json(data);

  } catch (err) {
    console.error("[clickup-client]", err);
    return res.status(500).json({ error: "Failed to fetch project data", detail: err.message });
  }
}
