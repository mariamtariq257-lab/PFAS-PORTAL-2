// pages/api/sharepoint-recent.js
// Returns the 3 most recently modified files in a project's
// "Data for client access" SharePoint folder.

const PROJECT_FOLDER_PATHS = {
  "wildlife-bansra": "Wildlife/Bansara Gali/Data for client access",
  "wildlife-changa": "Wildlife/Changa Manga/Data for client access",
  "punjab-onebill":  "Finance Department/Punjab One Bill Study/Data for client access",
  "bot1":            "C&W/BOT-1 Depalpur-Pakpattan-Vehari/Data for client access",
  "bot2":            "C&W/BOT-2 Chiragabad-Jhang-Shorkot/Data for client access",
  "bot3":            "C&W/BOT-3 Muzaffargarh-Alipur-TM/Data for client access",
  "bot4":            "C&W/BOT-4 Sahiwal Samundari/Data for client access",
  "bot5":            "C&W/BOT 5 Bahawalpur-Jhangra sharqi Road/Data for client access",
  "om-roads":        "C&W/18 O&M Roads-PPP/Data for client access",
  "pcmmdc":          "PCMMDC/HR Manual/Data for client access",
  "p4a":             "P4A/PPP Structure Optimisation and Economic & Financial Feasibility Advisory -  Tertiary Care General Hospital/Data for client access",
  "fiedmc-m3ic":     "FIEDMC/Optimal Fund Utilisation of M3IC Commercial Plot Sale Proceeds/Data for client access",
  "fiedmc-sbp":      "FIEDMC/Strategic Business Plan/Data for client access",
  "tam":             "TAM/Time Travel Park/Data for client access",
  "pha":             "PHA/PHA/Data for client access",
  "pbf":             "Punjab Benevolent Fund/Punjab Govt Employees welfare fund/Data for client access",
  "vss":             "Finance Department/VSS Engagement/Data for client access",
  "energy":          "Energy Department/Strategic Assessment & Design of a Project Management Wing/Data for client access",
  "hed":             "Higher Education Department/Higher Education Department/Data for client access",
  "phimc":           "PHIMC/6 Hospitals Feasibility/Data for client access",
  "lda":             "LDA/Economic & Financial Feasibility Advisory -  4 Hospitals/Data for client access",
  "shrimps":         "Fisheries/Shrimps Estate Project/Data for client access",
};

// Root path inside the SharePoint Shared Documents library
const LIBRARY_ROOT = "PFAS Operations/All Clients";

let _token = null;
let _tokenExpiry = 0;

async function getToken() {
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;
  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
    throw new Error("NOT_CONFIGURED");
  }
  if (_token && Date.now() < _tokenExpiry - 60000) return _token;

  const r = await fetch(
    `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: AZURE_CLIENT_ID,
        client_secret: AZURE_CLIENT_SECRET,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`TOKEN_FAILED:${r.status}:${t}`);
  }
  const d = await r.json();
  _token = d.access_token;
  _tokenExpiry = Date.now() + d.expires_in * 1000;
  return _token;
}

// Use SharePoint search API to find recently modified files under a specific
// folder path — avoids needing the drive ID, works with application permissions.
async function getRecentFiles(token, siteId, folderPath) {
  // Use Graph search with a path filter — most reliable with Files.Read.All
  const fullPath = `/sites/PFAS-PMO/Shared Documents/${LIBRARY_ROOT}/${folderPath}`;

  // Try Graph drive approach using site drives endpoint
  // First get the drive ID for this site
  const drivesUrl = `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteId)}/drives`;
  const drivesRes = await fetch(drivesUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!drivesRes.ok) {
    const err = await drivesRes.text();
    throw new Error(`DRIVES_FAILED:${drivesRes.status}:${err}`);
  }

  const drivesData = await drivesRes.json();
  // Find the "Documents" or "Shared Documents" drive
  const drive = drivesData.value?.find(
    d => d.name === "Documents" || d.name === "Shared Documents"
  ) || drivesData.value?.[0];

  if (!drive) throw new Error("NO_DRIVE_FOUND");

  const driveId = drive.id;
  const encodedFolderPath = `${LIBRARY_ROOT}/${folderPath}`;

  // Use /drive/root:/path:/children to list folder contents
  const folderUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodedFolderPath}:/children?$orderby=lastModifiedDateTime desc&$top=20`;

  const folderRes = await fetch(folderUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!folderRes.ok) {
    const err = await folderRes.text();
    throw new Error(`FOLDER_FAILED:${folderRes.status}:${err}`);
  }

  const folderData = await folderRes.json();
  const items = folderData.value || [];

  // Collect files from top level + recurse one level into sub-folders
  const files = [];
  for (const item of items) {
    if (item.file) {
      files.push({
        name: item.name,
        webUrl: item.webUrl,
        lastModifiedDateTime: item.lastModifiedDateTime,
        type: (item.name.split(".").pop() || "").toLowerCase(),
      });
    } else if (item.folder) {
      // Go one level deeper into each sub-folder
      const subUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${item.id}/children?$orderby=lastModifiedDateTime desc&$top=10`;
      const subRes = await fetch(subUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (subRes.ok) {
        const subData = await subRes.json();
        for (const sub of subData.value || []) {
          if (sub.file) {
            files.push({
              name: sub.name,
              webUrl: sub.webUrl,
              lastModifiedDateTime: sub.lastModifiedDateTime,
              type: (sub.name.split(".").pop() || "").toLowerCase(),
            });
          }
        }
      }
    }
  }

  // Sort by most recently modified and return top 3
  files.sort((a, b) => new Date(b.lastModifiedDateTime) - new Date(a.lastModifiedDateTime));
  return files.slice(0, 3);
}

export default async function handler(req, res) {
  const { project } = req.query;

  if (!project || !PROJECT_FOLDER_PATHS[project]) {
    return res.status(400).json({ files: [], error: "Unknown project slug." });
  }

  const siteId = process.env.SHAREPOINT_SITE_ID;
  if (!siteId) {
    return res.status(200).json({ files: [], error: "NOT_CONFIGURED" });
  }

  try {
    const token = await getToken();
    const files = await getRecentFiles(token, siteId, PROJECT_FOLDER_PATHS[project]);
    return res.status(200).json({ files });
  } catch (err) {
    if (err.message === "NOT_CONFIGURED") {
      return res.status(200).json({ files: [], error: "NOT_CONFIGURED" });
    }
    // Return the actual error message so we can debug from the portal
    return res.status(200).json({ files: [], error: "FETCH_FAILED", detail: err.message });
  }
}
