const login = require("itz-ur-raza");
const fs = require("fs");
const express = require("express");
const axios = require("axios");
const handleCommands = require("./commands");
const welcomeEvent = require("./welcomeevent");
const { startAutoGreetings } = require("./greetings");
const Jimp = require("jimp");
const botStartTime = Date.now();
const path = require("path");

// ✅ UPTIME FUNCTION
function formatUptime(ms) {
  const sec = Math.floor(ms / 1000) % 60;
  const min = Math.floor(ms / (1000 * 60)) % 60;
  const hr = Math.floor(ms / (1000 * 60 * 60)) % 24;
  const day = Math.floor(ms / (1000 * 60 * 60 * 24));

  return `${day}d ${hr}h ${min}m ${sec}s`;
}

const sayQueue = [];
let sayRunning = false;

async function processSayQueue(api) {

  if (sayRunning) return;
  sayRunning = true;

  while (sayQueue.length) {

    const job = sayQueue.shift();
    const { text, threadID, messageID } = job;

    try {

      const url =
`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(text)}&tl=hi`;

      const file = path.join(__dirname, `say_${Date.now()}.mp3`);

      const res = await axios({
          url,
          method: "GET",
          responseType: "stream",
          headers: {
               "User-Agent":
                   "Mozilla/5.0 (Linux; Android 10)"
          }
       });

      const writer = fs.createWriteStream(file);

      res.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      await humanDelay(2000, 4000);

      await api.sendMessage(
        {
          attachment: fs.createReadStream(file)
        },
        threadID,
        messageID
      );

      fs.unlinkSync(file);

    } catch (e) {
      console.log("Say error:", e.message);
    }

    await humanDelay(2000, 4000);

  }

  sayRunning = false;
}

// ===============================
// ADVANCED COOKIE → APPSTATE
// ===============================

function cookieToAppstate() {

  if (!fs.existsSync("cookie.txt")) {
    console.log("❌ cookie.txt not found");
    process.exit(0);
  }

  const raw = fs.readFileSync("cookie.txt", "utf8");

  const cookies = raw
    .split(";")
    .map(c => c.trim())
    .filter(Boolean);

  const appstate = cookies.map(cookie => {

    const [key, ...val] = cookie.split("=");

    return {
      key,
      value: val.join("="),
      domain: ".facebook.com",
      path: "/",
      hostOnly: false,
      creation: Date.now(),
      lastAccessed: Date.now()
    };

  });

  fs.writeFileSync(
    "appstate.json",
    JSON.stringify(appstate, null, 2)
  );

  console.log("✅ Cookie converted → appstate");

}

if (!fs.existsSync("appstate.json")) {
  cookieToAppstate();
}

// ===============================
// AUTO SAVE NEW APPSTATE
// ===============================

function saveAppstate(api) {

  const newState = api.getAppState();

  fs.writeFileSync(
    "appstate.json",
    JSON.stringify(newState, null, 2)
  );

  console.log("💾 Appstate refreshed & saved");
}

let activeKeyIndex = 0;
let mqttInstanceId = 0;

const PREFIX = "$";

const OWNER_UIDS = fs.existsSync("owners.txt")
  ? fs.readFileSync("owners.txt", "utf8")
      .split("\n")
      .map(x => x.trim())
      .filter(Boolean)
  : [];

let loaderState = {
  interval: null,
  stop: false
};

const lockedGroupNames = {};

const lockedNicknames = {}; 
// Structure:
// lockedNicknames[threadID] = {
//    userID1: "Nick",
//    userID2: "Nick"
// }

// ===== MULTI TARGET SYSTEM =====
const activeTargets = new Set(); // multiple targets store honge

/* ================= FRIEND PROTECTION SYSTEM ================= */

const friendUIDs = fs.existsSync("friends.txt")
  ? fs.readFileSync("friends.txt", "utf8")
      .split("\n")
      .map(x => x.trim())
      .filter(Boolean)
  : [];

let BAD_WORDS = [];

function loadBadWords() {
  try {
    if (!fs.existsSync("badwords.txt")) {
      console.log("⚠️ badwords.txt not found");
      BAD_WORDS = [];
      return;
    }

    BAD_WORDS = fs
      .readFileSync("badwords.txt", "utf8")
      .split("\n")
      .map(x => x.trim().toLowerCase())
      .filter(Boolean);

  } catch (e) {
    console.log("BadWords load error:", e.message);
    BAD_WORDS = [];
  }
}

// 🔥 first load
loadBadWords();

// attacker sequence tracker
const badWordIndex = {};

const humanDelay = (min = 1500, max = 3500) =>
new Promise(r =>
setTimeout(r, Math.floor(Math.random() * (max - min)) + min)
);

const lastCommandTime = {};

const targetUIDs = fs.existsSync("Target.txt")
? fs.readFileSync("Target.txt", "utf8").split("\n").map(x => x.trim()).filter(Boolean)
: [];

const messageQueues = {};
const queueRunning = {};
let globalTargetIndex = 0;

const app = express();
app.get("/", (_, res) => res.send("<h2>Messenger Bot Running</h2>"));
app.listen(20782, () => console.log("🌐 Log server running"));

process.on("uncaughtException", err =>
console.error("❗ Uncaught:", err.message)
);
process.on("unhandledRejection", r =>
console.error("❗ Rejection:", r)
);

login(
  {
    appState: JSON.parse(fs.readFileSync("appstate.json", "utf8")),
    userAgent:
"Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 Chrome/119.0.0.0 Mobile Safari/537.36"
  },
  (err, api) => {
    if (err) return console.error("❌ Login failed:", err);

    console.log("✅ Bot logged in");
    
    startAutoGreetings(api);
    
    saveAppstate(api);   // 👈 YE LINE ADD KARO

    api.setOptions({
      listenEvents: true,
      updatePresence: false,
      selfListen: false,
      autoMarkRead: false,
      forceLogin: false
    });

    console.log("✅ Bot logged in with $ prefix");

    // ===== RANDOM DELAY =====
    const eventDelay = () =>
      new Promise(resolve =>
        setTimeout(resolve, Math.floor(Math.random() * 3000) + 2000)
      );

    // ===============================
    // 🔥 AUTO RECONNECT MQTT SYSTEM
    // ===============================
    
    let reconnectTimeout = null;

    const safeReconnect = () => {
  if (reconnectTimeout) return;

  reconnectTimeout = setTimeout(() => {
    console.log("🛠 safeReconnect triggered");
    forceRestartMQTT();   // ✅ ONLY THIS
    reconnectTimeout = null;
  }, 2 * 60 * 1000);
};

let reconnectInProgress = false;
let lastEventTime = Date.now();

let mqttStopper = null; // 🔥 IMPORTANT
     
     const forceRestartMQTT = async () => {

  if (reconnectInProgress) return;

  reconnectInProgress = true;

  console.log("♻️ Restarting MQTT safely...");

  try {

    mqttInstanceId++; // 🔥 OLD LISTENER INVALID

    if (mqttStopper) {
      try {
        mqttStopper();
      } catch {}
    }

    await new Promise(r => setTimeout(r, 4000));

    startListening();

  } finally {

    reconnectInProgress = false;

  }

};


    const startListening = () => {

  mqttInstanceId++; // 🔥 new instance
  const currentInstance = mqttInstanceId;

  console.log("📡 MQTT Listening STARTED");

  mqttStopper = api.listenMqtt(async (err, event) => {

    // 🔥 OLD LISTENER AUTO STOP
    if (currentInstance !== mqttInstanceId) {
      return;
    }

    lastEventTime = Date.now();

    if (err) {
      console.log("❌ MQTT Error:", err.message);
      forceRestartMQTT();
      return;
    }

    if (!event) return;

    try {

const {
threadID,
senderID,
body,
messageID,
messageReply,
mentions,
} = event;

/* ================= GROUP NAME LOCK ENFORCEMENT ================= */

if (
event.type === "event" &&
event.logMessageType === "log:thread-name"
) {
const locked = lockedGroupNames[threadID];
if (locked && event.logMessageData.name !== locked) {
await humanDelay(2000, 5000);
await api.setTitle(locked, threadID);
await api.sendMessage(
"Groupname Locked 🔒 Successfully",
threadID
);
}
return;
}

/* ================= NICKNAME LOCK ENFORCEMENT ================= */

if (
  event.type === "event" &&
  event.logMessageType === "log:user-nickname"
) {
  const { participant_id, nickname } = event.logMessageData;

  if (
    lockedNicknames[threadID] &&
    lockedNicknames[threadID][participant_id]
  ) {
    const lockedName = lockedNicknames[threadID][participant_id];

    if (nickname !== lockedName) {
      await humanDelay(2000, 5000);
      await api.changeNickname(
        lockedName,
        threadID,
        participant_id
      );

      await api.sendMessage(
        "Nickname Locked 🔒 Successfully",
        threadID
      );
    }
  }

  return;
}

/* ================= WELCOME / GOODBYE SYSTEM ================= */

await welcomeEvent({
  api,
  event,
  threadID,
  eventDelay
});

/* ================= TARGET AUTO REPLY (FIXED GLOBAL LINE SYSTEM) ================= */

const enqueueMessage = async (uid, threadID, messageID) => {

  if (!messageQueues[uid]) messageQueues[uid] = [];
  messageQueues[uid].push({ threadID, messageID });

  if (queueRunning[uid]) return;
  queueRunning[uid] = true;

  if (!fs.existsSync("targetnp.txt")) {
    queueRunning[uid] = false;
    return;
  }

  const lines = fs
    .readFileSync("targetnp.txt", "utf8")
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  if (!lines.length) {
    queueRunning[uid] = false;
    return;
  }

  let userName = "User";
  try {
    const info = await api.getUserInfo(uid);
    userName = info[uid]?.name || "User";
  } catch {}

  const run = async () => {

    if (!messageQueues[uid].length) {
      queueRunning[uid] = false;
      return;
    }

    const msg = messageQueues[uid].shift();

    // ✅ GLOBAL LINE PICK
    const line = lines[globalTargetIndex];

    // 🔁 GLOBAL INDEX UPDATE
    globalTargetIndex++;
    if (globalTargetIndex >= lines.length) {
      globalTargetIndex = 0;
    }

    // ⏳ HUMAN DELAY
    await humanDelay(30000, 50000);

    await api.sendMessage(
      {
        body: `@${userName} ${line}`,
        mentions: [{ tag: `@${userName}`, id: uid }],
      },
      msg.threadID,
      msg.messageID
    );

    setTimeout(run, Math.floor(Math.random() * 4000) + 2000);
  };

  run();
};

// ✅ MULTI TARGET CHECK
if (
  fs.existsSync("targetnp.txt") &&
  (targetUIDs.includes(senderID) || activeTargets.has(senderID))
) {
  enqueueMessage(senderID, threadID, messageID);
}

/* ================= FRIEND BAD WORD PROTECTION ================= */

if (body && fs.existsSync("badwordsreply.txt")) {

  const lower = body.toLowerCase();

  const hasBadWord = BAD_WORDS.some(word =>
    new RegExp(`\\b${word}\\b`, "i").test(lower)
  );

  if (hasBadWord) {

    let targetUID = null;

    /* ===== REPLY CHECK ===== */

    if (
      messageReply &&
      messageReply.senderID &&
      friendUIDs.includes(messageReply.senderID)
    ) {
      targetUID = messageReply.senderID;
    }

    /* ===== REAL MENTION CHECK ===== */

    if (!targetUID && mentions) {

      for (const key in mentions) {

        const uid = mentions[key];

        if (friendUIDs.includes(uid)) {
          targetUID = uid;
          break;
        }

      }

    }

    /* ===== NAME DETECTION (EXTRA FIX) ===== */

    if (!targetUID) {

      for (const uid of friendUIDs) {

        try {

          const info = await api.getUserInfo(uid);
          const name = info[uid]?.name?.toLowerCase();

          if (name && lower.includes(name)) {
            targetUID = uid;
            break;
          }

        } catch {}

      }

    }

    /* ===== ACTION ===== */

    if (targetUID) {

      const lines = fs
        .readFileSync("badwordsreply.txt", "utf8")
        .split("\n")
        .map(x => x.trim())
        .filter(Boolean);

      if (!lines.length) return;

      const attacker = senderID;

      if (!badWordIndex[attacker]) {
        badWordIndex[attacker] = 0;
      }

      const line = lines[badWordIndex[attacker]];

      badWordIndex[attacker]++;
      if (badWordIndex[attacker] >= lines.length) {
        badWordIndex[attacker] = 0;
      }

      let name = "User";

      try {
        const info = await api.getUserInfo(attacker);
        name = info[attacker]?.name || "User";
      } catch {}

      await humanDelay(3000, 6000);

      api.sendMessage(
        {
          body: `⚠️ @${name}\n${line}`,
          mentions: [{ tag: `@${name}`, id: attacker }]
        },
        threadID,
        messageID
      );

    }

  }

}

/* ================= PUBLIC SAY COMMAND ================= */

if (
  body &&
  body.toLowerCase().startsWith("$say ")
) {

  const text = body.slice(5).trim();

  if (!text) {
    return api.sendMessage(
      "❌ Usage: $say <text>",
      threadID,
      messageID
    );
  }

  if (text.length > 500) {
    return api.sendMessage(
      "⚠️ Message bahut bada hai (Max 500 characters)",
      threadID,
      messageID
    );
  }

  sayQueue.push({
    text,
    threadID,
    messageID
  });

  processSayQueue(api);

  return;
}

/* ================= PUBLIC STATUS COMMAND ================= */

if (body && body.toLowerCase() === "$status") {

  try {

    // ⏳ RANDOM HUMAN DELAY ADD
    await humanDelay(2500, 5000);

    // ⏱ uptime
    const uptime = formatUptime(Date.now() - botStartTime);

    // 👥 total groups
    const threads = await api.getThreadList(100, null, ["INBOX"]);
    const groupCount = threads.filter(t => t.isGroup).length;

    // 👑 bot admins count
    const adminCount = OWNER_UIDS.length;

    // ✨ Stylish Message
    const msg = 
`╭─〔 🤖 𝗕𝗢𝗧 𝗦𝗧𝗔𝗧𝗨𝗦 〕─╮

⏳ 𝗥𝘂𝗻𝗻𝗶𝗻𝗴 𝗨𝗽𝘁𝗶𝗺𝗲
➥ ${uptime}

👥 𝗧𝗼𝘁𝗮𝗹 𝗝𝗼𝗶𝗻𝗲𝗱 𝗚𝗿𝗼𝘂𝗽𝘀
➤ ${groupCount}

🛠 𝗣𝗿𝗲𝗳𝗶𝘅
➥ ${PREFIX}

📢 𝗣𝘂𝗯𝗹𝗶𝗰 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀
➤ $say , $status

👑 𝗕𝗼𝘁 𝗔𝗱𝗺𝗶𝗻
➥ ${adminCount}

🧑‍💻 𝗕𝗼𝘁 𝗢𝘄𝗻𝗲𝗿
➤ Vikram Sharma

╰───────────────╯`;

    return api.sendMessage(msg, threadID, messageID);

  } catch (e) {
    console.log("Status error:", e.message);
  }
}

/* ================= ULTRA SAFE IMAGE PAIR (FINAL) ================= */

if (body && body.toLowerCase() === "$pair") {

  try {

    // ⏳ Human delay
    await humanDelay(3000, 6000);

    // 🧊 COOLDOWN
    global.pairCooldown = global.pairCooldown || {};
    if (
      global.pairCooldown[senderID] &&
      Date.now() - global.pairCooldown[senderID] < 60000
    ) {
      return api.sendMessage(
        "⏳ Wait 1 minute before using $pair again",
        threadID,
        messageID
      );
    }
    global.pairCooldown[senderID] = Date.now();

    // 👤 USER INFO (LOW API USAGE)
    const userInfo = await api.getUserInfo([senderID]);
    const senderName = userInfo[senderID]?.name || "User";

    const threadInfo = await api.getThreadInfo(threadID);
    const members = threadInfo.participantIDs.filter(
      id => id !== senderID && id !== api.getCurrentUserID()
    );

    if (!members.length) {
      return api.sendMessage("❌ No members found", threadID, messageID);
    }

    // 🎲 RANDOM PARTNER
    const randomID = members[Math.floor(Math.random() * members.length)];

    const partnerInfo = await api.getUserInfo([randomID]);
    const partnerName = partnerInfo[randomID]?.name || "Partner";

    // ================= SAFE DP =================
    const getDP = (uid, data) => {
      return data[uid]?.thumbSrc || `https://i.pravatar.cc/300?u=${uid}`;
    };

    const senderDP = getDP(senderID, userInfo);
    const partnerDP = getDP(randomID, partnerInfo);

    // ================= SAFE IMAGE LOADER =================
    const loadImg = async (url) => {
      try {
        const res = await axios({
          url,
          method: "GET",
          responseType: "arraybuffer",
          timeout: 8000,
          headers: { "User-Agent": "Mozilla/5.0" }
        });
        return await Jimp.read(Buffer.from(res.data));
      } catch {
        return await Jimp.read("https://i.pravatar.cc/300");
      }
    };

    const dp1 = await loadImg(senderDP);
    const dp2 = await loadImg(partnerDP);

    await humanDelay(1000, 2000);

    // ================= BACKGROUND CACHE SYSTEM =================
    if (!global.pairBG) {
      try {
        const bgRes = await axios({
          url: "https://iili.io/qh0h8Ss.jpg",
          responseType: "arraybuffer",
          timeout: 10000,
          headers: { "User-Agent": "Mozilla/5.0" }
        });

        global.pairBG = await Jimp.read(Buffer.from(bgRes.data));
        console.log("✅ Background cached");
      } catch (e) {
        console.log("BG load fail:", e.message);
        global.pairBG = new Jimp(1920, 1080, "#000000");
      }
    }

    const bg = global.pairBG.clone();

    // ================= IMAGE PROCESS =================
    dp1.resize(220, 220).circle();
    dp2.resize(220, 220).circle();

    const centerX = bg.bitmap.width / 2;
    const y = bg.bitmap.height / 2 - 110;
    const gap = 150;

    bg.composite(dp1, centerX - gap - 110, y);
    bg.composite(dp2, centerX + gap - 110, y);

    // ❤️ HEART (OPTIONAL SAFE)
    try {
      if (!global.heartImg) {
        const heartRes = await axios({
          url: "https://iili.io/F2KXHns.png",
          responseType: "arraybuffer"
        });
        global.heartImg = await Jimp.read(Buffer.from(heartRes.data));
      }

      const heart = global.heartImg.clone().resize(100, 100);
      bg.composite(heart, centerX - 50, y + 60);
    } catch {}

    // ================= TEXT =================
    const fontWhite = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    const fontBlack = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);

    const text = `${senderName} ❤️ ${partnerName}`;
    const textY = bg.bitmap.height - 90;

    bg.print(fontBlack, 0, textY + 3, {
      text,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
    }, bg.bitmap.width);

    bg.print(fontWhite, 0, textY, {
      text,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
    }, bg.bitmap.width);

    // ================= SAVE =================
    const filePath = path.join(__dirname, `pair_${Date.now()}.jpg`);
    await bg.writeAsync(filePath);

    await humanDelay(2000, 4000);

    // ================= SEND =================
    await api.sendMessage(
      {
        body: `💖 Perfect Pair!\n\n@${senderName} ❤️ @${partnerName}`,
        mentions: [
          { tag: `@${senderName}`, id: senderID },
          { tag: `@${partnerName}`, id: randomID }
        ],
        attachment: fs.createReadStream(filePath)
      },
      threadID,
      messageID
    );

    fs.unlinkSync(filePath);

  } catch (e) {
    console.log("Pair error:", e.message);
    api.sendMessage("❌ Pair command error", threadID, messageID);
  }
}

/* ================= OWNER COMMANDS ================= */

if (!body || !body.startsWith(PREFIX)) return;
if (!OWNER_UIDS.includes(senderID)) return;

const now = Date.now();
if (lastCommandTime[senderID] && now - lastCommandTime[senderID] < 8000)
  return;
lastCommandTime[senderID] = now;

const args = body.slice(PREFIX.length).trim().split(/\s+/);
const cmd = args[0].toLowerCase();
const input = args.slice(1).join(" ");

await handleCommands({
  api,
  event,
  args,
  cmd,
  input,
  PREFIX,
  OWNER_UIDS,
  humanDelay,
  lockedGroupNames,
  lockedNicknames,
  activeTargets,
  messageQueues,
  queueRunning,
  loaderState   // 👈 ye bhejo
});

/* ===== MUST HAVE CATCH FOR listenMqtt ===== */
} catch (e) {
      console.error("❌ MQTT handler error:", e);
    }
  });
};

    // 🚀 Start Listening First Time
    startListening();
    
    // 🔥 MQTT DEAD WATCHDOG (every 5 min)
setInterval(() => {
  const now = Date.now();
  const diff = now - lastEventTime;

  if (diff > 20 * 60 * 1000) { // 20 minutes no events
    console.log("⚠️ MQTT seems dead — restarting safely");
    forceRestartMQTT();
  }
}, 5 * 60 * 1000);

// ===============================
// 💓 KEEP ALIVE SYSTEM (30 MIN)
// ===============================

setInterval(async () => {

  const time = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true
  });

  try {
    await api.getCurrentUserID();

    console.log(`💓 [${time}] Keep Alive Ping Sent Successfully`);
  } catch (err) {
    console.log(`⚠️ [${time}] Keep Alive Failed, safe reconnect scheduled...`);
    safeReconnect();
  }

}, 30 * 60 * 1000);


// ===============================
// 🔄 SESSION AUTO REFRESH (6 HR)
// ===============================

setInterval(() => {

  try {

    const newState = api.getAppState();

    fs.writeFileSync(
      "appstate.json",
      JSON.stringify(newState, null, 2)
    );

    console.log("🔄 Session refreshed");

  } catch (e) {
    console.log("Session refresh error:", e.message);
  }

}, 6 * 60 * 60 * 1000);

});
