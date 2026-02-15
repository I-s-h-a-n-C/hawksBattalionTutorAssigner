const { SDK_VERSION } = require("firebase/app");
const { useEffect } = require("react");

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

  function getCheckedSubjects(namePrefix) {
    var nodes = document.querySelectorAll('input[name="' + namePrefix + '"]:checked');
    return Array.prototype.map.call(nodes, function (n) { return n.value; });
  }

  function renderSubjectSelect(selectId, optionalEmpty) {
    var sel = document.getElementById(selectId);
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
    renderSubjectCheckboxes('staff-subjects', 'staff-subj');
    document.getElementById('staff-email').value = auth.currentUser ? auth.currentUser.email : '';
  }

  function showOnboardStudent() {
    showScreen('studentForm');
    document.getElementById('student-form-error').textContent = '';
    var container = document.getElementById('student-subjects');
    container.innerHTML = '';
    var group = document.createElement('div');
    group.className = 'radio-group';
    SUBJECTS.forEach(function (subj) {
      var id = 'student-subj-' + subj.replace(/\s/g, '-');
      var label = document.createElement('label');
      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'student-subj';
      radio.value = subj;
      radio.id = id;
      label.htmlFor = id;
      label.appendChild(radio);
      label.appendChild(document.createTextNode(subj));
      group.appendChild(label);
    });
    container.appendChild(group);
  }

  function getStudentSubject() {
    var r = document.querySelector('input[name="student-subj"]:checked');
    return r ? r.value : '';
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
    if (isAdmin || isInstructor) {
      adminSection.classList.remove('hidden');
    } else if (isStaff) {
      staffSection.classList.remove('hidden');
    } else {
      studentSection.classList.remove('hidden');
    }

    if (isAdmin || isInstructor) {
      var codesSection = document.getElementById('admin-codes-section');
      if (codesSection) codesSection.classList.toggle('hidden', !isInstructor);
      if (isInstructor) loadAdminCodes();
      loadAllRequests();
      loadAllUsers();
    } else if (isStaff) {
      loadStaffRequests(userDoc.get('subjects') || []);
    } else {
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
            '<p class="meta">' + (d.createdAt ? 'Added ' + formatDate(d.createdAt) : '') + '</p>' +
            '<button type="button" data-request-id="' + escapeHtml(doc.id) + '">Remove</button>';
          card.querySelector('button').addEventListener('click', function () {
            removeRequest(doc.id);
          });
          listEl.appendChild(card);
        });
      });
  }

  function loadStaffRequests(mySubjects) {
    var listEl = document.getElementById('staff-requests-list');
    listEl.innerHTML = '<p class="empty-msg">Loading…</p>';
    if (mySubjects.length === 0) {
      listEl.innerHTML = '<p class="empty-msg">You have no subjects selected. Requests will appear here when they match your tutoring subjects.</p>';
      return;
    }
    db.collection('tutoringRequests')
      .orderBy('createdAt', 'desc')
      .onSnapshot(function (snap) {
        listEl.innerHTML = '';
        var filtered = snap.docs.filter(function (doc) {
          return mySubjects.indexOf(doc.data().subject) !== -1;
        });
        if (filtered.length === 0) {
          listEl.innerHTML = '<p class="empty-msg">No matching requests right now.</p>';
          return;
        }
        filtered.forEach(function (doc) {
          var d = doc.data();
          var card = document.createElement('div');
          card.className = 'request-card';
          card.innerHTML =
            '<strong>' + escapeHtml(d.subject) + '</strong> – ' + escapeHtml(d.needDescription || '') +
            '<br>Enrichment: ' + (d.enrichment || '') + ', Urgency: ' + (d.urgency || '') +
            '<p class="meta">' + (d.createdAt ? formatDate(d.createdAt) : '') + '</p>';
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
          card.innerHTML =
            '<strong>' + escapeHtml(d.subject) + '</strong> – ' + escapeHtml(d.needDescription || '') +
            '<br>Enrichment: ' + (d.enrichment || '') + ', Urgency: ' + (d.urgency || '') +
            '<p class="meta">' + (d.createdAt ? formatDate(d.createdAt) : '') + '</p>' +
            '<button type="button" data-request-id="' + escapeHtml(doc.id) + '">Delete</button>';
          card.querySelector('button').addEventListener('click', function () {
            removeRequest(doc.id);
          });
          listEl.appendChild(card);
        });
      });
  }

  function loadAllUsers() {
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
        var role = d.isAdmin ? 'Admin' : (d.isInstructor ? 'Instructor' : (d.isStaff ? 'Staff' : 'Student'));
        var card = document.createElement('div');
        card.className = 'request-card';
        card.innerHTML =
          '<strong>' + escapeHtml(d.email || doc.id) + '</strong> – ' + role +
          (d.phone ? '<br>Phone: ' + escapeHtml(d.phone) : '') +
          '<br><button type="button" data-user-id="' + escapeHtml(doc.id) + '">Remove</button>';
        card.querySelector('button').addEventListener('click', function () {
          removeUser(doc.id);
        });
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
        showOnboardRole();
        return;
      }
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

  document.getElementById('btn-staff-submit').addEventListener('click', function () {
    var code = document.getElementById('staff-code').value.trim();
    var enrichment = document.getElementById('staff-enrichment').value;
    var email = document.getElementById('staff-email').value.trim();
    var phone = document.getElementById('staff-phone').value.trim();
    var subjects = getCheckedSubjects('staff-subj');

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
    db.collection('tutoringRequests').add({
      userId: uid,
      subject: subject,
      enrichment: enrichment,
      needDescription: need,
      urgency: urgency,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
      db.collection('users').doc(uid).set({ completedOnboarding: true, isStaff: false }, { merge: true }).then(function () {
        handleAuthState(auth.currentUser);
      });
    }).catch(function (err) {
      errEl.textContent = err.message || 'Submit failed';
    });
  });

  document.getElementById('btn-signout').addEventListener('click', function () {
    auth.signOut();
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
    db.collection('tutoringRequests').add({
      userId: uid,
      subject: subject,
      enrichment: enrichment,
      needDescription: need,
      urgency: urgency,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
      document.getElementById('dash-need').value = '';
    }).catch(function (err) {
      errEl.textContent = err.message || 'Add failed';
    });
  });

  auth.onAuthStateChanged(handleAuthState);
})();


