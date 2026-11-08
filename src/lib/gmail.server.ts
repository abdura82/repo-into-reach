const b64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const header = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);

/** Sends one HTML email through the connected Gmail account. */
export async function sendGmail(to: string[], subject: string, html: string) {
  const lovable = process.env["LOVABLE_API_KEY"];
  const gmail = process.env["GOOGLE_MAIL_API_KEY"];
  if (!lovable || !gmail) throw new Error("Gmail bağlantısı eksik.");
  const raw = b64(
    [`To: ${to.join(", ")}`, `Subject: ${header(subject)}`, "MIME-Version: 1.0", 'Content-Type: text/html; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", b64(html)].join("\r\n"),
  ).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const res = await fetch("https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": gmail, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error(`Gmail gönderimi başarısız [${res.status}]: ${await res.text()}`);
}
