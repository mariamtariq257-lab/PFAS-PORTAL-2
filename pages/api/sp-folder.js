// pages/api/sp-folder.js
// Dynamic SharePoint folder resolver for Quick Actions.
// Resolves the real folder by NAME at click time via Graph API —
// immune to numbering differences ("2. Received from Client" vs
// "Received from Client" vs "2.Received from client" all match).
// Always falls back to the project root — never a dead link.
//
// Usage: /api/sp-folder?slug=punjab-onebill&action=upload
//   action = docs | upload | minutes | invoices

const SITE_HOST = "pfaspk.sharepoint.com";
const SITE_PATH = "/sites/PFAS-PMO";
const BASE_WEB = `https://${SITE_HOST}${SITE_PATH}/Shared Documents/PFAS Operations/All Clients`;
const DRIVE_ROOT_PATH = "PFAS Operations/All Clients"; // within default doc library

// slug -> [department folder, project folder]
const PROJECT_PATHS = {
  "wildlife-bansra": ["Wildlife", "Bansara Gali"],
  "wildlife-changa": ["Wildlife", "Changa Manga"],
  "punjab-onebill":  ["Finance Department", "Punjab One Bill Study"],
  "twilight":        ["Finance Department", "Project Twilight"],
  "bot1":            ["C&W", "BOT-1 Depalpur-Pakpattan-Vehari"],
  "bot2":            ["C&W", "BOT-2 Chiragabad-Jhang-Shorkot"],
  "bot3":            ["C&W", "BOT-3 Muzaffargarh-Alipur-TM"],
  "bot4":            ["C&W", "BOT-4 Sahiwal Samundari"],
  "bot5":            ["C&W", "BOT 5 Bahawalpur-Jhangra sharqi Road"],
  "om-roads":        ["C&W", "18 O&M Roads-PPP"],
  "pcmmdc":          ["PCMMDC", "HR Manual"],
  "p4a":             ["P4A", "PPP Structure Optimisation and Economic & Financial Feasibility Advisory -  Tertiary Care General Hospital"],
  "fiedmc-m3ic":     ["FIEDMC", "Optimal Fund Utilisation of M3IC Commercial Plot Sale Proceeds"],
  "fiedmc-sbp":      ["FIEDMC", "Strategic Business Plan"],
  "tam":             ["TAM", "Time Travel Park"],
  "pha":             ["PHA", "PHA"],
  "pbf":             ["Punjab Benevolent Fund", "Punjab Govt Employees welfare fund"],
  "energy":          ["Energy Department", "Strategic Assessment & Design of a Project Management Wing"],
  "hed":             ["Higher Education Department", "Higher Education Department"],
  "lda":             ["LDA", "Economic & Financial Feasibility Advisory -  4 Hospitals"],
  "shrimps":         ["Fisheries", "Shrimps Estate Project"],
};

// PHIMC lives in a separate Teams site — direct link, no resolution needed.
const SPECIAL_DIRECT = {
  "phimc": "https://pfaspk.sharepoint.com/sites/msteams_517524/Shared Documents/PHIMC 6 Hospitals Feasibility",
};

// What each action looks for, in priority order (case-insensitive substring
// match on the normalized folder name).
const ACTION_KEYWORDS = {
  docs:     ["data for client access"],
  upload:   ["received from client", "received from", "from client"],
  minutes:  ["meeting minutes", "minutes and notes", "meeting min"],
  invoices: ["invoices and payments", "invoices", "invoice", "payments"],
};

// normalize: lowercase, strip leading numbering like "2. ", "3-", "4)" etc.
function norm(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/^\s*\d+\s*[\.\-\)_]?\s*/, "")
    .trim();
}

function findMatch(children, keywords) {
  const folders = children.filter(c => c.folder);
  for (const kw of keywords) {
    const hit = folders.find(f => norm(f.name).includes(kw));
    if (hit) return hit;
  }
  return null;
}

async function getToken() {
  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AZURE_CLIENT_ID,
        client_secret: process.env.AZURE_CLIENT_SECRET,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error("TOKEN_FAILED");
  return data.access_token;
}

async function listChildren(token, pathSegments) {
  // pathSegments: array of folder names from drive root
  const encoded = pathSegments.map(encodeURIComponent).join("/");
  const url = `https://graph.microsoft.com/v1.0/sites/${process.env.SHAREPOINT_SITE_ID}/drive/root:/${encoded}:/children?$select=name,webUrl,folder&$top=200`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.value || [];
}

export default async function handler(req, res) {
  const { slug, action } = req.query;

  // Special-site projects: direct redirect, all actions.
  if (SPECIAL_DIRECT[slug]) return res.redirect(302, SPECIAL_DIRECT[slug]);

  const p = PROJECT_PATHS[slug];
  if (!p) return res.status(404).json({ error: "UNKNOWN_PROJECT" });

  const [dept, project] = p;
  const rootWeb = `${BASE_WEB}/${dept}/${project}`;
  const keywords = ACTION_KEYWORDS[action];

  // Unknown action or plain docs-root request context: try to resolve,
  // fall back to project root on any failure.
  try {
    if (!keywords) return res.redirect(302, rootWeb);

    const token = await getToken();
    const base = [...DRIVE_ROOT_PATH.split("/"), dept, project];
    const rootChildren = await listChildren(token, base);
    if (!rootChildren) return res.redirect(302, rootWeb);

    // Locate "Data for client access" (any numbering/casing)
    const dfca = findMatch(rootChildren, ACTION_KEYWORDS.docs);

    if (action === "docs") {
      return res.redirect(302, dfca ? dfca.webUrl : rootWeb);
    }

    if (action === "invoices") {
      // invoices usually sit at project root; check there first, then inside DFCA
      const atRoot = findMatch(rootChildren, keywords);
      if (atRoot) return res.redirect(302, atRoot.webUrl);
      if (dfca) {
        const dfcaChildren = await listChildren(token, [...base, dfca.name]);
        const inside = dfcaChildren && findMatch(dfcaChildren, keywords);
        if (inside) return res.redirect(302, inside.webUrl);
        return res.redirect(302, dfca.webUrl);
      }
      return res.redirect(302, rootWeb);
    }

    // upload / minutes: look inside DFCA first, then project root
    if (dfca) {
      const dfcaChildren = await listChildren(token, [...base, dfca.name]);
      const inside = dfcaChildren && findMatch(dfcaChildren, keywords);
      if (inside) return res.redirect(302, inside.webUrl);
      return res.redirect(302, dfca.webUrl); // DFCA exists but subfolder doesn't yet
    }
    const atRoot = findMatch(rootChildren, keywords);
    if (atRoot) return res.redirect(302, atRoot.webUrl);

    return res.redirect(302, rootWeb);
  } catch (e) {
    return res.redirect(302, rootWeb);
  }
}
