# DNS migration: Uniweb → Cloudflare

Goal: Cloudflare manages DNS for `kobberogkran.no`, and the domain registration stays at
Uniweb. Email (Microsoft 365) must keep working the whole time.

## Current state (checked 2026-11-11 from public DNS)

| Item | Value |
|---|---|
| Nameservers | `ns01.no.brand.one.com`, `ns02.no.brand.one.com` (Uniweb runs on the one.com platform) |
| DNSSEC | **ON** (DS record `40032 13 2 …`) |
| Email | Microsoft 365 / Outlook |

Records found (only names I could guess are visible from outside, so compare with the
full list in the Uniweb panel):

| Type | Name | Content | Priority | Cloudflare proxy |
|---|---|---|---|---|
| MX | `@` | `kobberogkran-no.mail.protection.outlook.com` | 1 | n/a |
| TXT | `@` | `MS=ms62668515` | | n/a |
| TXT | `@` | `v=spf1 include:spf.protection.outlook.com -all` | | n/a |
| CNAME | `autodiscover` | `autodiscover.outlook.com` | | **DNS only (grey cloud)** |
| A | `@` | `104.37.39.71` (Uniweb placeholder page) | | DNS only |
| A | `www` | `104.37.39.71` (Uniweb placeholder page) | | DNS only |

There are no DKIM or DMARC records today. Adding them is a later improvement and not part of
this move.

## Steps

### 1. Turn off DNSSEC at Uniweb (do this first)
The domain has DNSSEC on, signed by Uniweb. If you switch nameservers while it's on,
the domain **stops resolving (website and email)** until it's fixed.

1. Uniweb control panel → the domain → DNS / DNSSEC → turn DNSSEC **off**.
2. Wait until the DS record is gone. This can take up to 24 hours because of Norid
   processing and caching. Check with
   `https://dns.google/resolve?name=kobberogkran.no&type=DS` (open it in a
   browser). When `"Answer"` is missing from the response, you can continue.

### 2. Add the domain in Cloudflare
1. Cloudflare dashboard → **Add a domain** → `kobberogkran.no` → choose the quick scan for
   DNS records → **Free** plan.
2. Compare the imported records with the table above **and** with the DNS list in the
   Uniweb panel. Add anything that's missing. Every record in Uniweb must exist in
   Cloudflare.
3. Set **every record to "DNS only" (grey cloud)** for now. Email records (MX,
   autodiscover) must always stay grey.
4. Cloudflare shows two nameservers, like `xxx.ns.cloudflare.com` and
   `yyy.ns.cloudflare.com`. Write them down.

### 3. Switch nameservers at Uniweb
1. Uniweb control panel → the domain → nameservers ("Navnetjenere") → custom nameservers.
2. Replace the two `brand.one.com` servers with the two Cloudflare nameservers.
3. Save. Cloudflare emails you when the domain is active, usually within a few hours
   and at most about 24 hours.

### 4. Verify
- Send an email to and from an `@kobberogkran.no` address.
- In Outlook, check that the account still connects (this uses autodiscover).
- Check that `nslookup -type=NS kobberogkran.no 1.1.1.1` shows the Cloudflare
  nameservers.

### 5. Turn DNSSEC back on (with Cloudflare this time)
1. Cloudflare → the domain → DNS → Settings → **Enable DNSSEC**. Cloudflare shows a DS
   record.
2. Uniweb control panel → DNSSEC → add the DS values Cloudflare shows. If Uniweb has no field
   for this, ask Uniweb support to register the DS record with Norid.

The website records (`@`, `www`) are replaced later, when the site is connected to
Cloudflare Workers. That happens in a separate step in `cloudflare-setup.md`.
