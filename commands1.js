const fs = require("fs");

module.exports = async function handleCommands({
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
  loaderState   // 👈 YAHI ADD KARNA HAI
}) {

const { threadID, messageID, senderID, messageReply, mentions } = event;

/* ================= COMMANDS ================= */

if (cmd === "uid") {
await humanDelay();

let uid = null;

if (mentions && Object.keys(mentions).length > 0) {
uid = Object.keys(mentions)[0];
}

else if (messageReply && messageReply.senderID) {
uid = messageReply.senderID;
}

else {
const searchName = input.replace("@", "").toLowerCase();
if (!searchName) {
return api.sendMessage("❌ $uid @MemberName likho", threadID, messageID);
}

const info = await api.getThreadInfo(threadID);
const users = await api.getUserInfo(info.participantIDs);

for (const id in users) {
const name = users[id]?.name;
if (name && name.toLowerCase().includes(searchName)) {
uid = id;
break;
}
}

if (!uid) {
return api.sendMessage("❌ Member nahi mila", threadID, messageID);
}
}

try {
const info = await api.getUserInfo(uid);
const name = info[uid]?.name || "Unknown";

return api.sendMessage(
`👤 🆔 Name : ${name}
User UID : ${uid}`,
threadID,
messageID
);
} catch {
return api.sendMessage(
`👤 🆔 Name : Not Found
User UID : ${uid}`,
threadID,
messageID
);
}
}

else if (cmd === "locknickname") {
await humanDelay(2000, 4000);

  if (!messageReply || !messageReply.senderID) {
    return api.sendMessage(
      "❌ Kisi ke message pe reply karke $locknickname <name> likho",
      threadID,
      messageID
    );
  }

  const targetUser = messageReply.senderID;
  const newNick = input.trim();

  if (!newNick) {
    return api.sendMessage(
      "❌ Nickname bhi likho",
      threadID,
      messageID
    );
  }

  if (!lockedNicknames[threadID]) {
    lockedNicknames[threadID] = {};
  }

  lockedNicknames[threadID][targetUser] = newNick;

  await api.changeNickname(newNick, threadID, targetUser);

  await api.sendMessage(
    `🔒 Nickname Locked Successfully`,
    threadID,
    messageID
  );
}

else if (cmd === "unlocknickname") {
await humanDelay(2000, 4000);

  if (!lockedNicknames[threadID]) {
    return api.sendMessage(
      "❌ Koi nickname lock nahi hai",
      threadID,
      messageID
    );
  }

  delete lockedNicknames[threadID];

  await api.sendMessage(
    "🔓 All Nicknames Unlocked Successfully",
    threadID,
    messageID
  );
}

else if (cmd === "whois") {
await humanDelay();

if (!messageReply || !messageReply.senderID) {
return api.sendMessage("❌ Reply pe $whois likho", threadID, messageID);
}

const uid = messageReply.senderID;

try {
const info = await api.getUserInfo(uid);
const name = info[uid]?.name || "Unknown";

return api.sendMessage(
`🕵️ WHOIS UID

👤 🆔 Name : ${name}
User UID : ${uid}`,
threadID,
messageID
);
} catch {
return api.sendMessage(
`🕵️ WHOIS UID

👤 🆔 Name : Not Found
User UID : ${uid}`,
threadID,
messageID
);
}
}

else if (cmd === "locknickname") {
  await humanDelay(3000, 6000);

  let targetUID = null;

  // ✅ reply method
  if (messageReply && messageReply.senderID) {
    targetUID = messageReply.senderID;
  }

  // ❌ no target
  if (!targetUID) {
    return api.sendMessage(
      "❌ Reply karke $locknickname <name> likho",
      threadID,
      messageID
    );
  }

  const newNick = input.trim();

  if (!newNick) {
    return api.sendMessage(
      "❌ Nickname likhna zaroori hai",
      threadID,
      messageID
    );
  }

  // 🔒 initialize group
  if (!lockedNicknames[threadID]) {
    lockedNicknames[threadID] = {};
  }

  lockedNicknames[threadID][targetUID] = newNick;

  try {

    await api.changeNickname(newNick, threadID, targetUID);

    const info = await api.getUserInfo(targetUID);
    const name = info[targetUID]?.name || "User";

    return api.sendMessage(
`🔒 𝗡𝗜𝗖𝗞𝗡𝗔𝗠𝗘 𝗟𝗢𝗖𝗞𝗘𝗗

👤 Name : ${name}
🆔 Uid  : ${targetUID}
🏷 Nickname : ${newNick}

✅ Nickname Locked Successfully`,
      threadID,
      messageID
    );

  } catch (e) {
    console.log(e.message);
    return api.sendMessage("❌ Error locking nickname", threadID, messageID);
  }
}

else if (cmd === "unlocknickname") {
  await humanDelay(3000, 6000);

  if (!lockedNicknames[threadID]) {
    return api.sendMessage(
      "⚠️ Is group me koi nickname locked nahi hai",
      threadID,
      messageID
    );
  }

  delete lockedNicknames[threadID];

  return api.sendMessage(
`🔓 𝗡𝗜𝗖𝗞𝗡𝗔𝗠𝗘 𝗨𝗡𝗟𝗢𝗖𝗞𝗘𝗗

🧹 Is group ke sabhi locked nicknames remove ho gaye

✅ System Disabled Successfully`,
    threadID,
    messageID
  );
}

else if (cmd === "groupuid") {
await humanDelay();
api.sendMessage(`🆔 Group UID: ${threadID}`, threadID, messageID);
}

else if (cmd === "allnickname") {
await humanDelay(4000, 7000);
const info = await api.getThreadInfo(threadID);
for (const uid of info.participantIDs) {
await api.changeNickname(input, threadID, uid);
await new Promise(r => setTimeout(r, 30000));
}
}

else if (cmd === "groupname") {
await humanDelay();
await api.setTitle(input, threadID);
}

else if (cmd === "lockgroupname") {
await humanDelay(2500, 5000);
lockedGroupNames[threadID] = input;
await api.setTitle(input, threadID);
await api.sendMessage("Groupname Locked 🔒 Successfully", threadID, messageID);
}

else if (cmd === "unlockgroupname") {
await humanDelay(2000, 4000);
delete lockedGroupNames[threadID];
await api.sendMessage("Groupname Unlocked 🔓 Successfully", threadID, messageID);
}

else if (cmd === "exit") {
await humanDelay(3000, 6000);
await api.removeUserFromGroup(api.getCurrentUserID(), threadID);
}

else if (cmd === "loderstart") {
  await humanDelay(4000, 7000);

  const lines = fs.readFileSync("np.txt", "utf8")
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  if (!lines.length)
    return api.sendMessage("❌ np.txt empty hai", threadID);

  // 🔥 OLD LOADER STOP
  if (loaderState.interval) {
    clearInterval(loaderState.interval);
    loaderState.interval = null;
  }

  loaderState.stop = false;

  await api.sendMessage("Loder Started Successfully", threadID, messageID);

  let i = 0;

  loaderState.interval = setInterval(() => {

    if (loaderState.stop) {
      clearInterval(loaderState.interval);
      loaderState.interval = null;
      return;
    }

    api.sendMessage(`${input} ${lines[i]}`, threadID);

    i++;
    if (i >= lines.length) i = 0;

  }, 60000);
}

else if (cmd === "loderstop") {
  await humanDelay(2500, 4500);

  loaderState.stop = true;

  if (loaderState.interval) {
    clearInterval(loaderState.interval);
    loaderState.interval = null;
  }

  await api.sendMessage(
    "🛑 Loder Stopped Successfully",
    threadID,
    messageID
  );
}

else if (cmd === "target") {
await humanDelay(3000, 5000);
  const uid = args[1];
  if (!uid) {
    return api.sendMessage(
      "❌ Usage: $target <uid>",
      threadID,
      messageID
    );
  }

  activeTargets.add(uid);

  try {
    const info = await api.getUserInfo(uid);
    const name = info[uid]?.name || "Unknown";

    await api.sendMessage(
`🎯 Target Added Successfully

👤 Name : ${name}
🆔 UID  : ${uid}

📌 Total Targets : ${activeTargets.size}`,
      threadID,
      messageID
    );
  } catch {
    await api.sendMessage(
`🎯 Target Added Successfully
🆔 UID : ${uid}

📌 Total Targets : ${activeTargets.size}`,
      threadID,
      messageID
    );
  }
}

else if (cmd === "cleartarget") {
  await humanDelay(2000, 4000);

  activeTargets.clear();

  // 🔥 QUEUES FORCE STOP
  for (const uid in messageQueues) {
    messageQueues[uid] = [];
    queueRunning[uid] = false;
  }

  await api.sendMessage(
    "🧹 All Targets & Queues Cleared Successfully",
    threadID,
    messageID
  );
} // ✅ <<< YE MISSING THA

else if (cmd === "mycommands") {
  await humanDelay();

  try {
    await api.sendMessage(
`🤖 𝗕𝗢𝗧 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦

━━━━━━━━━━━━━━━━
👤 𝗨𝗦𝗘𝗥 𝗜𝗡𝗙𝗢

$uid (reply pe)
$whois (reply)
$groupuid

━━━━━━━━━━━━━━━━
👥 𝗚𝗥𝗢𝗨𝗣 𝗖𝗢𝗡𝗧𝗥𝗢𝗟

$groupname <name>
$lockgroupname <name>
$unlockgroupname
$exit

━━━━━━━━━━━━━━━━
⚙️ 𝗦𝗬𝗦𝗧𝗘𝗠 𝗖𝗢𝗡𝗧𝗥𝗢𝗟

$loderstart <text>
$loderstop
$target <uid>
$cleartarget

━━━━━━━━━━━━━━━━
✨ Prefix : $
👑 Owner Only Commands`,
      threadID,
      messageID
    );
  } catch (err) {
    console.log("Error sending $mycommands:", err.message);
  }
}

}