// sidebar/sidebar.js
(function () {
  const state = {
    rooms: [
      { roomId: '!demo1:server', name: 'General' },
      { roomId: '!demo2:server', name: 'Development' }
    ],
    currentRoomId: '!demo1:server'
  };

  function renderRooms(host) {
    const list = host.querySelector('#sidebar-list');
    list.innerHTML = '';
    state.rooms.forEach(r => {
      const el = document.createElement('div');
      el.className = 'sidebar__room' + (r.roomId === state.currentRoomId ? ' sidebar__room--active' : '');
      el.textContent = r.name;
      el.onclick = () => {
        state.currentRoomId = r.roomId;
        renderRooms(host);
      };
      list.appendChild(el);
    });
  }

  function attachActions(host) {
    const input = host.querySelector('#sidebar-room-name');
    const btn   = host.querySelector('#sidebar-create');
    const info  = host.querySelector('#sidebar-created');

    btn.addEventListener('click', () => {
      const name = input.value.trim();
      if (!name) return;
      const roomId = '!' + Math.random().toString(36).slice(2);
      state.rooms.push({ roomId, name });
      state.currentRoomId = roomId;
      renderRooms(host);
      input.value = '';
      info.textContent = 'Створено кімнату: ' + roomId;
      setTimeout(() => info.textContent = '', 1500);
    });
  }

  window.Sidebar = {
    init(hostEl) {
      renderRooms(hostEl);
      attachActions(hostEl);
    }
  };
})();
