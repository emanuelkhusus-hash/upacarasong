/**
 * app.js - Logika Portal Pengelola & Upload Lagu (Upacara Song Repository)
 * Mendukung GitHub REST API, File System Access API, Audio Preview, & Manajemen Katalog
 */

const state = {
  songs: [],
  selectedFile: null,
  activeFilter: 'all',
  searchQuery: '',
  gitConfig: {
    owner: '',
    repo: '',
    branch: 'main',
    token: ''
  },
  dirHandle: null, // Chrome FileSystemDirectoryHandle (jika mode lokal)
  currentPlayingAudio: null,
  currentPlayingId: null
};

// ==========================================
// Inisialisasi
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  loadGitConfig();
  initDropzone();
  initFormInputs();
  initFilterTabs();
  initSearch();
  initModals();
  initActions();

  loadSongsFromCatalog();
});

// ==========================================
// Load & Simpan Konfigurasi GitHub
// ==========================================
function loadGitConfig() {
  const saved = localStorage.getItem('upacara_repo_github_cfg');
  if (saved) {
    try {
      state.gitConfig = JSON.parse(saved);
      document.getElementById('cfgOwner').value = state.gitConfig.owner || '';
      document.getElementById('cfgRepo').value = state.gitConfig.repo || '';
      document.getElementById('cfgBranch').value = state.gitConfig.branch || 'main';
      document.getElementById('cfgToken').value = state.gitConfig.token || '';
    } catch (e) {
      console.warn('Gagal membaca saved github config');
    }
  }
  updateSyncBadge();
  updateCdnDisplay();
}

function saveGitConfig() {
  state.gitConfig.owner = document.getElementById('cfgOwner').value.trim();
  state.gitConfig.repo = document.getElementById('cfgRepo').value.trim();
  state.gitConfig.branch = document.getElementById('cfgBranch').value.trim() || 'main';
  state.gitConfig.token = document.getElementById('cfgToken').value.trim();

  localStorage.setItem('upacara_repo_github_cfg', JSON.stringify(state.gitConfig));
  updateSyncBadge();
  updateCdnDisplay();
}

function updateSyncBadge() {
  const badge = document.getElementById('syncBadge');
  const text = document.getElementById('syncText');
  if (state.gitConfig.token && state.gitConfig.owner && state.gitConfig.repo) {
    badge.className = 'badge-status connected';
    text.textContent = `GitHub: ${state.gitConfig.owner}/${state.gitConfig.repo}`;
  } else {
    badge.className = 'badge-status disconnected';
    text.textContent = 'GitHub Belum Dikonfigurasi';
  }
}

function updateCdnDisplay() {
  const input = document.getElementById('cdnUrlInput');
  if (state.gitConfig.owner && state.gitConfig.repo) {
    input.value = `https://cdn.jsdelivr.net/gh/${state.gitConfig.owner}/${state.gitConfig.repo}@${state.gitConfig.branch}/songs.json`;
  } else {
    input.value = 'songs.json (Lokal)';
  }
}

// ==========================================
// Muat Katalog songs.json
// ==========================================
async function loadSongsFromCatalog() {
  try {
    const res = await fetch(`songs.json?nocache=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      state.songs = data.songs || [];
      renderStats();
      renderCatalog();
    } else {
      console.warn('Katalog songs.json lokal belum dapat diakses melalui HTTP, memuat fallback.');
    }
  } catch (err) {
    console.warn('Tidak dapat mem-fetch songs.json via fetch:', err);
  }
}

function renderStats() {
  const total = state.songs.length;
  const mp3 = state.songs.filter(s => !s.isMidi).length;
  const midi = state.songs.filter(s => s.isMidi).length;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statMp3').textContent = mp3;
  document.getElementById('statMidi').textContent = midi;
  document.getElementById('songCountSubtitle').textContent = `${total} lagu terdaftar dalam katalog`;
}

// ==========================================
// Dropzone & File Handling
// ==========================================
function initDropzone() {
  const dropzone = document.getElementById('audioDropzone');
  const fileInput = document.getElementById('fileAudio');
  const emptyView = document.getElementById('dropzoneEmpty');
  const previewView = document.getElementById('dropzonePreview');
  const btnRemove = document.getElementById('btnRemoveFile');

  dropzone.addEventListener('click', (e) => {
    if (e.target !== btnRemove && !btnRemove.contains(e.target)) {
      fileInput.click();
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      handleFileSelected(fileInput.files[0]);
    }
  });

  btnRemove.addEventListener('click', (e) => {
    e.stopPropagation();
    clearSelectedFile();
  });
}

function handleFileSelected(file) {
  state.selectedFile = file;

  const emptyView = document.getElementById('dropzoneEmpty');
  const previewView = document.getElementById('dropzonePreview');
  const nameEl = document.getElementById('previewName');
  const metaEl = document.getElementById('previewMeta');

  emptyView.style.display = 'none';
  previewView.style.display = 'flex';

  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  const isMidi = (ext === '.mid' || ext === '.midi');
  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);

  nameEl.textContent = file.name;
  metaEl.textContent = `${sizeMb} MB • ${isMidi ? 'MIDI Audio' : ext.replace('.', '').toUpperCase()}`;

  // Auto-fill Title dan ID jika belum diisi
  const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
  const cleanTitle = baseName.replace(/_/g, ' ').replace(/-/g, ' ').trim();
  const cleanId = baseName.toLowerCase().replace(/[^a-z0-9_]/g, '_') + (ext.replace('.', '_'));

  const inputTitle = document.getElementById('inputTitle');
  const inputId = document.getElementById('inputId');

  if (!inputTitle.value) {
    inputTitle.value = cleanTitle;
  }
  inputId.value = cleanId;

  // Pratinjau pemutar audio jika audio browser playable
  const previewWrap = document.getElementById('audioPreviewWrap');
  const previewPlayer = document.getElementById('audioPreviewPlayer');

  if (!isMidi && (ext === '.mp3' || ext === '.wav' || ext === '.ogg')) {
    const objectUrl = URL.createObjectURL(file);
    previewPlayer.src = objectUrl;
    previewWrap.style.display = 'block';
  } else {
    previewWrap.style.display = 'none';
    previewPlayer.src = '';
  }
}

function clearSelectedFile() {
  state.selectedFile = null;
  document.getElementById('fileAudio').value = '';
  document.getElementById('dropzoneEmpty').style.display = 'block';
  document.getElementById('dropzonePreview').style.display = 'none';

  const previewWrap = document.getElementById('audioPreviewWrap');
  const previewPlayer = document.getElementById('audioPreviewPlayer');
  previewPlayer.src = '';
  previewWrap.style.display = 'none';
}

function initFormInputs() {
  document.getElementById('inputTitle').addEventListener('input', (e) => {
    if (state.selectedFile) {
      const ext = state.selectedFile.name.substring(state.selectedFile.name.lastIndexOf('.')).toLowerCase();
      const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') + (ext.replace('.', '_'));
      document.getElementById('inputId').value = val;
    }
  });
}

// ==========================================
// Filter & Search Katalog
// ==========================================
function initFilterTabs() {
  const container = document.getElementById('categoryFilterPills');
  container.addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    container.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    state.activeFilter = pill.dataset.cat;
    renderCatalog();
  });
}

function initSearch() {
  const input = document.getElementById('filterSearch');
  input.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase();
    renderCatalog();
  });
}

function renderCatalog() {
  const container = document.getElementById('songsTableContainer');
  container.innerHTML = '';

  const filtered = state.songs.filter(s => {
    if (state.activeFilter !== 'all' && s.category !== state.activeFilter) {
      return false;
    }
    if (state.searchQuery) {
      const matchTitle = (s.title || '').toLowerCase().includes(state.searchQuery);
      const matchCat = (s.category || '').toLowerCase().includes(state.searchQuery);
      const matchDesc = (s.description || '').toLowerCase().includes(state.searchQuery);
      return matchTitle || matchCat || matchDesc;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 16px; color: var(--text-dim);">
        <p>Tidak ada lagu yang sesuai kriteria pencarian.</p>
      </div>
    `;
    return;
  }

  filtered.forEach(song => {
    const row = document.createElement('div');
    row.className = 'song-row';
    const tagClass = song.isMidi ? 'tag-midi' : 'tag-mp3';
    const tagText = song.isMidi ? 'MIDI' : 'MP3';

    row.innerHTML = `
      <div class="song-left">
        <button class="btn-play-preview" data-id="${song.id}" title="Pratinjau Suara">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <div class="song-details">
          <div class="song-title-row">
            <span class="song-title">${escapeHtml(song.title)}</span>
            <span class="tag-badge ${tagClass}">${tagText}</span>
            <span class="card-badge">${escapeHtml(song.category || 'Umum')}</span>
          </div>
          <p class="song-desc">${escapeHtml(song.description || song.directUrl || '')}</p>
        </div>
      </div>
      <div class="song-actions">
        <button class="btn-icon-action btn-copy-link" data-url="${song.directUrl || ''}" title="Salin URL Direct Audio">
          <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
        </button>
        <button class="btn-icon-action btn-del" data-id="${song.id}" title="Hapus dari Katalog">
          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    `;

    // Event listener play audio preview
    const btnPlay = row.querySelector('.btn-play-preview');
    btnPlay.addEventListener('click', () => togglePlaySong(song, btnPlay));

    // Event copy directUrl
    const btnCopy = row.querySelector('.btn-copy-link');
    btnCopy.addEventListener('click', () => {
      let finalUrl = song.directUrl || '';
      if (state.gitConfig.owner && state.gitConfig.repo && !finalUrl.startsWith('http')) {
        finalUrl = `https://cdn.jsdelivr.net/gh/${state.gitConfig.owner}/${state.gitConfig.repo}@${state.gitConfig.branch}/${finalUrl}`;
      }
      navigator.clipboard.writeText(finalUrl);
      showToast('✓ Link audio berhasil disalin ke clipboard!');
    });

    // Event remove song
    const btnDel = row.querySelector('.btn-del');
    btnDel.addEventListener('click', () => removeSongFromCatalog(song.id, song.title));

    container.appendChild(row);
  });
}

function togglePlaySong(song, buttonEl) {
  if (state.currentPlayingAudio && state.currentPlayingId === song.id) {
    state.currentPlayingAudio.pause();
    state.currentPlayingAudio = null;
    state.currentPlayingId = null;
    buttonEl.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    return;
  }

  if (state.currentPlayingAudio) {
    state.currentPlayingAudio.pause();
    state.currentPlayingAudio = null;
    document.querySelectorAll('.btn-play-preview').forEach(b => {
      b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    });
  }

  if (song.isMidi) {
    showToast('⚠️ Pratinjau file MIDI dapat diputar langsung di Upacara Player.');
    return;
  }

  let audioUrl = song.directUrl || '';
  if (!audioUrl.startsWith('http')) {
    if (state.gitConfig.owner && state.gitConfig.repo) {
      audioUrl = `https://cdn.jsdelivr.net/gh/${state.gitConfig.owner}/${state.gitConfig.repo}@${state.gitConfig.branch}/${audioUrl}`;
    }
  }

  const audio = new Audio(audioUrl);
  audio.play().then(() => {
    state.currentPlayingAudio = audio;
    state.currentPlayingId = song.id;
    buttonEl.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
  }).catch(e => {
    showToast('Gagal memutar audio: ' + e.message, true);
  });

  audio.onended = () => {
    buttonEl.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    state.currentPlayingAudio = null;
    state.currentPlayingId = null;
  };
}

// ==========================================
// Upload & Publikasi ke GitHub (API)
// ==========================================
async function publishToGitHub() {
  const { owner, repo, branch, token } = state.gitConfig;
  if (!token || !owner || !repo) {
    showToast('⚠️ Konfigurasi GitHub belum lengkap! Silakan klik "Pengaturan GitHub".', true);
    openSettingsModal();
    return;
  }

  if (!state.selectedFile) {
    showToast('⚠️ Silakan pilih file audio terlebih dahulu!', true);
    return;
  }

  const title = document.getElementById('inputTitle').value.trim();
  const category = document.getElementById('selectCategory').value;
  const songId = document.getElementById('inputId').value.trim();
  const desc = document.getElementById('inputDesc').value.trim();
  const driveId = document.getElementById('inputDriveId').value.trim();

  if (!title || !songId) {
    showToast('⚠️ Judul lagu dan ID harus diisi!', true);
    return;
  }

  const btnPublish = document.getElementById('btnPublishGitHub');
  btnPublish.disabled = true;

  const progressWrap = document.getElementById('uploadProgressWrap');
  const progressMsg = document.getElementById('progressMessage');
  const progressPercent = document.getElementById('progressPercent');
  const progressBarFill = document.getElementById('progressBarFill');

  progressWrap.style.display = 'block';

  try {
    // 1. Baca File Audio ke Base64
    progressMsg.textContent = 'Membaca file audio...';
    progressBarFill.style.width = '20%';
    progressPercent.textContent = '20%';

    const fileBuffer = await state.selectedFile.arrayBuffer();
    const base64Audio = arrayBufferToBase64(fileBuffer);
    const audioPath = `audio/${state.selectedFile.name}`;

    // 2. Upload Audio File ke GitHub via PUT /repos/{owner}/{repo}/contents/{path}
    progressMsg.textContent = `Mengunggah ${state.selectedFile.name} ke GitHub...`;
    progressBarFill.style.width = '45%';
    progressPercent.textContent = '45%';

    // Cek apakah file sudah ada untuk ambil sha (jika overwrite)
    let existingSha = null;
    try {
      const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${audioPath}?ref=${branch}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        existingSha = checkData.sha;
      }
    } catch (e) {}

    const putAudioRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${audioPath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        message: `add: audio ${state.selectedFile.name} via Upacara Song Portal`,
        content: base64Audio,
        branch: branch,
        sha: existingSha || undefined
      })
    });

    if (!putAudioRes.ok) {
      const errJson = await putAudioRes.json();
      throw new Error(errJson.message || `Gagal mengunggah file audio (Status ${putAudioRes.status})`);
    }

    // 3. Ambil songs.json terbaru dari GitHub
    progressMsg.textContent = 'Memperbarui katalog songs.json di GitHub...';
    progressBarFill.style.width = '75%';
    progressPercent.textContent = '75%';

    const getCatalogRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/songs.json?ref=${branch}&nocache=${Date.now()}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    let catalogSha = null;
    let catalogJson = {
      repository: "Upacara Song Repository",
      version: "1.0.0",
      description: "Katalog Lagu Upacara Bendera & Koor untuk Upacara Player",
      songs: []
    };

    if (getCatalogRes.ok) {
      const catalogData = await getCatalogRes.json();
      catalogSha = catalogData.sha;
      try {
        const decodedContent = decodeURIComponent(escape(atob(catalogData.content)));
        catalogJson = JSON.parse(decodedContent);
      } catch (e) {
        console.warn('Gagal decode songs.json dari GitHub, menggunakan fallback');
      }
    }

    // Tambah / Perbarui entri lagu di songs
    const ext = state.selectedFile.name.substring(state.selectedFile.name.lastIndexOf('.')).toLowerCase();
    const isMidi = (ext === '.mid' || ext === '.midi');

    const newSongEntry = {
      id: songId,
      title: title,
      category: category,
      directUrl: audioPath,
      isMidi: isMidi,
      description: desc || `Lagu pengiring upacara (${title})`
    };
    if (driveId) newSongEntry.driveId = driveId;

    // Hapus entry lama jika ID sama, lalu tambahkan baru
    catalogJson.songs = (catalogJson.songs || []).filter(s => s.id !== songId);
    catalogJson.songs.push(newSongEntry);

    // Encode updated songs.json ke Base64
    const updatedJsonString = JSON.stringify(catalogJson, null, 2);
    const base64Catalog = btoa(unescape(encodeURIComponent(updatedJsonString)));

    // 4. Commit songs.json kembali ke GitHub
    const putCatalogRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/songs.json`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        message: `update: katalog songs.json (+ ${title}) via Upacara Song Portal`,
        content: base64Catalog,
        branch: branch,
        sha: catalogSha || undefined
      })
    });

    if (!putCatalogRes.ok) {
      const errJson = await putCatalogRes.json();
      throw new Error(errJson.message || `Gagal commit songs.json (Status ${putCatalogRes.status})`);
    }

    progressBarFill.style.width = '100%';
    progressPercent.textContent = '100%';
    progressMsg.textContent = '✓ Lagu berhasil diunggah & dipublikasikan ke GitHub!';

    state.songs = catalogJson.songs;
    renderStats();
    renderCatalog();

    showToast(`🎉 Berhasil! Lagu "${title}" telah dipublikasikan ke GitHub.`);
    clearSelectedFile();
    document.getElementById('inputTitle').value = '';
    document.getElementById('inputId').value = '';
    document.getElementById('inputDesc').value = '';
    document.getElementById('inputDriveId').value = '';

    setTimeout(() => {
      progressWrap.style.display = 'none';
      progressBarFill.style.width = '0%';
    }, 3500);

  } catch (err) {
    console.error('Error publishing to GitHub:', err);
    progressMsg.textContent = `⚠️ Error: ${err.message}`;
    showToast(`Gagal mengunggah: ${err.message}`, true);
  } finally {
    btnPublish.disabled = false;
  }
}

// ==========================================
// Simpan ke Komputer Lokal (File System Access)
// ==========================================
async function saveToLocalFolder() {
  if (!('showDirectoryPicker' in window)) {
    showToast('⚠️ Browser Anda tidak mendukung File System Access API. Gunakan Chrome atau Edge.', true);
    return;
  }

  if (!state.selectedFile) {
    showToast('⚠️ Silakan pilih file audio terlebih dahulu!', true);
    return;
  }

  try {
    if (!state.dirHandle) {
      state.dirHandle = await window.showDirectoryPicker();
    }

    // Dapatkan folder audio/ di dalam folder repo
    const audioDirHandle = await state.dirHandle.getDirectoryHandle('audio', { create: true });
    const fileHandle = await audioDirHandle.getFileHandle(state.selectedFile.name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(state.selectedFile);
    await writable.close();

    // Baca dan update songs.json
    let songsFileHandle = await state.dirHandle.getFileHandle('songs.json', { create: true });
    let catalog = {
      repository: "Upacara Song Repository",
      version: "1.0.0",
      description: "Katalog Lagu Upacara Bendera & Koor untuk Upacara Player",
      songs: []
    };

    try {
      const fileData = await songsFileHandle.getFile();
      const text = await fileData.text();
      catalog = JSON.parse(text);
    } catch (e) {}

    const title = document.getElementById('inputTitle').value.trim() || state.selectedFile.name;
    const category = document.getElementById('selectCategory').value;
    const songId = document.getElementById('inputId').value.trim();
    const desc = document.getElementById('inputDesc').value.trim();
    const ext = state.selectedFile.name.substring(state.selectedFile.name.lastIndexOf('.')).toLowerCase();
    const isMidi = (ext === '.mid' || ext === '.midi');

    const newSong = {
      id: songId,
      title: title,
      category: category,
      directUrl: `audio/${state.selectedFile.name}`,
      isMidi: isMidi,
      description: desc || `Lagu pengiring upacara (${title})`
    };

    catalog.songs = (catalog.songs || []).filter(s => s.id !== songId);
    catalog.songs.push(newSong);

    const jsonWritable = await songsFileHandle.createWritable();
    await jsonWritable.write(JSON.stringify(catalog, null, 2));
    await jsonWritable.close();

    state.songs = catalog.songs;
    renderStats();
    renderCatalog();

    showToast(`✓ Berhasil disimpan ke folder lokal: audio/${state.selectedFile.name}`);
    clearSelectedFile();
  } catch (err) {
    if (err.name !== 'AbortError') {
      showToast(`Gagal menyimpan: ${err.message}`, true);
    }
  }
}

// ==========================================
// Export songs.json
// ==========================================
function exportSongsJson() {
  const jsonStr = JSON.stringify({
    repository: "Upacara Song Repository",
    version: "1.0.0",
    description: "Katalog Lagu Upacara Bendera & Koor untuk Upacara Player",
    songs: state.songs
  }, null, 2);

  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'songs.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('✓ Berkas songs.json berhasil diunduh!');
}

// ==========================================
// Hapus Lagu dari Katalog
// ==========================================
async function removeSongFromCatalog(id, title) {
  if (!confirm(`Hapus lagu "${title}" dari katalog?`)) return;

  state.songs = state.songs.filter(s => s.id !== id);
  renderStats();
  renderCatalog();

  // Jika terhubung ke GitHub, tawarkan commit penghapusan
  const { owner, repo, branch, token } = state.gitConfig;
  if (token && owner && repo) {
    try {
      const getCatalogRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/songs.json?ref=${branch}&nocache=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (getCatalogRes.ok) {
        const data = await getCatalogRes.json();
        const catalogJson = JSON.parse(decodeURIComponent(escape(atob(data.content))));
        catalogJson.songs = (catalogJson.songs || []).filter(s => s.id !== id);

        const updatedJsonString = JSON.stringify(catalogJson, null, 2);
        const base64Catalog = btoa(unescape(encodeURIComponent(updatedJsonString)));

        await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/songs.json`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `remove: hapus lagu ${title} dari katalog songs.json`,
            content: base64Catalog,
            branch: branch,
            sha: data.sha
          })
        });
        showToast(`✓ Lagu "${title}" dihapus dan disinkronkan ke GitHub.`);
        return;
      }
    } catch (e) {
      console.warn('Gagal sinkron hapus ke GitHub:', e);
    }
  }

  showToast(`✓ Lagu "${title}" dihapus dari katalog lokal.`);
}

// ==========================================
// Helpers & Modal
// ==========================================
function initActions() {
  document.getElementById('btnPublishGitHub').addEventListener('click', publishToGitHub);
  document.getElementById('btnSaveLocalFolder').addEventListener('click', saveToLocalFolder);
  document.getElementById('btnExportJson').addEventListener('click', exportSongsJson);
  document.getElementById('btnReloadRepo').addEventListener('click', () => {
    loadSongsFromCatalog();
    showToast('✓ Data katalog berhasil dimuat ulang!');
  });

  document.getElementById('btnCopyCdnUrl').addEventListener('click', () => {
    const input = document.getElementById('cdnUrlInput');
    navigator.clipboard.writeText(input.value);
    showToast('✓ URL CDN berhasil disalin!');
  });
}

function initModals() {
  const modalSettings = document.getElementById('modalSettings');
  const modalGuide = document.getElementById('modalGuide');

  document.getElementById('btnOpenSettings').addEventListener('click', openSettingsModal);
  document.getElementById('btnCloseSettings').addEventListener('click', () => modalSettings.style.display = 'none');
  document.getElementById('btnSaveGithubCfg').addEventListener('click', () => {
    saveGitConfig();
    modalSettings.style.display = 'none';
    showToast('✓ Pengaturan GitHub berhasil disimpan!');
  });

  document.getElementById('btnOpenGuideModal').addEventListener('click', () => modalGuide.style.display = 'flex');
  document.getElementById('btnCloseGuide').addEventListener('click', () => modalGuide.style.display = 'none');
  document.getElementById('btnCloseGuideBtn').addEventListener('click', () => modalGuide.style.display = 'none');

  document.getElementById('btnTestGithubConn').addEventListener('click', testGitHubConnection);
}

function openSettingsModal() {
  document.getElementById('modalSettings').style.display = 'flex';
}

async function testGitHubConnection() {
  const owner = document.getElementById('cfgOwner').value.trim();
  const repo = document.getElementById('cfgRepo').value.trim();
  const token = document.getElementById('cfgToken').value.trim();
  const msgEl = document.getElementById('cfgStatusMsg');

  if (!owner || !repo || !token) {
    msgEl.className = 'alert-box error';
    msgEl.textContent = 'Harap isi Owner, Repo, dan Token terlebih dahulu.';
    msgEl.style.display = 'block';
    return;
  }

  msgEl.className = 'alert-box';
  msgEl.textContent = 'Menguji koneksi ke GitHub API...';
  msgEl.style.display = 'block';

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      msgEl.className = 'alert-box success';
      msgEl.textContent = `✓ Terhubung ke ${data.full_name} (${data.private ? 'Private' : 'Public'}). Akses API berhasil!`;
    } else {
      const err = await res.json();
      msgEl.className = 'alert-box error';
      msgEl.textContent = `⚠️ Gagal terhubung (${res.status}): ${err.message || 'Token salah atau repo tidak ditemukan'}`;
    }
  } catch (err) {
    msgEl.className = 'alert-box error';
    msgEl.textContent = `Error: ${err.message}`;
  }
}

function showToast(text, isError = false) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
  toast.textContent = text;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}
