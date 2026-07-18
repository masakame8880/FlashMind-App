/* =========================================
   FlashMind Ultimate
   script.js
========================================= */

const mindText = document.getElementById("mind-text");
const speedControls = document.getElementById("speed-controls");
const timerControls = document.getElementById("timer-controls");
const soundButton = document.getElementById("sound-button");
const playButton = document.getElementById("play-button");
const statusText = document.getElementById("status-text");

let cards = [];
let currentIndex = 0;

let displaySpeed = 1000;
let selectedMinutes = 3;

let cardTimer = null;
let sessionTimer = null;
let sessionEndTime = null;

let isPlaying = true;
let soundEnabled = true;
let sessionFinished = false;

const SETTINGS_KEY = "flashmind_settings";


/* -----------------------------------------
   初期化
----------------------------------------- */

async function init() {
  loadSettings();
  updateControlButtons();

  try {
    const response = await fetch("./cards.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("cards.jsonを読み込めませんでした");
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("カードデータがありません");
    }

    cards = shuffleCards(
      data.filter(card => {
        return card && typeof card.text === "string";
      })
    );

    if (cards.length === 0) {
      throw new Error("表示できるカードがありません");
    }

    currentIndex = 0;

    showCurrentCard();
    startSession();

  } catch (error) {
    console.error(error);

    mindText.textContent =
      "カードを読み込めませんでした。";

    statusText.textContent =
      "通信環境とcards.jsonを確認してください。";

    isPlaying = false;
    updatePlayButton();
  }
}


/* -----------------------------------------
   カード表示
----------------------------------------- */

function showCurrentCard() {
  if (!cards.length) return;

  const card = cards[currentIndex];

  mindText.classList.remove("fade-change");

  void mindText.offsetWidth;

  mindText.textContent = card.text;

  mindText.classList.add("fade-change");

  speakCurrentCard();
}


function showNextCard() {
  if (!cards.length || sessionFinished) return;

  currentIndex++;

  if (currentIndex >= cards.length) {
    cards = shuffleCards(cards);
    currentIndex = 0;
  }

  showCurrentCard();
}


/* -----------------------------------------
   自動切り替え
----------------------------------------- */

function startCardTimer() {
  clearInterval(cardTimer);

  if (!isPlaying || sessionFinished) return;

  cardTimer = setInterval(() => {
    showNextCard();
  }, displaySpeed);
}


function stopCardTimer() {
  clearInterval(cardTimer);
  cardTimer = null;
}


/* -----------------------------------------
   セッションタイマー
----------------------------------------- */

function startSession() {
  clearInterval(sessionTimer);

  sessionFinished = false;
  isPlaying = true;

  sessionEndTime =
    Date.now() + selectedMinutes * 60 * 1000;

  startCardTimer();
  updatePlayButton();
  updateStatus();

  sessionTimer = setInterval(() => {
    updateStatus();

    if (Date.now() >= sessionEndTime) {
      finishSession();
    }
  }, 250);
}


function updateStatus() {
  if (sessionFinished) return;

  if (!sessionEndTime) {
    statusText.textContent =
      `${selectedMinutes}分間の再生`;
    return;
  }

  const remaining =
    Math.max(0, sessionEndTime - Date.now());

  const totalSeconds =
    Math.ceil(remaining / 1000);

  const minutes =
    Math.floor(totalSeconds / 60);

  const seconds =
    String(totalSeconds % 60).padStart(2, "0");

  const state =
    isPlaying ? "再生中" : "一時停止中";

  statusText.textContent =
    `${state}　残り ${minutes}:${seconds}`;
}


function finishSession() {
  sessionFinished = true;
  isPlaying = false;

  stopCardTimer();
  clearInterval(sessionTimer);

  window.speechSynthesis?.cancel();

  mindText.classList.remove("fade-change");

  void mindText.offsetWidth;

  mindText.innerHTML =
    "今日もお疲れさまでした。<br>また続けていきましょう。";

  mindText.classList.add("fade-change");

  statusText.textContent =
    `${selectedMinutes}分間の再生が完了しました`;

  updatePlayButton();
}


/* -----------------------------------------
   速度切り替え
----------------------------------------- */

speedControls.addEventListener("click", event => {
  const button =
    event.target.closest("button[data-speed]");

  if (!button) return;

  displaySpeed =
    Number(button.dataset.speed);

  saveSettings();
  updateControlButtons();

  if (isPlaying && !sessionFinished) {
    startCardTimer();
  }
});


/* -----------------------------------------
   タイマー切り替え
----------------------------------------- */

timerControls.addEventListener("click", event => {
  const button =
    event.target.closest("button[data-minutes]");

  if (!button) return;

  selectedMinutes =
    Number(button.dataset.minutes);

  saveSettings();
  updateControlButtons();

  startSession();
});


/* -----------------------------------------
   一時停止・再開
----------------------------------------- */

playButton.addEventListener("click", () => {
  if (sessionFinished) {
    currentIndex = 0;
    showCurrentCard();
    startSession();
    return;
  }

  isPlaying = !isPlaying;

  if (isPlaying) {
    startCardTimer();
  } else {
    stopCardTimer();
  }

  updatePlayButton();
  updateStatus();
});


function updatePlayButton() {
  if (sessionFinished) {
    playButton.textContent =
      "▶ もう一度再生";
    return;
  }

  playButton.textContent =
    isPlaying
      ? "⏸ 一時停止"
      : "▶ 再開";
}


/* -----------------------------------------
   音声読み上げ
----------------------------------------- */

soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;

  if (!soundEnabled) {
    window.speechSynthesis?.cancel();
  } else {
    speakCurrentCard();
  }

  saveSettings();
  updateSoundButton();
});


function speakCurrentCard() {
  if (
    !soundEnabled ||
    sessionFinished ||
    !("speechSynthesis" in window)
  ) {
    return;
  }

  /*
    読み上げ中の音声は途中で切らない。
    読み終わった時点で、現在画面に出ている
    最新の文章を次に読み上げる。
  */

  if (window.speechSynthesis.speaking) {
    return;
  }

  speakText(mindText.textContent);
}


function speakText(text) {
  if (
    !soundEnabled ||
    !text ||
    sessionFinished
  ) {
    return;
  }

  const spokenText = text;

  const utterance =
    new SpeechSynthesisUtterance(spokenText);

  utterance.lang = "ja-JP";
  utterance.rate = 1.35;
  utterance.pitch = 1;
  utterance.volume = 1;

  utterance.onend = () => {
    if (
      soundEnabled &&
      isPlaying &&
      !sessionFinished
    ) {
      const latestText =
        mindText.textContent;

      if (latestText) {
        setTimeout(() => {
          speakText(latestText);
        }, 150);
      }
    }
  };

  utterance.onerror = event => {
    console.error(
      "Speech error:",
      event.error
    );
  };

  window.speechSynthesis.speak(
    utterance
  );
}


function updateSoundButton() {
  soundButton.textContent =
    soundEnabled
      ? "🔊 音声ON"
      : "🔇 音声OFF";
}


/* -----------------------------------------
   選択ボタン表示
----------------------------------------- */

function updateControlButtons() {
  document
    .querySelectorAll(
      "#speed-controls button"
    )
    .forEach(button => {
      button.classList.toggle(
        "active",
        Number(button.dataset.speed) ===
          displaySpeed
      );
    });

  document
    .querySelectorAll(
      "#timer-controls button"
    )
    .forEach(button => {
      button.classList.toggle(
        "active",
        Number(button.dataset.minutes) ===
          selectedMinutes
      );
    });

  updateSoundButton();
  updatePlayButton();
}


/* -----------------------------------------
   設定保存
----------------------------------------- */

function saveSettings() {
  const settings = {
    displaySpeed,
    selectedMinutes,
    soundEnabled
  };

  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify(settings)
  );
}


function loadSettings() {
  try {
    const saved =
      localStorage.getItem(SETTINGS_KEY);

    if (!saved) return;

    const settings =
      JSON.parse(saved);

    if (
      [500, 1000, 1500].includes(
        settings.displaySpeed
      )
    ) {
      displaySpeed =
        settings.displaySpeed;
    }

    if (
      [1, 3, 5].includes(
        settings.selectedMinutes
      )
    ) {
      selectedMinutes =
        settings.selectedMinutes;
    }

    if (
      typeof settings.soundEnabled ===
      "boolean"
    ) {
      soundEnabled =
        settings.soundEnabled;
    }

  } catch (error) {
    console.error(
      "設定の読み込みに失敗しました:",
      error
    );
  }
}


/* -----------------------------------------
   シャッフル
----------------------------------------- */

function shuffleCards(array) {
  const result = [...array];

  for (
    let i = result.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    [
      result[i],
      result[j]
    ] = [
      result[j],
      result[i]
    ];
  }

  return result;
}


/* -----------------------------------------
   アプリ開始
----------------------------------------- */

init();
