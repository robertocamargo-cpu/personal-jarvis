import { ChatError } from "../chat/policy.mjs";
import { CALLBACK, SCOPES } from "./policy.mjs";
async function jsonFetch(url, options, fetcher = fetch) {
  const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(10000), redirect: "error" });
  if (!response.ok) throw new ChatError(502, response.status === 401 ? "reconnect" : response.status === 403 ? "permission_denied" : "google_unavailable");
  return response.json();
}
export async function exchange(config, code, verifier, fetcher = fetch) {
  return jsonFetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code, code_verifier: verifier, grant_type: "authorization_code", redirect_uri: CALLBACK }) }, fetcher);
}
export async function refresh(config, token, fetcher = fetch) {
  return jsonFetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: token, grant_type: "refresh_token" }) }, fetcher);
}
export async function identity(access, fetcher = fetch) {
  return jsonFetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${access}` } }, fetcher);
}
export function validateGrant(token, user, account) {
  if (!token.access_token || !token.refresh_token || !Number.isFinite(token.expires_in) || token.expires_in <= 0) throw new ChatError(502, "incomplete_grant");
  if (user.email_verified !== true || typeof user.email !== "string" || user.email.toLowerCase() !== account.email.toLowerCase()) throw new ChatError(403, "account_mismatch");
  const scopes = (token.scope || "").split(" ");
  if (!Object.values(SCOPES).some(scope => scopes.includes(scope))) throw new ChatError(403, "permission_denied");
  return scopes;
}
export async function readService(service, access, fetcher = fetch, now = new Date()) {
  const options = { headers: { Authorization: `Bearer ${access}` } };
  if (service === "gmail") {
    const list = await jsonFetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=is%3Aunread%20newer_than%3A7d", options, fetcher);
    const items = await Promise.all((list.messages || []).map(async item => {
      const message = await jsonFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, options, fetcher);
      const header = name => message.payload?.headers?.find(h => h.name.toLowerCase() === name)?.value || "";
      return { title: header("subject") || "(sem assunto)", detail: header("from"), date: header("date") };
    }));
    return { items, more: Boolean(list.nextPageToken), description: "Até 10 emails não lidos dos últimos 7 dias. Nenhuma mensagem foi marcada como lida." };
  }
  if (service === "calendar") {
    const query = new URLSearchParams({ timeMin: now.toISOString(), timeMax: new Date(now.getTime()+7*86400000).toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "10" });
    const data = await jsonFetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`, options, fetcher);
    return { items: (data.items || []).map(item => ({ title: item.summary || "(sem título)", detail: item.location || "", date: item.start?.dateTime || item.start?.date || "" })), more: Boolean(data.nextPageToken), description: "Até 10 compromissos da agenda principal nos próximos 7 dias." };
  }
  if (service === "drive") {
    const query = new URLSearchParams({ pageSize: "10", orderBy: "modifiedTime desc", q: "trashed=false", fields: "nextPageToken,files(name,mimeType,modifiedTime)" });
    const data = await jsonFetch(`https://www.googleapis.com/drive/v3/files?${query}`, options, fetcher);
    return { items: (data.files || []).map(item => ({ title: item.name, detail: item.mimeType, date: item.modifiedTime })), more: Boolean(data.nextPageToken), description: "Metadados de até 10 arquivos modificados recentemente. O conteúdo dos arquivos não é lido." };
  }
  throw new ChatError(400, "invalid_request");
}
