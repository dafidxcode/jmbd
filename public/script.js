// Toggle Dark Mode
const toggleDarkModeBtn = document.getElementById('toggleDarkMode');
toggleDarkModeBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
});

// Upload Form
const uploadForm = document.getElementById('uploadForm');
const uploadResult = document.getElementById('uploadResult');

uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(uploadForm);
  try {
    const res = await fetch('/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    uploadResult.textContent = data.message + '. Nama file: ' + data.file;
  } catch (error) {
    uploadResult.textContent = 'Terjadi kesalahan pada upload.';
  }
});

// Stream Form
const streamForm = document.getElementById('streamForm');
const streamResult = document.getElementById('streamResult');

streamForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(streamForm);
  // Mengubah RTMP URLs menjadi array dengan memisahkan berdasarkan koma
  const rtmpUrls = formData.get('rtmpUrls').split(',').map(url => url.trim());
  const payload = {
    fileName: formData.get('fileName'),
    orientation: formData.get('orientation'),
    fps: parseInt(formData.get('fps'), 10),
    bitrate: formData.get('bitrate'),
    quality: formData.get('quality'),
    rtmpUrls: rtmpUrls
  };

  try {
    const res = await fetch('/start-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    streamResult.textContent = data.message;
  } catch (error) {
    streamResult.textContent = 'Terjadi kesalahan saat memulai streaming.';
  }
});
