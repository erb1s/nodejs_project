// sidebar/sidebar.js
// Працює з index.html, який після auth:success підвантажує цей фрагмент і викликає Sidebar.init(host).
// Виконує ТЗ: створення кімнат, видалення (leave), показ учасників, kick користувача.

(function () {
  const API_BASE = 'https://matrix.org/_matrix/client';
  const VERS = 'r0';
  const enc = encodeURIComponent;

  function authHeader() {
    const token = window.AppAuth?.accessToken || '';
    return { 'Authorization': 'Bearer ' + token };
  }
  function hasAuth() {
    return Boolean(window.AppAuth?.accessToken);
  }

  async function apiJson(url, opts = {}) {
    const res = await fetch(url, opts);
    let data = {};
    try { data = await res.json(); } catch (_) {}
    return { res, data };
  }

  // ---------- РЕНДЕР ----------
  function renderRooms(host, state) {
    const list = host.querySelector('#rooms-list');
    list.innerHTML = '';

    state.rooms.forEach(room => {
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between rounded-lg p-2 cursor-pointer hover:bg-indigo-50';
      if (room.roomId === state.roomId) li.classList.add('active');

      // назва
      const nameSpan = document.createElement('span');
      nameSpan.className = 'flex-1 truncate';
      nameSpan.textContent = room.name || room.roomId;

      // кнопка leave
      const btn = document.createElement('button');
      btn.className = 'ml-2 text-red-500 hover:text-red-700 text-xs font-medium';
      btn.title = 'Leave room';
      btn.textContent = '× Delete';

      li.addEventListener('click', () => switchRoom(host, state, room.roomId));
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        leaveRoom(host, state, room.roomId);
      });

      li.appendChild(nameSpan);
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function renderMembers(host, state) {
    const block = host.querySelector('#members-block');
    const list = host.querySelector('#members-list');
    if (!state.roomId) {
      block.hidden = true;
      list.innerHTML = '';
      return;
    }
    block.hidden = false;
    list.innerHTML = '';

    state.members.forEach(m => {
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between bg-white p-2 rounded border';

      const left = document.createElement('div');
      left.innerHTML = `<span class="font-medium">${m.displayName || m.userId}</span>
                        <span class="text-gray-500 ml-1">${'(' + m.userId.split(':')[0].substring(1) + ')'}</span>`;

      const kickBtn = document.createElement('button');
      kickBtn.className = 'text-red-600 hover:text-red-800 text-xs font-bold';
      kickBtn.title = 'Kick user';
      kickBtn.textContent = '×';
      kickBtn.addEventListener('click', () => kickUser(host, state, m.userId));

      li.appendChild(left);
      li.appendChild(kickBtn);
      list.appendChild(li);
    });
  }

  // ---------- API ДІЇ ----------
  async function fetchRoomsWithNames(state) {
    if (!hasAuth()) return;
    const { res, data } = await apiJson(`${API_BASE}/${VERS}/joined_rooms`, {
      headers: authHeader()
    });
    if (!res.ok) return;

    const out = [];
    for (const id of (data.joined_rooms || [])) {
      let name = '';
      try {
        const r2 = await fetch(`${API_BASE}/${VERS}/rooms/${enc(id)}/state/m.room.name`, {
          headers: authHeader()
        });
        if (r2.ok) {
          const j = await r2.json();
          name = j?.name || '';
        }
      } catch(_) {}
      out.push({ roomId: id, name });
    }
    state.rooms = out;

    // якщо активної кімнати більше немає — скинемо
    if (state.roomId && !out.find(r => r.roomId === state.roomId)) {
      state.roomId = '';
      state.members = [];
    }
  }

  async function createRoom(host, state) {
    const input = host.querySelector('#new-room-name');
    const val = (input.value || '').trim();
    if (!val || !hasAuth()) return;

    const { res, data } = await apiJson(`${API_BASE}/${VERS}/createRoom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ name: val })
    });

    if (res.ok) {
      input.value = '';
      await fetchRoomsWithNames(state);
      if (data.room_id) {
        await switchRoom(host, state, data.room_id);
        const rid = host.querySelector('#new-room-id');
        rid.hidden = false;
        rid.querySelector('span').textContent = data.room_id;
      }
      renderRooms(host, state);
    } else {
      alert('Failed to create room: ' + (data.error || 'Error'));
    }
  }

  async function leaveRoom(host, state, roomId) {
    if (!hasAuth() || !roomId) return;
    if (!confirm('Leave (delete from my list) this room?')) return;

    const { res, data } = await apiJson(`${API_BASE}/${VERS}/rooms/${enc(roomId)}/leave`, {
      method: 'POST',
      headers: authHeader()
    });
    if (res.ok) {
      state.rooms = state.rooms.filter(r => r.roomId !== roomId);
      if (state.roomId === roomId) {
        state.roomId = '';
        state.members = [];
        // повідомимо інші компоненти
        document.dispatchEvent(new CustomEvent('room:selected', { detail: { roomId: '' } }));
      }
      await fetchRoomsWithNames(state);
      renderRooms(host, state);
      renderMembers(host, state);
      alert('Room left.');
    } else {
      console.error('leave failed:', data);
      alert('Cannot leave room: ' + (data.error || 'Unknown error'));
    }
  }

  async function switchRoom(host, state, roomId) {
    if (!roomId) return;
    state.roomId = roomId;
    await fetchRoomMembers(state);
    renderRooms(host, state);
    renderMembers(host, state);
    // повідомляємо чат/юзер компоненти
    document.dispatchEvent(new CustomEvent('room:selected', { detail: { roomId } }));
  }

  async function fetchRoomMembers(state) {
    if (!hasAuth() || !state.roomId) return;
    const { res, data } = await apiJson(`${API_BASE}/${VERS}/rooms/${enc(state.roomId)}/members?at=`, {
      headers: authHeader()
    });
    if (!res.ok) {
      state.members = [];
      return;
    }
    state.members = (data.chunk || [])
      .filter(ev => ev.type === 'm.room.member' && ev.content?.membership === 'join')
      .map(ev => ({ userId: ev.state_key, displayName: ev.content?.displayname || ev.state_key }));
  }

  async function kickUser(host, state, userId) {
    if (!hasAuth() || !state.roomId || !userId) return;
    if (!confirm(`Kick ${userId} from room?`)) return;

    const { res, data } = await apiJson(
      `${API_BASE}/${VERS}/rooms/${enc(state.roomId)}/kick`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ user_id: userId })
      }
    );

    if (res.ok) {
      state.members = state.members.filter(m => m.userId !== userId);
      renderMembers(host, state);
      alert(`User ${userId} kicked.`);
    } else {
      console.error('kick failed:', data);
      alert('Cannot kick: ' + (data.error || 'Unknown error'));
    }
  }

  // ---------- ПУБЛІЧНИЙ API КОМПОНЕНТА ----------
  window.Sidebar = {
    init(host) {
      const state = {
        rooms: [],
        roomId: '',
        members: []
      };

      // кнопки/інпут
      const createBtn = host.querySelector('#create-room-btn');
      const input = host.querySelector('#new-room-name');

      createBtn.addEventListener('click', () => createRoom(host, state));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') createRoom(host, state);
      });

      // якщо вже авторизовані — тягнемо кімнати
      if (hasAuth()) {
        fetchRoomsWithNames(state).then(() => renderRooms(host, state));
      }

      // якщо інші частини апки перепризначили кімнату
      document.addEventListener('room:force', (e) => {
        const { roomId } = e.detail || {};
        if (roomId) switchRoom(host, state, roomId);
      });
    }
  };
})();
