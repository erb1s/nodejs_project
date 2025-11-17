(function () {
  const API_BASE = 'https://matrix.org/_matrix/client';
  const VERS = 'r0';
  const enc = encodeURIComponent;

  function authHeader() {
    const token = window.AppAuth?.accessToken || '';
    return { 
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    };
  }

  function hasAuth() {
    return Boolean(window.AppAuth?.accessToken);
  }

  async function apiJson(url, opts = {}) {
    const res = await fetch(url, {
      ...opts,
      headers: { ...authHeader(), ...opts.headers }
    });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    return { res, data };
  }

  // ---------- РЕНДЕР ----------
  function renderRooms(host, state) {
    const list = host.querySelector('#rooms-list');
    if (!list) return;
    
    list.innerHTML = '';

    if (state.rooms.length === 0) {
      list.innerHTML = '<div class="text-gray-500 text-sm text-center py-4">Немає активних кімнат</div>';
      return;
    }

    state.rooms.forEach(room => {
      const li = document.createElement('li');
      li.className = 'sidebar__room' + (room.roomId === state.roomId ? ' sidebar__room--active' : '');
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'room-name';
      nameSpan.textContent = room.name || room.roomId;
      nameSpan.title = room.roomId;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = 'Видалити';
      deleteBtn.title = 'Покинути кімнату';

      li.appendChild(nameSpan);
      li.appendChild(deleteBtn);
      list.appendChild(li);

      // Обробники подій
      li.addEventListener('click', (e) => {
        if (e.target !== deleteBtn) {
          switchRoom(host, state, room.roomId);
        }
      });

      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        leaveRoom(host, state, room.roomId);
      });
    });
  }

  function renderMembers(host, state) {
    const block = host.querySelector('#members-block');
    const list = host.querySelector('#members-list');
    
    if (!state.roomId || state.members.length === 0) {
      if (block) block.hidden = true;
      return;
    }

    block.hidden = false;
    list.innerHTML = '';

    state.members.forEach(member => {
      const li = document.createElement('li');
      li.className = 'member-item';

      const infoDiv = document.createElement('div');
      infoDiv.className = 'member-info';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'member-name';
      nameSpan.textContent = member.displayName || member.userId;

      const idSpan = document.createElement('span');
      idSpan.className = 'member-id';
      idSpan.textContent = member.userId;

      const kickBtn = document.createElement('button');
      kickBtn.className = 'kick-btn';
      kickBtn.textContent = 'Видалити';
      kickBtn.title = 'Виключити з кімнати';

      infoDiv.appendChild(nameSpan);
      infoDiv.appendChild(idSpan);
      li.appendChild(infoDiv);
      li.appendChild(kickBtn);
      list.appendChild(li);

      kickBtn.addEventListener('click', () => {
        kickUser(host, state, member.userId);
      });
    });
  }

  // ---------- API ФУНКЦІЇ ----------
  async function fetchRoomsWithNames(state) {
    if (!hasAuth()) return;
    
    try {
      const { res, data } = await apiJson(`${API_BASE}/${VERS}/joined_rooms`);
      if (!res.ok) throw new Error(data.error || 'Failed to fetch rooms');

      const rooms = [];
      for (const id of (data.joined_rooms || [])) {
        let name = id;
        try {
          const roomRes = await fetch(`${API_BASE}/${VERS}/rooms/${enc(id)}/state/m.room.name`, {
            headers: authHeader()
          });
          if (roomRes.ok) {
            const roomData = await roomRes.json();
            name = roomData?.name || id;
          }
        } catch (_) {}
        rooms.push({ roomId: id, name });
      }
      
      state.rooms = rooms;
      
      // Якщо активної кімнати більше немає - скидаємо
      if (state.roomId && !rooms.find(r => r.roomId === state.roomId)) {
        state.roomId = '';
        state.members = [];
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  }

  async function createRoom(host, state) {
    const input = host.querySelector('#new-room-name');
    const name = (input?.value || '').trim();
    
    if (!name || !hasAuth()) {
      alert('Будь ласка, введіть назву кімнати');
      return;
    }

    try {
      const { res, data } = await apiJson(`${API_BASE}/${VERS}/createRoom`, {
        method: 'POST',
        body: JSON.stringify({ name })
      });

      if (res.ok && data.room_id) {
        input.value = '';
        await fetchRoomsWithNames(state);
        await switchRoom(host, state, data.room_id);
        
        // Показуємо ID нової кімнати
        const ridElement = host.querySelector('#new-room-id');
        if (ridElement) {
          ridElement.hidden = false;
          ridElement.querySelector('span').textContent = data.room_id;
          setTimeout(() => ridElement.hidden = true, 5000);
        }
        
        renderRooms(host, state);
        alert('Кімната успішно створена!');
      } else {
        throw new Error(data.error || 'Помилка створення кімнати');
      }
    } catch (error) {
      alert('Помилка: ' + error.message);
    }
  }

  async function leaveRoom(host, state, roomId) {
    if (!hasAuth() || !roomId) return;
    
    if (!confirm('Ви впевнені, що хочете покинути цю кімнату?')) {
      return;
    }

    try {
      const { res, data } = await apiJson(`${API_BASE}/${VERS}/rooms/${enc(roomId)}/leave`, {
        method: 'POST'
      });

      if (res.ok) {
        // Оновлюємо стан
        state.rooms = state.rooms.filter(r => r.roomId !== roomId);
        if (state.roomId === roomId) {
          state.roomId = '';
          state.members = [];
        }
        
        // Оновлюємо UI
        await fetchRoomsWithNames(state);
        renderRooms(host, state);
        renderMembers(host, state);
        
        alert('Кімнату успішно покинуто');
      } else {
        throw new Error(data.error || 'Помилка виходу з кімнати');
      }
    } catch (error) {
      alert('Помилка: ' + error.message);
    }
  }

  async function switchRoom(host, state, roomId) {
    if (!roomId) return;
    
    state.roomId = roomId;
    await fetchRoomMembers(state);
    renderRooms(host, state);
    renderMembers(host, state);
    
    // Сповіщаємо інші компоненти про зміну кімнати
    document.dispatchEvent(new CustomEvent('room:changed', { 
      detail: { roomId } 
    }));
  }

  async function fetchRoomMembers(state) {
    if (!hasAuth() || !state.roomId) return;
    
    try {
      const { res, data } = await apiJson(
        `${API_BASE}/${VERS}/rooms/${enc(state.roomId)}/joined_members`
      );

      if (res.ok) {
        state.members = Object.entries(data.joined || {}).map(([userId, info]) => ({
          userId,
          displayName: info.display_name || userId
        }));
      } else {
        state.members = [];
      }
    } catch (error) {
      console.error('Error fetching members:', error);
      state.members = [];
    }
  }

  async function kickUser(host, state, userId) {
    if (!hasAuth() || !state.roomId || !userId) return;
    
    if (!confirm(`Видалити користувача ${userId} з кімнати?`)) {
      return;
    }

    try {
      const { res, data } = await apiJson(
        `${API_BASE}/${VERS}/rooms/${enc(state.roomId)}/kick`,
        {
          method: 'POST',
          body: JSON.stringify({ user_id: userId })
        }
      );

      if (res.ok) {
        state.members = state.members.filter(m => m.userId !== userId);
        renderMembers(host, state);
        alert('Користувача успішно видалено');
      } else {
        throw new Error(data.error || 'Помилка видалення користувача');
      }
    } catch (error) {
      alert('Помилка: ' + error.message);
    }
  }

  // ---------- ПУБЛІЧНИЙ API ----------
  window.Sidebar = {
    init(host) {
      const state = {
        rooms: [],
        roomId: '',
        members: []
      };

      // Прив'язка подій
      const createBtn = host.querySelector('#create-room-btn');
      const nameInput = host.querySelector('#new-room-name');

      if (createBtn) {
        createBtn.addEventListener('click', () => createRoom(host, state));
      }

      if (nameInput) {
        nameInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') createRoom(host, state);
        });
      }

      // Завантаження початкових даних
      if (hasAuth()) {
        fetchRoomsWithNames(state).then(() => renderRooms(host, state));
      }

      // Слухач подій авторизації
      document.addEventListener('auth:success', () => {
        fetchRoomsWithNames(state).then(() => renderRooms(host, state));
      });
    },
    
    getCurrentRoomId() {
      return window.Sidebar?.state?.roomId || '';
    }
  };
})();