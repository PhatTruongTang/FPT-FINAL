let money = parseInt(localStorage.getItem('money')) || 0;
let power = parseInt(localStorage.getItem('power')) || 1;
let autoClick = parseInt(localStorage.getItem('autoClick')) || 0;
let autoPower = parseInt(localStorage.getItem('autoPower')) || 1;
let autoInterval = parseInt(localStorage.getItem('autoInterval')) || 1000; // ms
let clickPrice = parseInt(localStorage.getItem('clickPrice')) || 50;
let autoPrice = parseInt(localStorage.getItem('autoPrice')) || 200;
let autoPowerPrice = parseInt(localStorage.getItem('autoPowerPrice')) || 300;
let boostActive = false;

let autoClickTimer = null;

const skins = [
    { name: "Normal Skibidi", img: "images/NormalSkibidi.png", price: 0, owned: true },
    { name: "Big Skibidi", img: "images/Bigskibidi.png", price: 500, owned: false },
    { name: "GMAN Toilet", img: "images/Gmantoilet.png", price: 1000, owned: false },
    { name: "Soldier Skibidi", img: "images/SoldierSkibidi.png", price: 1500, owned: false }
];

const moneyEl = document.getElementById('money');
const powerEl = document.getElementById('power');
const autoEl = document.getElementById('auto');
const toilet = document.getElementById('toilet');
const clickPriceEl = document.getElementById('clickPrice');
const autoPriceEl = document.getElementById('autoPrice');
const autoPowerPriceEl = document.getElementById('autoPowerPrice');
const skinList = document.getElementById('skinList');
const boostStatus = document.getElementById('boost-status');
const upgradeAutoPowerBtn = document.getElementById('upgradeAutoPower');

const baseClickSound = new Audio('click2.mp3');
const baseClickSound = new Audio('click.mp3');
baseClickSound.volume = 0.5;

function triggerClickEffect(x, y, earn, volume = 0.5) {
    createParticle(x, y, earn);
    toilet.classList.remove('toilet-zoom');
    void toilet.offsetWidth;
    toilet.classList.add('toilet-zoom');
    setTimeout(() => toilet.classList.remove('toilet-zoom'), 100);
    const sound = baseClickSound.cloneNode();
    sound.volume = volume;
    sound.play();
}

toilet.addEventListener('click', (e) => {
    let earn = power;
    if (boostActive) earn *= 2;
    money += earn;
    triggerClickEffect(e.clientX, e.clientY, earn, 0.5);
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 100);
    updateUI();
    saveGame();
});

function saveGame() {
    localStorage.setItem('money', money);
    localStorage.setItem('power', power);
    localStorage.setItem('autoClick', autoClick);
    localStorage.setItem('autoPower', autoPower);
    localStorage.setItem('autoInterval', autoInterval);
    localStorage.setItem('clickPrice', clickPrice);
    localStorage.setItem('autoPrice', autoPrice);
    localStorage.setItem('autoPowerPrice', autoPowerPrice);
    localStorage.setItem('skins', JSON.stringify(skins));
}

function createParticle(x, y, text) {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    particle.textContent = `+${text}`;
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    document.body.appendChild(particle);
    particle.addEventListener('animationend', () => particle.remove());
}

function renderSkins() {
    skinList.innerHTML = "";
    skins.forEach((skin) => {
        const btn = document.createElement('button');
        btn.classList.add('skin-btn');
        btn.textContent = skin.owned ? `${skin.name} (OWNED)` : `${skin.name} (${skin.price}💰)`;
        btn.addEventListener('click', () => {
            if (!skin.owned && money >= skin.price) {
                money -= skin.price;
                skin.owned = true;
                updateUI();
                saveGame();
                renderSkins();
            } else if (skin.owned) {
                toilet.src = skin.img;
            }
        });
        skinList.appendChild(btn);
    });
}

document.getElementById('upgradeClick').addEventListener('click', () => {
    if (money >= clickPrice) {
        money -= clickPrice;
        power++;
        clickPrice = Math.floor(clickPrice * 1.5);
        updateUI();
        saveGame();
    }
});

document.getElementById('buyAuto').addEventListener('click', () => {
    if (money >= autoPrice) {
        money -= autoPrice;
        autoClick++;
        autoPrice = Math.floor(autoPrice * 1.5);
        startAutoClick();
        updateUI();
        saveGame();
    }
});

upgradeAutoPowerBtn.addEventListener('click', () => {
    if (money >= autoPowerPrice && autoClick > 0) {
        money -= autoPowerPrice;
        autoPower++;
        autoPowerPrice = Math.floor(autoPowerPrice * 1.6);

        // Giảm thời gian bắn xuống 100ms mỗi lần, tối đa 200ms
        autoInterval = Math.max(200, autoInterval - 100);
        startAutoClick();

        updateUI();
        saveGame();
    }
});

document.getElementById('boost').addEventListener('click', () => {
    if (!boostActive && money >= 1000) {
        money -= 1000;
        boostActive = true;
        updateUI();
        setTimeout(() => {
            boostActive = false;
            updateUI();
        }, 30000);
    }
});

function startAutoClick() {
    if (autoClickTimer) clearInterval(autoClickTimer);
    if (autoClick > 0) {
        autoClickTimer = setInterval(() => {
            let earn = autoClick * autoPower * (boostActive ? 2 : 1);
            money += earn;
            const rect = toilet.getBoundingClientRect();
            triggerClickEffect(rect.left + rect.width / 2, rect.top + rect.height / 2, earn, 0.3);
            updateUI();
            saveGame();
        }, autoInterval);
    }
}

if (localStorage.getItem('skins')) {
    const savedSkins = JSON.parse(localStorage.getItem('skins'));
    skins.forEach((s, i) => skins[i].owned = savedSkins[i].owned);
}

function updateUI() {
    moneyEl.textContent = money;
    powerEl.textContent = power;
    autoEl.textContent = `${autoClick} × ${autoPower} (${autoInterval}ms)`;
    clickPriceEl.textContent = clickPrice;
    autoPriceEl.textContent = autoPrice;
    autoPowerPriceEl.textContent = autoPowerPrice;
    boostStatus.textContent = boostActive ? "Bật" : "Tắt";
    upgradeAutoPowerBtn.style.display = (autoClick > 0) ? 'inline-block' : 'none';
}

renderSkins();
updateUI();
startAutoClick();
