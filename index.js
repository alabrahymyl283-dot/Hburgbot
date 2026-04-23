const https = require("https");
const http = require("http");

const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_KEY = process.env.GEMINI_KEY;

let offset = 0;

function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.request(url, { method: options.method || "GET", headers: options.headers || {} }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error("parse error")); }
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

async function askGemini(userText) {
  const prompt = `أنت مساعد دراسي متخصص لطلاب المرحلة الإعدادية في العراق. تساعد في جميع المواد: رياضيات، علوم، فيزياء، كيمياء، أحياء، عربي، انكليزي، تاريخ، جغرافية، تربية إسلامية. أجب بشكل واضح ومبسط باللغة العربية. إذا كان سؤالاً رياضياً اشرح الخطوات بالتفصيل. إذا كان سؤالاً علمياً اشرح المفهوم ببساطة.\n\nسؤال الطالب: ${userText}`;

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
  const res = await fetchJSON(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1000, temperature: 0.3 }
    })
  });
  if (!res.candidates) {
    console.error("GEMINI ERROR:", JSON.stringify(res).slice(0, 300));
    return "عذراً، حصل خطأ. حاول مرة ثانية.";
  }
  return res.candidates[0].content.parts[0].text;
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
      const chatId = msg.chat.id;
      const text = msg.text;
      console.log(`[MSG] ${text}`);
      try {
        const reply = await askGemini(text);
        await sendMessage(chatId, reply);
        console.log(`[REPLY] ${reply.slice(0, 50)}`);
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
  res.end("Bot running!");
}).listen(process.env.PORT || 3000, () => {
  console.log("✅ Bot started!");
  poll();
});

