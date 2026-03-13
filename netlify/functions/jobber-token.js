// netlify/functions/jobber-token.js
exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  const CLIENT_ID     = process.env.JOBBER_CLIENT_ID;
  const CLIENT_SECRET = process.env.JOBBER_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Server not configured. JOBBER_CLIENT_ID and JOBBER_CLIENT_SECRET must be set in Netlify environment variables." }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { grant_type, code, refresh_token, redirect_uri } = body;

  const params = new URLSearchParams();
  params.append("client_id", CLIENT_ID.trim());
  params.append("client_secret", CLIENT_SECRET.trim());
  params.append("grant_type", grant_type);

  if (grant_type === "authorization_code") {
    params.append("code", code);
    params.append("redirect_uri", redirect_uri);
  } else if (grant_type === "refresh_token") {
    params.append("refresh_token", refresh_token);
  } else {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid grant_type" }) };
  }

  try {
    const res = await fetch("https://api.getjobber.com/api/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: params.toString(),
    });

    const rawText = await res.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: "Jobber returned: " + rawText.slice(0, 300) }),
      };
    }

    if (!res.ok) {
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({ error: data.error_description || data.error || "Token exchange failed", details: data }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
        expires_in:    data.expires_in,
      }),
    };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: "Network error reaching Jobber: " + err.message }) };
  }
};
