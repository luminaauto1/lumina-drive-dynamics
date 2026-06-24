// LuminaTaskOS — shared Telegram sendMessage for edge functions.
// `replyMarkup` attaches an inline keyboard (tappable buttons) — taps come back as
// a `callback_query` update handled in taskos-telegram-webhook.
// Returns the sent message_id on success (truthy — existing `if (await sendTelegram())`
// callers still work), or null on failure.
export async function sendTelegram(
  token: string,
  chatId: number,
  text: string,
  opts?: { markdown?: boolean; replyMarkup?: unknown },
): Promise<number | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(opts?.markdown ? { parse_mode: "Markdown" } : {}),
        ...(opts?.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) { console.error("[taskos] sendTelegram", res.status, await res.text()); return null; }
    const j = await res.json().catch(() => null);
    return j?.result?.message_id ?? 0;
  } catch (e) {
    console.error("[taskos] sendTelegram failed", e instanceof Error ? e.message : e);
    return null;
  }
}

// Acknowledge an inline-button tap (shows a brief toast in Telegram, stops the spinner).
export async function answerCallback(token: string, callbackQueryId: string, text?: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, ...(text ? { text } : {}) }),
    });
  } catch (e) { console.error("[taskos] answerCallback failed", e instanceof Error ? e.message : e); }
}

// Replace a message's text and REMOVE its buttons (so a tapped action can't be re-tapped).
export async function editTelegramText(token: string, chatId: number, messageId: number, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, reply_markup: { inline_keyboard: [] } }),
    });
  } catch (e) { console.error("[taskos] editTelegramText failed", e instanceof Error ? e.message : e); }
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
