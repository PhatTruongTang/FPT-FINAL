const container = document.getElementById("cardContainer");
const levelText = document.getElementById("level");
let level = 1;

function getRandomHue() {
  return Math.floor(Math.random() * 360);
}

function generateCards() {
  container.innerHTML = "";
  levelText.textContent = "Level " + level;

  const baseHue = getRandomHue();
  const lightness = 50;
  const diff = Math.max(15 - level, 1);
  const oddIndex = Math.floor(Math.random() * 4);

  for (let i = 0; i < 4; i++) {
    const card = document.createElement("div");
    card.className = "card";

    if (i === oddIndex) {
      card.style.backgroundColor = `hsl(${baseHue}, 100%, ${lightness + diff}%)`;
      card.onclick = () => {
        level++;
        if (level > 10) {
          alert("🎉 Bạn đã thắng game!");
          level = 1;
        }
        setTimeout(() => generateCards(), 300); // THÊM delay 0.3 giây → mượt
      };
    } else {
      card.style.backgroundColor = `hsl(${baseHue}, 100%, ${lightness}%)`;
      card.onclick = () => {
        alert("💥 Bạn đã chọn sai! Game over!");
        level = 1;
        setTimeout(() => generateCards(), 300); // cũng delay
      };
    }

    container.appendChild(card);
  }
}

generateCards();
