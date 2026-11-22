async function checkHealth() {
  const titleEl = document.getElementById('status-title');
  const messageEl = document.getElementById('status-message');
  const badgeEl = document.getElementById('status-badge');

  try {
    const response = await fetch('/api/health');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.status === 'ok') {
      titleEl.textContent = 'TeamBoard is running';
      messageEl.textContent = 'API server is healthy and responding.';
      badgeEl.textContent = 'Operational';
      badgeEl.className = 'tb-badge success';
    } else {
      titleEl.textContent = 'System degraded';
      messageEl.textContent = 'Unexpected response from API.';
      badgeEl.textContent = 'Degraded';
      badgeEl.className = 'tb-badge error';
    }
  } catch (error) {
    titleEl.textContent = 'Connection failed';
    messageEl.textContent = 'Could not reach the TeamBoard backend API.';
    badgeEl.textContent = 'Offline';
    badgeEl.className = 'tb-badge error';
  }
}

document.addEventListener('DOMContentLoaded', checkHealth);
