// Tangani form upload video
document.getElementById('uploadForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  fetch(form.action, {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    document.getElementById('uploadResponse').textContent = data.message;
    // Reload halaman setelah upload agar daftar video terupdate
    setTimeout(() => { window.location.reload(); }, 1000);
  })
  .catch(err => {
    document.getElementById('uploadResponse').textContent = 'Terjadi kesalahan.';
  });
});

// Tangani form start streaming untuk setiap video
document.querySelectorAll('.startStreamForm').forEach(form => {
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const filename = form.getAttribute('data-filename');
    const streamUrl = form.querySelector('input[name="streamUrl"]').value;
    fetch('/start-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, streamUrl })
    })
    .then(res => res.json())
    .then(data => {
      alert(data.message);
    })
    .catch(err => {
      alert('Terjadi kesalahan saat memulai streaming.');
    });
  });
});
