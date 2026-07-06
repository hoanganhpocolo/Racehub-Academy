import type { APIRoute } from 'astro';
import { JWT } from 'google-auth-library';

// Runs on-demand (serverless) on Vercel; everything else stays prerendered.
export const prerender = false;

// Read env at runtime (Vercel serverless) with a dev fallback (astro dev / Vite).
const env = (k: string): string =>
  (process.env[k] ?? (import.meta.env as Record<string, string>)[k] ?? '').trim();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

async function readBody(request: Request): Promise<Record<string, string>> {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('application/json')) return await request.json();
  const fd = await request.formData();
  return Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
}

async function appendToSheet(row: (string | number)[]) {
  const sheetId = env('SHEET_ID');
  const clientEmail = env('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = env('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n');
  if (!sheetId || !clientEmail || !privateKey) throw new Error('Missing Google Sheets env vars');

  const auth = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const { access_token } = await auth.authorize();

  // Range "A1" (no tab name) targets the first sheet → user can name the tab anything.
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}` +
    `/values/A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [row] }),
  });
  if (!res.ok) throw new Error('Sheets append failed: ' + (await res.text()));
}

async function sendEmail(fields: Record<string, string>) {
  const apiKey = env('RESEND_API_KEY');
  const from = env('MAIL_FROM');
  const to = env('NOTIFY_EMAIL');
  if (!apiKey || !from || !to) throw new Error('Missing Resend env vars');

  const text = [
    'New academy application:',
    '',
    `Driver:      ${fields.driverName || ''}`,
    `Age:         ${fields.driverAge || ''}`,
    `Experience:  ${fields.experience || ''}`,
    `Parent:      ${fields.parentName || '—'}`,
    `Phone:       ${fields.phone || ''}`,
    `Email:       ${fields.email || ''}`,
    `Program:     ${fields.program || ''}`,
    `Goals:       ${fields.goals || '—'}`,
    `Language:    ${fields.lang || ''}`,
  ].join('\n');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: fields.email || undefined,
      subject: `New Application — ${fields.driverName || 'Unknown'}`,
      text,
    }),
  });
  if (!res.ok) throw new Error('Resend send failed: ' + (await res.text()));
}

export const POST: APIRoute = async ({ request }) => {
  let fields: Record<string, string>;
  try {
    fields = await readBody(request);
  } catch {
    return json({ ok: false, error: 'Invalid request body' }, 400);
  }

  // Minimal validation (driver name, email, phone are required in the form).
  if (!fields.driverName?.trim() || !fields.email?.trim() || !fields.phone?.trim()) {
    return json({ ok: false, error: 'Missing required fields' }, 400);
  }

  const row = [
    new Date().toISOString(),
    fields.lang || '',
    fields.driverName || '',
    fields.driverAge || '',
    fields.experience || '',
    fields.parentName || '',
    fields.phone || '',
    fields.email || '',
    fields.goals || '',
    fields.program || '',
  ];

  try {
    // Record first, then notify — run in parallel; fail if either errors.
    await Promise.all([appendToSheet(row), sendEmail(fields)]);
    return json({ ok: true });
  } catch (err) {
    console.error('[apply]', err);
    return json({ ok: false, error: String((err as Error).message || err) }, 500);
  }
};
