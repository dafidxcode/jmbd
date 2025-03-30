// Upload Form
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  
  const response = await fetch('/upload', {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  document.getElementById('uploadResponse').textContent = result.message + (result.filename ? ' - ' + result.filename : '');
});

// Stream Form
document.getElementById('streamForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  
  const payload = {
    filename: formData.get('filename'),
    rtmpUrl: formData.get('rtmpUrl')
  };
  
  const response = await fetch('/start-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const result = await response.json();
  document.getElementById('streamResponse').textContent = result.message;
});
