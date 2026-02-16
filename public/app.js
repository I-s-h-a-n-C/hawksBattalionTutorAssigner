(function () {
  'use strict';

  if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) {
    document.getElementById('login-screen').querySelector('p').innerHTML =
      'Firebase is not loaded. Add your project config to <strong>public/firebase-config.js</strong> (get it from Firebase Console → Project settings → Your apps).';
    document.getElementById('btn-google-signin').style.display = 'none';
    throw new Error('Firebase not initialized. Check firebase-config.js.');
  }

  var SUBJECTS = [
    'Math',
    'Science',
    'English',
    'History',
    'Spanish',
    'French',
    'Other'
  ];

  var DEFAULT_STAFF_CODE = 'hawksstaff';
  var DEFAULT_ADMIN_CODE = 'hawksadmin';
  var DEFAULT_INSTRUCTOR_CODE = 'hawksinstructor';

  var codesCache = null;

  var db = firebase.firestore();
  var auth = firebase.auth();

  function getCodes() {
    if (codesCache) return Promise.resolve(codesCache);
    return db.collection('config').doc('codes').get().then(function (snap) {
      if (snap.exists && snap.data()) {
        codesCache = snap.data();
        return codesCache;
      }
      codesCache = {
        staffCode: DEFAULT_STAFF_CODE,
        adminCode: DEFAULT_ADMIN_CODE,
        instructorCode: DEFAULT_INSTRUCTOR_CODE
      };
      return codesCache;
    }).catch(function () {
      codesCache = {
        staffCode: DEFAULT_STAFF_CODE,
        adminCode: DEFAULT_ADMIN_CODE,
        instructorCode: DEFAULT_INSTRUCTOR_CODE
      };
      return codesCache;
    });
  }

  function clearCodesCache() {
    codesCache = null;
  }

  function loadAdminCodes() {
    getCodes().then(function (codes) {
      var staffEl = document.getElementById('admin-staff-code');
      var adminEl = document.getElementById('admin-admin-code');
      var instructorEl = document.getElementById('admin-instructor-code');
      if (staffEl) staffEl.value = (codes && codes.staffCode) || '';
      if (adminEl) adminEl.value = (codes && codes.adminCode) || '';
      if (instructorEl) instructorEl.value = (codes && codes.instructorCode) || '';
    });
  }

  var screens = {
    login: document.getElementById('login-screen'),
    role: document.getElementById('onboard-role-screen'),
    staffForm: document.getElementById('onboard-staff-screen'),
    studentForm: document.getElementById('onboard-student-screen'),
    dashboard: document.getElementById('dashboard-screen')
  };

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].classList.toggle('hidden', key !== name);
    });
  }

  function renderSubjectCheckboxes(containerId, namePrefix) {
    var container = document.getElementById(containerId);
    container.innerHTML = '';
    var group = document.createElement('div');
    group.className = 'checkbox-group';
    SUBJECTS.forEach(function (subj) {
      var id = namePrefix + '-' + subj.replace(/\s/g, '-');
      var label = document.createElement('label');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.name = namePrefix;
      cb.value = subj;
      cb.id = id;
      label.htmlFor = id;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(subj));
      group.appendChild(label);
    });
    container.appendChild(group);
  }

  function getSubjectNames(subjects) {
    if (!subjects || !subjects.length) return [];
    return subjects.map(function (s) { return typeof s === 'string' ? s : (s.name || s); });
  }

  function normalizeSubjects(subjects) {
    if (!subjects || !subjects.length) return [];
    return subjects.map(function (s) {
      if (typeof s === 'string') return { name: s, ap: false };
      return { name: s.name || '', ap: !!s.ap };
    });
  }

  var staffFormSubjects = [];
  var dashStaffSubjects = [];

  function renderStaffSubjectSelectOptions(selectId) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '';
    var opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = 'Select...';
    sel.appendChild(opt0);
    SUBJECTS.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      sel.appendChild(opt);
    });
    var optCustom = document.createElement('option');
    optCustom.value = '__custom__';
    optCustom.textContent = 'Custom...';
    sel.appendChild(optCustom);
  }

  function renderStaffSubjectList(containerId, list) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    list.forEach(function (item, index) {
      var row = document.createElement('div');
      row.className = 'subject-row';
      var label = document.createElement('span');
      label.textContent = item.name + (item.ap ? ' (AP)' : '');
      var apCb = document.createElement('input');
      apCb.type = 'checkbox';
      apCb.checked = !!item.ap;
      apCb.id = containerId + '-ap-' + index;
      apCb.addEventListener('change', function () {
        item.ap = apCb.checked;
        renderStaffSubjectList(containerId, list);
      });
      var apLabel = document.createElement('label');
      apLabel.htmlFor = apCb.id;
      apLabel.textContent = ' AP';
      apLabel.style.marginLeft = '8px';
      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', function () {
        list.splice(index, 1);
        renderStaffSubjectList(containerId, list);
      });
      row.appendChild(label);
      row.appendChild(apCb);
      row.appendChild(apLabel);
      row.appendChild(removeBtn);
      container.appendChild(row);
    });
  }

  function getStaffSubjectFromPicker(selectId, customWrapId, customInputId) {
    var sel = document.getElementById(selectId);
    var customInput = document.getElementById(customInputId);
    var val = sel && sel.value;
    if (val === '__custom__' && customInput) {
      val = customInput.value.trim();
      if (val) customInput.value = '';
    }
    return val || null;
  }

  function renderSubjectSelect(selectId, optionalEmpty) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '';
    if (optionalEmpty) {
      var opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Select';
      sel.appendChild(opt);
    }
    SUBJECTS.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      sel.appendChild(opt);
    });
  }

  function getCurrentUserDoc() {
    var user = auth.currentUser;
    if (!user) return Promise.resolve(null);
    return db.collection('users').doc(user.uid).get();
  }

  function showLogin() {
    showScreen('login');
    document.getElementById('login-error').textContent = '';
  }

  function showOnboardRole() {
    showScreen('role');
  }

  function showOnboardStaff() {
    showScreen('staffForm');
    document.getElementById('staff-code-error').textContent = '';
    document.getElementById('staff-form-error').textContent = '';
    staffFormSubjects.length = 0;
    renderStaffSubjectSelectOptions('staff-subject-select');
    renderStaffSubjectList('staff-subjects-list', staffFormSubjects);
    var customWrap = document.getElementById('staff-custom-wrap');
    var staffSelect = document.getElementById('staff-subject-select');
    if (customWrap) customWrap.classList.add('hidden');
    if (staffSelect) {
      staffSelect.addEventListener('change', function () {
        if (customWrap) customWrap.classList.toggle('hidden', staffSelect.value !== '__custom__');
      });
    }
    document.getElementById('staff-email').value = auth.currentUser ? auth.currentUser.email : '';
  }

  function showOnboardStudent() {
    showScreen('studentForm');
    document.getElementById('student-form-error').textContent = '';
    renderSubjectSelect('student-subject-select', true);
  }

  function getStudentSubject() {
    var sel = document.getElementById('student-subject-select');
    return sel && sel.value ? sel.value : '';
  }

  function showDashboard(userDoc) {
    showScreen('dashboard');
    var isAdmin = userDoc && userDoc.get('isAdmin') === true;
    var isInstructor = userDoc && userDoc.get('isInstructor') === true;
    var isStaff = userDoc && userDoc.get('isStaff') === true;

    var studentSection = document.getElementById('dashboard-student-section');
    var staffSection = document.getElementById('dashboard-staff-section');
    var adminSection = document.getElementById('dashboard-admin-section');

    studentSection.classList.add('hidden');
    staffSection.classList.add('hidden');
    adminSection.classList.add('hidden');
    if (isAdmin || isInstructor) adminSection.classList.remove('hidden');
    if (isStaff) staffSection.classList.remove('hidden');
    if (!isAdmin && !isInstructor && !isStaff) studentSection.classList.remove('hidden');
    if (isAdmin || isStaff) studentSection.classList.remove('hidden');

    if (isAdmin || isInstructor) {
      var codesSection = document.getElementById('admin-codes-section');
      var statsSection = document.getElementById('admin-stats-section');
      if (codesSection) codesSection.classList.toggle('hidden', !isInstructor);
      if (statsSection) statsSection.classList.toggle('hidden', !isInstructor);
      if (isInstructor) loadAdminCodes();
      if (isInstructor) loadAdminStats();
      loadAllRequests();
      loadAllUsers(isInstructor);
    }
    if (isStaff) {
      dashStaffSubjects = normalizeSubjects(userDoc.get('subjects') || []);
      renderStaffSubjectSelectOptions('dash-staff-subject-select');
      renderStaffSubjectList('dash-staff-subjects-list', dashStaffSubjects);
      loadStaffRequests(userDoc.get('subjects') || []);
      renderSubjectSelect('dash-subject', true);
      loadMyRequests();
    }
    if (!isAdmin && !isInstructor && !isStaff) {
      renderSubjectSelect('dash-subject', true);
      loadMyRequests();
    }
  }

  function loadMyRequests() {
    var uid = auth.currentUser.uid;
    var listEl = document.getElementById('my-requests-list');
    listEl.innerHTML = '<p class="empty-msg">Loading…</p>';
    db.collection('tutoringRequests')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .onSnapshot(function (snap) {
        listEl.innerHTML = '';
        if (snap.empty) {
          listEl.innerHTML = '<p class="empty-msg">No requests yet.</p>';
          return;
        }
        snap.docs.forEach(function (doc) {
          var d = doc.data();
          var card = document.createElement('div');
          card.className = 'request-card';
          card.innerHTML =
            '<strong>' + escapeHtml(d.subject) + '</strong> – ' + escapeHtml(d.needDescription || '') +
            '<br>Enrichment: ' + (d.enrichment || '') + ', Urgency: ' + (d.urgency || '') +
            (d.requesterEmail ? '<br><strong>Email: ' + escapeHtml(d.requesterEmail) + '</strong>' : '') +
            '<div class="request-status">Status: ' + escapeHtml(d.status || 'pending') + '</div>' +
            '<p class="meta">' + (d.createdAt ? 'Added ' + formatDate(d.createdAt) : '') + '</p>' +
            '<button type="button" data-request-id="' + escapeHtml(doc.id) + '" data-action="complete">Mark as completed</button> ' +
            '<button type="button" data-request-id="' + escapeHtml(doc.id) + '" data-action="remove">Remove</button>';
          var completeBtn = card.querySelector('[data-action="complete"]');
          var removeBtn = card.querySelector('[data-action="remove"]');
          completeBtn.addEventListener('click', function () {
            db.collection('tutoringRequests').doc(doc.id).update({ status: 'completed' });
          });
          removeBtn.addEventListener('click', function () {
            removeRequest(doc.id);
          });
          listEl.appendChild(card);
        });
      });
  }

  function loadStaffRequests(mySubjects) {
    var listEl = document.getElementById('staff-requests-list');
    listEl.innerHTML = '<p class="empty-msg">Loading…</p>';
    var subjectNames = getSubjectNames(mySubjects);
    if (subjectNames.length === 0) {
      listEl.innerHTML = '<p class="empty-msg">You have no subjects selected. Requests will appear here when they match your tutoring subjects.</p>';
      return;
    }
    db.collection('tutoringRequests')
      .orderBy('createdAt', 'desc')
      .onSnapshot(function (snap) {
        listEl.innerHTML = '';
        var filtered = snap.docs.filter(function (doc) {
          return subjectNames.indexOf(doc.data().subject) !== -1;
        });
        if (filtered.length === 0) {
          listEl.innerHTML = '<p class="empty-msg">No matching requests right now.</p>';
          return;
        }
        filtered.forEach(function (doc) {
          var d = doc.data();
          var card = document.createElement('div');
          card.className = 'request-card';
          var statusSelect = document.createElement('select');
          statusSelect.className = 'request-status-select';
          ['pending', 'matched', 'in progress', 'completed'].forEach(function (s) {
            var opt = document.createElement('option');
            opt.value = s;
            opt.textContent = 'Status: ' + s;
            opt.selected = (s === (d.status || 'pending'));
            statusSelect.appendChild(opt);
          });
          statusSelect.addEventListener('change', function () {
            db.collection('tutoringRequests').doc(doc.id).update({ status: statusSelect.value });
          });
          card.innerHTML =
            '<strong>' + escapeHtml(d.subject) + '</strong> – ' + escapeHtml(d.needDescription || '') +
            '<br>Enrichment: ' + (d.enrichment || '') + ', Urgency: ' + (d.urgency || '') +
            (d.requesterEmail ? '<br><strong>Email: ' + escapeHtml(d.requesterEmail) + '</strong>' : '') +
            '<p class="meta">' + (d.createdAt ? formatDate(d.createdAt) : '') + '</p>';
          card.appendChild(statusSelect);
          listEl.appendChild(card);
        });
      });
  }

  function removeRequest(id) {
    db.collection('tutoringRequests').doc(id).delete().catch(function (err) {
      alert('Could not remove: ' + (err.message || err));
    });
  }

  function loadAllRequests() {
    var listEl = document.getElementById('admin-requests-list');
    listEl.innerHTML = '<p class="empty-msg">Loading…</p>';
    db.collection('tutoringRequests')
      .orderBy('createdAt', 'desc')
      .onSnapshot(function (snap) {
        listEl.innerHTML = '';
        if (snap.empty) {
          listEl.innerHTML = '<p class="empty-msg">No requests.</p>';
          return;
        }
        snap.docs.forEach(function (doc) {
          var d = doc.data();
          var card = document.createElement('div');
          card.className = 'request-card';
          var statusSelect = document.createElement('select');
          statusSelect.className = 'request-status-select';
          ['pending', 'matched', 'in progress', 'completed'].forEach(function (s) {
            var opt = document.createElement('option');
            opt.value = s;
            opt.textContent = 'Status: ' + s;
            opt.selected = (s === (d.status || 'pending'));
            statusSelect.appendChild(opt);
          });
          statusSelect.addEventListener('change', function () {
            db.collection('tutoringRequests').doc(doc.id).update({ status: statusSelect.value });
          });
          var deleteBtn = document.createElement('button');
          deleteBtn.type = 'button';
          deleteBtn.textContent = 'Delete';
          deleteBtn.addEventListener('click', function () {
            removeRequest(doc.id);
          });
          card.innerHTML =
            '<strong>' + escapeHtml(d.subject) + '</strong> – ' + escapeHtml(d.needDescription || '') +
            '<br>Enrichment: ' + (d.enrichment || '') + ', Urgency: ' + (d.urgency || '') +
            (d.requesterEmail ? '<br><strong>Email: ' + escapeHtml(d.requesterEmail) + '</strong>' : '') +
            '<p class="meta">' + (d.createdAt ? formatDate(d.createdAt) : '') + '</p>';
          card.appendChild(statusSelect);
          card.appendChild(deleteBtn);
          listEl.appendChild(card);
        });
      });
  }

  function loadAllUsers(currentUserIsInstructor) {
    var listEl = document.getElementById('admin-users-list');
    listEl.innerHTML = '<p class="empty-msg">Loading…</p>';
    db.collection('users').onSnapshot(function (snap) {
      listEl.innerHTML = '';
      if (snap.empty) {
        listEl.innerHTML = '<p class="empty-msg">No users.</p>';
        return;
      }
      snap.docs.forEach(function (doc) {
        if (doc.id === auth.currentUser.uid) return;
        var d = doc.data();
        if (!currentUserIsInstructor && d.isInstructor) return;
        var role = d.isAdmin ? 'Admin' : (d.isInstructor ? 'Instructor' : (d.isStaff ? 'Staff' : 'Student'));
        var showRemove = currentUserIsInstructor || !d.isInstructor;
        var card = document.createElement('div');
        card.className = 'request-card';
        card.innerHTML =
          '<strong>' + escapeHtml(d.email || doc.id) + '</strong> – ' + role +
          (d.phone ? '<br>Phone: ' + escapeHtml(d.phone) : '') +
          (showRemove ? '<br><button type="button" data-user-id="' + escapeHtml(doc.id) + '">Remove</button>' : '');
        if (showRemove) {
          card.querySelector('button').addEventListener('click', function () {
            removeUser(doc.id);
          });
        }
        listEl.appendChild(card);
      });
    });
  }

  function removeUser(uid) {
    if (!confirm('Remove this user? Their profile and (if student) all their requests will be deleted.')) return;
    db.collection('tutoringRequests').where('userId', '==', uid).get().then(function (snap) {
      var batch = db.batch();
      snap.docs.forEach(function (doc) { batch.delete(doc.ref); });
      batch.delete(db.collection('users').doc(uid));
      return batch.commit();
    }).then(function () {
      loadAllUsers();
      loadAllRequests();
    }).catch(function (err) {
      alert('Could not remove user: ' + (err.message || err));
    });
  }

  var subjectChart = null;
  var statusChart = null;

  function loadAdminStats() {
    db.collection('tutoringRequests').get().then(function (snap) {
      var subjectCounts = {};
      var statusCounts = { pending: 0, matched: 0, 'in progress': 0, completed: 0 };
      
      snap.docs.forEach(function (doc) {
        var d = doc.data();
        var subj = d.subject || 'Unknown';
        subjectCounts[subj] = (subjectCounts[subj] || 0) + 1;
        var status = d.status || 'pending';
        if (statusCounts.hasOwnProperty(status)) {
          statusCounts[status]++;
        }
      });

      // Subject chart
      var subjectCtx = document.getElementById('chart-subject');
      if (subjectCtx) {
        if (subjectChart) subjectChart.destroy();
        var labels = Object.keys(subjectCounts);
        var data = labels.map(function (l) { return subjectCounts[l]; });
        subjectChart = new Chart(subjectCtx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: 'Number of Requests',
              data: data,
              backgroundColor: '#ccc',
              borderColor: '#999',
              borderWidth: 1
            }]
          },
          options: { responsive: true, maintainAspectRatio: true }
        });
      }

      // Status chart
      var statusCtx = document.getElementById('chart-status');
      if (statusCtx) {
        if (statusChart) statusChart.destroy();
        var statusLabels = Object.keys(statusCounts);
        var statusData = statusLabels.map(function (l) { return statusCounts[l]; });
        statusChart = new Chart(statusCtx, {
          type: 'doughnut',
          data: {
            labels: statusLabels,
            datasets: [{
              label: 'Requests by Status',
              data: statusData,
              backgroundColor: ['#e8e8e8', '#d0d0d0', '#b8b8b8', '#a0a0a0'],
              borderColor: '#999',
              borderWidth: 1
            }]
          },
          options: { responsive: true, maintainAspectRatio: true }
        });
      }
    });
  }

  function formatDate(t) {
    if (!t || !t.toDate) return '';
    var d = t.toDate();
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function handleAuthState(user) {
    if (!user) {
      showLogin();
      return;
    }
    getCurrentUserDoc().then(function (snap) {
      if (!snap || !snap.exists) {
        // For new users, automatically set them as regular members (not staff)
        var uid = user.uid;
        return db.collection('users').doc(uid).set({ isStaff: false }, { merge: true }).then(function () {
          return db.collection('users').doc(uid).get();
        });
      }
      return snap;
    }).then(function (snap) {
      var data = snap.data();
      if (data.completedOnboarding) {
        showDashboard(snap);
        return;
      }
      if (data.isStaff !== undefined) {
        if (data.isStaff) showOnboardStaff();
        else showOnboardStudent();
        return;
      }
      showOnboardRole();
    });
  }

  document.getElementById('btn-google-signin').addEventListener('click', function () {
    var provider = new firebase.auth.GoogleAuthProvider();
    document.getElementById('login-error').textContent = '';
    auth.signInWithPopup(provider).catch(function (err) {
      document.getElementById('login-error').textContent = err.message || 'Sign-in failed';
    });
  });

  document.getElementById('btn-yes-staff').addEventListener('click', function () {
    var uid = auth.currentUser.uid;
    db.collection('users').doc(uid).set({ isStaff: true }, { merge: true }).then(function () {
      showOnboardStaff();
    });
  });

  document.getElementById('btn-no-staff').addEventListener('click', function () {
    var uid = auth.currentUser.uid;
    db.collection('users').doc(uid).set({ isStaff: false }, { merge: true }).then(function () {
      showOnboardStudent();
    });
  });

  document.getElementById('btn-staff-back').addEventListener('click', function () {
    showOnboardRole();
  });

  document.getElementById('btn-student-back').addEventListener('click', function () {
    showOnboardRole();
  });

  document.getElementById('btn-staff-add-subject').addEventListener('click', function () {
    var name = getStaffSubjectFromPicker('staff-subject-select', 'staff-custom-wrap', 'staff-custom-name');
    if (!name) return;
    if (staffFormSubjects.some(function (s) { return s.name === name; })) return;
    staffFormSubjects.push({ name: name, ap: false });
    renderStaffSubjectList('staff-subjects-list', staffFormSubjects);
    var sel = document.getElementById('staff-subject-select');
    if (sel) sel.value = '';
    document.getElementById('staff-custom-wrap').classList.add('hidden');
  });

  document.getElementById('btn-staff-submit').addEventListener('click', function () {
    var code = document.getElementById('staff-code').value.trim();
    var enrichment = document.getElementById('staff-enrichment').value;
    var email = document.getElementById('staff-email').value.trim();
    var phone = document.getElementById('staff-phone').value.trim();
    var subjects = staffFormSubjects.slice();

    var errEl = document.getElementById('staff-form-error');
    var codeErr = document.getElementById('staff-code-error');
    errEl.textContent = '';
    codeErr.textContent = '';

    getCodes().then(function (codes) {
      var staffCode = (codes && codes.staffCode) || DEFAULT_STAFF_CODE;
      var adminCode = (codes && codes.adminCode) || DEFAULT_ADMIN_CODE;
      var instructorCode = (codes && codes.instructorCode) || DEFAULT_INSTRUCTOR_CODE;

      var isAdmin = (code === adminCode);
      var isInstructor = (code === instructorCode);
      var isStaff = (code === staffCode);
      if (!isStaff && !isAdmin && !isInstructor) {
        codeErr.textContent = 'Invalid staff code.';
        return;
      }
      runStaffSubmit(code, isAdmin, isInstructor, enrichment, email, phone, subjects, errEl, codeErr);
    });
  });

  function runStaffSubmit(code, isAdmin, isInstructor, enrichment, email, phone, subjects, errEl, codeErr) {
    if (isInstructor) {
      // Instructors: code only, no subjects/enrichment
    } else if (isAdmin) {
      // Admins must sign up to teach: require full staff form
      if (subjects.length === 0) {
        errEl.textContent = 'Select at least one subject.';
        return;
      }
      if (enrichment !== 'A' && enrichment !== 'D') {
        errEl.textContent = 'Select enrichment A or D.';
        return;
      }
      if (!email) {
        errEl.textContent = 'Enter your email.';
        return;
      }
    } else {
      // Staff
      if (subjects.length === 0) {
        errEl.textContent = 'Select at least one subject.';
        return;
      }
      if (enrichment !== 'A' && enrichment !== 'D') {
        errEl.textContent = 'Select enrichment A or D.';
        return;
      }
      if (!email) {
        errEl.textContent = 'Enter your email.';
        return;
      }
    }

    var uid = auth.currentUser.uid;
    var payload = {
      staffCodeEntered: true,
      completedOnboarding: true
    };
    if (isInstructor) {
      payload.isInstructor = true;
      payload.isStaff = false;
      payload.isAdmin = false;
      payload.email = auth.currentUser.email || '';
    } else if (isAdmin) {
      payload.isAdmin = true;
      payload.isStaff = true;
      payload.isInstructor = false;
      payload.subjects = subjects;
      payload.enrichment = enrichment;
      payload.email = email;
      payload.phone = phone || null;
    } else {
      payload.isStaff = true;
      payload.isAdmin = false;
      payload.isInstructor = false;
      payload.subjects = subjects;
      payload.enrichment = enrichment;
      payload.email = email;
      payload.phone = phone || null;
    }
    db.collection('users').doc(uid).set(payload, { merge: true }).then(function () {
      return getCurrentUserDoc();
    }).then(function (snap) {
      showDashboard(snap);
    }).catch(function (err) {
      errEl.textContent = err.message || 'Save failed';
    });
  }

  document.getElementById('btn-student-submit').addEventListener('click', function () {
    var subject = getStudentSubject();
    var enrichment = document.getElementById('student-enrichment').value;
    var need = document.getElementById('student-need').value.trim();
    var urgency = document.getElementById('student-urgency').value;

    var errEl = document.getElementById('student-form-error');
    errEl.textContent = '';

    if (!subject) {
      errEl.textContent = 'Select a subject.';
      return;
    }
    if (enrichment !== 'A' && enrichment !== 'D') {
      errEl.textContent = 'Select enrichment A or D.';
      return;
    }
    if (!need) {
      errEl.textContent = 'Describe what you need tutoring with.';
      return;
    }
    if (!urgency) {
      errEl.textContent = 'Select urgency.';
      return;
    }

    var uid = auth.currentUser.uid;
    var email = auth.currentUser.email || '';
    db.collection('tutoringRequests').add({
      userId: uid,
      subject: subject,
      enrichment: enrichment,
      needDescription: need,
      urgency: urgency,
      requesterEmail: email,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
      return db.collection('users').doc(uid).set({ completedOnboarding: true, isStaff: false }, { merge: true });
    }).then(function () {
      return getCurrentUserDoc();
    }).then(function (snap) {
      showDashboard(snap);
    }).catch(function (err) {
      errEl.textContent = err.message || 'Submit failed';
    });
  });

  document.getElementById('btn-signout').addEventListener('click', function () {
    auth.signOut();
  });

  var dashStaffSelect = document.getElementById('dash-staff-subject-select');
  var dashStaffCustomWrap = document.getElementById('dash-staff-custom-wrap');
  if (dashStaffSelect && dashStaffCustomWrap) {
    dashStaffSelect.addEventListener('change', function () {
      dashStaffCustomWrap.classList.toggle('hidden', dashStaffSelect.value !== '__custom__');
    });
  }
  document.getElementById('btn-dash-staff-add-subject').addEventListener('click', function () {
    var name = getStaffSubjectFromPicker('dash-staff-subject-select', 'dash-staff-custom-wrap', 'dash-staff-custom-name');
    if (!name) return;
    if (dashStaffSubjects.some(function (s) { return s.name === name; })) return;
    dashStaffSubjects.push({ name: name, ap: false });
    renderStaffSubjectList('dash-staff-subjects-list', dashStaffSubjects);
    var sel = document.getElementById('dash-staff-subject-select');
    if (sel) sel.value = '';
    if (dashStaffCustomWrap) dashStaffCustomWrap.classList.add('hidden');
  });
  document.getElementById('btn-dash-staff-save-subjects').addEventListener('click', function () {
    var errEl = document.getElementById('dash-staff-subjects-error');
    errEl.textContent = '';
    var uid = auth.currentUser.uid;
    db.collection('users').doc(uid).update({ subjects: dashStaffSubjects }).then(function () {
      errEl.textContent = 'Classes saved.';
      errEl.style.color = '#080';
    }).catch(function (err) {
      errEl.style.color = '';
      errEl.textContent = err.message || 'Save failed';
    });
  });

  document.getElementById('btn-admin-save-codes').addEventListener('click', function () {
    var staffCode = document.getElementById('admin-staff-code').value.trim();
    var adminCode = document.getElementById('admin-admin-code').value.trim();
    var instructorCode = document.getElementById('admin-instructor-code').value.trim();
    var errEl = document.getElementById('admin-codes-error');
    errEl.textContent = '';
    if (!staffCode || !adminCode || !instructorCode) {
      errEl.textContent = 'All three codes are required.';
      return;
    }
    db.collection('config').doc('codes').set({
      staffCode: staffCode,
      adminCode: adminCode,
      instructorCode: instructorCode
    }).then(function () {
      clearCodesCache();
      errEl.textContent = '';
      errEl.style.color = '';
      errEl.textContent = 'Codes saved.';
      errEl.style.color = '#080';
    }).catch(function (err) {
      errEl.style.color = '';
      errEl.textContent = err.message || 'Save failed';
    });
  });

  document.getElementById('btn-dash-submit').addEventListener('click', function () {
    var subject = document.getElementById('dash-subject').value;
    var enrichment = document.getElementById('dash-enrichment').value;
    var need = document.getElementById('dash-need').value.trim();
    var urgency = document.getElementById('dash-urgency').value;
    var errEl = document.getElementById('dash-form-error');
    errEl.textContent = '';

    if (!subject || enrichment !== 'A' && enrichment !== 'D' || !need || !urgency) {
      errEl.textContent = 'Fill all fields (subject, enrichment A or D, need, urgency).';
      return;
    }
    var uid = auth.currentUser.uid;
    var email = auth.currentUser.email || '';
    db.collection('tutoringRequests').add({
      userId: uid,
      subject: subject,
      enrichment: enrichment,
      needDescription: need,
      urgency: urgency,
      requesterEmail: email,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
      document.getElementById('dash-need').value = '';
    }).catch(function (err) {
      errEl.textContent = err.message || 'Add failed';
    });
  });

  auth.onAuthStateChanged(handleAuthState);
})();