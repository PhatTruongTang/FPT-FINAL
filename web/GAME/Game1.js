const canvas = document.getElementById("flappyCanvas"); // Lấy phần tử canvas có id là "flappyCanvas"
const ctx = canvas.getContext("2d"); // Lấy ngữ cảnh 2D để vẽ lên canvas

function resizeCanvas() {
  canvas.width = window.innerWidth; // Đặt chiều rộng canvas bằng chiều rộng cửa sổ trình duyệt
  canvas.height = window.innerHeight; // Đặt chiều cao canvas bằng chiều cao cửa sổ trình duyệt
}
window.addEventListener('resize', resizeCanvas); // Khi thay đổi kích thước cửa sổ, gọi hàm resizeCanvas
resizeCanvas(); // Gọi hàm resizeCanvas lần đầu để khởi tạo kích thước canvas

// Tải ảnh chim
const birdImage = new Image(); // Tạo đối tượng hình ảnh mới
birdImage.src = "Chim.jpg"; // Đặt đường dẫn ảnh cho đối tượng chim

// Khởi tạo đối tượng chim
const bird = {
  x: 80, // Vị trí ngang ban đầu của chim
  y: 150, // Vị trí dọc ban đầu của chim
  width: 55, // Chiều rộng của chim
  height: 55, // Chiều cao của chim
  gravity: 1.2, // Trọng lực kéo chim xuống
  lift: -15, // Lực nâng chim khi bay lên
  velocity: 0, // Tốc độ hiện tại của chim
  draw() {
    ctx.drawImage(birdImage, this.x, this.y, this.width, this.height); // Vẽ hình chim lên canvas
  },
  update() {
    this.velocity += this.gravity; // Cập nhật tốc độ do trọng lực
    this.y += this.velocity; // Cập nhật vị trí y theo tốc độ

    if (this.y + this.height > canvas.height) { // Nếu chim chạm đất
      this.y = canvas.height - this.height; // Giữ chim ở sát mép dưới
      this.velocity = 0; // Dừng chuyển động
    }
    if (this.y < 0) { // Nếu chim bay quá đầu màn hình
      this.y = 0; // Giữ chim ở sát mép trên
      this.velocity = 0; // Dừng chuyển động
    }
  },
  flap() {
    this.velocity = this.lift; // Khi chim vỗ cánh thì thay đổi vận tốc để bay lên
  }
};

const pipes = []; // Mảng chứa các ống nước
const pipeWidth = 50; // Chiều rộng của mỗi ống
const gap = 140; // Khoảng cách giữa 2 ống (trên và dưới)
const pipeSpeed = 5; // Tốc độ di chuyển của ống

let frame = 0; // Biến đếm khung hình để tạo ống định kỳ
let score = 0; // Điểm số
let gameOver = false; // Trạng thái kết thúc game

function drawPipe(pipe) {
  ctx.fillStyle = "green"; // Màu ống
  ctx.fillRect(pipe.x, 0, pipeWidth, pipe.top); // Vẽ ống trên
  ctx.fillRect(pipe.x, pipe.top + gap, pipeWidth, canvas.height - pipe.top - gap); // Vẽ ống dưới
}

function updatePipes() {
  if (frame % 80 === 0) { // Cứ mỗi 80 khung thì tạo 1 ống mới
    const minPipeHeight = 60; // Chiều cao tối thiểu của ống trên
    const top = Math.random() * (canvas.height - gap - minPipeHeight * 2) + minPipeHeight; // Tạo chiều cao ngẫu nhiên cho ống trên
    pipes.push({ x: canvas.width, top, scored: false }); // Thêm ống mới vào mảng
  }

  for (let i = 0; i < pipes.length; i++) {
    const pipe = pipes[i];
    pipe.x -= pipeSpeed; // Di chuyển ống về bên trái

    // Kiểm tra va chạm giữa chim và ống
    if (
      bird.x < pipe.x + pipeWidth &&
      bird.x + bird.width > pipe.x &&
      (bird.y < pipe.top || bird.y > pipe.top + gap)
    ) {
      gameOver = true; // Nếu va chạm thì kết thúc game
    }

    if (!pipe.scored && pipe.x + pipeWidth < bird.x) {
      score++; // Cộng điểm nếu chim đã vượt qua ống
      pipe.scored = true; // Đánh dấu đã cộng điểm
    }
  }
}

function drawScore() {
  ctx.fillStyle = "black"; // Màu chữ
  ctx.font = "24px Arial"; // Font chữ
  ctx.fillText("Điểm: " + score, 20, 40); // Hiển thị điểm số ở góc trái
}

function gameLoop() {
  if (gameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; // Vẽ nền mờ khi kết thúc
    ctx.fillRect(0, 0, canvas.width, canvas.height); // Phủ nền
    ctx.fillStyle = "white"; // Màu chữ
    ctx.font = "40px Arial"; // Font chữ to
    ctx.fillText("Game Over!", canvas.width / 2 - 120, canvas.height / 2 - 20); // Thông báo thua
    ctx.font = "30px Arial"; 
    ctx.fillText("Điểm: " + score, canvas.width / 2 - 50, canvas.height / 2 + 30); // Hiển thị điểm
    ctx.font = "20px Arial"; 
    ctx.fillText("Nhấn Enter để chơi lại", canvas.width / 2 - 100, canvas.height / 2 + 60); // Hướng dẫn restart
    return; // Dừng vòng lặp game
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height); // Xóa canvas để vẽ lại

  bird.update(); // Cập nhật vị trí chim
  bird.draw(); // Vẽ chim

  updatePipes(); // Cập nhật ống
  pipes.forEach(drawPipe); // Vẽ tất cả các ống

  drawScore(); // Vẽ điểm số

  frame++; // Tăng số khung hình
  requestAnimationFrame(gameLoop); // Gọi lại gameLoop ở khung hình tiếp theo
}

// Nhấn Space để chim bay lên
window.addEventListener("keydown", function (e) {
  if (e.code === "Space") bird.flap(); // Nếu nhấn phím cách thì chim bay

  // Nhấn Enter để reset game khi kết thúc
  if (e.code === "Enter" && gameOver) {
    bird.y = 150; // Reset vị trí chim
    bird.velocity = 0; // Reset vận tốc
    pipes.length = 0; // Xóa ống
    score = 0; // Reset điểm
    frame = 0; // Reset khung hình
    gameOver = false; // Reset trạng thái game
    gameLoop(); // Bắt đầu lại game
  }
});

// Bắt đầu game khi ảnh chim tải xong
birdImage.onload = function () {
  gameLoop(); // Khởi động vòng lặp game
};

document.addEventListener("DOMContentLoaded", function() {
    const audio = document.getElementById('background-audio');
    audio.play().catch(() => {
        document.addEventListener('click', function playOncce() {
            audio.play();
            document.removeEventListener('click', playOnce);
        });
    });
});