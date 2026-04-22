const https = require("https");
const http = require("http");

const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_KEY = process.env.GEMINI_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const PERSONA_NAME = process.env.PERSONA_NAME || "سيموني";
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || "أنت سيموني، بوت ذكي وجريء في مجموعة تيليغرام. ترد على كل رسالة بأسلوب عراقي مضحوك وشبابي. كن مسلياً وذكياً. اختصر ردودك بجملة أو جملتين.";

let offset = 0;

function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.request(url, { method: options.method || "GET", headers: options.headers || {} }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error("JSON parse error: " + data.slice(0, 200))); }
      });
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function getUpdates() {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?timeout=10&offset=${offset}&allowed_updates=["message"]`;
  return fetchJSON(url);
}

async function sendMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  return fetchJSON(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

async function askGemini(userText, fromName) {
  const prompt = `${SYSTEM_PROMPT}\nاسمك ${PERSONA_NAME}. رد بالعربي العراقي. اختصر ردك.\n\n${fromName} قال: "${userText}"`;
  const url = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetchJSON(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 300, temperature: 0.9 }
    })
  });
  console.log("GEMINI RESPONSE:", JSON.stringify(res).slice(0, 200));
  if (!res.candidates) return "اه اه اه ";
  return res.candidates[0].content.parts[0].text || "...";
}

async function poll() {
  try {
    const data = await getUpdates();
    if (!data.ok) {
      console.error("Telegram error:", data.description);
      setTimeout(poll, 3000);
      return;
    }
    for (const update of data.result) {
      offset = update.update_id + 1;
      const msg = update.message;
      if (!msg || !msg.text || msg.from?.is_bot) continue;
      const from = msg.from?.first_name || "مستخدم";
      const chatId = msg.chat.id;
      const text = msg.text;
      console.log(`[MSG] ${from}: ${text}`);
      try {
        const reply = await askGemini(text, from);
        await sendMessage(chatId, reply);
        console.log(`[REPLY] ${reply}`);
      } catch (e) {
        console.error("[AI ERROR]", e.message);
      }
    }
  } catch (e) {
    console.error("[POLL ERROR]", e.message);
  }
  setTimeout(poll, 1500);
}

http.createServer((req, res) => {
  res.writeHead(200);
  res.end("HburgBot is running!");
}).listen(process.env.PORT || 3000, () => {
  console.log("✅ HburgBot started!");
  poll();
});


