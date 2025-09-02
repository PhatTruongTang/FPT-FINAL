// === script.js (complete) ===

// === config keys ===
const USERS_KEY = 'demo_users_v1';
const CURRENT_KEY = 'demo_current_user_v1';

// helpers
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

/** convert ArrayBuffer -> hex */
function toHex(buffer){
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join('');
}

/** hash password with SHA-256 (returns hex) */
async function hashPassword(raw) {
  const enc = new TextEncoder();
  const buf = enc.encode(raw);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return toHex(hashBuf);
}

// storage helpers
function loadUsers(){
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }
  catch(e) { return []; }
}
function saveUsers(list){ localStorage.setItem(USERS_KEY, JSON.stringify(list)); }
function saveCurrent(user, remember){
  const { name, email, createdAt } = user;
  const payload = { name, email, createdAt };
  if(remember) localStorage.setItem(CURRENT_KEY, JSON.stringify(payload));
  else sessionStorage.setItem(CURRENT_KEY, JSON.stringify(payload));
}
function clearCurrent(){
  localStorage.removeItem(CURRENT_KEY);
  sessionStorage.removeItem(CURRENT_KEY);
}
function getCurrent(){
  return JSON.parse(sessionStorage.getItem(CURRENT_KEY) || localStorage.getItem(CURRENT_KEY) || 'null');
}

// UI nodes
const wrapper = document.getElementById('authWrapper');
const toRegister = document.getElementById('toRegister');
const toLogin = document.getElementById('toLogin');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginError = document.getElementById('loginError');
const regError = document.getElementById('regError');
const userStatus = document.getElementById('userStatus');
const rememberCheckbox = document.getElementById('rememberMe');

const forgotLink = document.getElementById('forgotLink');
const backToLogin = document.getElementById('backToLogin');
const forgotForm = document.getElementById('forgotForm');
const otpBox = document.getElementById('otpBox');
const sendOtpBtn = document.getElementById('sendOtpBtn');
const resetBtn = document.getElementById('resetBtn');

// OTP storage (in-memory, demo)
const otpStorage = {};

/* ========== Modal helper (returns Promise) ========== */
/**
 * showModal({ title, body, buttons }) => Promise resolves to button.value or null if closed
 * buttons: [{ label, value, class }]
 */
function showModal({ title = '', body = '', buttons = [{label:'OK', value:true, class:'primary'}] } = {}) {
  return new Promise(resolve => {
    const overlay = document.getElementById('appModal');
    const titleEl = overlay.querySelector('.modal-title');
    const bodyEl = overlay.querySelector('.modal-body');
    const actions = overlay.querySelector('.modal-actions');
    const closeBtn = overlay.querySelector('.modal-close');

    // set content
    titleEl.textContent = title || '';
    if (typeof body === 'string') {
      bodyEl.innerHTML = body;
    } else {
      bodyEl.innerHTML = '';
      bodyEl.appendChild(body);
    }

    // clear previous actions and add new ones
    actions.innerHTML = '';
    buttons.forEach((b) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'modal-btn ' + (b.class || '');
      btn.textContent = b.label;

      btn.addEventListener('click', (ev) => {
        // ripple
        try {
          const rect = btn.getBoundingClientRect();
          const ripple = document.createElement('span');
          ripple.className = 'ripple';
          const x = ev.clientX - rect.left;
          const y = ev.clientY - rect.top;
          ripple.style.left = x + 'px';
          ripple.style.top = y + 'px';
          btn.appendChild(ripple);
          setTimeout(()=> { if(ripple && ripple.parentNode) ripple.parentNode.removeChild(ripple); }, 700);
        } catch(e) {}

        // pressed animation
        btn.classList.add('clicked');
        setTimeout(()=> btn.classList.remove('clicked'), 220);

        // hide after tiny delay so user sees the effect
        setTimeout(()=> hide(b.value), 200);
      });

      actions.appendChild(btn);
    });

    // show overlay
    overlay.classList.remove('hiding');
    overlay.classList.add('show');

    // focus
    setTimeout(() => {
      const firstBtn = actions.querySelector('button');
      if (firstBtn) firstBtn.focus();
      else closeBtn.focus();
    }, 40);

    function hide(result) {
      overlay.classList.add('hiding');
      overlay.classList.remove('show');
      setTimeout(() => {
        titleEl.textContent = '';
        bodyEl.innerHTML = '';
        actions.innerHTML = '';
        resolve(result === undefined ? null : result);
      }, 240);
    }

    // close behaviors
    closeBtn.onclick = () => hide(null);
    const onBgClick = (ev) => {
      if (ev.target === overlay) {
        hide(null);
        overlay.removeEventListener('click', onBgClick);
      }
    };
    overlay.addEventListener('click', onBgClick);
  });
}

/* ========== Validators & misc ========== */
function isValidEmail(email){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function passwordStrength(pw){
  let score = 0;
  if(pw.length >= 8) score++;
  if(/[0-9]/.test(pw)) score++;
  if(/[A-Z]/.test(pw)) score++;
  if(/[^A-Za-z0-9]/.test(pw)) score++;
  return score; // 0..4
}
function escapeHtml(unsafe){
  return (unsafe || '').replace(/[&<"'>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ========== Panel resizing: auto height with animation ========== */
function updateWrapperHeight() {
  const panels = Array.from(document.querySelectorAll('.panel'));
  if (!panels.length) return;
  let idx = 0;
  if (wrapper.classList.contains('show-register')) idx = 1;
  else if (wrapper.classList.contains('show-forgot')) idx = 2;
  const panel = panels[idx];

  // width we want to measure at (wrapper inner width)
  const measureWidth = Math.max(wrapper.clientWidth - 0, 320); // fallback

  // clone the panel to measure its natural height without constraints
  const clone = panel.cloneNode(true);
  clone.style.width = measureWidth + 'px';
  clone.style.position = 'absolute';
  clone.style.left = '-9999px';
  clone.style.top = '0';
  clone.style.visibility = 'hidden';
  clone.style.transform = 'none';
  clone.style.height = 'auto';
  clone.style.maxHeight = 'none';
  // ensure floating/positioned children render same: remove any inline styles that depend on wrapper
  clone.querySelectorAll('*').forEach(el => {
    el.style.transition = 'none';
    // don't remove inline display properties, but ensure no height constraints
    el.style.height = 'auto';
    el.style.maxHeight = 'none';
  });

  document.body.appendChild(clone);
  // give browser microtask to layout if necessary
  const contentHeight = Math.ceil(clone.scrollHeight || clone.getBoundingClientRect().height);
  document.body.removeChild(clone);

  const padding = 48; // same padding we used before
  let target = contentHeight + padding;
  const minH = 420;
  const maxH = Math.max(window.innerHeight - 80, minH);
  target = Math.min(Math.max(target, minH), maxH);

  // set inline height (will animate due to CSS transition on .wrapper)
  wrapper.style.height = target + 'px';
}


// debounce on resize
let __rsz;
window.addEventListener('resize', () => {
  clearTimeout(__rsz);
  __rsz = setTimeout(updateWrapperHeight, 120);
});

/* ========== UI: toggles (use these handlers so updateWrapperHeight called) ========== */
toRegister.addEventListener('click', e => {
  e.preventDefault();
  wrapper.classList.remove('show-forgot', 'show-login');
  wrapper.classList.add('show-register');
  loginError.style.display = 'none';
  setTimeout(updateWrapperHeight, 80);
});
toLogin.addEventListener('click', e => {
  e.preventDefault();
  wrapper.classList.remove('show-register', 'show-forgot');
  wrapper.classList.add('show-login');
  regError.style.display = 'none';
  otpBox.style.display = 'none';
  setTimeout(updateWrapperHeight, 80);
});
forgotLink.addEventListener('click', e => {
  e.preventDefault();
  wrapper.classList.remove('show-register', 'show-login');
  wrapper.classList.add('show-forgot');
  loginError.style.display = 'none';
  setTimeout(updateWrapperHeight, 80);
});
backToLogin.addEventListener('click', e => {
  e.preventDefault();
  wrapper.classList.remove('show-register', 'show-forgot');
  wrapper.classList.add('show-login');
  otpBox.style.display = 'none';
  setTimeout(updateWrapperHeight, 80);
});

/* ========== Toggle show/hide password ========== */
document.querySelectorAll('.toggle-pw').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const targetId = btn.getAttribute('data-target');
    const inp = document.getElementById(targetId);
    if(!inp) return;
    if(inp.type === 'password'){
      inp.type = 'text';
      btn.innerHTML = '<ion-icon name="eye-outline"></ion-icon>';
    } else {
      inp.type = 'password';
      btn.innerHTML = '<ion-icon name="eye-off-outline"></ion-icon>';
    }
    inp.focus();
  });
});

/* ========== Register ========== */
registerForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  regError.style.display = 'none';
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const password = document.getElementById('regPassword').value;

  if(!name || !email || !password){
    regError.textContent = 'Vui lòng điền đầy đủ thông tin.';
    regError.style.display = 'block';
    setTimeout(updateWrapperHeight, 60);
    return;
  }
  if(!isValidEmail(email)){
    regError.textContent = 'Email không hợp lệ.';
    regError.style.display = 'block';
    setTimeout(updateWrapperHeight, 60);
    return;
  }
  if(passwordStrength(password) < 2){
    regError.textContent = 'Mật khẩu yếu. Nên >=8 ký tự, có số và ký tự in hoa.';
    regError.style.display = 'block';
    setTimeout(updateWrapperHeight, 60);
    return;
  }

  const users = loadUsers();
  if(users.some(u=>u.email === email)){
    regError.textContent = 'Email đã được dùng. Vui lòng dùng email khác hoặc đăng nhập.';
    regError.style.display = 'block';
    setTimeout(updateWrapperHeight, 60);
    return;
  }

  const pwHash = await hashPassword(password);
  const newUser = { id: Date.now(), name, email, passwordHash: pwHash, createdAt: new Date().toISOString() };
  users.push(newUser);
  saveUsers(users);

  await showModal({ title: 'Đăng ký', body: 'Đăng ký thành công! Bạn có thể đăng nhập bây giờ.', buttons: [{label:'OK', value:true, class:'primary'}] });
  registerForm.reset();
  wrapper.classList.remove('show-register');
  wrapper.classList.add('show-login');
  updateUserStatus();
  setTimeout(updateWrapperHeight, 60);
});

/* ========== Login ========== */
loginForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  loginError.style.display = 'none';
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;
  const remember = rememberCheckbox.checked;

  if(!email || !password){
    loginError.textContent = 'Vui lòng nhập email & mật khẩu.';
    loginError.style.display = 'block';
    setTimeout(updateWrapperHeight, 60);
    return;
  }
  if(!isValidEmail(email)){
    loginError.textContent = 'Email không hợp lệ.';
    loginError.style.display = 'block';
    setTimeout(updateWrapperHeight, 60);
    return;
  }

  const users = loadUsers();
  const user = users.find(u=>u.email === email);
  if(!user){
    loginError.textContent = 'Không tìm thấy tài khoản với email này.';
    loginError.style.display = 'block';
    setTimeout(updateWrapperHeight, 60);
    return;
  }

  const pwHash = await hashPassword(password);
  if(pwHash !== user.passwordHash){
    loginError.textContent = 'Mật khẩu không đúng.';
    loginError.style.display = 'block';
    setTimeout(updateWrapperHeight, 60);
    return;
  }

  saveCurrent(user, remember);
  updateUserStatus();
  await showModal({ title: 'Đăng nhập', body: `Đăng nhập thành công: ${escapeHtml(user.name)}`, buttons:[{label:'OK', value:true, class:'primary'}] });
  loginForm.reset();
});

/* ========== Forgot / Reset (OTP demo) ========== */
forgotForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = document.getElementById('forgotEmail').value.trim().toLowerCase();
  if(!email){
    await showModal({ title: 'Lỗi', body: 'Nhập email trước.', buttons:[{label:'OK', value:true, class:'primary'}] });
    return;
  }
  if(!isValidEmail(email)){
    await showModal({ title: 'Lỗi', body: 'Email không hợp lệ.', buttons:[{label:'OK', value:true, class:'primary'}] });
    return;
  }
  const users = loadUsers();
  const user = users.find(u=>u.email === email);
  if(!user){
    const wantRegister = await showModal({
      title: 'Email không tồn tại',
      body: 'Email này chưa tồn tại. Bạn muốn đăng ký mới?',
      buttons: [
        { label: 'Đăng ký', value: true, class: 'primary' },
        { label: 'Hủy', value: false, class: 'ghost' }
      ]
    });
    if(wantRegister){
      document.getElementById('regEmail').value = email;
      wrapper.classList.remove('show-login','show-forgot');
      wrapper.classList.add('show-register');
      setTimeout(updateWrapperHeight, 80);
    }
    return;
  }

  const otp = Math.floor(100000 + Math.random()*900000).toString();
  otpStorage[email] = otp;
  await showModal({
    title: 'Mã OTP (demo)',
    body: `Mã OTP: <strong style="letter-spacing:2px">${otp}</strong><br/><small>Trong ứng dụng thực tế, gọi API để gửi email.</small>`,
    buttons: [{label:'OK', value:true, class:'primary'}]
  });
  otpBox.style.display = 'block';
  setTimeout(updateWrapperHeight, 80);
});

resetBtn.addEventListener('click', async ()=>{
  const email = document.getElementById('forgotEmail').value.trim().toLowerCase();
  const code = document.getElementById('otpCode').value.trim();
  const newPw = document.getElementById('newPassword').value;

  if(!email || !code || !newPw){
    await showModal({ title: 'Lỗi', body: 'Vui lòng điền đầy đủ OTP và mật khẩu mới.', buttons:[{label:'OK', value:true, class:'primary'}] });
    return;
  }
  if(otpStorage[email] !== code){
    await showModal({ title: 'Lỗi', body: 'OTP không đúng hoặc đã hết hạn.', buttons:[{label:'OK', value:true, class:'primary'}] });
    return;
  }
  if(passwordStrength(newPw) < 2){
    await showModal({ title: 'Lỗi', body: 'Mật khẩu yếu. Nên >=8 ký tự, có số và ký tự in hoa.', buttons:[{label:'OK', value:true, class:'primary'}] });
    return;
  }

  const users = loadUsers();
  const user = users.find(u=>u.email === email);
  if(!user){
    await showModal({ title: 'Lỗi', body: 'Tài khoản không tồn tại.', buttons:[{label:'OK', value:true, class:'primary'}] });
    wrapper.classList.remove('show-login','show-register');
    wrapper.classList.add('show-register');
    setTimeout(updateWrapperHeight, 80);
    return;
  }

  user.passwordHash = await hashPassword(newPw);
  saveUsers(users);
  delete otpStorage[email];

  await showModal({ title: 'Thành công', body: 'Đổi mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.', buttons:[{label:'OK', value:true, class:'primary'}] });
  forgotForm.reset();
  otpBox.style.display = 'none';
  wrapper.classList.remove('show-forgot','show-register');
  wrapper.classList.add('show-login');
  setTimeout(updateWrapperHeight, 80);
});

/* ========== Misc UI & persistence ========== */
function updateUserStatus(){
  const cur = getCurrent();
  if(cur){
    userStatus.innerHTML = `Hi, ${escapeHtml(cur.name)} • <a href="#" id="logoutLink" style="color:var(--accent-2);text-decoration:underline">Logout</a>`;
    const logoutLink = document.getElementById('logoutLink');
    logoutLink.addEventListener('click', async (e)=>{
      e.preventDefault();
      clearCurrent();
      updateUserStatus();
      await showModal({ title: 'Logout', body: 'Bạn đã logout.', buttons:[{label:'OK',value:true,class:'primary'}] });
    });
  } else {
    userStatus.innerHTML = '';
  }
}

// on load
window.addEventListener('DOMContentLoaded', () => {
  updateUserStatus();
  // set initial wrapper height after small delay (allow fonts/images/layout)
  setTimeout(updateWrapperHeight, 40);
});

/* debug helpers (small) */
window._demoUsers = {
  list: loadUsers,
  clear: ()=>{ localStorage.removeItem(USERS_KEY); localStorage.removeItem(CURRENT_KEY); sessionStorage.removeItem(CURRENT_KEY); showModal({title:'Cleared', body:'Demo storage cleared', buttons:[{label:'OK',value:true,class:'primary'}]}); }
};

// ===== Bg cover responsive + STRETCH-FILL (kéo giãn giống slider) =====
(function initBgCoverStretch(){
  const bg = document.querySelector('.bg-cover');
  if(!bg) return;

  // lấy src từ CSS background-image nếu có, fallback
  let src = null;
  try {
    const styleBg = getComputedStyle(bg).backgroundImage || '';
    if(styleBg && styleBg !== 'none'){
      src = styleBg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
    }
  } catch(e){ /* ignore */ }
  if(!src) src = 'background2.jpg'; // đổi nếu cần

  // tạo / chọn img
  let img = bg.querySelector('img.bg-img');
  if(!img){
    img = document.createElement('img');
    img.className = 'bg-img';
    img.alt = 'background';
    img.decoding = 'async';
    img.draggable = false;
    img.src = src;
    bg.appendChild(img);
  } else {
    if(!img.src) img.src = src;
  }

  // Apply immediate styles for stretch-fill behavior
  function applyStretchStyles(){
    try {
      img.style.position = 'fixed';
      img.style.top = '0';
      img.style.left = '0';
      // set css pixels to ensure full viewport coverage
      img.style.width = window.innerWidth + 'px';
      img.style.height = window.innerHeight + 'px';
      img.style.minWidth = '100%';
      img.style.minHeight = '100%';
      img.style.objectFit = 'fill';         // KÉO GIÃN
      img.style.objectPosition = 'center center';
      img.style.transform = 'none';
      img.style.transition = 'transform 320ms cubic-bezier(.2,.9,.3,1), opacity 180ms ease';
    } catch(e){}
  }

  // Smoothly handle resize: briefly remove transition, set new size, re-add small transition
  let rz;
  function onResizeStretch(){
    if(!img) return;
    // avoid jump: set no-transition then update
    img.style.transition = 'none';
    // set size immediately
    img.style.width = window.innerWidth + 'px';
    img.style.height = window.innerHeight + 'px';
    // force reflow then restore transition for smoothness
    cancelAnimationFrame(rz);
    rz = requestAnimationFrame(()=> {
      requestAnimationFrame(()=> {
        img.style.transition = 'transform 320ms cubic-bezier(.2,.9,.3,1), opacity 180ms ease';
        img.style.transform = 'scale(1)';
      });
    });
  }

  // events
  window.addEventListener('resize', onResizeStretch);
  window.addEventListener('orientationchange', onResizeStretch);
  img.addEventListener('load', () => {
    applyStretchStyles();
  });

  // init
  applyStretchStyles();
  if(img.complete) applyStretchStyles();
})();

// ===== TOP VERTICAL CAROUSEL (clamped heights để tránh hiển thị quá mức) =====
(function topCarouselInit(){
  const container = document.getElementById('topCarousel');
  const track = document.getElementById('topCarouselTrack');
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  if(!container || !track) return;

  const slides = Array.from(track.children).filter(n => n.classList && n.classList.contains('top-slide'));
  if(slides.length === 0) return;

  let idx = 0, timer = null;
  const total = slides.length;
  const AUTOPLAY = 3500;

  // --- TÙY CHỈNH NHANH (thay giá trị nếu cần) ---
  const MOBILE_BREAK = 420;           // <= px => mobile
  const MOBILE_HEIGHT = 150;          // px (mobile)
  const TABLET_HEIGHT = 220;          // px (tablet)
  const DESKTOP_VH = 0.24;            // desktop height as vh (14% of viewport)
  const DESKTOP_MIN = 140;            // px (desktop minimum)
  const DESKTOP_MAX = 360;            // px (desktop maximum)
  // để tránh wrapper bị đẩy xuống quá, giới hạn margin-top tối đa bằng 50% viewport (tùy chỉnh)
  const WRAPPER_MARGIN_MAX_VH = 0.5;

  function getDesktopHeight() {
    // height theo vh nhưng clamp vào DESKTOP_MIN..DESKTOP_MAX
    const h = Math.round(window.innerHeight * DESKTOP_VH);
    return Math.max(DESKTOP_MIN, Math.min(h, DESKTOP_MAX));
  }

  function calcTargetHeight() {
    const w = window.innerWidth || document.documentElement.clientWidth;
    if (w <= MOBILE_BREAK) return MOBILE_HEIGHT;
    if (w <= 900) return TABLET_HEIGHT;
    return getDesktopHeight();
  }

  function updateSizes(){
    const targetH = calcTargetHeight();
    const w = container.clientWidth || container.getBoundingClientRect().width;

    // set inline height (CSS transition xử lý animation)
    container.style.height = targetH + 'px';

    // SYNC wrapper.marginTop nhưng clamp để không bị quá lớn
    try {
      if (typeof wrapper !== 'undefined' && wrapper && wrapper.style) {
        // margin top = targetH + gap (12)
        const desired = targetH + 12;
        const maxAllowed = Math.round(window.innerHeight * WRAPPER_MARGIN_MAX_VH);
        wrapper.style.marginTop = Math.min(desired, maxAllowed) + 'px';
      }
    } catch(e){ /* ignore */ }

    // compact mode for narrow viewports
    container.classList.toggle('compact', w < 420);

    // set slide heights & make images fill (object-fit:fill -> stretch)
    slides.forEach(sl => { sl.style.height = targetH + 'px'; });

    slides.forEach(sl => {
      const img = sl.querySelector('img');
      if(!img) return;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'fill';
      img.style.objectPosition = 'center';
      img.style.maxWidth = 'none';
      img.style.maxHeight = 'none';
    });

    // reposition track without transition then restore
    track.style.transition = 'none';
    track.style.transform = `translateY(-${idx * targetH}px)`;
    requestAnimationFrame(()=> requestAnimationFrame(()=> {
      track.style.transition = 'transform 700ms cubic-bezier(.2,.9,.3,1)';
    }));
  }

  function go(i){
    idx = ((i % total) + total) % total;
    const targetH = calcTargetHeight();
    track.style.transform = `translateY(-${idx * targetH}px)`;
  }
  function next(){ go(idx + 1); }
  function prev(){ go(idx - 1); }

  function start(){ stop(); timer = setInterval(()=> next(), AUTOPLAY); }
  function stop(){ if(timer){ clearInterval(timer); timer = null; } }
  function setPaused(v){ if(v) stop(); else start(); container.classList.toggle('paused', !!v); }

  // interactions
  container.addEventListener('mouseenter', ()=> setPaused(true));
  container.addEventListener('mouseleave', ()=> setPaused(false));
  container.addEventListener('focusin', ()=> setPaused(true));
  container.addEventListener('focusout', ()=> setPaused(false));
  prevBtn?.addEventListener('click', (e) => { e.preventDefault(); prev(); });
  nextBtn?.addEventListener('click', (e) => { e.preventDefault(); next(); });

  document.querySelectorAll('.form input, .form button, .form textarea, .form select')
    .forEach(el => { el.addEventListener('focus', ()=> setPaused(true)); el.addEventListener('blur', ()=> setPaused(false)); });

  // resize / orientation handling
  let rsz;
  window.addEventListener('resize', () => {
    clearTimeout(rsz);
    rsz = setTimeout(() => updateSizes(), 100);
  });

  // recalc when images load
  slides.forEach((sl) => {
    const img = sl.querySelector('img');
    if(!img) return;
    img.addEventListener('load', () => updateSizes());
  });

  // init
  window.addEventListener('load', updateSizes);
  document.addEventListener('DOMContentLoaded', updateSizes);
  updateSizes();
  start();
})();
