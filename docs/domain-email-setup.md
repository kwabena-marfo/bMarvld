# Domain email without an inbox

How to give a website a professional address like `info@yourdomain.com`
**without paying for a mailbox** (no Google Workspace, no Zoho, no cPanel mail):

| What | Service | Cost |
| --- | --- | --- |
| The website sends email (confirmations, login codes, notifications) from `@yourdomain.com` | **Resend** | Free tier |
| Mail sent **to** `info@yourdomain.com` arrives in an ordinary Gmail inbox | **ImprovMX** (forwarding) | Free tier |
| Replies from that Gmail go out **as** `info@yourdomain.com` | Gmail "Send mail as" through Resend's SMTP | Free |

First used for `info@sophiaappiah.com`. Replace `yourdomain.com`, `info@` and the
names below with the project's own.

```
someone ──► info@yourdomain.com ──(ImprovMX MX records)──► your Gmail inbox
your Gmail ──(Send mail as, smtp.resend.com)──► someone, From: info@yourdomain.com
website ──(Resend API key)──► customer, From: info@ / noreply@yourdomain.com
```

**Who does what.** Parts 1–3 are done once per domain, by whoever manages the DNS
(geared.io). Parts 4–8 are done by **each person** who answers client email, in their
own Gmail. Part 9 is a one-time website change.

---

## Part 1 · Let Resend send from the domain (once per domain)

Skip this part if the website already sends mail through Resend from this domain.

1. Log in at [resend.com](https://resend.com) → **Domains** → **Add Domain** → enter
   `yourdomain.com`.
2. Resend lists DNS records to add: a DKIM `TXT` record (`resend._domainkey`), plus
   an `MX` and an SPF `TXT` record on the `send` subdomain. Add **every** record exactly as
   Resend shows it, wherever the domain's DNS is managed. For domains on Vercel, go to
   **Vercel → Domains → yourdomain.com → DNS Records**.
3. Back in Resend, click **Verify DNS Records** and wait until the domain shows
   **Verified** (usually minutes; up to a few hours).

Resend's records live on the `send.` and `resend._domainkey.` names. They don't clash
with the forwarding records in Part 2, which sit on the bare domain.

## Part 2 · Forward incoming mail to Gmail (once per domain)

1. Sign up at [improvmx.com](https://improvmx.com) with the Gmail address that should
   receive the mail, and add `yourdomain.com`.
2. Add the DNS records ImprovMX asks for, on the bare domain (Name `@`):

   | Type | Name | Value | Priority |
   | --- | --- | --- | --- |
   | MX | @ | `mx1.improvmx.com` | 10 |
   | MX | @ | `mx2.improvmx.com` | 20 |
   | TXT | @ | `v=spf1 include:spf.improvmx.com ~all` | — |

   If the domain already has an SPF record (`v=spf1 …`) on `@`, **merge** the two into
   one record, because a domain may only have one SPF record. Remove any old MX records on `@`
   from a previous mail provider.
3. In ImprovMX, create the alias: `info` → your Gmail address. (Add more if needed, e.g.
   `bookings@` → another person. A `*` catch-all forwards every address.)
4. Wait until ImprovMX shows the domain as set up correctly. Then send a test to
   `info@yourdomain.com` from another account and check it lands in Gmail. Look in
   Spam the first time.

## Part 3 · Add the DMARC record (once per domain)

1. In the DNS records (e.g. **Vercel → Domains → yourdomain.com → DNS Records**), add:

   | Name | Type | Value | TTL |
   | --- | --- | --- | --- |
   | `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:info@yourdomain.com` | default |

   This tells Gmail and other providers how to treat mail from the domain, so the
   website's emails and replies from `info@` are delivered instead of filtered. `p=none`
   only monitors; it never blocks mail.
2. Wait about **10–15 minutes** before continuing.

## Part 4 · Create a sending key in Resend (each person)

1. In [resend.com](https://resend.com) open **API Keys** → **Create API Key**:

   | Field | Value |
   | --- | --- |
   | Name | `Gmail – [your name]` (e.g. `Gmail – Sophia`) |
   | Permission | **Sending access** |
   | Domain | `yourdomain.com` |

2. Click **Add** and copy the key (it starts with `re_`). Resend shows it **only once**,
   so keep it somewhere safe until Part 5 is done.

Use a **separate key for each person**, and never reuse the website's own key. Then a
key can be revoked without breaking the site or anyone else's Gmail.

## Part 5 · Add info@ to Gmail (each person)

1. Open Gmail **on a computer** → ⚙ gear (top right) → **See all settings** →
   **Accounts and Import** tab.
2. Next to **Send mail as**, click **Add another email address**.
3. Fill in, then **Next Step**:

   | Field | Value |
   | --- | --- |
   | Name | the name clients should see, e.g. `Sophia Appiah` |
   | Email address | `info@yourdomain.com` |
   | Treat as an alias | **Untick** |

4. On the server screen enter exactly:

   | Field | Value |
   | --- | --- |
   | SMTP Server | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | the `re_…` key from Part 4 |
   | Connection | **Secured connection using SSL** |

   Click **Add Account**.

## Part 6 · Confirm the address (each person)

1. Gmail sends a confirmation to `info@yourdomain.com`, and ImprovMX forwards it to
   your inbox. Subject: *"Gmail Confirmation – Send Mail as info@yourdomain.com"*.
2. Paste the code into the Gmail window and click **Verify**, or click the link in
   the email.

## Part 7 · Reply as info@ automatically (each person)

1. **Settings → Accounts and Import → Send mail as** → under *When replying to a
   message*, choose **Reply from the same address the message was sent to**.
2. Optional: click **make default** next to `info@yourdomain.com` so new emails also
   come from it.

**Picking info@ for a single email.** On a computer, click Reply, then the small ▾
next to the recipient (or the "To" line). A **From** line appears; choose
`Name <info@yourdomain.com>`. New emails show the From line at the top. In the Gmail
phone app, tap the **From** line and choose `info@yourdomain.com`. If it isn't
listed yet, close and reopen the app; it can take a few minutes after setup.

## Part 8 · Test it (each person)

1. From a different account (a phone, another Gmail), email `info@yourdomain.com`.
2. When it arrives, click **Reply**. The From line should show
   `Name <info@yourdomain.com>`. Send it, and check the other account received it
   **from info@**.

## Part 9 · Point the website at info@ (one-time, geared.io)

So replies to the website's own emails (confirmations, guides, follow-ups) land at
`info@` too:

1. Send the site's emails **from** an address on the verified domain, e.g.
   `"Brand <info@yourdomain.com>"` or `noreply@yourdomain.com`. With a `noreply@`
   sender, set **reply-to** to `info@yourdomain.com`.
2. Set the project's env vars in **Vercel → Project → Settings → Environment
   Variables** (names vary by project, e.g. `adminEmail`, `RESEND_TRANSACTIONAL_FROM_EMAIL`,
   `RESEND_API_KEY`). Then **Deployments → latest → ⋯ → Redeploy**.

---

## Troubleshooting

| Problem | Likely cause |
| --- | --- |
| Mail to info@ never arrives | ImprovMX MX records missing or still propagating, an old provider's MX records still on `@`, or the alias points at the wrong Gmail. Check ImprovMX's dashboard and Gmail **Spam**. |
| Gmail says "couldn't reach server" / auth failed | Wrong key, a key without **Sending access**, or a key limited to a different domain. Username must be exactly `resend`, port `465`, SSL. |
| Replies land in the recipient's spam | Resend domain not **Verified**, DMARC record missing, or two SPF records on `@`. |
| Confirmation email from Gmail never comes | Forwarding (Part 2) isn't working yet. Fix that first. |
| Replies still go out from @gmail.com | Part 7 not set, or the alias was added with *Treat as an alias* ticked. Remove it and add it again. |
| Website emails fail after the change | The sender address isn't on the verified Resend domain, or the env var wasn't redeployed. |
