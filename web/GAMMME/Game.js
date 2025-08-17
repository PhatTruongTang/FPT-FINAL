const canvas = document.getElementById("gameCanvas"); // Lấy thẻ canvas từ HTML
const ctx = canvas.getContext("2d"); // Lấy ngữ cảnh vẽ 2D từ canvas

canvas.width = 800; // Đặt chiều rộng canvas là 800px
canvas.height = 600; // Đặt chiều cao canvas là 600px

const keys = {}; // Khởi tạo object để lưu phím đang được nhấn

const playerImg = new Image(); // Tạo đối tượng ảnh cho máy bay
playerImg.src = "Maybay.jpg"; // Gán đường dẫn ảnh cho máy bay

const player = { // Tạo đối tượng người chơi (máy bay)
  x: 400, // Vị trí ngang ban đầu (chính giữa)
  y: 500, // Vị trí dọc ban đầu (gần cuối màn hình)
  width: 50, // Chiều rộng máy bay
  height: 50, // Chiều cao máy bay
  speed: 5, // Tốc độ di chuyển
  color: "#0ff" // Màu máy bay (dự phòng nếu không có hình)
};

let bullets = []; // Mảng lưu các viên đạn
let enemies = []; // Mảng lưu các kẻ địch
let powerUps = []; // Mảng lưu các vật phẩm hỗ trợ
let poweredUp = false; // Cờ kiểm tra người chơi có đang ở trạng thái mạnh lên không
let powerUpTime = 0; // Thời điểm ăn vật phẩm hỗ trợ
let score = 0; // Điểm số người chơi
let gameOver = false; // Kiểm tra trò chơi đã kết thúc chưa
let startTime = Date.now(); // Lưu thời gian bắt đầu trò chơi

function drawPlayer() {
  if (playerImg.complete && playerImg.naturalWidth !== 0) { // Kiểm tra ảnh đã tải thành công
    ctx.drawImage(playerImg, player.x, player.y, player.width, player.height); // Vẽ ảnh máy bay
  } else {
    ctx.fillStyle = player.color; // Dùng màu dự phòng
    ctx.fillRect(player.x, player.y, player.width, player.height); // Vẽ hình chữ nhật thay thế
  }
}

function drawBullets() {
  bullets.forEach(bullet => { // Lặp qua từng viên đạn
    ctx.fillStyle = bullet.color || "#f00"; // Chọn màu đạn
    switch (bullet.shape) {
      case "circle": // Nếu là đạn tròn
        ctx.beginPath();
        ctx.arc(bullet.x + bullet.width / 2, bullet.y + bullet.height / 2, bullet.width / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "triangle": // Nếu là đạn tam giác
        ctx.beginPath();
        ctx.moveTo(bullet.x + bullet.width / 2, bullet.y);
        ctx.lineTo(bullet.x, bullet.y + bullet.height);
        ctx.lineTo(bullet.x + bullet.width, bullet.y + bullet.height);
        ctx.closePath();
        ctx.fill();
        break;
      default: // Mặc định là hình chữ nhật
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    }
  });
}

function drawEnemies() {
  ctx.fillStyle = "#0f0"; // Màu xanh lá cho kẻ địch
  enemies.forEach(enemy => {
    ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height); // Vẽ từng kẻ địch
  });
}

function updateBullets() {
  bullets = bullets.filter(bullet => { // Giữ lại những viên đạn còn nằm trong màn hình
    bullet.x += bullet.speedX || 0; // Di chuyển ngang nếu có
    bullet.y += bullet.speedY || -bullet.speed || -7; // Di chuyển lên nếu không có hướng riêng
    return bullet.y + bullet.height >= 0 &&
           bullet.x >= 0 &&
           bullet.x <= canvas.width &&
           bullet.y <= canvas.height; // Kiểm tra đạn còn trong canvas
  });
}

function updateEnemies() {
  enemies.forEach((enemy, i) => {
    enemy.y += enemy.speed; // Cho kẻ địch rơi xuống

    // Kiểm tra va chạm với người chơi
    if (
      enemy.x < player.x + player.width &&
      enemy.x + enemy.width > player.x &&
      enemy.y < player.y + player.height &&
      enemy.y + enemy.height > player.y
    ) {
      gameOver = true; // Va chạm thì kết thúc trò chơi
    }

    // Kiểm tra va chạm với đạn
    bullets.forEach((bullet, j) => {
      if (
        bullet.x < enemy.x + enemy.width &&
        bullet.x + bullet.width > enemy.x &&
        bullet.y < enemy.y + enemy.height &&
        bullet.y + bullet.height > enemy.y
      ) {
        enemies.splice(i, 1); // Xóa kẻ địch
        bullets.splice(j, 1); // Xóa viên đạn
        score += 10; // Cộng điểm
      }
    });
  });
}

function spawnEnemies() {
  const elapsedMinutes = (Date.now() - startTime) / 60000; // Tính số phút đã chơi
  const enemyCount = Math.min(5, Math.floor(elapsedMinutes) + 1); // Số lượng kẻ địch sinh ra
  for (let i = 0; i < enemyCount; i++) {
    const x = Math.random() * (canvas.width - 40); // Vị trí ngẫu nhiên
    enemies.push({
      x,
      y: -50, // Bắt đầu từ ngoài màn hình
      width: 40,
      height: 40,
      speed: 2 + Math.random() * 2 + elapsedMinutes // Tăng tốc độ theo thời gian
    });
  }
}

function spawnPowerUp() {
  const x = Math.random() * (canvas.width - 40); // Vị trí ngẫu nhiên
  powerUps.push({
    x,
    y: -40, // Bắt đầu từ trên rơi xuống
    width: 40,
    height: 40,
    speed: 2 // Tốc độ rơi
  });
}

function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height); // Xóa canvas

  if (gameOver) { // Nếu thua
    ctx.fillStyle = "white";
    ctx.font = "40px Arial";
    ctx.fillText("Game Over", canvas.width / 2 - 100, canvas.height / 2 - 20);
    ctx.font = "20px Arial";
    ctx.fillText("Score: " + score, canvas.width / 2 - 40, canvas.height / 2 + 10);
    ctx.fillText("Press Enter to Restart", canvas.width / 2 - 100, canvas.height / 2 + 40);
    return; // Không vẽ tiếp nữa
  }

  if (keys["a"]) player.x -= player.speed; // Di chuyển trái
  if (keys["d"]) player.x += player.speed; // Di chuyển phải
  if (keys["w"]) player.y -= player.speed; // Di chuyển lên
  if (keys["s"]) player.y += player.speed; // Di chuyển xuống

  player.x = Math.max(0, Math.min(canvas.width - player.width, player.x)); // Giới hạn trong màn hình
  player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));

  drawPlayer(); // Vẽ người chơi
  drawBullets(); // Vẽ đạn
  drawEnemies(); // Vẽ kẻ địch
  updateBullets(); // Cập nhật đạn
  updateEnemies(); // Cập nhật kẻ địch

  // Cập nhật power-up
  ctx.fillStyle = "#ff69b4"; // Màu hồng cho vật phẩm
  powerUps.forEach((pu, index) => {
    pu.y += pu.speed; // Rơi xuống
    ctx.fillRect(pu.x, pu.y, pu.width, pu.height); // Vẽ hình

    // Kiểm tra va chạm với người chơi
    if (
      pu.x < player.x + player.width &&
      pu.x + pu.width > player.x &&
      pu.y < player.y + player.height &&
      pu.y + pu.height > player.y
    ) {
      powerUps.splice(index, 1); // Xóa vật phẩm
      poweredUp = true; // Bật trạng thái mạnh
      powerUpTime = Date.now(); // Ghi lại thời điểm
      player.width += 10; // Tăng kích thước
      player.height += 10;
    }
  });

  // Hết thời gian power-up (10s)
  if (poweredUp && Date.now() - powerUpTime > 10000) {
    poweredUp = false;
    player.width = 50; // Trở lại bình thường
    player.height = 50;
  }

  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.fillText("Score: " + score, 10, 30); // Hiển thị điểm

  requestAnimationFrame(update); // Gọi lại hàm update liên tục (vòng lặp game)
}

document.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true; // Ghi nhận phím đang được nhấn

  if (e.key === "Enter" && gameOver) { // Nhấn Enter khi thua để chơi lại
    player.x = 400;
    player.y = 500;
    bullets = [];
    enemies = [];
    powerUps = [];
    score = 0;
    gameOver = false;
    poweredUp = false;
    player.width = 50;
    player.height = 50;
    startTime = Date.now();
    update(); // Bắt đầu lại game
  }
});

document.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false; // Khi thả phím ra thì gán false
});

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0 && !gameOver) { // Nhấn chuột trái và game chưa kết thúc
    const bulletColors = ["#f00", "#0f0", "#00f", "#ff0", "#f0f", "#0ff"]; // Màu đạn
    const bulletShapes = ["square", "circle", "triangle"]; // Hình dạng đạn
    const directions = poweredUp
      ? [ // Nếu có power-up thì bắn nhiều đạn
          { dx: 0, dy: -7 },
          { dx: 3, dy: -7 },
          { dx: -3, dy: -7 },
          { dx: 5, dy: -5 },
          { dx: -5, dy: -5 },
          { dx: 0, dy: -10 },
        ]
      : [{ dx: 0, dy: -7 }]; // Nếu không thì bắn 1 viên

    const elapsedTime = Date.now() - powerUpTime;
    const bulletLimit = poweredUp && elapsedTime > 15000 ? 3 : directions.length; // Giới hạn số đạn

    directions.slice(0, bulletLimit).forEach((dir, i) => {
      bullets.push({ // Tạo viên đạn mới
        x: player.x + player.width / 2 - 5,
        y: player.y,
        width: 10,
        height: 10,
        speedX: dir.dx,
        speedY: dir.dy,
        color: bulletColors[i % bulletColors.length],
        shape: poweredUp ? bulletShapes[i % bulletShapes.length] : "square"
      });
    });
  }
});

setInterval(spawnEnemies, 1000); // Tạo kẻ địch mỗi 1 giây
setInterval(spawnPowerUp, 7000); // Tạo vật phẩm mỗi 7 giây
update(); // Bắt đầu trò chơi

document.addEventListener("DOMContentLoaded", function() {
    const audio = document.getElementById('background-audio');
    audio.play().catch(() => {
        document.addEventListener('click', function playOncce() {
            audio.play();
            document.removeEventListener('click', playOnce);
        });
    });
});
