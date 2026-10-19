// Plan2Code Web Console - the page talking to its own server.
//
// Only defines.

// POST a JSON body; the status and parsed answer, or status 0 when the
// server could not be reached.
export async function postJson(url, body) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    let answer = {};
    try {
      answer = await res.json();
    } catch {}
    return { status: res.status, body: answer };
  } catch {
    return { status: 0, body: {} };
  }
}
