// login/login.js
(function () {
  async function matrixLogin(user, pass) {
    const res = await fetch('https://matrix.org/_matrix/client/r0/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'm.login.password',
        user,
        password: pass
      })
    });
    const data = await res.json();
    if (!res.ok || !data?.access_token) {
      const code = data?.errcode || '';
      if (code === 'M_FORBIDDEN') throw new Error('Невірний логін або пароль');
      if (code === 'M_LIMIT_EXCEEDED') throw new Error('Перевищено ліміт запитів. Спробуйте пізніше');
      throw new Error(data?.error || 'Помилка під час входу');
    }
    return { accessToken: data.access_token, userId: data.user_id || '' };
  }

  function showLogin(formEl, panelEl) {
    formEl.style.display = '';
    panelEl.style.display = 'none';
  }
  function showPanel(formEl, panelEl) {
    formEl.style.display = 'none';
    panelEl.style.display = '';
  }

  // --- ДОДАНО: керування відображенням Room ID
  function setRoomId(roomId) {
    const el  = document.getElementById('room-id-value');
    const btn = document.getElementById('copy-room-id');
    const msg = document.getElementById('room-id-copy-msg');
    if (!el || !btn) return;

    if (roomId && typeof roomId === 'string') {
      el.textContent = roomId;
      btn.disabled = false;
      btn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(roomId);
          if (msg) { msg.textContent = 'Room ID скопійовано'; setTimeout(() => msg.textContent = '', 1200); }
        } catch {}
      };
      el.onclick  = btn.onclick;
    } else {
      el.textContent = 'Not selected';
      btn.disabled = true;
      btn.onclick = null;
      if (msg) msg.textContent = '';
    }
  }

  function init(host, { onAuth, onLogout } = {}) {
    const $form     = host.querySelector('#login-form');
    const $user     = host.querySelector('#login-username');
    const $pass     = host.querySelector('#login-password');
    const $submit   = host.querySelector('#login-submit');
    const $error    = host.querySelector('#login-error');

    const $panel    = host.querySelector('#login-panel');
    const $userid   = host.querySelector('#login-userid');
    const $token    = host.querySelector('#login-token');
    const $copyBtn  = host.querySelector('#login-copy');
    const $copyMsg  = host.querySelector('#login-copy-msg');
    const $logout   = host.querySelector('#login-logout');

    // стартовий стан
    showLogin($form, $panel);
    setRoomId(''); // поки не вибрано

    $submit.addEventListener('click', async () => {
      $submit.disabled = true;
      $error.textContent = '';
      try {
        const username = $user.value.trim();
        const password = $pass.value;
        if (!username || !password) throw new Error('Вкажіть логін і пароль');

        const { accessToken, userId } = await matrixLogin(username, password);

        // оновлюємо UI
        $userid.textContent = userId;
        $token.textContent = accessToken;
        showPanel($form, $panel);

        // глобальний стан / колбек
        if (typeof onAuth === 'function') onAuth({ accessToken, userId });
      } catch (e) {
        $error.textContent = e.message || 'Помилка';
      } finally {
        $submit.disabled = false;
      }
    });

    $copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText($token.textContent || '');
        $copyMsg.textContent = 'Токен скопійовано';
        setTimeout(() => ($copyMsg.textContent = ''), 1500);
      } catch {
        $copyMsg.textContent = 'Не вдалося скопіювати';
      }
    });

    $logout.addEventListener('click', () => {
      // очищаємо форму/панель
      $user.value = '';
      $pass.value = '';
      $token.textContent = '';
      $userid.textContent = '';
      setRoomId('');
      showLogin($form, $panel);
      if (typeof onLogout === 'function') onLogout();
    });

    // --- ДОДАНО: оновлюємо Room ID при зміні кімнати
    document.addEventListener('room:changed', (e) => {
      const roomId = e?.detail?.roomId || '';
      if (!window.AppAuth) window.AppAuth = {};
      window.AppAuth.currentRoomId = roomId;
      setRoomId(roomId);
    });

    // --- ДОДАНО: після логіну підхопити активну кімнату (якщо Sidebar вже є)
    document.addEventListener('auth:success', () => {
      try {
        const initial = window.Sidebar?.getCurrentRoomId ? window.Sidebar.getCurrentRoomId() : '';
        setRoomId(initial || '');
      } catch {
        setRoomId('');
      }
    });
  }

  window.Login = { init };
})();
