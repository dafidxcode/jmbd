// server.js
const express = require('express');
const multer  = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const app = express();
const PORT = process.env.PORT || 3000;

// Inisialisasi database SQLite (file database.sqlite akan dibuat jika belum ada)
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) console.error(err.message);
  else console.log('Connected to SQLite database.');
});

// Buat tabel users dan videos (jika belum ada)
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    filename TEXT,
    orientation TEXT,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

// Konfigurasi sesi (maksimal 2 jam)
app.use(session({
  secret: 'streamx_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 2 * 60 * 60 * 1000 } // 2 jam
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(
  (username, password, done) => {
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
      if (err) return done(err);
      if (!row) return done(null, false, { message: 'Username atau password salah' });
      return done(null, row);
    });
  }
));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
    if (err) return done(err);
    done(null, row);
  });
});

// Set view engine EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Parsing JSON dan URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sajikan file statis di folder public
app.use(express.static(path.join(__dirname, 'public')));

// Pastikan folder uploads ada
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

// Konfigurasi Multer untuk upload video
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// ROUTING UNTUK AUTENTIKASI
// Halaman register
app.get('/register', (req, res) => {
  res.render('register', { message: null });
});
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('register', { message: 'Semua field harus diisi.' });
  }
  db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], function(err) {
    if (err) {
      return res.render('register', { message: 'Username sudah digunakan.' });
    }
    res.redirect('/login');
  });
});

// Halaman login
app.get('/login', (req, res) => {
  res.render('login', { message: null });
});
app.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard',
  failureRedirect: '/login'
}));

// Middleware proteksi route
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

// Halaman dashboard (menampilkan video user dan data streaming)
app.get('/dashboard', isAuthenticated, (req, res) => {
  // Ambil daftar video milik user dari database
  db.all('SELECT * FROM videos WHERE user_id = ?', [req.user.id], (err, rows) => {
    if (err) rows = [];
    res.render('dashboard', { user: req.user, videos: rows });
  });
});

// Logout
app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/login');
  });
});

// ENDPOINT API UNTUK UPLOAD & STREAMING
// Upload video; form harus mengirim field 'orientation' (portrait/landscape)
app.post('/upload', isAuthenticated, upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File video diperlukan' });
  }
  const orientation = req.body.orientation || 'landscape';
  // Simpan data video ke DB
  db.run('INSERT INTO videos (user_id, filename, orientation) VALUES (?, ?, ?)', [req.user.id, req.file.filename, orientation], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Gagal menyimpan data video' });
    }
    res.json({ message: 'Upload berhasil', filename: req.file.filename });
  });
});

// Fungsi untuk memulai streaming menggunakan FFmpeg tanpa re-encode video
function startStreaming(videoPath, streamUrl) {
  const ffmpegArgs = [
    "-re",
    "-stream_loop", "-1",
    "-i", videoPath,
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "128k",
    "-f", "flv",
    streamUrl
  ];
  console.log("Memulai streaming dengan perintah: ffmpeg " + ffmpegArgs.join(" "));
  const ffmpegProcess = spawn("ffmpeg", ffmpegArgs);
  ffmpegProcess.stdout.on("data", (data) => console.log(`ffmpeg stdout: ${data}`));
  ffmpegProcess.stderr.on("data", (data) => console.log(`ffmpeg stderr: ${data}`));
  ffmpegProcess.on("close", (code) => console.log(`Proses FFmpeg berhenti dengan kode ${code}`));
  return ffmpegProcess;
}

// Endpoint untuk memulai streaming video
// Form mengirimkan: filename (video yang sudah diupload), streamUrl (RTMP URL)
app.post('/start-stream', isAuthenticated, (req, res) => {
  const { filename, streamUrl } = req.body;
  if (!filename || !streamUrl) {
    return res.status(400).json({ error: 'Filename dan stream URL diperlukan' });
  }
  const videoPath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'File tidak ditemukan' });
  }
  // Jalankan FFmpeg dengan perintah tanpa re-encode
  const streamProcess = startStreaming(videoPath, streamUrl);
  res.json({ message: 'Streaming dimulai', processId: streamProcess.pid });
});

app.listen(PORT, () => console.log(`Server berjalan pada http://localhost:${PORT}`));
