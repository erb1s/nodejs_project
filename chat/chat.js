// Простий модуль Chat, що працює з global window.AppAuth (accessToken, userId)
window.Chat = (() => {
  const state = {
    accessToken: '',
    userId: '',
    roomId: '',
    lastSyncToken: '',
    rooms: [],
    messages: [],
    syncTimer: null
  };

  // === УТИЛІТИ ===
  const api = (path, opts = {}) => fetch(
    `https://matrix.org/_matrix/client/r0${path}`,
    {
      ...opts,
      headers: {
        'Authorization': `Bearer ${state.accessToken}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {})
      }
    }
  ).then(r => r.json());

  // FIX: правильний синтаксис іменованого хелпера
  const $ = (id) => document.getElementById(id);

  const showError = (msg) => {
    const box = $('chat-error');
    if (!box) return;
    box.textContent = msg || '';
    box.hidden = !msg;
  };

  const renderUser = () => {
    const userEl = $('chat-user-id');
    if (userEl) userEl.textContent = state.userId || '—';

    const pill = $('chat-room-id');
    if (pill) {
      pill.textContent = state.roomId || 'Not selected';
      pill.onclick = () => {
        if (!state.roomId) return;
        navigator.clipboard.writeText(state.roomId).catch(() => {});
      };
    }
  };

  const renderRooms = () => {
    const list = $('chat-rooms-list');
    if (!list) return;
    list.innerHTML = '';
    for (const r of state.rooms) {
      const li = document.createElement('li');
      const name = r.name || r.roomId;
      li.innerHTML = `
        <span title="${r.roomId}">${name}</span>
        <span>
          <button data-room="${r.roomId}" class="btn btn--light">Open</button>
        </span>
      `;
      list.appendChild(li);
    }
    list.querySelectorAll('button[data-room]').forEach(btn => {
      btn.addEventListener('click', () => switchRoom(btn.dataset.room));
    });
  };

  const renderMessages = () => {
    const box = $('chat-messages');
    if (!box) return;
    box.innerHTML = '';
    for (const m of state.messages) {
      const item = document.createElement('div');
      item.className = 'msg';
      const who = (m.sender === state.userId) ? 'You' : (m.sender || 'user');
      item.innerHTML = `
        <div class="msg__meta">${who}</div>
        <div class="msg__body">${m.body || ''}</div>
      `;
      box.appendChild(item);
    }
    box.scrollTop = box.scrollHeight;
  };

  // === МЕТОДИ ЗАВДАННЯ ===

  async function createRoom() {
    const nameInput = $('chat-new-room-name');
    const name = nameInput ? nameInput.value.trim() : '';
    if (!name) return showError('Введіть назву кімнати');
    showError('');
    const data = await api('/createRoom', { method: 'POST', body: JSON.stringify({ name }) });
    if (data.room_id) {
      state.roomId = data.room_id;
      if (nameInput) nameInput.value = '';
      renderUser();
      await fetchRoomsWithNames();
      await fetchMessages();
      // ДОДАНО: повідомляємо інші модулі та Login про новий активний room
      document.dispatchEvent(new CustomEvent('room:changed', { detail: { roomId: state.roomId } }));
    } else {
      showError(data.error || 'Create room failed');
    }
  }

  async function fetchRoomsWithNames() {
    if (!state.accessToken) return;
    const joined = await api('/joined_rooms');
    const result = [];
    if (Array.isArray(joined?.joined_rooms)) {
      for (const rid of joined.joined_rooms) {
        let name = rid;
        try {
          const summary = await api(`/rooms/${encodeURIComponent(rid)}/state/m.room.name`);
          name = summary?.name || rid;
        } catch (_) {}
        result.push({ roomId: rid, name });
      }
    }
    state.rooms = result;
    renderRooms();
  }

  function getRoomName(roomId) {
    return state.rooms.find(r => r.roomId === roomId)?.name || roomId;
  }

  function switchRoom(roomId) {
    if (!roomId) return;
    state.roomId = roomId;
    state.messages = [];
    state.lastSyncToken = '';
    renderUser();
    renderMessages();
    fetchMessages();
    // ДОДАНО
    document.dispatchEvent(new CustomEvent('room:changed', { detail: { roomId } }));
  }

  async function inviteUserToRoom() {
    const inviteEl = $('chat-invite-user');
    const invite = inviteEl ? inviteEl.value.trim() : '';
    if (!invite || !state.roomId) return showError('Введіть user_id та оберіть кімнату');
    showError('');
    const data = await api(`/rooms/${encodeURIComponent(state.roomId)}/invite`, {
      method: 'POST',
      body: JSON.stringify({ user_id: invite })
    });
    if (data.errcode) {
      showError(data.error || 'Invite failed');
    } else if (inviteEl) {
      inviteEl.value = '';
      await fetchRoomsWithNames();
    }
  }

  async function joinRoom() {
    const joinEl = $('chat-join-room-id');
    const rid = joinEl ? joinEl.value.trim() : '';
    if (!rid) return;
    showError('');
    const data = await api(`/join/${encodeURIComponent(rid)}`, { method: 'POST' });
    if (data.room_id) {
      state.roomId = rid;
      if (joinEl) joinEl.value = '';
      state.messages = [];
      state.lastSyncToken = '';
      renderUser();
      await fetchRoomsWithNames();
      fetchMessages();
      // ДОДАНО
      document.dispatchEvent(new CustomEvent('room:changed', { detail: { roomId: state.roomId } }));
    } else {
      showError(data.error || 'Join failed');
    }
  }

  async function sendMessage() {
    const ta = $('chat-input');
    const msg = (ta?.value || '').trim();
    if (!msg || !state.roomId) return;
    showError('');
    const data = await api(`/rooms/${encodeURIComponent(state.roomId)}/send/m.room.message`, {
      method: 'POST',
      body: JSON.stringify({ msgtype: 'm.text', body: msg })
    });
    if (data.event_id) {
      state.messages.push({ id: data.event_id, body: msg, sender: state.userId });
      if (ta) ta.value = '';
      renderMessages();
    } else {
      showError(data.error || 'Send failed');
    }
  }

  async function fetchMessages() {
    if (!state.accessToken || !state.roomId) return;
    const qs = state.lastSyncToken ? `?since=${encodeURIComponent(state.lastSyncToken)}&timeout=10000` : '?timeout=10000';
    const data = await api(`/sync${qs}`);
    if (data?.next_batch) {
      state.lastSyncToken = data.next_batch;
      const roomData = data.rooms?.join?.[state.roomId];
      if (roomData?.timeline?.events?.length) {
        for (const ev of roomData.timeline.events) {
          if (ev.type === 'm.room.message' && ev.content?.body) {
            if (!state.messages.find(m => m.id === ev.event_id)) {
              state.messages.push({ id: ev.event_id, body: ev.content.body, sender: ev.sender });
            }
          }
        }
        renderMessages();
      }
    }
  }

  // === ПУБЛІЧНА ІНІЦІАЛІЗАЦІЯ ===
  function init(host) {
    // Стартові значення з глобального Auth
    state.accessToken = window.AppAuth.accessToken || '';
    state.userId = window.AppAuth.userId || '';

    // Прив'язка елементів UI
    $('chat-create-room')?.addEventListener('click', createRoom);
    $('chat-join-room')?.addEventListener('click', joinRoom);
    $('chat-invite')?.addEventListener('click', inviteUserToRoom);
    $('chat-send')?.addEventListener('click', sendMessage);
    $('chat-refresh')?.addEventListener('click', fetchMessages);
    $('chat-refresh-rooms')?.addEventListener('click', fetchRoomsWithNames);

    renderUser();
    fetchRoomsWithNames();

    // Автосинхронізація
    if (state.syncTimer) clearInterval(state.syncTimer);
    state.syncTimer = setInterval(fetchMessages, 5000);

    // На події логіна підставляємо токен/ID і оновлюємо
    document.addEventListener('auth:success', (e) => {
      state.accessToken = e.detail.accessToken;
      state.userId = e.detail.userId;
      renderUser();
      fetchRoomsWithNames();
      fetchMessages();
    });

    document.addEventListener('auth:logout', () => {
      state.accessToken = '';
      state.userId = '';
      state.roomId = '';
      state.messages = [];
      state.rooms = [];
      state.lastSyncToken = '';
      renderUser();
      renderRooms();
      renderMessages();
      showError('');
    });

    // ДОДАНО: коли Sidebar переключає кімнату
    document.addEventListener('room:changed', (e) => {
      const rid = e?.detail?.roomId || '';
      if (!rid) return;
      state.roomId = rid;
      state.messages = [];
      state.lastSyncToken = '';
      renderUser();
      renderMessages();
      fetchMessages();
    });
  }

  // Експортуємо методи (на випадок якщо треба викликати зовні)
  return {
    init,
    createRoom,
    fetchRoomsWithNames,
    getRoomName,
    switchRoom,
    inviteUserToRoom,
    joinRoom,
    sendMessage,
    fetchMessages
  };
})();
