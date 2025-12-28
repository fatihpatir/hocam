// NHMTAL Teacher PWA - Main Logic v7
let db;
const DB_NAME = 'NHMTAL_DB';
const DB_VERSION = 3;

// Global current state
let currentClassId = null;
let currentStudentId = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log("NHMTAL App v7 Initializing...");

    try {
        initDB();
    } catch (e) {
        console.error("Critical DB Init Error:", e);
    }

    try {
        setupNavigation();
        setupProfileLogic();
        setupClassLogic();
        setupStudentLogic();
        setupPerformanceLogic();
        setupAlumniLogic();
        setupTransitionLogic();
        setupPDFLogic();
        setupPlansLogic();
        setupSettingsLogic();
    } catch (e) {
        console.error("Setup Error:", e);
    }

    // Check theme
    try {
        const savedTheme = localStorage.getItem('app-theme') || 'navy';
        applyTheme(savedTheme);
    } catch (e) { console.warn("Theme load failed", e); }
});

function initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
        console.error("Database error: " + event.target.errorCode);
    };

    request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('teachers')) {
            db.createObjectStore('teachers', { keyPath: 'id', autoIncrement: true });
        }

        if (!db.objectStoreNames.contains('classes')) {
            const classStore = db.createObjectStore('classes', { keyPath: 'id', autoIncrement: true });
            classStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('students')) {
            const studentStore = db.createObjectStore('students', { keyPath: 'id', autoIncrement: true });
            studentStore.createIndex('classId', 'classId', { unique: false });
            studentStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('plans')) {
            const planStore = db.createObjectStore('plans', { keyPath: 'id', autoIncrement: true });
            planStore.createIndex('type', 'type', { unique: false });
        }
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        console.log("DB Initialized");
        checkFirstLaunch();
        renderClasses();
    };
}

// --- Navigation ---
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            const title = item.getAttribute('data-title');
            navigate(target, title);
        });
    });
}

function navigate(viewId, title) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    // Show target
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.add('active');
        if (title) document.getElementById('page-title').textContent = title;

        // Update nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('data-target') === viewId) item.classList.add('active');
            else item.classList.remove('active');
        });

        // Scroll top
        document.getElementById('main-content').scrollTop = 0;

        // Reset Student Detail State
        if (viewId !== 'view-student-profile') {
            currentStudentId = null;
        }

        // Custom View Refresh
        if (viewId === 'view-plans') {
            renderPlans('yearly');
            renderPlans('weekly');
        }
        if (viewId === 'view-students') {
            renderAllStudents();
        }
        if (viewId === 'view-classes') {
            renderClasses();
        }
        if (viewId === 'view-alumni') {
            renderAlumni();
        }
    }
}

// --- First Launch ---
function checkFirstLaunch() {
    const tx = db.transaction(['teachers'], 'readonly');
    const store = tx.objectStore('teachers');
    const req = store.get('teacher_profile');

    req.onsuccess = (e) => {
        if (!e.target.result) {
            showSetupMode();
        } else {
            loadTeacherProfile(e.target.result);
            showAppMode();
        }
    };
}

function showSetupMode() {
    document.getElementById('view-welcome').classList.add('active');
    document.querySelector('.bottom-nav').style.display = 'none';
    document.querySelector('.app-header').style.display = 'none';
}

function showAppMode() {
    document.getElementById('view-welcome').classList.remove('active');
    document.querySelector('.bottom-nav').style.display = 'flex';
    document.querySelector('.app-header').style.display = 'flex';
    navigate('view-profile', 'Profil');
}

// --- Teacher Profile Logic ---
function setupProfileLogic() {
    const form = document.getElementById('setup-form');
    const avatarOpts = document.querySelectorAll('.avatar-option');
    let selectedAvatar = 'avatar1.png';

    avatarOpts.forEach(opt => {
        opt.addEventListener('click', () => {
            avatarOpts.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedAvatar = opt.getAttribute('data-avatar');
        });
    });

    const photoUpload = document.getElementById('photo-upload');
    photoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const preview = document.getElementById('photo-preview');
                preview.src = ev.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveTeacherProfile();
    });

    document.getElementById('btn-edit-profile').addEventListener('click', () => {
        const tx = db.transaction(['teachers'], 'readonly');
        tx.objectStore('teachers').get('teacher_profile').onsuccess = (e) => {
            const t = e.target.result;
            if (t) {
                document.getElementById('setup-name').value = t.name;
                document.getElementById('setup-branch').value = t.branch;
                document.getElementById('setup-school').value = t.school;
                document.getElementById('setup-gender').value = t.gender;
                showSetupMode();
            }
        };
    });
}

function saveTeacherProfile() {
    const name = document.getElementById('setup-name').value;
    const branch = document.getElementById('setup-branch').value;
    const school = document.getElementById('setup-school').value;
    const gender = document.getElementById('setup-gender').value;
    const photoPreview = document.getElementById('photo-preview').src;

    // Determine avatar
    let avatar = '👨‍🏫';
    if (gender === 'female') avatar = '👩‍🏫';
    if (gender === 'none') avatar = '🧑‍🏫';

    const profileData = {
        id: 'teacher_profile',
        name,
        branch,
        school,
        gender,
        avatar,
        photo: (photoPreview && photoPreview.startsWith('data:')) ? photoPreview : null,
        updatedAt: new Date()
    };

    const tx = db.transaction(['teachers'], 'readwrite');
    tx.objectStore('teachers').put(profileData).onsuccess = () => {
        loadTeacherProfile(profileData);
        showAppMode();
    };
}

function loadTeacherProfile(t) {
    document.getElementById('disp-name').textContent = t.name;

    // Custom Slogan Logic
    const firstName = t.name.split(' ')[0];
    document.getElementById('disp-slogan').textContent = `${firstName} Hocamın Dijital Asistanı`;

    document.getElementById('disp-branch').textContent = t.branch;
    document.getElementById('disp-school').textContent = t.school || 'Belirtilmedi';
    document.getElementById('disp-gender').textContent = t.gender === 'male' ? 'Erkek' : (t.gender === 'female' ? 'Kadın' : 'Belirtilmedi');

    const avatarDisp = document.getElementById('profile-avatar-display');
    const imgDisp = document.getElementById('profile-img-display');

    if (t.photo) {
        imgDisp.src = t.photo;
        imgDisp.style.display = 'block';
        avatarDisp.style.display = 'none';
    } else {
        avatarDisp.textContent = t.avatar || '👨‍🏫';
        avatarDisp.style.display = 'block';
        imgDisp.style.display = 'none';
    }
}

// --- Class Logic ---
function setupClassLogic() {
    const btnAdd = document.getElementById('btn-add-class');
    const modal = document.getElementById('modal-class');
    const form = document.getElementById('form-class');

    btnAdd.addEventListener('click', () => {
        form.reset();
        document.getElementById('class-id').value = '';
        document.getElementById('modal-class-title').textContent = 'Yeni Sınıf Ekle';
        document.getElementById('btn-delete-class').style.display = 'none'; // Hide delete
        modal.classList.add('active');
    });

    document.getElementById('btn-close-class-modal').addEventListener('click', () => modal.classList.remove('active'));

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveClass();
    });

    document.getElementById('btn-delete-class').onclick = () => {
        const id = Number(document.getElementById('class-id').value);
        if (confirm("Bu sınıfı ve içindeki TÜM ÖĞRENCİLERİ silmek istediğinize emin misiniz?")) {
            deleteClass(id);
        }
    };
}

function saveClass() {
    const id = document.getElementById('class-id').value;
    const name = document.getElementById('class-name').value;

    // Auto-infer level (e.g., "9-A" -> 9, "Hazırlık" -> 0)
    let level = parseInt(name);
    if (isNaN(level)) level = 0;

    const data = { name, level };
    if (id) data.id = Number(id);

    const tx = db.transaction(['classes'], 'readwrite');
    tx.objectStore('classes').put(data).onsuccess = () => {
        document.getElementById('modal-class').classList.remove('active');
        renderClasses();
    };
}

function deleteClass(id) {
    const tx = db.transaction(['classes', 'students'], 'readwrite');
    tx.objectStore('classes').delete(id);
    const sStore = tx.objectStore('students');
    sStore.getAll().onsuccess = (e) => {
        const students = e.target.result.filter(s => s.classId === id);
        students.forEach(s => sStore.delete(s.id));
    };

    tx.oncomplete = () => {
        document.getElementById('modal-class').classList.remove('active');
        renderClasses();
    };
}

function renderClasses() {
    const list = document.getElementById('class-list');
    list.innerHTML = '';

    const tx = db.transaction(['classes'], 'readonly');
    tx.objectStore('classes').getAll().onsuccess = (e) => {
        const classes = e.target.result;
        if (classes.length === 0) {
            list.innerHTML = '<div class="empty-state"><p>Henüz hiç sınıf eklenmedi.</p></div>';
            return;
        }

        classes.forEach(c => {
            const card = document.createElement('div');
            card.className = 'student-card';
            card.innerHTML = `
                <div class="student-list-avatar">🏫</div>
                <div class="student-info">
                    <h4>${c.name}</h4>
                    <p>${c.level > 0 ? c.level + '. Sınıf' : 'Sınıf'}</p>
                </div>
                <button class="btn-text" style="margin-left:auto; font-size:1.2rem; color:#888;" onclick="event.stopPropagation(); openEditClassModal(${c.id})">⚙️</button>
            `;
            card.onclick = () => loadClassDetail(c.id);
            list.appendChild(card);
        });
    };
}

function openEditClassModal(id) {
    const tx = db.transaction(['classes'], 'readonly');
    tx.objectStore('classes').get(id).onsuccess = (e) => {
        const c = e.target.result;
        document.getElementById('class-id').value = c.id;
        document.getElementById('class-name').value = c.name;
        document.getElementById('modal-class-title').textContent = 'Sınıfı Düzenle';
        document.getElementById('btn-delete-class').style.display = 'block'; // Show delete
        document.getElementById('modal-class').classList.add('active');
    };
}

function loadClassDetail(classId) {
    currentClassId = classId;
    const tx = db.transaction(['classes'], 'readonly');
    tx.objectStore('classes').get(classId).onsuccess = (e) => {
        const c = e.target.result;
        document.getElementById('class-detail-title').textContent = c.name;
        navigate('view-class-detail');
        renderStudents(classId);
    };
}

// --- Student Logic ---
function setupStudentLogic() {
    const btnAdd = document.getElementById('btn-add-student');
    const modal = document.getElementById('modal-student');
    const form = document.getElementById('form-student');

    btnAdd.addEventListener('click', async () => {
        form.reset();
        document.getElementById('student-id').value = '';
        document.getElementById('modal-student-title').textContent = 'Öğrenci Ekle';

        await populateClassSelect();
        document.getElementById('student-class-id').value = currentClassId || "";

        document.getElementById('student-form-img').style.display = 'none';
        document.getElementById('student-form-avatar').style.display = 'block';
        document.getElementById('btn-delete-student').style.display = 'none'; // Hide delete
        modal.classList.add('active');
    });

    document.getElementById('btn-close-student-modal').addEventListener('click', () => modal.classList.remove('active'));

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveStudent();
    });

    document.getElementById('student-photo-upload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.getElementById('student-form-img').src = ev.target.result;
                document.getElementById('student-form-img').style.display = 'block';
                document.getElementById('student-form-avatar').style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('student-search').addEventListener('input', (e) => {
        const text = e.target.value.toLowerCase();
        document.querySelectorAll('#student-list .student-card').forEach(card => {
            const name = card.querySelector('h4').textContent.toLowerCase();
            card.style.display = name.includes(text) ? 'flex' : 'none';
        });
    });

    document.getElementById('btn-back-from-student').addEventListener('click', () => {
        if (document.getElementById('view-students').classList.contains('active') || !currentClassId) {
            navigate('view-students', 'Öğrenciler');
        } else {
            loadClassDetail(currentClassId);
        }
    });

    document.getElementById('btn-edit-student').addEventListener('click', async () => {
        const tx = db.transaction(['students'], 'readonly');
        tx.objectStore('students').get(currentStudentId).onsuccess = async (e) => {
            const s = e.target.result;

            await populateClassSelect();

            document.getElementById('student-id').value = s.id;
            document.getElementById('student-name').value = s.name;
            document.getElementById('student-number').value = s.number;
            document.getElementById('student-class-id').value = s.classId || "";
            document.getElementById('student-mother-name').value = s.parents?.mother?.name || '';
            document.getElementById('student-mother-tel').value = s.parents?.mother?.tel || '';
            document.getElementById('student-father-name').value = s.parents?.father?.name || '';
            document.getElementById('student-father-tel').value = s.parents?.father?.tel || '';
            document.getElementById('student-notes').value = s.notes || '';

            if (s.photo) {
                document.getElementById('student-form-img').src = s.photo;
                document.getElementById('student-form-img').style.display = 'block';
                document.getElementById('student-form-avatar').style.display = 'none';
            } else {
                document.getElementById('student-form-img').style.display = 'none';
                document.getElementById('student-form-avatar').style.display = 'block';
            }

            modal.classList.add('active');
            document.getElementById('btn-delete-student').style.display = 'block'; // Show delete
        };
    });

    document.getElementById('btn-delete-student').onclick = () => {
        const id = Number(document.getElementById('student-id').value);
        if (confirm("Bu öğrenciyi silmek istediğinize emin misiniz?")) {
            deleteStudent(id);
        }
    };
}

async function populateClassSelect() {
    const select = document.getElementById('student-class-id');
    if (!select) return;
    select.innerHTML = '<option value="">Sınıf Seçiniz</option>';

    return new Promise(resolve => {
        const tx = db.transaction(['classes'], 'readonly');
        tx.objectStore('classes').getAll().onsuccess = (e) => {
            const classes = e.target.result;
            classes.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                select.appendChild(opt);
            });
            resolve();
        };
    });
}

function saveStudent() {
    const id = document.getElementById('student-id').value;
    const name = document.getElementById('student-name').value;
    const number = document.getElementById('student-number').value;
    const classId = Number(document.getElementById('student-class-id').value);

    if (!classId) {
        alert("Lütfen bir sınıf seçin!");
        return;
    }

    const photoImg = document.getElementById('student-form-img');
    const photo = (photoImg.style.display === 'block') ? photoImg.src : null;

    const studentData = {
        number,
        name,
        classId,
        photo,
        tags: [],
        parents: {
            mother: {
                name: document.getElementById('student-mother-name').value,
                tel: document.getElementById('student-mother-tel').value
            },
            father: {
                name: document.getElementById('student-father-name').value,
                tel: document.getElementById('student-father-tel').value
            }
        },
        notes: document.getElementById('student-notes').value,
        status: 'active',
        updatedAt: new Date()
    };

    if (id) {
        studentData.id = Number(id);
        const tx = db.transaction(['students'], 'readonly');
        tx.objectStore('students').get(Number(id)).onsuccess = (e) => {
            const existing = e.target.result;
            if (existing) {
                studentData.exams = existing.exams || [];
                studentData.teacherNotes = existing.teacherNotes || [];
                studentData.status = existing.status || 'active';
                if (existing.gradYear) studentData.gradYear = existing.gradYear;
                if (existing.prevClass) studentData.prevClass = existing.prevClass;
            }
            performSaveStudent(studentData);
        };
    } else {
        performSaveStudent(studentData);
    }
}

function performSaveStudent(studentData) {
    const tx = db.transaction(['students'], 'readwrite');
    tx.objectStore('students').put(studentData).onsuccess = () => {
        document.getElementById('modal-student').classList.remove('active');
        if (currentClassId) renderStudents(currentClassId);
        if (currentStudentId) loadStudentProfile(currentStudentId);
        if (document.getElementById('view-students').classList.contains('active')) {
            renderAllStudents();
        }
    };
}

function renderStudents(classId) {
    const list = document.getElementById('student-list');
    if (!list) return;
    list.innerHTML = '';

    const tx = db.transaction(['students'], 'readonly');
    const index = tx.objectStore('students').index('classId');
    index.getAll(classId).onsuccess = (e) => {
        const students = e.target.result;
        if (students.length === 0) {
            list.innerHTML = '<div class="empty-state"><p>Bu sınıfta öğrenci yok.</p></div>';
            return;
        }

        students.forEach(s => {
            const card = document.createElement('div');
            card.className = 'student-card';
            let avatar = s.photo ? `<img src="${s.photo}" class="student-list-img">` : `<div class="student-list-avatar">🎓</div>`;
            card.innerHTML = `
                ${avatar}
                <div class="student-info">
                    <h4>${s.name}</h4>
                    <p>No: ${s.number}</p>
                </div>
            `;
            card.onclick = () => loadStudentProfile(s.id);
            list.appendChild(card);
        });
    };
}

function deleteStudent(id) {
    const tx = db.transaction(['students'], 'readwrite');
    tx.objectStore('students').delete(id).onsuccess = () => {
        document.getElementById('modal-student').classList.remove('active');
        if (currentClassId) renderStudents(currentClassId);
        renderAllStudents();
        navigate('view-classes', 'Sınıflar');
    };
}

function loadStudentProfile(studentId, readOnly = false) {
    currentStudentId = studentId;
    const tx = db.transaction(['students', 'classes'], 'readonly');
    tx.objectStore('students').get(studentId).onsuccess = (e) => {
        const s = e.target.result;

        tx.objectStore('classes').get(s.classId).onsuccess = (ce) => {
            const classData = ce.target.result;
            const className = classData ? classData.name : 'Bilinmiyor';

            document.getElementById('std-profile-name').textContent = s.name;
            document.getElementById('std-profile-no').textContent = 'No: ' + s.number + ' | Sınıf: ' + className;

            const avatarDisp = document.getElementById('std-profile-avatar');
            const imgDisp = document.getElementById('std-profile-img');
            if (s.photo) {
                imgDisp.src = s.photo;
                imgDisp.style.display = 'block';
                avatarDisp.style.display = 'none';
            } else {
                avatarDisp.style.display = 'block';
                imgDisp.style.display = 'none';
            }

            const tagCont = document.getElementById('std-profile-tags');
            tagCont.innerHTML = '';

            document.getElementById('std-mother-name').textContent = s.parents?.mother?.name || '-';
            document.getElementById('std-father-name').textContent = s.parents?.father?.name || '-';

            const mActions = document.getElementById('actions-mother');
            mActions.innerHTML = '';
            if (s.parents?.mother?.tel) {
                mActions.innerHTML = `<a href="tel:${s.parents.mother.tel}" class="btn-action call">📞</a> <a href="sms:${s.parents.mother.tel}" class="btn-action msg">💬</a>`;
            }

            const fActions = document.getElementById('actions-father');
            fActions.innerHTML = '';
            if (s.parents?.father?.tel) {
                fActions.innerHTML = `<a href="tel:${s.parents.father.tel}" class="btn-action call">📞</a> <a href="sms:${s.parents.father.tel}" class="btn-action msg">💬</a>`;
            }

            document.getElementById('std-general-notes').textContent = s.notes || 'Not yok.';

            renderNotes(s.teacherNotes, readOnly);
            renderExams(s.exams, readOnly);
            navigate('view-student-profile');

            document.getElementById('btn-add-note').style.display = readOnly ? 'none' : 'flex';
            document.getElementById('btn-add-exam').style.display = readOnly ? 'none' : 'flex';
            document.getElementById('btn-edit-student').style.display = readOnly ? 'none' : 'block';
        };
    };
}

function renderAllStudents() {
    const list = document.getElementById('global-student-list');
    if (!list) return;
    list.innerHTML = '';

    const cTx = db.transaction(['classes'], 'readonly');
    cTx.objectStore('classes').getAll().onsuccess = (ce) => {
        const classes = ce.target.result;
        const classMap = {};
        classes.forEach(c => classMap[c.id] = c.name);

        const tx = db.transaction(['students'], 'readonly');
        tx.objectStore('students').getAll().onsuccess = (e) => {
            const students = e.target.result.filter(s => s.status !== 'graduated');
            if (students.length === 0) {
                list.innerHTML = '<div class="empty-state"><p>Henüz kayıtlı öğrenci yok.</p></div>';
                return;
            }

            students.forEach(s => {
                const card = document.createElement('div');
                card.className = 'student-card global-student-card';
                card.setAttribute('data-name', s.name.toLowerCase());
                let avatar = s.photo ? `<img src="${s.photo}" class="student-list-img">` : `<div class="student-list-avatar">🎓</div>`;
                card.innerHTML = `
                    ${avatar}
                    <div class="student-info">
                        <h4>${s.name}</h4>
                        <p>No: ${s.number} | Sınıf: ${classMap[s.classId] || 'Bilinmiyor'}</p>
                    </div>
                `;
                card.onclick = () => loadStudentProfile(s.id);
                list.appendChild(card);
            });
        };
    };
}

// Global Search logic for All Students
if (document.getElementById('global-student-search')) {
    document.getElementById('global-student-search').addEventListener('input', (e) => {
        const text = e.target.value.toLowerCase();
        document.querySelectorAll('.global-student-card').forEach(card => {
            const name = card.getAttribute('data-name');
            card.style.display = name.includes(text) ? 'flex' : 'none';
        });
    });
}

// --- Performance (Notes/Exams) ---
function setupPerformanceLogic() {
    document.getElementById('btn-close-note-modal').onclick = () => document.getElementById('modal-note').classList.remove('active');
    document.getElementById('btn-close-exam-modal').onclick = () => document.getElementById('modal-exam').classList.remove('active');

    document.getElementById('btn-add-note').onclick = () => {
        const form = document.getElementById('form-note');
        if (form) form.reset();
        document.getElementById('note-id').value = ''; // Reset note ID for adding new
        document.getElementById('note-student-id').value = currentStudentId;
        document.getElementById('note-date').valueAsDate = new Date();
        document.getElementById('modal-note-title').textContent = 'Not Ekle';
        document.getElementById('modal-note').classList.add('active');
    };

    document.getElementById('btn-add-exam').onclick = () => {
        const form = document.getElementById('form-exam');
        if (form) form.reset();
        document.getElementById('exam-student-id').value = currentStudentId;
        document.getElementById('exam-date').valueAsDate = new Date();
        document.getElementById('modal-exam').classList.add('active');
    };

    document.getElementById('form-note').onsubmit = (e) => {
        e.preventDefault();
        saveNote();
    };

    document.getElementById('form-exam').onsubmit = (e) => {
        e.preventDefault();
        saveExam();
    };

    document.querySelectorAll('#view-student-profile .tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('#view-student-profile .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('#view-student-profile .tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-tab')).classList.add('active');
        };
    });
}

function saveNote() {
    const sId = Number(document.getElementById('note-student-id').value);
    const noteId = document.getElementById('note-id').value;
    const text = document.getElementById('note-text').value;
    const date = document.getElementById('note-date').value;

    const tx = db.transaction(['students'], 'readwrite');
    const store = tx.objectStore('students');
    store.get(sId).onsuccess = (e) => {
        const s = e.target.result;
        if (!s.teacherNotes) s.teacherNotes = [];

        if (noteId) {
            // Edit existing note
            const idx = s.teacherNotes.findIndex(n => n.id === Number(noteId));
            if (idx !== -1) {
                s.teacherNotes[idx] = { id: Number(noteId), text, date };
            }
        } else {
            // New note
            s.teacherNotes.unshift({ id: Date.now(), text, date });
        }

        store.put(s).onsuccess = () => {
            document.getElementById('modal-note').classList.remove('active');
            renderNotes(s.teacherNotes);
        };
    };
}

function editNote(id) {
    const tx = db.transaction(['students'], 'readonly');
    tx.objectStore('students').get(currentStudentId).onsuccess = (e) => {
        const s = e.target.result;
        const note = s.teacherNotes.find(n => n.id === id);
        if (note) {
            document.getElementById('note-id').value = note.id;
            document.getElementById('note-student-id').value = currentStudentId;
            document.getElementById('note-text').value = note.text;
            document.getElementById('note-date').value = note.date;
            document.getElementById('modal-note-title').textContent = 'Notu Güncelle';
            document.getElementById('modal-note').classList.add('active');
        }
    };
}

function deleteNote(id) {
    if (!confirm("Bu notu silmek istediğinize emin misiniz?")) return;
    const tx = db.transaction(['students'], 'readwrite');
    const store = tx.objectStore('students');
    store.get(currentStudentId).onsuccess = (e) => {
        const s = e.target.result;
        s.teacherNotes = s.teacherNotes.filter(n => n.id !== id);
        store.put(s).onsuccess = () => {
            renderNotes(s.teacherNotes);
        };
    };
}

function renderNotes(notes, readOnly) {
    const list = document.getElementById('notes-list');
    if (!list) return;
    list.innerHTML = '';
    if (!notes || notes.length === 0) {
        list.innerHTML = '<div class="empty-state-small">Not bulunmuyor.</div>';
        return;
    }
    notes.forEach(n => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
            <div class="timeline-date">${new Date(n.date).toLocaleDateString('tr-TR')}</div>
            <div class="timeline-content">${n.text}</div>
            <div class="note-actions" style="margin-top:5px;">
                <button class="btn-text-small" onclick="editNote(${n.id})">✏️ Düzenle</button>
                <button class="btn-text-small danger" onclick="deleteNote(${n.id})">🗑️ Sil</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function saveExam() {
    const sId = Number(document.getElementById('exam-student-id').value);
    const name = document.getElementById('exam-name').value;
    const date = document.getElementById('exam-date').value;
    const score = Number(document.getElementById('exam-score').value);

    const tx = db.transaction(['students'], 'readwrite');
    const store = tx.objectStore('students');
    store.get(sId).onsuccess = (e) => {
        const s = e.target.result;
        if (!s.exams) s.exams = [];
        s.exams.push({ id: Date.now(), name, date, score });
        store.put(s).onsuccess = () => {
            document.getElementById('modal-exam').classList.remove('active');
            renderExams(s.exams);
        };
    };
}

function renderExams(exams, readOnly) {
    const list = document.getElementById('exams-list');
    if (!list) return;
    list.innerHTML = '';
    const avgVal = document.getElementById('exam-average');
    if (!exams || exams.length === 0) {
        list.innerHTML = '<div class="empty-state-small">Sınav bulunmuyor.</div>';
        if (avgVal) avgVal.textContent = '-';
        return;
    }
    let sum = 0;
    exams.forEach(ex => {
        sum += ex.score;
        const item = document.createElement('div');
        item.className = 'exam-item';
        item.innerHTML = `
            <div class="exam-info"><h4>${ex.name}</h4><span>${new Date(ex.date).toLocaleDateString('tr-TR')}</span></div>
            <div class="exam-score">${ex.score}</div>
        `;
        list.appendChild(item);
    });
    if (avgVal) avgVal.textContent = (sum / exams.length).toFixed(1);
}

// --- Alumni Logic ---
function setupAlumniLogic() {
    const searchInput = document.getElementById('alumni-search');
    const yearSelect = document.getElementById('alumni-year-filter');
    if (searchInput) searchInput.oninput = filterAlumni;
    if (yearSelect) yearSelect.onchange = filterAlumni;
}

function renderAlumni() {
    const list = document.getElementById('alumni-list');
    if (!list) return;
    list.innerHTML = '';
    const tx = db.transaction(['students'], 'readonly');
    tx.objectStore('students').getAll().onsuccess = (e) => {
        const students = e.target.result.filter(s => s.status === 'graduated');

        const yearSelect = document.getElementById('alumni-year-filter');
        if (yearSelect) {
            const years = [...new Set(students.map(s => s.gradYear))].sort((a, b) => b - a);
            yearSelect.innerHTML = '<option value="">Tüm Yıllar</option>';
            years.forEach(y => {
                yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
            });
        }

        if (students.length === 0) {
            list.innerHTML = '<div class="empty-state"><p>Henüz mezun öğrenci yok.</p></div>';
            return;
        }

        students.forEach(s => {
            const card = document.createElement('div');
            card.className = 'student-card alumni-card';
            card.setAttribute('data-name', s.name.toLowerCase());
            card.setAttribute('data-year', s.gradYear);
            let avatar = s.photo ? `<img src="${s.photo}" class="student-list-img">` : `<div class="student-list-avatar">🎓</div>`;
            card.innerHTML = `
                ${avatar}
                <div class="student-info">
                    <h4>${s.name}</h4>
                    <p>Mezuniyet: ${s.gradYear} | Eski Sınıf: ${s.prevClass || 'Bilinmiyor'}</p>
                </div>
            `;
            card.onclick = () => loadStudentProfile(s.id, true);
            list.appendChild(card);
        });
    };
}

function filterAlumni() {
    const text = document.getElementById('alumni-search').value.toLowerCase();
    const year = document.getElementById('alumni-year-filter').value;
    document.querySelectorAll('.alumni-card').forEach(card => {
        const nameMatch = card.getAttribute('data-name').includes(text);
        const yearMatch = !year || card.getAttribute('data-year') === year;
        card.style.display = (nameMatch && yearMatch) ? 'flex' : 'none';
    });
}

// --- Transition / Education Year ---
function setupTransitionLogic() {
    document.getElementById('btn-year-transition').onclick = () => document.getElementById('modal-transition').classList.add('active');
    document.getElementById('btn-cancel-transition').onclick = () => document.getElementById('modal-transition').classList.remove('active');
    document.getElementById('btn-confirm-transition').onclick = performYearTransition;
}

function performYearTransition() {
    const currentYear = new Date().getFullYear();
    const tx = db.transaction(['classes', 'students'], 'readwrite');
    const cStore = tx.objectStore('classes');
    const sStore = tx.objectStore('students');

    sStore.getAll().onsuccess = (e) => {
        const students = e.target.result;
        students.forEach(s => {
            if (s.status === 'graduated') return;

            cStore.get(s.classId).onsuccess = (ce) => {
                const c = ce.target.result;
                if (!c) return;

                const nextLevel = c.level + 1;
                s.prevClass = c.name;

                if (nextLevel > 12) {
                    s.status = 'graduated';
                    s.gradYear = currentYear;
                } else {
                    const nextClassName = nextLevel + c.name.substring(c.name.search(/[A-Za-z]/));
                    cStore.index('name').get(nextClassName).onsuccess = (nce) => {
                        let targetClass = nce.target.result;
                        if (targetClass) {
                            s.classId = targetClass.id;
                            sStore.put(s);
                        } else {
                            cStore.add({ name: nextClassName, level: nextLevel }).onsuccess = (ae) => {
                                s.classId = ae.target.result;
                                sStore.put(s);
                            };
                        }
                    };
                }
            };
        });
    };

    tx.oncomplete = () => {
        document.getElementById('modal-transition').classList.remove('active');
        alert("Eğitim yılı geçişi tamamlandı!");
        renderClasses();
        navigate('view-classes', 'Sınıflar');
    };
}

// --- Plans Logic ---
function setupPlansLogic() {
    const btnAdd = document.getElementById('btn-add-plan');
    const modal = document.getElementById('modal-plan');
    const form = document.getElementById('form-plan');

    btnAdd.onclick = () => {
        form.reset();
        document.getElementById('plan-id').value = '';
        modal.classList.add('active');
    };

    document.getElementById('btn-close-plan-modal').onclick = () => modal.classList.remove('active');

    form.onsubmit = (e) => {
        e.preventDefault();
        savePlan();
    };

    document.querySelectorAll('#view-plans .tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('#view-plans .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('#view-plans .plan-tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-tab') + '-list').classList.add('active');
        };
    });
}

// Long-press implementation helper
let longPressTimer;
function startLongPress(id, type) {
    longPressTimer = setTimeout(() => {
        deletePlan(id, type);
    }, 800); // 800ms for long press
}
function stopLongPress() {
    clearTimeout(longPressTimer);
}

function savePlan() {
    const title = document.getElementById('plan-title').value;
    const type = document.getElementById('plan-type').value;
    const isUrlMode = document.getElementById('plan-url').parentElement.style.display !== 'none';

    if (isUrlMode) {
        // Handle URL
        const url = document.getElementById('plan-url').value;
        if (!url) return alert("Lütfen bir web adresi girin.");

        const planData = {
            title,
            type,
            fileData: url,
            fileName: 'Web Bağlantısı',
            fileType: 'url',
            updatedAt: new Date()
        };
        savePlanToDB(planData);

    } else {
        // Handle File
        const fileInput = document.getElementById('plan-file');
        if (!fileInput.files[0]) return alert("Lütfen bir dosya seçin.");

        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = (e) => {
            const planData = {
                title,
                type,
                fileData: e.target.result,
                fileName: file.name,
                fileType: file.type,
                updatedAt: new Date()
            };
            savePlanToDB(planData);
        };
        reader.readAsDataURL(file);
    }
}

function savePlanToDB(data) {
    const tx = db.transaction(['plans'], 'readwrite');
    tx.objectStore('plans').add(data).onsuccess = () => {
        document.getElementById('modal-plan').classList.remove('active');
        renderPlans(data.type);
    };
}

function renderPlans(type) {
    const list = document.getElementById(`plan-${type}-list`);
    if (!list) return;
    list.innerHTML = '';

    const tx = db.transaction(['plans'], 'readonly');
    const index = tx.objectStore('plans').index('type');

    index.getAll(type).onsuccess = (e) => {
        const plans = e.target.result;
        if (plans.length === 0) {
            list.innerHTML = `<div class="empty-state-small">${type === 'yearly' ? 'Yıllık plan' : 'Haftalık program'} bulunmuyor.</div>`;
            return;
        }

        plans.forEach(p => {
            const card = document.createElement('div');
            card.className = 'plan-card';

            // Add long press and swipe-like hints
            card.setAttribute('onmousedown', `startLongPress(${p.id}, '${type}')`);
            card.setAttribute('onmouseup', `stopLongPress()`);
            card.setAttribute('onmouseleave', `stopLongPress()`);
            card.setAttribute('ontouchstart', `startLongPress(${p.id}, '${type}')`);
            card.setAttribute('ontouchend', `stopLongPress()`);

            const isUrl = p.fileType === 'url';
            card.innerHTML = `
                <div class="plan-icon">${isUrl ? '🔗' : '📄'}</div>
                <div class="plan-info">
                    <h4>${p.title}</h4>
                    <p>${new Date(p.updatedAt).toLocaleDateString('tr-TR')}</p>
                </div>
                <div class="plan-actions">
                    <button class="btn-icon-small" onclick="viewPlan(${p.id})">👁️</button>
                    <button class="btn-icon-small danger" onclick="deletePlan(${p.id}, '${type}')">🗑️</button>
                </div>
            `;
            list.appendChild(card);
        });
    };
}

function viewPlan(id) {
    const tx = db.transaction(['plans'], 'readonly');
    tx.objectStore('plans').get(id).onsuccess = (e) => {
        const p = e.target.result;
        if (!p) return;

        const viewerModal = document.getElementById('modal-file-viewer');
        const frame = document.getElementById('viewer-frame');
        const title = document.getElementById('viewer-title');
        const btnOpenExternal = document.getElementById('btn-open-external');

        title.textContent = p.title;
        frame.src = p.fileData;

        // Handle External Links
        if (p.fileType === 'url') {
            btnOpenExternal.href = p.fileData;
            btnOpenExternal.style.display = 'flex';
        } else {
            btnOpenExternal.style.display = 'none';
        }

        viewerModal.classList.add('active');
    };
}

function deletePlan(id, type) {
    if (!confirm("Bu planı silmek istediğinize emin misiniz?")) return;
    const tx = db.transaction(['plans'], 'readwrite');
    tx.objectStore('plans').delete(id).onsuccess = () => {
        renderPlans(type);
    };
}

// --- Settings & Themes ---
function setupSettingsLogic() {
    document.getElementById('btn-settings-profile').onclick = () => {
        const tx = db.transaction(['teachers'], 'readonly');
        tx.objectStore('teachers').get('teacher_profile').onsuccess = (e) => {
            const t = e.target.result;
            if (t) {
                document.getElementById('setup-name').value = t.name;
                document.getElementById('setup-branch').value = t.branch;
                document.getElementById('setup-school').value = t.school;
                document.getElementById('setup-gender').value = t.gender;
                showSetupMode();
            }
        };
    };

    document.getElementById('btn-settings-theme').onclick = () => document.getElementById('modal-theme').classList.add('active');
    document.getElementById('btn-close-theme-modal').onclick = () => document.getElementById('modal-theme').classList.remove('active');

    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.onclick = () => {
            const theme = opt.getAttribute('data-theme');
            applyTheme(theme);
            localStorage.setItem('app-theme', theme);
            document.getElementById('modal-theme').classList.remove('active');
        };
    });

    document.getElementById('btn-settings-plans').onclick = () => navigate('view-plans', 'Planlarım');
    document.getElementById('btn-settings-info').onclick = () => navigate('view-info', 'Hakkında');

    // Restore Listener
    const btnRestore = document.getElementById('restore-file');
    if (btnRestore) {
        btnRestore.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => restoreData(ev.target.result);
            reader.readAsText(file);
        };
    }
    document.getElementById('btn-dash-plans').onclick = () => navigate('view-plans', 'Planlarım');

    document.getElementById('btn-reset-data').onclick = () => {
        if (confirm("DİKKAT! Tüm verileriniz kalıcı olarak silinecektir. Bu işlem geri alınamaz. Onaylıyor musunuz?")) {
            const req = indexedDB.deleteDatabase(DB_NAME);
            req.onsuccess = () => {
                localStorage.clear();
                location.reload();
            };
        }
    };

    const btnBackup = document.getElementById('btn-backup-data');
    if (btnBackup) {
        btnBackup.onclick = () => backupData();
    }
}

async function backupData() {
    const backup = {
        teachers: [],
        classes: [],
        students: [],
        plans: [],
        version: DB_VERSION,
        exportedAt: new Date().toISOString()
    };

    const stores = ['teachers', 'classes', 'students', 'plans'];
    const tx = db.transaction(stores, 'readonly');

    for (const storeName of stores) {
        const store = tx.objectStore(storeName);
        backup[storeName] = await new Promise(resolve => {
            store.getAll().onsuccess = (e) => resolve(e.target.result);
        });
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `NHMTAL_Yedek_${new Date().toLocaleDateString('tr-TR')}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function restoreData(jsonStr) {
    try {
        const data = JSON.parse(jsonStr);
        if (!data.version || !data.teachers) throw new Error("Geçersiz yedek dosyası");

        if (!confirm(`Bu yedeği geri yüklemek istediğinize emin misiniz?\n\nTarih: ${new Date(data.exportedAt).toLocaleDateString()}\n\nUYARI: Mevcut tüm veriler silinecek ve yedektekiler yüklenecektir.`)) {
            document.getElementById('restore-file').value = '';
            return;
        }

        const tx = db.transaction(['teachers', 'classes', 'students', 'plans'], 'readwrite');

        // Clear existing data
        tx.objectStore('teachers').clear();
        tx.objectStore('classes').clear();
        tx.objectStore('students').clear();
        tx.objectStore('plans').clear();

        // Restore data
        if (data.teachers) data.teachers.forEach(i => tx.objectStore('teachers').put(i));
        if (data.classes) data.classes.forEach(i => tx.objectStore('classes').put(i));
        if (data.students) data.students.forEach(i => tx.objectStore('students').put(i));
        if (data.plans) data.plans.forEach(i => tx.objectStore('plans').put(i));

        tx.oncomplete = () => {
            alert("Veriler başarıyla geri yüklendi! Uygulama yeniden başlatılıyor...");
            location.reload();
        };

        tx.onerror = (e) => {
            console.error("Restore error:", e);
            alert("Geri yükleme sırasında bir hata oluştu.");
        };

    } catch (e) {
        alert("Hata: " + e.message);
    }
}

function applyTheme(theme) {
    document.body.className = '';
    document.body.classList.add(theme + '-theme');
}

// --- PDF Logic ---
function setupPDFLogic() {
    document.getElementById('btn-create-pdf').onclick = () => {
        window.print();
    };

    const btnExportClass = document.getElementById('btn-export-class-pdf');
    if (btnExportClass) {
        btnExportClass.onclick = () => exportClassPDF();
    }

    document.getElementById('btn-close-viewer').onclick = () => {
        document.getElementById('modal-file-viewer').classList.remove('active');
        document.getElementById('viewer-frame').src = '';
    };
}

function exportClassPDF() {
    if (!currentClassId) return;

    const tx = db.transaction(['classes', 'students'], 'readonly');
    tx.objectStore('classes').get(currentClassId).onsuccess = (ce) => {
        const classInfo = ce.target.result;
        tx.objectStore('students').index('classId').getAll(currentClassId).onsuccess = (se) => {
            const students = se.target.result;

            let printContent = `
                <div style="padding: 20px; font-family: sans-serif;">
                    <h1 style="text-align:center; color: #1e3c72;">${classInfo.name} - Tüm Öğrenci Notları</h1>
                    <p style="text-align:right; font-size: 0.8rem;">Tarih: ${new Date().toLocaleDateString('tr-TR')}</p>
                    <hr>
            `;

            students.forEach((s, index) => {
                printContent += `
                    <div style="margin-bottom: 30px; page-break-inside: avoid; border-bottom: 1px dashed #ccc; padding-bottom: 15px;">
                        <h2 style="margin-bottom: 5px;">${s.number} - ${s.name}</h2>
                        <div style="display: flex; gap: 20px;">
                            <div style="flex: 1;">
                                <h3>Sınav Notları</h3>
                                ${s.exams && s.exams.length > 0 ? `
                                    <table style="width: 100%; border-collapse: collapse;">
                                        <thead>
                                            <tr style="background: #f4f4f4;">
                                                <th style="border: 1px solid #ddd; padding: 5px;">Sınav</th>
                                                <th style="border: 1px solid #ddd; padding: 5px;">Not</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${s.exams.map(ex => `
                                                <tr>
                                                    <td style="border: 1px solid #ddd; padding: 5px;">${ex.name}</td>
                                                    <td style="border: 1px solid #ddd; padding: 5px; text-align:center;">${ex.score}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                ` : '<p>Sınav notu bulunmuyor.</p>'}
                            </div>
                            <div style="flex: 2;">
                                <h3>Öğretmen Notları</h3>
                                ${s.teacherNotes && s.teacherNotes.length > 0 ? `
                                    <ul style="padding-left: 20px;">
                                        ${s.teacherNotes.map(n => `
                                            <li style="margin-bottom: 5px;">
                                                <strong>${new Date(n.date).toLocaleDateString('tr-TR')}:</strong> ${n.text}
                                            </li>
                                        `).join('')}
                                    </ul>
                                ` : '<p>Not bulunmuyor.</p>'}
                            </div>
                        </div>
                    </div>
                `;
            });

            printContent += `</div>`;

            // Open a new window for printing
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                    <head>
                        <title>${classInfo.name} - Sonuçlar</title>
                        <style>
                            body { font-family: 'Segoe UI', sans-serif; }
                            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                            th { background-color: #f2f2f2; }
                            @media print {
                                .no-print { display: none; }
                            }
                        </style>
                    </head>
                    <body>
                        ${printContent}
                        <script>
                            window.onload = function() {
                                window.print();
                                // window.close(); // Optional
                            };
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        };
    };
}
