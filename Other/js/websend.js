    const modeSelect = document.getElementById('modeSelect');
    const basicFields = document.getElementById('basicFields');
    const forumFields = document.getElementById('forumFields');
    const threadNameField = document.getElementById('threadNameField');
    const threadIdField = document.getElementById('threadIdField');
    const status = document.getElementById('status');

    modeSelect.value = localStorage.getItem('lastMode') || 'basic';

    document.getElementById('webhookUrl_basic').value = localStorage.getItem('webhookUrl_basic') || '';
    document.getElementById('username_basic').value = localStorage.getItem('username_basic') || '';
    document.getElementById('webhookUrl_forum').value = localStorage.getItem('webhookUrl_forum') || '';
    document.getElementById('username_forum').value = localStorage.getItem('username_forum') || '';

    function renderMode() {
      const mode = modeSelect.value;
      basicFields.style.display = mode === 'basic' ? 'block' : 'none';
      forumFields.style.display = mode === 'basic' ? 'none' : 'block';
      threadNameField.style.display = mode === 'forumNew' ? 'block' : 'none';
      threadIdField.style.display = mode === 'forumReply' ? 'block' : 'none';
      localStorage.setItem('lastMode', mode);
    }
    modeSelect.onchange = renderMode;
    renderMode();

    document.getElementById('sendBtn').onclick = async () => {
      const mode = modeSelect.value;
      const content = document.getElementById('message').value.trim();

      let url, username;

      if (mode === 'basic') {
        url = document.getElementById('webhookUrl_basic').value.trim();
        username = document.getElementById('username_basic').value.trim();
        localStorage.setItem('webhookUrl_basic', url);
        localStorage.setItem('username_basic', username);
      } else {
        url = document.getElementById('webhookUrl_forum').value.trim();
        username = document.getElementById('username_forum').value.trim();
        localStorage.setItem('webhookUrl_forum', url);
        localStorage.setItem('username_forum', username);
      }

      if (!url || !content) {
        status.textContent = 'Need a webhook URL and a message, chief.';
        return;
      }

      const payload = {content, ...(username && {username})};
      let sendUrl = url;

      if (mode === 'forumNew') {
        const threadName = document.getElementById('threadName').value.trim();
        if (!threadName) {
          status.textContent = 'Forum posts need a title (thread_name), chief.';
          return;
        }
        payload.thread_name = threadName;
      }

      if (mode === 'forumReply') {
        const threadId = document.getElementById('threadId').value.trim();
        if (!threadId) {
          status.textContent = 'Need a thread_id to reply into, chief.';
          return;
        }
        sendUrl = `${url}?thread_id=${threadId}`;
      }

      status.textContent = 'Sending...';

      try {
        const res = await fetch(sendUrl, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload)
        });

        if (res.ok || res.status === 204) {
          status.textContent = '✅ Sent!';
          document.getElementById('message').value = '';
        } else {
          status.textContent = `❌ Failed: ${res.status}`;
        }
      } catch (err) {
        status.textContent = `❌ Error: ${err.message}`;
      }
    };

    // Back button: return to wherever this tool was opened from, if possible
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        document.body.classList.add('page-leaving');
        setTimeout(() => {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.href = backBtn.getAttribute('href');
          }
        }, 220);
      });
    }
    // Guard against a stuck fade if the browser restores this page from cache
    window.addEventListener('pageshow', () => {
      document.body.classList.remove('page-leaving');
    });
  