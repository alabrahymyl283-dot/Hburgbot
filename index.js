const https = require("https");
const http = require("http");

const BOT_TOKEN = process.env.BOT_TOKEN;

let offset = 0;

const replies = {
  "شلونك": ["زين", "مفتوح", "تمام والله", "بخير يسلمو"],
  "السلام عليكم": ["و عليكم السلام", "وعليكم السلام ورحمة الله"],
  "هلا": ["هلا هلا", "هلا والله", "هلا بيك"],
  "اهلين": ["اهلين بيك", "اهلين وسهلين"],
  "صباح الخير": ["صباح النور", "صباح الورد"],
  "مساء الخير": ["مساء النور", "مساء الورد والياسمين"],
  "شتسوي": ["ولا شي", "شغل شغل", "اتعبط بالموبايل"],
  "وين": ["هنا والله", "مو بعيد"],
  "تعبت": ["الله يعافيك", "روح ارتاح"],
  "جوعان": ["اكل اكل", "طبخ شي"],
  "بوس": ["بوسة على راسك", "ههههه لا"],
  "احبك": ["وياك والله", "هههه اشكرك"],
  "غبي": ["انت الغبي 😂", "ههههه يحچيني"],
  "تعال": ["جاي جاي", "وين؟"],
  "نام": ["ما أقدر الحين", "بعدين"],
  "گلبي": ["هههه شبيك", "والله چا"],
  "شنو": ["شنو شنو؟", "سؤال صعب"],
  "ما ادري": ["انا بعد ما أدري 😂", "نفس"],
  "روح": ["مو رايح 😂", "لا اريد"],
  "بسرعة": ["هاي هاي", "صبر صبر"]
};

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

function getReply(text) {
  const clean = text.trim().toLowerCase();
  for (const key of Object.keys(replies)) {
    if (clean.includes(key)) {
      const options = replies[key];
      return options[Math.floor(Math.random() * options.length)];
    }
  }
  return null;
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
      const reply = getReply(text);
      if (reply) {
        await sendMessage(chatId, reply);
        console.log(`[REPLY] ${reply}`);
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





