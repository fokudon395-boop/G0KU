const fs = require("fs");

function getIndianTime() {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true
  });
}

function getDate() {
  return new Date().toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

// 🎨 STYLISH HEADER
function getHeader() {
  return `📅 ${getDate()}\n⏰ ${getIndianTime()}\n\n👥 𝑯𝒆𝒍𝒍𝒐 𝑬𝒗𝒆𝒓𝒚𝒐𝒏𝒆`;
}

// 🌅 GOOD MORNING
function goodMorningMsg() {
  const messages = [
    "🌞 Good Morning! Utho aur aaj kuch bada karo 💪✨",
    "🌼 Suprabhat! Naya din, nayi energy 🔥",
    "☀️ Rise & Shine! Aaj ka din tumhara hai 😎",
    "🌸 Khush raho, haste raho 😊 Good Morning!"
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

// 🌞 AFTERNOON
function goodAfternoonMsg() {
  const messages = [
    "🌤️ Good Afternoon! Thoda relax karo 😌",
    "🍛 Lunch time vibes 😋 Stay fresh!",
    "🌿 Half day done! Keep going 💯",
    "😎 Chill karo aur enjoy karo afternoon"
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

// 🌇 EVENING
function goodEveningMsg() {
  const messages = [
    "🌇 Good Evening! Aaj ka din mast gaya 😍",
    "✨ Shaam ho gayi... relax time 😌",
    "🌆 Enjoy the beautiful evening vibes 💫",
    "🍵 Chai + Shaam = Perfect combo ❤️"
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

// 🌙 NIGHT
function goodNightMsg() {
  const messages = [
    "🌙 Good Night! Sweet dreams 😴✨",
    "💤 Aaj ka din khatam... rest karo 😌",
    "🌌 So jao hero kal fir jeetna hai 💪",
    "😴 Dream big, sleep tight 🌟"
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

// 🚀 MAIN FUNCTION

let lastSentHour = null;

function startAutoGreetings(api) {

  setInterval(async () => {

    try {

      const now = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: false
      });

      const time = now.split(", ")[1]; // HH:MM:SS
      const hour = parseInt(time.split(":")[0]);
      const minute = parseInt(time.split(":")[1]);

      // 🔥 EXACT TIME TRIGGER (minute = 0 only)
      if (minute !== 0 || lastSentHour === hour) return;
      lastSentHour = hour;

      let message = "";

      if (hour === 10) {
        message = `${getHeader()}\n\n🌞 𝙂𝙤𝙤𝙙 𝙈𝙤𝙧𝙣𝙞𝙣𝙜\n${goodMorningMsg()}`;
      }

      else if (hour === 14) {
        message = `${getHeader()}\n\n🌤️ 𝙂𝙤𝙤𝙙 𝘼𝙛𝙩𝙚𝙧𝙣𝙤𝙤𝙣\n${goodAfternoonMsg()}`;
      }

      else if (hour === 18) {
        message = `${getHeader()}\n\n🌆 𝙂𝙤𝙤𝙙 𝙀𝙫𝙚𝙣𝙞𝙣𝙜\n${goodEveningMsg()}`;
      }

      else if (hour === 22) {
        message = `${getHeader()}\n\n🌙 𝙂𝙤𝙤𝙙 𝙉𝙞𝙜𝙝𝙩\n${goodNightMsg()}`;
      }

      if (!message) return;

      // 📥 ALL GROUPS GET
      const threads = await api.getThreadList(100, null, ["INBOX"]);

      for (const thread of threads) {

        if (thread.isGroup) {

          try {
            await api.sendMessage(message, thread.threadID);

            // ⏳ Anti-spam delay
           await new Promise(r => setTimeout(r, 800));
  
          } catch (e) {
            console.log("Send error:", e.message);
          }

        }
      }

    } catch (err) {
      console.log("Auto greeting error:", err.message);
    }

  }, 60 * 1000); // ⏱️ every 1 min check
}

module.exports = { startAutoGreetings };