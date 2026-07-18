const mindText = document.getElementById('mind-text');
const speedButtons = [...document.querySelectorAll('[data-speed]')];
const timerButtons = [...document.querySelectorAll('[data-minutes]')];
const soundButton = document.getElementById('sound-button');
const playButton = document.getElementById('play-button');
const statusText = document.getElementById('status-text');

const SETTINGS_KEY = 'flashmind_settings_v2';

let cards = [];
let currentIndex = 0;
let displaySpeed = 1000;
let selectedMinutes = 3;
let soundEnabled = true;
let isPlaying = false;
let sessionFinished = false;
let cardTimer = null;
let sessionTimer = null;
let sessionEndTime = 0;
let remainingWhenPaused = 0;
let speechQueueText = '';

async function init() {
  loadSettings();
  updateControls();

  try {
    const response = await fetch('./cards.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`cards.json: ${response.status}`);

    const data = await response.json();
    cards = shuffle(data.filter(card => card && typeof card.text === 'string' && card.text.trim()));
    if (!cards.length) throw new Error('カードがありません');

    currentIndex = 0;
    showCurrentCard();
    startSession();
  } catch (error) {
    console.error(error);
    mindText.textContent = 'カードを読み込めませんでした。';
    statusText.textContent = 'cards.json を確認してください。';
    playButton.disabled = true;
    soundButton.disabled = true;
  }
}

function showCurrentCard() {
  if (!cards.length) return;
  const text = cards[currentIndex].text.trim();
  mindText.classList.remove('fade-change');
  void mindText.offsetWidth;
  mindText.textContent = text;
  mindText.classList.add('fade-change');
  queueSpeech(text);
}

function nextCard() {
  if (!isPlaying || sessionFinished || !cards.length) return;
  currentIndex = (currentIndex + 1) % cards.length;
  if (currentIndex === 0) cards = shuffle(cards);
  showCurrentCard();
}

function startCardTimer() {
  clearInterval(cardTimer);
  if (!isPlaying || sessionFinished) return;
  cardTimer = setInterval(nextCard, displaySpeed);
}

function startSession() {
  clearInterval(sessionTimer);
  sessionFinished = false;
  isPlaying = true;
  sessionEndTime = Date.now() + selectedMinutes * 60_000;
  remainingWhenPaused = 0;
  startCardTimer();
  sessionTimer = setInterval(tickSession, 250);
  updatePlayButton();
  updateStatus();
}

function tickSession() {
  if (!isPlaying || sessionFinished) return;
  if (Date.now() >= sessionEndTime) {
    finishSession();
  } else {
    updateStatus();
  }
}

function pauseSession() {
  isPlaying = false;
  remainingWhenPaused = Math.max(0, sessionEndTime - Date.now());
  clearInterval(cardTimer);
  updatePlayButton();
  updateStatus();
}

function resumeSession() {
  isPlaying = true;
  sessionEndTime = Date.now() + remainingWhenPaused;
  startCardTimer();
  updatePlayButton();
  updateStatus();
  queueSpeech(mindText.textContent);
}

function finishSession() {
  sessionFinished = true;
  isPlaying = false;
  clearInterval(cardTimer);
  clearInterval(sessionTimer);
  window.speechSynthesis?.cancel();
  speechQueueText = '';

  mindText.classList.remove('fade-change');
  void mindText.offsetWidth;
  mindText.innerHTML = '今日もお疲れさまでした。<br>また続けていきましょう。';
  mindText.classList.add('fade-change');
  statusText.textContent = `${selectedMinutes}分間の再生が完了しました`;
  updatePlayButton();
}

function updateStatus() {
  if (sessionFinished) return;
  const remaining = isPlaying ? Math.max(0, sessionEndTime - Date.now()) : remainingWhenPaused;
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  statusText.textContent = `${isPlaying ? '再生中' : '一時停止中'}　残り ${minutes}:${seconds}`;
}

speedButtons.forEach(button => {
  button.addEventListener('click', () => {
    displaySpeed = Number(button.dataset.speed);
    saveSettings();
    updateControls();
    startCardTimer();
  });
});

timerButtons.forEach(button => {
  button.addEventListener('click', () => {
    selectedMinutes = Number(button.dataset.minutes);
    saveSettings();
    updateControls();
    startSession();
  });
});

playButton.addEventListener('click', () => {
  if (sessionFinished) {
    currentIndex = 0;
    showCurrentCard();
    startSession();
    return;
  }
  if (isPlaying) pauseSession();
  else resumeSession();
});

soundButton.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  if (!soundEnabled) {
    speechQueueText = '';
    window.speechSynthesis?.cancel();
  } else {
    queueSpeech(mindText.textContent);
  }
  saveSettings();
  updateControls();
});

function queueSpeech(text) {
  if (!soundEnabled || !text || sessionFinished || !('speechSynthesis' in window)) return;
  speechQueueText = text;
  if (!window.speechSynthesis.speaking) speakQueuedText();
}

function speakQueuedText() {
  if (!soundEnabled || !speechQueueText || sessionFinished) return;
  const text = speechQueueText;
  speechQueueText = '';
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 1.35;
  utterance.pitch = 1;
  utterance.volume = 1;
  utterance.onend = () => {
    if (soundEnabled && speechQueueText && !sessionFinished) {
      setTimeout(speakQueuedText, 120);
    }
  };
  utterance.onerror = event => console.error('Speech error:', event.error);
  window.speechSynthesis.speak(utterance);
}

function updateControls() {
  speedButtons.forEach(button => {
    button.classList.toggle('active', Number(button.dataset.speed) === displaySpeed);
  });
  timerButtons.forEach(button => {
    button.classList.toggle('active', Number(button.dataset.minutes) === selectedMinutes);
  });
  soundButton.textContent = soundEnabled ? '🔊 音声ON' : '🔇 音声OFF';
  updatePlayButton();
}

function updatePlayButton() {
  if (sessionFinished) playButton.textContent = '▶ もう一度再生';
  else playButton.textContent = isPlaying ? '⏸ 一時停止' : '▶ 再開';
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ displaySpeed, selectedMinutes, soundEnabled }));
}

function loadSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if ([500, 1000, 1500].includes(settings.displaySpeed)) displaySpeed = settings.displaySpeed;
    if ([1, 3, 5].includes(settings.selectedMinutes)) selectedMinutes = settings.selectedMinutes;
    if (typeof settings.soundEnabled === 'boolean') soundEnabled = settings.soundEnabled;
  } catch (error) {
    console.error('設定の読み込みに失敗しました:', error);
  }
}

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

init();
