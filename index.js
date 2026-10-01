const login = require("itz-ur-raza");
const fs = require("fs");
const axios = require("axios");
const express = require("express");
const handleCommands = require("./commands");

const app = express();
app.get("/", (_, res) => res.send("<h1>foku Final Shield Active 🛡️</h1>"));
app.listen(process.env.PORT || 3000);

if (!fs.existsSync("./cache")) fs.mkdirSync("./cache");

global.dpLockLink = {}; 
global.lockedNicknames = {}; 
global.groupNameLock = {}; 
global.nicknameLockStatus = {}; 
global.activeTargets1 = new Set();
global.activeTargets2 = new Set();

const OWNER_ID = "61591995446639";
const appStateFiles = ["appstate1.json", "appstate2.json"];

function startInstance(stateFile, idNum) {
  try {
    const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    login({ appState: state }, (err, api) => {
      if (err) return setTimeout(() => startInstance(stateFile, idNum), 10000);
      api.setOptions({ listenEvents: true, selfListen: true, autoMarkRead: true });
      
      const botID = api.getCurrentUserID(); // Bot ID check
      console.log(`✅ ID ${idNum} Running.`);

      // --- 🛡️ 30 SECOND AUTO-CHECK (Wahi Purana Logic) ---
      if (idNum === 1) {
        setInterval(async () => {
          api.getThreadList(25, null, ["INBOX"], (err, list) => {
            if (err || !list) return;
            list.forEach(thread => {
              const savedLink = global.dpLockLink[thread.threadID];
              if (thread.isGroup && savedLink && !thread.imageSrc) { 
                revertDP(api, thread.threadID, savedLink);
              }
            });
          });
        }, 30000); // 30 second check active
      }

      api.listenMqtt(async (err, event) => {
        if (err || !event) return;
        const { threadID, type, logMessageType, logMessageData, author, senderID } = event;

        // --- 🔒 LOCK REVERT LOGIC ---
        // Author na owner ho aur na hi khud bot ho (loop protection)
        if (type === "event" && author !== OWNER_ID && author !== botID) {
          
          // 1. Group Name Lock
          if (logMessageType === "log:thread-name" && global.groupNameLock[threadID]) {
            api.setTitle(global.groupNameLock[threadID], threadID);
          }
          
          // 2. Nickname Lock (Strictly ID 1 to avoid clash)
          if (idNum === 1 && logMessageType === "log:user-nickname" && global.nicknameLockStatus[threadID]) {
            const tID = logMessageData.participant_id;
            const oldNick = global.lockedNicknames[threadID]?.[tID] || "";
            if (oldNick) api.changeNickname(oldNick, threadID, tID);
          }
          
          // 3. DP Lock (MQTT Revert - Sirf ID 1)
          if (idNum === 1 && logMessageType === "log:thread-image" && global.dpLockLink[threadID]) {
            revertDP(api, threadID, global.dpLockLink[threadID]);
          }
        }

        // --- 🎯 TARGET FIGHT ---
        if (type === "message" && senderID !== OWNER_ID) {
          if (idNum === 1 && global.activeTargets1.has(senderID)) sendTargetReply(api, event, "np.txt");
          if (idNum === 2 && global.activeTargets2.has(senderID)) sendTargetReply(api, event, "np.txt");
        }

        // --- ⌨️ COMMANDS ---
        if (event.body && event.body.startsWith("!")) {
          const args = event.body.slice(1).trim().split(/\s+/);
          const cmd = args.shift().toLowerCase();
          handleCommands({ 
            api, event, args, cmd, idNum, OWNER_ID, 
            lockedNicknames: global.lockedNicknames, 
            activeTargets1: global.activeTargets1, 
            activeTargets2: global.activeTargets2, 
            input: args.join(" ") 
          }).catch(() => {});
        }
      });
    });
  } catch (e) { setTimeout(() => startInstance(stateFile, idNum), 10000); }
}

async function revertDP(api, threadID, link) {
    try {
        const res = await axios.get(link, { responseType: "arraybuffer" });
        const path = `./cache/revert_${threadID}.jpg`;
        fs.writeFileSync(path, Buffer.from(res.data, "utf-8"));
        api.changeGroupImage(fs.createReadStream(path), threadID);
    } catch (e) { }
}

function sendTargetReply(api, event, fileName) {
  try {
    const lines = fs.readFileSync(fileName, "utf-8").split("\n").filter(l => l.trim() !== "");
    const msg = lines[Math.floor(Math.random() * lines.length)];
    setTimeout(() => { api.sendMessage(msg, event.threadID, event.messageID); }, 7000);
  } catch (e) { }
}

appStateFiles.forEach((f, i) => startInstance(f, i + 1));
