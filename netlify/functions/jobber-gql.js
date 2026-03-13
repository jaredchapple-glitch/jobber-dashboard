// netlify/functions/jobber-gql.js
// Proxies GraphQL requests to Jobber so the access token
// is never stored permanently — just passed through per request.

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  const authHeader = event.headers["authorization"] || event.headers["Authorization"];
  if (!authHeader) return { statusCode: 401, headers, body: JSON.stringify({ error: "Missing Authorization header" }) };

  let body;
  try { body = event.body; JSON.parse(body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON body" }) }; }

  try {
    const res = await fetch("https://api.getjobber.com/api/graphql", {
      method:  "POST",
      headers: {
        "Content-Type":                "application/json",
        "Authorization":               authHeader,
        "X-JOBBER-GRAPHQL-VERSION":    "2024-01-01",
      },
      body,
    });

    const data = await res.text();
    return { statusCode: res.status, headers, body: data };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: "Failed to reach Jobber API: " + err.message }) };
  }
};
