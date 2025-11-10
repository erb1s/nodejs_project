// user/user.js
(function () {
  const API_BASE = 'https://matrix.org/_matrix/client/r0';

  function state() {
    return {
      accessToken: window.AppAuth?.accessToken || '',
      roomId: '',
      members: [],
    };
  }

  async function fetchRoomMembers(st) {
    if (!st.accessToken || !st.roomId) return;

    try {
      const res = await fetch(`${API_BASE}/rooms/${encodeURIComponent(st.roomId)}/joined_members`, {
        headers: { 'Authorization': `Bearer ${st.accessToken}` }
      });
      const data = await res.json();

      const members = Object.entries(data.joined || {}).map(([userId, info]) => ({
        userId,
        displayName: info.display_name || userId.split(':')[0].substring(1),
        avatarUrl: info.avatar_url || ''
      }));

      st.members = members;
      renderMembers(members);
    } catch (e) {
      console.error('Error fetching room members:', e);
    }
  }

  function renderMembers(members) {
    const ul = document.getElementById('room-members');
    const loading = document.getElementById('members-loading');
    if (!ul) return;

    ul.innerHTML = '';
    loading && (loading.style.display = members.length ? 'none' : 'block');

    members.forEach(m => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      const idFrag = document.createElement('span');
      name.textContent = m.displayName;
      idFrag.textContent = `(${m.userId.split(':')[0].substring(1)})`;
      idFrag.className = 'text-gray-500';
      li.appendChild(name);
      li.appendChild(idFrag);
      ul.appendChild(li);
    });
  }

  async function inviteUser(st, userId) {
    if (!st.accessToken || !st.roomId || !userId) return;
    try {
      await fetch(`${API_BASE}/rooms/${encodeURIComponent(st.roomId)}/invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${st.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId })
      });
      // Можна показати тост/повідомлення про успіх
    } catch (e) {
      console.error('Invite error:', e);
    }
  }

  async function joinRoom(st, joinRoomId) {
    if (!st.accessToken || !joinRoomId) return;
    try {
      await fetch(`${API_BASE}/join/${encodeURIComponent(joinRoomId)}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${st.accessToken}` }
      });
      // Після join можна оновити список кімнат (слухає Sidebar)
      document.dispatchEvent(new CustomEvent('rooms:refresh'));
    } catch (e) {
      console.error('Join error:', e);
    }
  }

  function wireEvents(st, host) {
    const inviteInput = host.querySelector('#invite-user');
    const inviteBtn   = host.querySelector('#invite-btn');
    const joinInput   = host.querySelector('#join-room-id');
    const joinBtn     = host.querySelector('#join-btn');

    inviteBtn?.addEventListener('click', () => inviteUser(st, inviteInput?.value?.trim()));
    joinBtn?.addEventListener('click', () => joinRoom(st, joinInput?.value?.trim()));

    document.addEventListener('auth:success', (e) => {
      st.accessToken = e.detail.accessToken;
      // при авторизації перезавантажимо учасників, якщо кімната вже вибрана
      fetchRoomMembers(st);
    });

    // Отримуємо оновлення при зміні кімнати (надсилає Sidebar)
    document.addEventListener('room:changed', (e) => {
      st.roomId = e.detail.roomId || '';
      fetchRoomMembers(st);
    });
  }

  window.User = {
    init(host) {
      const st = state();
      wireEvents(st, host);
      // Якщо вже авторизовані й кімната є — завантажити
      fetchRoomMembers(st);
    }
  };
})();
