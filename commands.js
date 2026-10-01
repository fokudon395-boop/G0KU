const axios = require("axios");
const fs = require("fs");

module.exports = async function handleCommands({
  api, event, args, cmd, idNum, OWNER_ID, lockedNicknames, activeTargets1, activeTargets2, input
}) {
  const { threadID, senderID } = event;
  if (senderID !== OWNER_ID) return;

  // ==========================================
  // --- SIRF ID 1 YE COMMANDS SUNEGI ---
  // ==========================================
  if (idNum === 1) {
    
    // 1. DP LOCK (Specific Group)
    if (cmd === "dplock") {
      if (!args[0]) return api.sendMessage("❌ Link do!", threadID);
      global.dpLockLink[threadID] = args[0];
      try {
        const res = await axios.get(args[0], { responseType: "arraybuffer" });
        const path = `./cache/lock_${threadID}.jpg`;
        fs.writeFileSync(path, Buffer.from(res.data, "utf-8"));
        api.changeGroupImage(fs.createReadStream(path), threadID, () => {
          api.sendMessage("🔒 DP Locked (ID 1) 🔥", threadID);
        });
      } catch (e) { api.sendMessage("❌ Link Error!", threadID); }
    }

    // 2. NAME LOCK (Specific Group)
    if (cmd === "namelock") {
      api.getThreadInfo(threadID, (err, info) => {
        if (err) return;
        global.groupNameLock[threadID] = info.threadName;
        api.sendMessage(`🔒 Group Name Locked: ${info.threadName}`, threadID);
      });
    }

    // 3. NICKNAME LOCK (Specific Group)
    if (cmd === "locknick") {
      api.getThreadInfo(threadID, (err, info) => {
        if (err) return;
        global.nicknameLockStatus[threadID] = true;
        global.lockedNicknames[threadID] = info.nicknames || {};
        api.sendMessage("Nicknames Locked by foku don!", threadID);
      });
    }

    // 4. SETALL NICKNAME (3s Gap)
    if (cmd === "setall") {
      if (!input) return api.sendMessage("❌ Naam likho!", threadID);
      api.getThreadInfo(threadID, (err, info) => {
        if (err) return;
        api.sendMessage(`⏳ Setting all to: ${input}...`, threadID);
        info.participantIDs.forEach((id, i) => {
          setTimeout(() => { api.changeNickname(input, threadID, id); }, i * 3000);
        });
      });
    }

    // FIGHT: TARGET 1
    if (cmd === "target1") {
      let tID = event.messageReply ? event.messageReply.senderID : args[0];
      if (tID) {
        if (activeTargets1.has(tID)) {
            activeTargets1.delete(tID);
            api.sendMessage("⚪ ID 1 Fight OFF", threadID);
        } else {
            activeTargets1.add(tID);
            api.sendMessage("🎯 ID 1 Fight ON!", threadID);
        }
      }
    }
  }

  // ==========================================
  // --- ID 2: SIRF FIGHT KAREGI ---
  // ==========================================
  if (idNum === 2) {
    if (cmd === "target2") {
      let tID = event.messageReply ? event.messageReply.senderID : args[0];
      if (tID) {
        if (activeTargets2.has(tID)) {
            activeTargets2.delete(tID);
            api.sendMessage("⚪ ID 2 Fight OFF", threadID);
        } else {
            activeTargets2.add(tID);
            api.sendMessage("🎯 ID 2 Fight ON!", threadID);
        }
      }
    }
  }
};
