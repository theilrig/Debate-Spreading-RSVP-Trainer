exports.handler = async function () {
  const token = process.env.GITHUB_TOKEN;
  const owner = 'theilrig';
  const repo  = 'Debate-Spreading-RSVP-Trainer';
  const path  = 'analytics.csv';
  const api   = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'debate-trainer-analytics',
  };

  let currentContent = 'visits,date\n';
  let sha = null;
  let visitCount = 0;

  try {
    const getRes = await fetch(api, { headers });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
      currentContent = Buffer.from(data.content, 'base64').toString('utf8');
      const dataLines = currentContent.trim().split('\n').slice(1).filter(Boolean);
      if (dataLines.length > 0) {
        visitCount = parseInt(dataLines[dataLines.length - 1].split(',')[0]) || 0;
      }
    }
  } catch (_) { /* file may not exist yet */ }

  visitCount++;
  const date = new Date().toISOString().split('T')[0];
  const newContent = currentContent.trimEnd() + '\n' + `${visitCount},${date}\n`;

  try {
    await fetch(api, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `visit ${visitCount}`,
        content: Buffer.from(newContent).toString('base64'),
        ...(sha && { sha }),
      }),
    });
  } catch (_) { /* best-effort */ }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visits: visitCount }),
  };
};
