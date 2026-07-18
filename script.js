const app = document.getElementById("app");

let cards = [];
let currentIndex = 0;
let timer = null;

async function loadCards() {
  try {
    const response = await fetch("./cards.json");

    if (!response.ok) {
      throw new Error("カードを読み込めませんでした");
    }

    cards = await response.json();

    if (!Array.isArray(cards) || cards.length === 0) {
      throw new Error("カードがありません");
    }

    shuffleCards();
    showCard();
    startAutoPlay();
  } catch (error) {
    app.innerHTML = `
      <h1>FlashMind</h1>
      <p>カードの読み込みに失敗しました。</p>
    `;

    console.error(error);
  }
}

function shuffleCards() {
  cards.sort(() => Math.random() - 0.5);
}

function showCard() {
  const card = cards[currentIndex];

  app.innerHTML = `
    <h1>FlashMind</h1>
    <p>${card.text}</p>
    <button id="next-button" type="button">次の言葉</button>
  `;

  document
    .getElementById("next-button")
    .addEventListener("click", showNextCard);
}

function showNextCard() {
  currentIndex = (currentIndex + 1) % cards.length;
  showCard();
  restartAutoPlay();
}

function startAutoPlay() {
  timer = setInterval(() => {
    currentIndex = (currentIndex + 1) % cards.length;
    showCard();
  }, 5000);
}

function restartAutoPlay() {
  clearInterval(timer);
  startAutoPlay();
}

loadCards();
