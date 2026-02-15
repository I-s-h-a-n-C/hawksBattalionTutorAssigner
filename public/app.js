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

  var STAFF_CODE = 'hawksstaff';

  var db = firebase.firestore();
  var auth = firebase.auth();

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
    var isStaff = userDoc && userDoc.get('isStaff') === true;
    document.getElementById('dashboard-student-section').classList.toggle('hidden', isStaff);
    document.getElementById('dashboard-staff-section').classList.toggle('hidden', !isStaff);

    if (isStaff) {
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

  document.getElementById('btn-staff-submit').addEventListener('click', function () {
    var code = document.getElementById('staff-code').value.trim();
    var enrichment = document.getElementById('staff-enrichment').value;
    var email = document.getElementById('staff-email').value.trim();
    var phone = document.getElementById('staff-phone').value.trim();
    var subjects = getCheckedSubjects('staff-subj');

    var errEl = document.getElementById('staff-form-error');
    var codeErr = document.getElementById('staff-code-error');
    codeErr.textContent = '';
    errEl.textContent = '';

    if (code !== STAFF_CODE) {
      codeErr.textContent = 'Invalid staff code.';
      return;
    }
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

    var uid = auth.currentUser.uid;
    db.collection('users').doc(uid).set({
      isStaff: true,
      staffCodeEntered: true,
      subjects: subjects,
      enrichment: enrichment,
      email: email,
      phone: phone || null,
      completedOnboarding: true
    }, { merge: true }).then(function () {
      return getCurrentUserDoc();
    }).then(function (snap) {
      showDashboard(snap);
    }).catch(function (err) {
      errEl.textContent = err.message || 'Save failed';
    });
  });

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
