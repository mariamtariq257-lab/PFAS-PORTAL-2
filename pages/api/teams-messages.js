// pages/api/teams-messages.js
// Fetches live Microsoft Teams channel messages for the PFAS Client Portal.
//
// ── ACTIVATION CHECKLIST ────────────────────────────────────────────────────
//  1. Wahab grants  ChannelMessage.Read.All  admin consent in Azure portal:
//       portal.azure.com → App registrations → PFAS Dashboard → API permissions
//       → Add permission → Microsoft Graph → Application → ChannelMessage.Read.All → Grant admin consent
//
//  2. Add teamsTeamId + teamsChannelId to each project in PROJECT_META (clickup-client.js):
//       "shrimps": {
//         ...existing fields...
//         teamsTeamId:    "19:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@thread.tacv2",
//         teamsChannelId: "19:yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy@thread.tacv2",
//       }
//     How to find these IDs:
//       In Teams → go to the channel → click ··· → Get link to channel
//       The URL contains the encoded team/channel IDs. Decode them or use Graph Explorer:
//       https://developer.microsoft.com/en-us/graph/graph-explorer
//       GET https://graph.microsoft.com/v1.0/me/joinedTeams  → lists all teams with IDs
//       GET https://graph.microsoft.com/v1.0/teams/{teamId}/channels → lists channels with IDs
//
//  3. These env vars must be set on Vercel (same as existing Azure setup):
//       AZURE_TENANT_ID     = 05f5bf76-f59a-482f-a9a4-ff6534ff9f56
//       AZURE_CLIENT_ID     = 00471aee-...  (full client ID)
//       AZURE_CLIENT_SECRET = (from Vercel sensitive env vars — not in .env.local)
//
//  4. Deploy. The TeamsPanel in index.js auto-detects teamsChannelId and switches
//     from the pending UI to live messages. No other changes needed.
//
// ── USAGE ───────────────────────────────────────────────────────────────────
//  GET /api/teams-messages?teamId=19:xxx&channelId=19:yyy
//  Returns: { messages: [{ from, body, createdDateTime, importance }] }
//
// ── CACHING ─────────────────────────────────────────────────────────────────
//  s-maxage=120 — messages refresh every 2 minutes on Vercel edge
// ─────────────────────────────────────────────────────────────────────────────

const TENANT_ID     = process.env.AZURE_TENANT_ID;
const CLIENT_ID     = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;

let _tokenCache = null;
let _tokenExpiry = 0;

async function getAccessToken() {
  if (_tokenCache && Date.now() < _tokenExpiry - 60000) return _tokenCache;

  const resp = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope:         "https://graph.microsoft.com/.default",
      }),
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Token error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  _tokenCache = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in * 1000);
  return _tokenCache;
}

function parseMessages(rawMessages) {
  return rawMessages
    .filter(m => m.messageType === "message" && m.body?.content)
    .map(m => ({
      from: m.from?.user?.displayName || m.from?.application?.displayName || "PFAS Team",
      body: m.body.content,           // HTML — frontend strips tags via stripHtml()
      createdDateTime: m.createdDateTime,
      importance: m.importance || "normal",
    }))
    .sort((a, b) => new Date(a.createdDateTime) - new Date(b.createdDateTime)); // oldest first
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { teamId, channelId } = req.query;
  if (!teamId || !channelId) {
    return res.status(400).json({ error: "teamId and channelId are required" });
  }

  // Validate ID format (basic guard against injection)
  const idPattern = /^19:[a-zA-Z0-9\-_@.]+$/;
  if (!idPattern.test(teamId) || !idPattern.test(channelId)) {
    return res.status(400).json({ error: "Invalid team or channel ID format" });
  }

  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    return res.status(503).json({
      error: "Azure credentials not configured",
      hint: "Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET in Vercel env vars",
    });
  }

  try {
    const token = await getAccessToken();

    // Fetch last 20 messages from the channel
    const graphUrl =
      `https://graph.microsoft.com/v1.0/teams/${encodeURIComponent(teamId)}` +
      `/channels/${encodeURIComponent(channelId)}/messages` +
      `?$top=20&$orderby=createdDateTime desc`;

    const graphResp = await fetch(graphUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (graphResp.status === 403) {
      return res.status(403).json({
        error: "Permission denied",
        hint: "ChannelMessage.Read.All admin consent has not been granted. Ask Wahab to approve in Azure portal.",
      });
    }

    if (!graphResp.ok) {
      const errBody = await graphResp.text();
      throw new Error(`Graph ${graphResp.status}: ${errBody}`);
    }

    const data = await graphResp.json();
    const messages = parseMessages(data.value || []);

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=30");
    return res.status(200).json({ messages });

  } catch (err) {
    console.error("[teams-messages]", err.message);
    return res.status(500).json({ error: "Failed to fetch Teams messages", detail: err.message });
  }
}
