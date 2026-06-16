// LuminaTaskOS — shared Telegram sendMessage for edge functions.
export async function sendTelegram(
  token: string,
  chatId: number,
  text: string,
  opts?: { markdown?: boolean },
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(opts?.markdown ? { parse_mode: "Markdown" } : {}),
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) console.error("[taskos] sendTelegram", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("[taskos] sendTelegram failed", e instanceof Error ? e.message : e);
    return false;
  }
}

// Download a Telegram file (e.g. a voice note) as bytes via getFile + file path.
export async function downloadTelegramFile(token: string, fileId: string): Promise<{ bytes: Uint8Array; path: string } | null> {
  try {
    const meta = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    });
    if (!meta.ok) return null;
    const j = await meta.json();
    const path = j?.result?.file_path;
    if (!path) return null;
    const bin = await fetch(`https://api.telegram.org/file/bot${token}/${path}`);
    if (!bin.ok) return null;
    return { bytes: new Uint8Array(await bin.arrayBuffer()), path };
  } catch (e) {
    console.error("[taskos] downloadTelegramFile failed", e instanceof Error ? e.message : e);
    return null;
  }
}
