// server.js
const express = require('express');
const multer  = require('multer');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Konfigurasi penyimpanan file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    // Simpan dengan nama asli atau bisa dikustomisasi
    cb(null, Date.now() + '-' + file.originalname)
  }
});
const upload = multer({ storage: storage });

// Middleware untuk parsing JSON
app.use(express.json());

// Sajikan file statis di folder public
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint upload video
app.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'File tidak ditemukan' });
  }
  res.json({ message: 'Upload berhasil', file: req.file.filename });
});

// Fungsi untuk memulai streaming menggunakan FFmpeg
function startStreaming({ inputFile, orientation, fps, bitrate, quality, rtmpUrl }) {
  let videoFilter = '';
  if (orientation === 'portrait') {
    // Misal, untuk portrait set resolusi 720x1280
    videoFilter = 'scale=720:1280';
  } else {
    // Untuk landscape set resolusi 1280x720
    videoFilter = 'scale=1280:720';
  }

  const ffmpegArgs = [
    '-re',
    '-stream_loop', '-1', // Loop video tanpa henti
    '-i', inputFile,
    '-vf', videoFilter,
    '-r', fps.toString(),
    '-b:v', bitrate,
    '-preset', quality,
    '-f', 'flv',
    rtmpUrl
  ];

  console.log('Menjalankan FFmpeg dengan argumen:', ffmpegArgs.join(' '));
  const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

  ffmpegProcess.stdout.on('data', (data) => {
    console.log('FFmpeg stdout:', data.toString());
  });

  ffmpegProcess.stderr.on('data', (data) => {
    console.error('FFmpeg stderr:', data.toString());
  });

  ffmpegProcess.on('exit', (code) => {
    console.log(`Proses FFmpeg selesai dengan kode ${code}`);
  });

  return ffmpegProcess;
}

// Endpoint untuk memulai streaming ke beberapa platform
app.post('/start-stream', (req, res) => {
  const {
    fileName,    // nama file yang telah diupload, misal: '1627891234567-video.mp4'
    orientation, // 'portrait' atau 'landscape'
    fps,         // misal: 30
    bitrate,     // misal: '2500k'
    quality,     // misal: 'fast'
    rtmpUrls     // array URL RTMP, misal: [ 'rtmp://a.rtmp.youtube.com/live2/xxx', 'rtmp://live-api-s.facebook.com/rtmp/yyy' ]
  } = req.body;

  if (!fileName || !rtmpUrls || rtmpUrls.length === 0) {
    return res.status(400).json({ message: 'Parameter tidak lengkap' });
  }

  const inputFile = path.join(__dirname, 'uploads', fileName);
  const processes = [];

  rtmpUrls.forEach(url => {
    const proc = startStreaming({ inputFile, orientation, fps, bitrate, quality, rtmpUrl: url });
    processes.push(proc);
  });

  res.json({ message: 'Streaming dimulai', processCount: processes.length });
});

app.listen(port, () => {
  console.log(`Server berjalan pada http://localhost:${port}`);
});
