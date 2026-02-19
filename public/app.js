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

  // EmailJS configuration
  var EMAILJS_PUBLIC_KEY = 'KUer0zNT18YPEJ8u2';
  var EMAILJS_SERVICE_ID = 'service_9cr1hq9';
  var EMAILJS_TEMPLATE_REQUEST_MATCHED = 'template_request_matched';
  var EMAILJS_TEMPLATE_MATCHED_ADMIN = 'template_matched_admin';

  function isPlaceholder(value, prefix) {
    if (!value) return true;
    return String(value).indexOf(prefix) === 0;
  }

  function isEmailJsReady() {
    return typeof emailjs !== 'undefined'
      && !isPlaceholder(EMAILJS_PUBLIC_KEY, 'YOUR_')
      && !isPlaceholder(EMAILJS_SERVICE_ID, 'YOUR_');
  }
  
  // Initialize EmailJS (only if public key is set)
  if (isEmailJsReady()) {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  } else {
    console.warn('EmailJS init skipped', {
      emailjsLoaded: typeof emailjs !== 'undefined',
      hasPublicKey: !isPlaceholder(EMAILJS_PUBLIC_KEY, 'YOUR_'),
      hasServiceId: !isPlaceholder(EMAILJS_SERVICE_ID, 'YOUR_')
    });
  }

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
  var adminTutorSubjects = [];
  var unsubscribeAuditLogs = null;

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

    var dashboardTitle = document.getElementById('dashboard-title');
    var studentSection = document.getElementById('dashboard-student-section');
    var staffSection = document.getElementById('dashboard-staff-section');
    var adminSection = document.getElementById('dashboard-admin-section');

    studentSection.classList.add('hidden');
    staffSection.classList.add('hidden');
    adminSection.classList.add('hidden');

    // Show only ONE dashboard based on highest privilege level
    if (isInstructor) {
      dashboardTitle.textContent = 'Instructor Dashboard';
      adminSection.classList.remove('hidden');
    } else if (isAdmin) {
      dashboardTitle.textContent = 'Admin Dashboard';
      adminSection.classList.remove('hidden');
    } else if (isStaff) {
      dashboardTitle.textContent = 'Staff Dashboard';
      staffSection.classList.remove('hidden');
    } else {
      dashboardTitle.textContent = 'Student Dashboard';
      studentSection.classList.remove('hidden');
    }

    if (isAdmin || isInstructor) {
      var codesSection = document.getElementById('admin-codes-section');
      var statsSection = document.getElementById('admin-stats-section');
      var resetStatsBtn = document.getElementById('btn-reset-stats');
      var adminTutorSection = document.getElementById('admin-tutor-section');
      if (codesSection) codesSection.classList.toggle('hidden', !isInstructor);
      if (statsSection) statsSection.classList.remove('hidden');
      if (resetStatsBtn) resetStatsBtn.classList.toggle('hidden', !isInstructor);
      if (adminTutorSection) adminTutorSection.classList.toggle('hidden', isInstructor);
      if (isInstructor) loadAdminCodes();
      loadAdminStats();
      loadAuditLogs();
      loadAllRequests();
      loadAllUsers(isInstructor);
      if (isAdmin && !isInstructor) {
        adminTutorSubjects = normalizeSubjects(userDoc.get('subjects') || []);
        renderStaffSubjectSelectOptions('admin-tutor-subject-select');
        renderStaffSubjectList('admin-tutor-subjects-list', adminTutorSubjects);
        loadRequestsForSubjects(userDoc.get('subjects') || [], 'admin-tutor-requests-list');
      }
    } else if (isStaff) {
      if (unsubscribeAuditLogs) {
        unsubscribeAuditLogs();
        unsubscribeAuditLogs = null;
      }
      dashStaffSubjects = normalizeSubjects(userDoc.get('subjects') || []);
      renderStaffSubjectSelectOptions('dash-staff-subject-select');
      renderStaffSubjectList('dash-staff-subjects-list', dashStaffSubjects);
      loadStaffRequests(userDoc.get('subjects') || []);
    } else {
      if (unsubscribeAuditLogs) {
        unsubscribeAuditLogs();
        unsubscribeAuditLogs = null;
      }
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
            if (confirm('Are you sure you want to mark this request as completed?')) {
              db.collection('tutoringRequests').doc(doc.id).update({ status: 'completed' }).then(function () {
                // Get current user info and notify admins/instructors
                var currentUid = auth.currentUser.uid;
                db.collection('users').doc(currentUid).get().then(function (userDoc) {
                  var userData = userDoc.data();
                  // Notify admins/instructors about completion
                  notifyAdminsAndInstructorsOfCompletion(d.subject, userData.displayName || 'Student');
                });
                archiveRequest(doc.id);
              });
            }
          });
          removeBtn.addEventListener('click', function () {
            removeRequest(doc.id);
          });
          listEl.appendChild(card);
        });
      });
  }

  function loadStaffRequests(mySubjects) {
    return loadRequestsForSubjects(mySubjects, 'staff-requests-list');
  }

  function loadRequestsForSubjects(mySubjects, listId) {
    var listEl = document.getElementById('staff-requests-list');
    if (listId) {
      listEl = document.getElementById(listId);
    }
    if (!listEl) return;
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
            var newStatus = statusSelect.value;
            if (newStatus === 'completed') {
              if (!confirm('Are you sure you want to mark this request as completed?')) {
                statusSelect.value = d.status || 'pending';
                return;
              }
            }
            db.collection('tutoringRequests').doc(doc.id).update({ status: newStatus }).then(function () {
              logActivity('request_status_changed', {
                requestId: doc.id,
                subject: d.subject || 'Unknown',
                status: newStatus,
                source: listId || 'staff-requests-list'
              });
              // Send emails based on new status
              if (newStatus === 'matched') {
                // Get current user (staff member) info
                var currentUid = auth.currentUser.uid;
                db.collection('users').doc(currentUid).get().then(function (staffDoc) {
                  var staffData = staffDoc.data();
                  // Notify student
                  if (d.requesterEmail) {
                    notifyStudentOfMatch(d.requesterEmail, 'Student', staffData.displayName || 'Staff Member', staffData.email);
                  }
                  // Notify admins/instructors
                  notifyAdminsAndInstructorsOfMatch(d.subject, staffData.displayName || 'Staff Member');
                });
              } else if (newStatus === 'completed') {
                // Get current user info
                var currentUid = auth.currentUser.uid;
                db.collection('users').doc(currentUid).get().then(function (staffDoc) {
                  var staffData = staffDoc.data();
                  // Notify admins/instructors
                  notifyAdminsAndInstructorsOfCompletion(d.subject, staffData.displayName || 'Staff Member');
                });
                archiveRequest(doc.id);
              }
            });
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

  function archiveRequest(id) {
    db.collection('tutoringRequests').doc(id).get().then(function (doc) {
      if (!doc.exists) return;
      var data = doc.data();
      var subject = data.subject || 'Unknown';
      
      // Update stats counters instead of saving full document
      var statsRef = db.collection('stats').doc('completedRequests');
      var increment = firebase.firestore.FieldValue.increment(1);
      var update = {
        total: increment,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      };
      update['bySubject.' + subject] = increment;
      
      return statsRef.set(update, { merge: true }).then(function () {
        logActivity('request_completed_archived', {
          requestId: id,
          subject: subject,
          userId: data.userId || '',
          requesterEmail: data.requesterEmail || ''
        });
        return db.collection('tutoringRequests').doc(id).delete();
      });
    }).catch(function (err) {
      console.error('Could not archive: ' + (err.message || err));
    });
  }

  function removeRequest(id) {
    db.collection('tutoringRequests').doc(id).delete().then(function () {
      logActivity('request_removed', { requestId: id });
    }).catch(function (err) {
      alert('Could not remove: ' + (err.message || err));
    });
  }

  function logActivity(action, details) {
    if (!auth.currentUser) return Promise.resolve();
    var currentUser = auth.currentUser;
    var uid = currentUser.uid;
    return db.collection('users').doc(uid).get().then(function (snap) {
      var userData = snap.exists ? (snap.data() || {}) : {};
      var role = userData.isInstructor ? 'Instructor' : (userData.isAdmin ? 'Admin' : (userData.isStaff ? 'Staff' : 'Student'));
      return db.collection('auditLogs').add({
        action: action,
        details: details || {},
        actorUid: uid,
        actorEmail: currentUser.email || userData.email || '',
        actorName: currentUser.displayName || userData.displayName || 'Unknown User',
        actorRole: role,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }).catch(function (err) {
      console.warn('Audit log write failed:', err && (err.message || err));
    });
  }

  function formatAuditDetails(details) {
    if (!details) return '';
    var keys = Object.keys(details);
    if (keys.length === 0) return '';
    return keys.map(function (key) {
      var value = details[key];
      if (value === null || value === undefined) return key + ': -';
      if (typeof value === 'object') {
        try {
          return key + ': ' + JSON.stringify(value);
        } catch (err) {
          return key + ': [object]';
        }
      }
      return key + ': ' + String(value);
    }).join(' | ');
  }

  function loadAuditLogs() {
    var listEl = document.getElementById('admin-audit-log-list');
    if (!listEl) return;
    if (unsubscribeAuditLogs) {
      unsubscribeAuditLogs();
      unsubscribeAuditLogs = null;
    }
    listEl.innerHTML = '<p class="empty-msg">Loading…</p>';
    unsubscribeAuditLogs = db.collection('auditLogs')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .onSnapshot(function (snap) {
        listEl.innerHTML = '';
        if (snap.empty) {
          listEl.innerHTML = '<p class="empty-msg">No activity yet.</p>';
          return;
        }
        snap.docs.forEach(function (doc) {
          var d = doc.data() || {};
          var card = document.createElement('div');
          card.className = 'request-card';
          var detailsText = formatAuditDetails(d.details);
          card.innerHTML =
            '<strong>' + escapeHtml(d.action || 'activity') + '</strong>' +
            '<br>User: ' + escapeHtml(d.actorName || 'Unknown') + ' (' + escapeHtml(d.actorRole || 'Unknown') + ')' +
            (d.actorEmail ? '<br>Email: ' + escapeHtml(d.actorEmail) : '') +
            (detailsText ? '<br><span>' + escapeHtml(detailsText) + '</span>' : '') +
            '<p class="meta">' + (d.createdAt ? formatDate(d.createdAt) : 'Just now') + '</p>';
          listEl.appendChild(card);
        });
      }, function (err) {
        listEl.innerHTML = '<p class="error">Could not load activity log: ' + escapeHtml(err && (err.message || err)) + '</p>';
      });
  }

  function sendEmailNotification(templateId, params) {
    if (!isEmailJsReady()) {
      console.warn('EmailJS not ready. Email would have been sent with params:', {
        templateId: templateId,
        to: params && params.to_email,
        emailjsLoaded: typeof emailjs !== 'undefined',
        hasPublicKey: !isPlaceholder(EMAILJS_PUBLIC_KEY, 'YOUR_'),
        hasServiceId: !isPlaceholder(EMAILJS_SERVICE_ID, 'YOUR_')
      });
      return Promise.resolve();
    }
    return emailjs.send(EMAILJS_SERVICE_ID, templateId, params, EMAILJS_PUBLIC_KEY)
      .then(function (result) {
        console.log('Email sent:', {
          templateId: templateId,
          to: params && params.to_email,
          status: result && result.status,
          text: result && result.text
        });
        return result;
      })
      .catch(function (err) {
        console.error('Email send error:', {
          templateId: templateId,
          to: params && params.to_email,
          status: err && err.status,
          text: err && err.text,
          message: err && err.message,
          raw: err
        });
      });
  }

  function notifyStaffOfNewRequest(request, subject) {
    db.collection('users')
      .where('isStaff', '==', true)
      .get()
      .then(function (snap) {
        var recipientCount = 0;
        snap.docs.forEach(function (doc) {
          var staffData = doc.data();
          var subjectNames = getSubjectNames(staffData.subjects || []);
          var canTutorSubject = subjectNames.indexOf(subject) !== -1;
          if (staffData.email && canTutorSubject) {
            recipientCount++;
            sendEmailNotification(EMAILJS_TEMPLATE_MATCHED_ADMIN, {
              to_email: staffData.email,
              recipient_name: staffData.displayName || 'Staff Member',
              event_title: 'New Tutoring Request',
              event_summary: 'A new tutoring request was submitted and matches your tutoring subject.',
              subject: subject,
              detail_1_label: 'Student need',
              detail_1_value: request.needDescription || 'Not provided',
              detail_2_label: 'Urgency / Enrichment',
              detail_2_value: (request.urgency || 'N/A') + ' / ' + (request.enrichment || 'N/A'),
              cta_message: 'Please open Hawks Battalion Tutoring to review and accept this request.'
            });
          }
        });
        if (recipientCount === 0) {
          console.warn('No staff recipients found for subject:', subject);
        }
      });
  }

  function notifyStudentOfUpdate(studentEmail, studentName, requestStatus, tutorName) {
    sendEmailNotification(EMAILJS_TEMPLATE_REQUEST_MATCHED, {
      to_email: studentEmail,
      student_name: studentName,
      event_title: 'Request Status Updated',
      event_summary: 'Your tutoring request status has changed.',
      status: requestStatus || 'updated',
      staff_name: tutorName || 'A tutor',
      staff_email: 'Not provided'
    });
  }

  function notifyStudentOfMatch(studentEmail, studentName, staffName, staffEmail) {
    sendEmailNotification(EMAILJS_TEMPLATE_REQUEST_MATCHED, {
      to_email: studentEmail,
      student_name: studentName,
      event_title: 'Your Request Was Accepted',
      event_summary: 'Great news — a tutor has accepted your tutoring request.',
      status: 'matched',
      staff_name: staffName || 'A tutor',
      staff_email: staffEmail || 'Not provided'
    });
  }

  function getAdminAndInstructorRecipients() {
    return db.collection('users').get().then(function (snap) {
      return snap.docs
        .map(function (doc) { return doc.data(); })
        .filter(function (userData) {
          return (userData && (userData.isAdmin === true || userData.isInstructor === true) && !!userData.email);
        });
    });
  }

  function notifyAdminsAndInstructorsOfMatch(requestSubject, staffName) {
    getAdminAndInstructorRecipients().then(function (recipients) {
      recipients.forEach(function (userData) {
        sendEmailNotification(EMAILJS_TEMPLATE_MATCHED_ADMIN, {
          to_email: userData.email,
          recipient_name: userData.displayName || 'Admin/Instructor',
          event_title: 'Request Matched',
          event_summary: 'A tutoring request has been marked as matched.',
          subject: requestSubject,
          detail_1_label: 'Accepted by',
          detail_1_value: staffName || 'Unknown staff member',
          detail_2_label: 'Status',
          detail_2_value: 'matched',
          cta_message: 'You can review details in the admin/instructor dashboard.'
        });
      });
    });
  }

  function notifyAdminsAndInstructorsOfCompletion(requestSubject, staffName) {
    getAdminAndInstructorRecipients().then(function (recipients) {
      recipients.forEach(function (userData) {
        sendEmailNotification(EMAILJS_TEMPLATE_MATCHED_ADMIN, {
          to_email: userData.email,
          recipient_name: userData.displayName || 'Admin/Instructor',
          event_title: 'Request Completed',
          event_summary: 'A tutoring request has been marked as completed.',
          subject: requestSubject,
          detail_1_label: 'Completed by',
          detail_1_value: staffName || 'Unknown staff member',
          detail_2_label: 'Status',
          detail_2_value: 'completed',
          cta_message: 'You can review updated statistics in the dashboard.'
        });
      });
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
            var newStatus = statusSelect.value;
            if (newStatus === 'completed') {
              if (!confirm('Are you sure you want to mark this request as completed?')) {
                statusSelect.value = d.status || 'pending';
                return;
              }
            }
            db.collection('tutoringRequests').doc(doc.id).update({ status: newStatus }).then(function () {
              logActivity('request_status_changed', {
                requestId: doc.id,
                subject: d.subject || 'Unknown',
                status: newStatus,
                source: 'admin-all-requests'
              });
              // Send emails based on new status
              if (newStatus === 'matched') {
                // Get current user (admin/instructor) info
                var currentUid = auth.currentUser.uid;
                db.collection('users').doc(currentUid).get().then(function (adminDoc) {
                  var adminData = adminDoc.data();
                  // Notify student
                  if (d.requesterEmail) {
                    notifyStudentOfMatch(d.requesterEmail, 'Student', adminData.displayName || 'Staff', adminData.email);
                  }
                  // Notify admins/instructors
                  notifyAdminsAndInstructorsOfMatch(d.subject, adminData.displayName || 'Staff');
                });
              } else if (newStatus === 'completed') {
                // Get current user info
                var currentUid = auth.currentUser.uid;
                db.collection('users').doc(currentUid).get().then(function (adminDoc) {
                  var adminData = adminDoc.data();
                  // Notify admins/instructors
                  notifyAdminsAndInstructorsOfCompletion(d.subject, adminData.displayName || 'Staff');
                });
                archiveRequest(doc.id);
              }
            });
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
      logActivity('user_removed', { userId: uid });
      loadAllUsers();
      loadAllRequests();
    }).catch(function (err) {
      alert('Could not remove user: ' + (err.message || err));
    });
  }

  var subjectChart = null;
  var statusChart = null;
  var latestStatusCounts = null;
  var latestStatsUpdatedAt = null;

  function exportAdminStatsPdf() {
    if (!latestStatusCounts) {
      alert('Statistics are still loading. Please try again in a moment.');
      return;
    }
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('PDF library is not loaded. Please refresh and try again.');
      return;
    }

    var jsPDF = window.jspdf.jsPDF;
    var pdf = new jsPDF();
    var y = 20;

    pdf.setFontSize(16);
    pdf.text('Hawks Battalion Tutoring - Statistics', 14, y);
    y += 8;

    pdf.setFontSize(11);
    pdf.text('Generated: ' + new Date().toLocaleString(), 14, y);
    y += 10;

    pdf.setFontSize(13);
    pdf.text('Request Status Summary', 14, y);
    y += 8;

    pdf.setFontSize(11);
    var total = 0;
    Object.keys(latestStatusCounts).forEach(function (key) {
      total += latestStatusCounts[key] || 0;
    });

    Object.keys(latestStatusCounts).forEach(function (key) {
      pdf.text(key + ': ' + (latestStatusCounts[key] || 0), 16, y);
      y += 7;
    });

    pdf.text('Total Requests: ' + total, 16, y);
    y += 10;

    if (latestStatsUpdatedAt) {
      pdf.text('Stats Last Updated: ' + latestStatsUpdatedAt, 14, y);
      y += 10;
    }

    var statusCanvas = document.getElementById('chart-status');
    if (statusCanvas && statusCanvas.toDataURL) {
      var chartImage = statusCanvas.toDataURL('image/png', 1.0);
      pdf.addImage(chartImage, 'PNG', 14, y, 180, 90);
    }

    pdf.save('hawks-tutoring-statistics.pdf');
  }

  function loadAdminStats() {
    Promise.all([
      db.collection('tutoringRequests').get(),
      db.collection('stats').doc('completedRequests').get()
    ]).then(function (results) {
      var activeSnap = results[0];
      var statsSnap = results[1];
      var subjectCounts = {};
      var statusCounts = { pending: 0, matched: 0, 'in progress': 0, completed: 0 };
      
      activeSnap.docs.forEach(function (doc) {
        var d = doc.data();
        var subj = d.subject || 'Unknown';
        subjectCounts[subj] = (subjectCounts[subj] || 0) + 1;
        var status = d.status || 'pending';
        if (statusCounts.hasOwnProperty(status)) {
          statusCounts[status]++;
        }
      });

      // Add completed request stats
      if (statsSnap.exists) {
        var statsData = statsSnap.data();
        statusCounts.completed = statsData.total || 0;
      }

      latestStatusCounts = statusCounts;
      latestStatsUpdatedAt = new Date().toLocaleString();

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
              backgroundColor: ['#ffc72c', '#fff9e6', '#ffe4e4', '#c41e3a'],
              borderColor: '#fff',
              borderWidth: 3
            }]
          },
          options: { 
            responsive: true, 
            maintainAspectRatio: true,
            plugins: {
              legend: {
                labels: {
                  color: '#2c2c2c',
                  font: { weight: 600 }
                }
              }
            }
          }
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
      if (err && (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user')) {
        auth.signInWithRedirect(provider).catch(function (redirectErr) {
          document.getElementById('login-error').textContent = redirectErr.message || 'Sign-in failed';
        });
        return;
      }
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
      // Admins must sign up to teach
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
      logActivity('staff_profile_saved', {
        isAdmin: !!payload.isAdmin,
        isInstructor: !!payload.isInstructor,
        isStaff: !!payload.isStaff,
        subjectsCount: payload.subjects ? payload.subjects.length : 0,
        enrichment: payload.enrichment || ''
      });
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
    var requestData = {
      userId: uid,
      subject: subject,
      enrichment: enrichment,
      needDescription: need,
      urgency: urgency,
      requesterEmail: email,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    db.collection('tutoringRequests').add(requestData).then(function () {
      logActivity('request_created', {
        subject: subject,
        enrichment: enrichment,
        urgency: urgency,
        source: 'student-onboarding'
      });
      // Send email to staff teaching this subject
      notifyStaffOfNewRequest(requestData, subject);
      return db.collection('users').doc(uid).set({ 
        completedOnboarding: true, 
        isStaff: false,
        email: email
      }, { merge: true });
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
      logActivity('tutor_subjects_saved', {
        source: 'staff-dashboard',
        subjectsCount: dashStaffSubjects.length
      });
    }).catch(function (err) {
      errEl.style.color = '';
      errEl.textContent = err.message || 'Save failed';
    });
  });

  var adminTutorSelect = document.getElementById('admin-tutor-subject-select');
  var adminTutorCustomWrap = document.getElementById('admin-tutor-custom-wrap');
  if (adminTutorSelect && adminTutorCustomWrap) {
    adminTutorSelect.addEventListener('change', function () {
      adminTutorCustomWrap.classList.toggle('hidden', adminTutorSelect.value !== '__custom__');
    });
  }

  var adminTutorAddBtn = document.getElementById('btn-admin-tutor-add-subject');
  if (adminTutorAddBtn) {
    adminTutorAddBtn.addEventListener('click', function () {
      var name = getStaffSubjectFromPicker('admin-tutor-subject-select', 'admin-tutor-custom-wrap', 'admin-tutor-custom-name');
      if (!name) return;
      if (adminTutorSubjects.some(function (s) { return s.name === name; })) return;
      adminTutorSubjects.push({ name: name, ap: false });
      renderStaffSubjectList('admin-tutor-subjects-list', adminTutorSubjects);
      var sel = document.getElementById('admin-tutor-subject-select');
      if (sel) sel.value = '';
      if (adminTutorCustomWrap) adminTutorCustomWrap.classList.add('hidden');
    });
  }

  var adminTutorSaveBtn = document.getElementById('btn-admin-tutor-save-subjects');
  if (adminTutorSaveBtn) {
    adminTutorSaveBtn.addEventListener('click', function () {
      var errEl = document.getElementById('admin-tutor-subjects-error');
      if (!errEl) return;
      errEl.textContent = '';
      var uid = auth.currentUser.uid;
      db.collection('users').doc(uid).update({ subjects: adminTutorSubjects }).then(function () {
        errEl.textContent = 'Classes saved.';
        errEl.style.color = '#080';
        logActivity('tutor_subjects_saved', {
          source: 'admin-dashboard',
          subjectsCount: adminTutorSubjects.length
        });
        loadRequestsForSubjects(adminTutorSubjects, 'admin-tutor-requests-list');
      }).catch(function (err) {
        errEl.style.color = '';
        errEl.textContent = err.message || 'Save failed';
      });
    });
  }

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
      logActivity('codes_updated', {
        updatedBy: auth.currentUser ? auth.currentUser.uid : ''
      });
    }).catch(function (err) {
      errEl.style.color = '';
      errEl.textContent = err.message || 'Save failed';
    });
  });

  var resetStatsBtnEl = document.getElementById('btn-reset-stats');
  if (resetStatsBtnEl) {
    resetStatsBtnEl.addEventListener('click', function () {
      var msgEl = document.getElementById('stats-reset-message');
      if (!msgEl) return;
      msgEl.textContent = '';
      msgEl.style.color = '';
      
      if (!confirm('Are you sure you want to reset all statistics? This will delete all completed request counts and cannot be undone.')) {
        return;
      }
      
      db.collection('stats').doc('completedRequests').delete().then(function () {
        msgEl.textContent = 'Statistics reset successfully.';
        msgEl.style.color = '#080';
        logActivity('statistics_reset', {});
        loadAdminStats();
      }).catch(function (err) {
        msgEl.textContent = err.message || 'Reset failed';
      });
    });
  }

  var exportStatsBtnEl = document.getElementById('btn-export-stats');
  if (exportStatsBtnEl) {
    exportStatsBtnEl.addEventListener('click', function () {
      exportAdminStatsPdf();
    });
  }

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
    var requestData = {
      userId: uid,
      subject: subject,
      enrichment: enrichment,
      needDescription: need,
      urgency: urgency,
      requesterEmail: email,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    db.collection('tutoringRequests').add(requestData).then(function () {
      logActivity('request_created', {
        subject: subject,
        enrichment: enrichment,
        urgency: urgency,
        source: 'student-dashboard'
      });
      // Send email to staff teaching this subject
      notifyStaffOfNewRequest(requestData, subject);
      document.getElementById('dash-need').value = '';
    }).catch(function (err) {
      errEl.textContent = err.message || 'Add failed';
    });
  });

  auth.onAuthStateChanged(handleAuthState);
})();


