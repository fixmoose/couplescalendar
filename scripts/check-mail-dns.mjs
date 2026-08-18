#!/usr/bin/env node
/**
 * Checks whether a domain is ready to send invitation email through UniOne.
 *
 *   node scripts/check-mail-dns.mjs docmaker.studio
 *
 * Uses DNS-over-HTTPS so it reports what the public internet sees, not what a
 * local resolver has cached.
 */

const domain = process.argv[2];
if (!domain) {
  console.error("usage: node scripts/check-mail-dns.mjs <sending-domain>");
  process.exit(1);
}

const query = async (name, type) => {
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    { headers: { accept: "application/dns-json" } },
  );
  const data = await res.json();
  return {
    status: data.Status,
    answers: (data.Answer ?? []).map((a) => ({ type: a.type, data: a.data })),
  };
};

const strip = (value) => value.replace(/^"|"$/g, "").replace(/""/g, "");
const pass = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const warn = (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`);

console.log(`\nSending domain: ${domain}\n`);
let problems = 0;

// A CNAME at the sending name makes every other record impossible.
const cname = await query(domain, "CNAME");
if (cname.answers.some((a) => a.type === 5)) {
  fail(
    `${domain} is a CNAME (${strip(cname.answers[0].data)}).\n` +
      `    A name holding a CNAME can hold no other records, so SPF, DKIM and\n` +
      `    verification TXT records cannot exist here. Send from a different\n` +
      `    hostname — the app's domain and the mail domain must not be the same.`,
  );
  problems += 1;
}

const txt = await query(domain, "TXT");
const records = txt.answers.map((a) => strip(a.data));

const spf = records.filter((r) => r.startsWith("v=spf1"));
if (spf.length === 0) {
  fail("No SPF record. Add TXT: v=spf1 include:spf.unione.io ~all");
  problems += 1;
} else if (spf.length > 1) {
  fail(`${spf.length} SPF records — only one is allowed. Merge the includes.`);
  problems += 1;
} else if (!spf[0].includes("spf.unione.io")) {
  fail(`SPF exists but does not include UniOne: ${spf[0]}`);
  problems += 1;
} else {
  pass(`SPF: ${spf[0]}`);
}

const verification = records.find((r) => r.startsWith("unione-validate-hash="));
if (verification) pass(`UniOne ownership record present`);
else {
  warn("No unione-validate-hash TXT — add the one UniOne shows for this domain.");
  problems += 1;
}

// DKIM: UniOne publishes under a selector we have to guess unless told.
const selectors = ["unione", "um1", "mail", "default", "s1", "key1"];
const dkim = [];
for (const selector of selectors) {
  const found = await query(`${selector}._domainkey.${domain}`, "TXT");
  if (found.answers.length) dkim.push(selector);
}
if (dkim.length) pass(`DKIM found at selector: ${dkim.join(", ")}`);
else {
  fail(
    "No DKIM record found. Copy the TXT record UniOne shows under\n" +
      `    <selector>._domainkey.${domain} — without it mail is unsigned and rejected.`,
  );
  problems += 1;
}

const dmarc = await query(`_dmarc.${domain}`, "TXT");
const dmarcTxt = dmarc.answers.map((a) => strip(a.data));
const policy = dmarcTxt.find((r) => r.startsWith("v=DMARC1"));
if (policy) {
  pass(`DMARC: ${policy}`);
} else if (dmarcTxt.length) {
  fail(
    `_dmarc holds "${dmarcTxt[0]}", which is not a DMARC policy.\n` +
      `    A hostname value belongs in a CNAME record, or replace it with a TXT:\n` +
      `    v=DMARC1; p=none; rua=mailto:dmarc@reporting.unione.io`,
  );
  problems += 1;
} else if (dmarc.answers.length) {
  pass("DMARC delegated by CNAME");
} else {
  warn("No DMARC record. Optional, but improves deliverability.");
}

console.log(
  problems === 0
    ? "\n\x1b[32mReady to send.\x1b[0m\n"
    : `\n\x1b[31m${problems} problem(s) to fix.\x1b[0m DNS changes take up to an hour at GoDaddy.\n`,
);
