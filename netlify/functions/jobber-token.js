// netlify/functions/jobber-token.js
// Handles Jobber OAuth2 token exchange securely on the server side.
// Your CLIENT_SECRET never touches the browser.

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const CLIENT_ID     = process.env.JOBBER_CLIENT_ID;
  const CLIENT_SECRET = process.env.JOBBER_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Server not configured. Set JOBBER_CLIENT_ID and JOBBER_CLIENT_SECRET in Netlify environment variables." }),
    };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { grant_type, code, refresh_token, redirect_uri } = body;

  if (!["authorization_code", "refresh_token"].includes(grant_type)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "grant_type must be authorization_code or refresh_token" }) };
  }

  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type,
    ...(grant_type === "authorization_code" ? { code, redirect_uri } : { refresh_token }),
  });

  try {
    const res = await fetch("https://api.getjobber.com/api/oauth/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    params.toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      return { statusCode: res.status, headers, body: JSON.stringify({ error: data.error_description || data.error || "Token exchange failed" }) };
    }

    // Return access_token + refresh_token + expires_in to the browser
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
    return { statusCode: 502, headers, body: JSON.stringify({ error: "Failed to reach Jobber: " + err.message }) };
  }
};
