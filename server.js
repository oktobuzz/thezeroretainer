require('dotenv').config();
const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();

// ─── Resend client ────────────────────────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Logo public URL ─────────────────────────────────────────────────────────
const LOGO_URL = 'https://oktobuzz.com/tzr-logo-cropped.png';

// ─── MySQL connection pool ────────────────────────────────────────────────────
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  ssl: { rejectUnauthorized: false },
});

// Create table on startup if it doesn't exist
async function initDB() {
  try {
    const conn = await pool.getConnection();
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS applications (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        submitted_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        name         VARCHAR(255),
        email        VARCHAR(255),
        brand        VARCHAR(255),
        score        DECIMAL(4,2),
        score_label  VARCHAR(50),
        full_data    JSON
      )
    `);
    conn.release();
    console.log('DB ready — applications table exists.');
  } catch (err) {
    console.error('DB init error (submissions will still work via email):', err.message);
  }
}
initDB();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ─── Thank-you email template ─────────────────────────────────────────────────
function buildThankYouEmail(name) {
  const logoSrc = LOGO_URL;

  return {
    subject: `Application Received — The Zero Retainer`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Application Received</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1A1A1A;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F0;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

          <!-- Logo header -->
          <tr>
            <td style="background:#ffffff;border-radius:12px 12px 0 0;padding:28px 36px;border-bottom:1px solid #E8E8E0;">
              <img src="${logoSrc}" alt="The Zero Retainer" style="height:44px;width:auto;display:block;" />
            </td>
          </tr>

          <!-- Red banner -->
          <tr>
            <td style="background:#CC1F26;padding:20px 36px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">Your application has been received!<br>Thank you.</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px 36px 28px;border:1px solid #E8E8E0;border-top:none;">

              <p style="font-size:15px;line-height:1.7;margin:0 0 16px;color:#1A1A1A;">Hi ${name},</p>

              <p style="font-size:15px;line-height:1.7;margin:0 0 16px;color:#3D3D3D;">
                We read every single one of these ourselves. If you're a strong fit, you'll hear back within <strong style="color:#1A1A1A;">5 days</strong> with a calendar link for a 60-minute call.
              </p>

              <p style="font-size:15px;line-height:1.7;margin:0 0 28px;color:#3D3D3D;">
                If this engagement isn't right for your brand at this stage, we'll still write back, and we'll tell you honestly what we'd recommend instead. That part isn't a courtesy line. It's just how we work.
              </p>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #E8E8E0;margin:0 0 28px;" />

              <!-- What happens next -->
              <p style="margin:0 0 20px;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#888880;">What happens if you're selected</p>

              <!-- Step 1 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td width="36" valign="top">
                    <div style="width:28px;height:28px;border-radius:50%;background:#F5F5F0;border:1px solid #DDDDD8;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#1A1A1A;">1</div>
                  </td>
                  <td valign="top" style="padding-left:8px;">
                    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1A1A1A;">We review your application <span style="display:inline-block;background:#F0F0EA;border-radius:4px;font-size:11px;font-weight:600;color:#555550;padding:2px 8px;letter-spacing:0.04em;">5 DAYS</span></p>
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#555550;">We read every one personally. Strong fits get a calendar link. Everyone else gets an honest reply.</p>
                  </td>
                </tr>
              </table>

              <!-- Step 2 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td width="36" valign="top">
                    <div style="width:28px;height:28px;border-radius:50%;background:#F5F5F0;border:1px solid #DDDDD8;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#1A1A1A;">2</div>
                  </td>
                  <td valign="top" style="padding-left:8px;">
                    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1A1A1A;">Discovery call <span style="display:inline-block;background:#F0F0EA;border-radius:4px;font-size:11px;font-weight:600;color:#555550;padding:2px 8px;letter-spacing:0.04em;">60 MINUTES</span></p>
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#555550;">We dig into your numbers, look at your listings together, validate the fit, and walk you through exactly how the model works.</p>
                  </td>
                </tr>
              </table>

              <!-- Step 3 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td width="36" valign="top">
                    <div style="width:28px;height:28px;border-radius:50%;background:#F5F5F0;border:1px solid #DDDDD8;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#1A1A1A;">3</div>
                  </td>
                  <td valign="top" style="padding-left:8px;">
                    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1A1A1A;">Contract</p>
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#555550;">We lock the baseline, the bands, and the 6-month engagement in writing. Clean terms, full transparency.</p>
                  </td>
                </tr>
              </table>

              <!-- Step 4 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td width="36" valign="top">
                    <div style="width:28px;height:28px;border-radius:50%;background:#F5F5F0;border:1px solid #DDDDD8;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#1A1A1A;">4</div>
                  </td>
                  <td valign="top" style="padding-left:8px;">
                    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1A1A1A;">Onboarding</p>
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#555550;">Read-only dashboard access, baseline locked from your last 3 months, account audit, and a kickoff session with the team.</p>
                  </td>
                </tr>
              </table>

              <!-- Step 5 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
                <tr>
                  <td width="36" valign="top">
                    <div style="width:28px;height:28px;border-radius:50%;background:#CC1F26;border:1px solid #CC1F26;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#ffffff;">5</div>
                  </td>
                  <td valign="top" style="padding-left:8px;">
                    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1A1A1A;">We start working</p>
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#555550;">Campaigns go live. Weekly working calls begin. From here, we only win when you do.</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#ffffff;border-radius:0 0 12px 12px;padding:20px 36px;border:1px solid #E8E8E0;border-top:none;">
              <p style="margin:0;font-size:13px;color:#888880;">
                OktoBuzz &nbsp;·&nbsp;
                <a href="mailto:growth@oktobuzz.com" style="color:#CC1F26;text-decoration:none;">growth@oktobuzz.com</a>
              </p>
            </td>
          </tr>

          <!-- Spacer -->
          <tr>
            <td style="padding:24px 0;">
              <p style="margin:0;font-size:11px;color:#AAAAAA;text-align:center;letter-spacing:0.06em;">oktobuzz.com</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}

// ─── GET /ping — quick health check ──────────────────────────────────────────
app.get('/ping', (req, res) => res.json({ ok: true, message: 'Server is running' }));

// ─── POST /submit ─────────────────────────────────────────────────────────────
app.post('/submit', async (req, res) => {
  const data = req.body;
  const applicantEmail = data.email;
  const applicantName  = (data.name || 'there').split(' ')[0];

  if (!applicantEmail) {
    return res.status(400).json({ ok: false, error: 'No email address provided.' });
  }

  const { subject, html } = buildThankYouEmail(applicantName);

  // Build admin email HTML
  function buildAdminEmail() {
    const score      = data._score      || '—';
    const scoreLabel = data._scoreLabel || '—';
    const breakdown  = (data._scoreBreakdown || '').split('\n').filter(Boolean);
    const pct  = parseFloat(score) * 10;
    const scol = pct < 40 ? '#E53935' : pct < 70 ? '#F59E0B' : '#22C55E';
    const scoreHtml = `
      <tr><td colspan="2" style="padding:16px 12px 6px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#888;border-bottom:2px solid #eee">Score</td></tr>
      <tr>
        <td style="padding:10px 12px;font-weight:600;color:#555;border-bottom:1px solid #eee;white-space:nowrap">Overall Score</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:20px;font-weight:800;color:${scol}">${score} / 10 &nbsp;<span style="font-size:13px;font-weight:700;background:${scol}20;color:${scol};padding:2px 8px;border-radius:4px;border:1px solid ${scol}50">${scoreLabel}</span></td>
      </tr>
      ${breakdown.map(line => `<tr><td style="padding:5px 12px 5px 24px;font-size:12px;color:#777;border-bottom:1px solid #f5f5f5" colspan="2">${line}</td></tr>`).join('')}
      <tr><td colspan="2" style="padding:16px 12px 6px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#888;border-bottom:2px solid #eee">Form Answers</td></tr>
    `;
    const skipKeys = new Set(['_score','_scoreLabel','_scoreBreakdown']);
    const rows = Object.entries(data)
      .filter(([k]) => !skipKeys.has(k))
      .map(([k, v]) => `<tr><td style="padding:6px 12px;font-weight:600;color:#555;border-bottom:1px solid #eee;white-space:nowrap">${k}</td><td style="padding:6px 12px;border-bottom:1px solid #eee">${Array.isArray(v) ? v.join(', ') : v}</td></tr>`)
      .join('');
    return {
      subject: `New application: ${data.name || 'Unknown'} — Score: ${score}/10 (${scoreLabel})`,
      html: `<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%;max-width:640px">${scoreHtml}${rows}</table>`,
    };
  }

  try {
    const sends = [
      resend.emails.send({
        from: 'The Zero Retainer <growth@oktobuzz.com>',
        to: [applicantEmail],
        subject,
        html,
      })
    ];

    if (process.env.NOTIFY_EMAIL) {
      const admin = buildAdminEmail();
      sends.push(
        resend.emails.send({
          from: 'Zero Retainer Form <growth@oktobuzz.com>',
          to: [process.env.NOTIFY_EMAIL],
          cc: ['leonard@oktobuzz.com', 'hemal@oktobuzz.com', 'aditya@oktobuzz.com', 'deuben@oktobuzz.com'],
          subject: admin.subject,
          html: admin.html,
        })
      );
    }

    await Promise.all(sends);
    res.json({ ok: true });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ ok: false, error: 'Failed to send email. Check server logs.' });
  }
});

// ─── POST /save-to-db — called by the frontend after scoring ─────────────────
app.post('/save-to-db', async (req, res) => {
  const { formData = {}, score, scoreLabel } = req.body || {};
  try {
    await pool.execute(
      `INSERT INTO applications (name, email, brand, score, score_label, full_data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        formData.name  || null,
        formData.email || null,
        formData.brand || null,
        score          != null ? parseFloat(score) : null,
        scoreLabel     || null,
        JSON.stringify({ formData, score, scoreLabel }),
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('DB save error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Zero Retainer server running on http://localhost:${PORT}`);
});
