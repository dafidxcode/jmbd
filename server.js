// server.js
const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware untuk parsing JSON dan form urlencoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sajikan file statis di folder public
app.use(express.static(path.join(__dirname, 'public')));

// Pastikan folder uploads ada
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

// Konfigurasi Multer untuk upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Endpoint untuk mengunggah video
app.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File video diperlukan' });
  }
  res.json({ message: 'Upload berhasil', filename: req.file.filename });
});

// Fungsi untuk memulai live streaming dengan FFmpeg
function startStreaming(videoPath, rtmpUrl) {
  // Contoh perintah FFmpeg:
  // -re           : Baca input dengan kecepatan aslinya
  // -stream_loop -1 : Loop video tanpa henti
  // -c:v libx264  : Gunakan codec video H.264
  // -b:v 2500k    : Bitrate video 2500 kbps
  // -preset veryfast : Preset encoding
  // -r 30         : 30 FPS
  // -g 60         : Keyframe setiap 60 frame
  // -c:a aac     : Gunakan codec audio AAC
  // -b:a 128k    : Bitrate audio 128 kbps
  // -ar 44100   : Sample rate audio 44100 Hz
  // -f flv       : Format output FLV untuk RTMP
  const ffmpegArgs = [
    '-re',
    '-stream_loop', '-1',
    '-i', videoPath,
    '-c:v', 'libx264',
    '-b:v', '2500k',
    '-preset', 'veryfast',
    '-r', '30',
    '-g', '60',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-f', 'flv',
    rtmpUrl
  ];

  console.log('Memulai streaming dengan perintah: ffmpeg ' + ffmpegArgs.join(' '));
  const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

  ffmpegProcess.stdout.on('data', (data) => console.log(`ffmpeg stdout: ${data}`));
  ffmpegProcess.stderr.on('data', (data) => console.log(`ffmpeg stderr: ${data}`));
  ffmpegProcess.on('close', (code) => console.log(`Proses FFmpeg berhenti dengan kode ${code}`));

  return ffmpegProcess;
}

// Endpoint untuk memulai streaming
app.post('/start-stream', (req, res) => {
  const { filename, rtmpUrl } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Filename diperlukan' });
  }
  const videoPath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'File tidak ditemukan' });
  }

  // Jika rtmpUrl tidak dikirimkan, gunakan default RTMPS Facebook dengan API key yang diberikan
  const streamUrl = rtmpUrl || 'rtmps://live-api-s.facebook.com:443/rtmp/FB-2062378527522704-0-Ab2r5gJPGBAybYSSp3rG9KKL';

  const streamProcess = startStreaming(videoPath, streamUrl);
  res.json({ message: 'Streaming dimulai', processId: streamProcess.pid });
});

app.listen(PORT, () => console.log(`Server berjalan pada http://localhost:${PORT}`));
