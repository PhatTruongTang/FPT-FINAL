const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Tạo tần số từ tên nốt (Equal Temperament, A4 = 440Hz)
function getNoteFreq(note) {
  const A4 = 440;
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const key = note.slice(0, -1);
  const octave = parseInt(note.slice(-1));
  const noteIndex = notes.indexOf(key);
  const noteNumber = noteIndex + octave * 12;
  const a4Number = notes.indexOf("A") + 4 * 12;
  return A4 * Math.pow(2, (noteNumber - a4Number) / 12);
}

function playFreq(freq) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1);
  osc.stop(audioCtx.currentTime + 1);
}

function playNote(note) {
  const freq = getNoteFreq(note);
  playFreq(freq);
}

// Bấm chuột
document.querySelectorAll(".key").forEach(key => {
  key.addEventListener("click", () => {
    playNote(key.dataset.note);
  });
});

// Bấm phím (chỉ để phát âm)
document.addEventListener("keydown", (e) => {
  const key = e.key.toUpperCase();
  const match = document.querySelector(`.key[data-key="${key}"]`);
  if (match) {
    playNote(match.dataset.note);
    match.classList.add("active");
  }
});

document.addEventListener("keyup", (e) => {
  const key = e.key.toUpperCase();
  const match = document.querySelector(`.key[data-key="${key}"]`);
  if (match) {
    match.classList.remove("active");
  }
});

// Piano Tiles: Twinkle Twinkle
const twinkleNotes = ['C', 'C', 'G', 'G', 'A', 'A', 'G', 'F', 'F', 'E', 'E', 'D', 'D', 'C'];
const twinkleTimings = twinkleNotes.map((_, i) => i * 1000); // mỗi nốt cách nhau 1 giây
const noteToKeyIndex = {
  'C': 0,
  'D': 1,
  'E': 2,
  'F': 3,
  'G': 4,
  'A': 5,
  'B': 6
};

const keyWidth = 70;
let highScore = 0;
let score = 0;

const noteSounds = {};
['C', 'D', 'E', 'F', 'G', 'A', 'B'].forEach(note => {
  const audio = new Audio(`sounds/${note}.mp3`);
  noteSounds[note] = audio;
});

window.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startTwinkle");
  const container = document.querySelector(".falling-notes-container");
  const scoreDisplay = document.getElementById("score");

  const highScoreDisplay = document.createElement("div");
  highScoreDisplay.textContent = `High Score: ${highScore}`;
  highScoreDisplay.className = "score-board";
  document.body.insertBefore(highScoreDisplay, container);

  startBtn.addEventListener("click", () => {
    score = 0;
    scoreDisplay.textContent = score;
    container.innerHTML = "";

    twinkleNotes.forEach((note, index) => {
      setTimeout(() => {
        spawnFallingNote(note);
      }, twinkleTimings[index]);
    });
  });

  function spawnFallingNote(note) {
    const div = document.createElement("div");
    div.className = "note-block";
    div.textContent = note;

    const index = noteToKeyIndex[note];
    if (index === undefined) return;
    div.style.left = `${index * keyWidth + 15}px`;
    div.style.top = "0px";

    container.appendChild(div);
    let y = 0;
    const speed = 2;
    const interval = setInterval(() => {
      y += speed;
      div.style.top = `${y}px`;
      if (y > 400) {
        clearInterval(interval);
        div.remove();
      }
    }, 16);

    div.dataset.note = note;
    div.dataset.hit = "false";
    div.dataset.intervalId = interval;
  }

  // Ánh xạ phím A–J sang nốt nhạc
  const keyToNote = {
    A: "C",
    S: "D",
    D: "E",
    F: "F",
    G: "G",
    H: "A",
    J: "B"
  };

  // Xử lý tính điểm khi bấm phím đúng
  document.addEventListener("keydown", (e) => {
    const key = e.key.toUpperCase();
    const noteFromKey = keyToNote[key];
    if (!noteFromKey) return;

    const blocks = document.querySelectorAll(".note-block");

    blocks.forEach(block => {
      const note = block.dataset.note;
      const y = parseInt(block.style.top);
      if (note === noteFromKey && block.dataset.hit === "false" && y >= 150 && y <= 650) {
        block.dataset.hit = "true";
        score++;
        scoreDisplay.textContent = score;
        if (score > highScore) {
          highScore = score;
        }
        block.remove();
      }
    });
  });
});
