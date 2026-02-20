# Automated tutor matching system for JROTC battalions
<img width="1918" height="862" alt="image" src="https://github.com/user-attachments/assets/43d17bbd-2ad9-4177-a3cf-e21efeb483ea" />
<img width="1918" height="866" alt="image" src="https://github.com/user-attachments/assets/f9f1f6d9-ae86-4edd-a630-1335a426ab7b" />

## tldr

This platform connects students who need tutoring help with staff members who can provide it. Students submit tutoring requests by subject, staff members review matching requests and complete sessions, and administrators oversee the entire process with analytics and audit logging.

**Live demo**: https://hawksbtlntutoring-49974.web.app

## User Roles & Features

### 1. **Student**
Students can request tutoring help and track session completion.

**Current system (you can change as needed for your own battalion):**
- **Create Tutoring Request** — Submit a request specifying the subject and any additional details
- **View Request Status** — Track whether their request is "waiting for match," "in progress," or "completed"
- **Email Notifications** — Receive notifications when a staff member is matched to their request

**Important stuff to remember:**
- Requests are automatically saved to Firestore
- Students see a "Create New Request" button on their dashboard
- Once matched, they receive an email notification with the staff member's name

### 2. **Staff Member**
Staff members tutor students and update session progress.

**Current system:**
- **Browse Matching Tutoring Requests** — View all open requests for subjects they tutor
- **Accept a Request** — Click "Accept Match" to start tutoring a student
- **Update Request Status** — Mark requests as "In Progress" or "Completed"

**Important stuff to remember:**
- Staff see only requests for their assigned subjects
- Requests auto-update in real-time as they accept them
- Email notifications inform students when a staff member has been matched
- Staff email is included in the notification sent to students (via EmailJS)

### 3. **Admin** (S6 and S3/S3 SGM probably)
Admins oversee tutoring operations, manage staff class assignments, complete their own tutoring, and monitor all activity.

**Current System:**

#### a. **Admin Dashboard (Main Panel)**
- View summary statistics: total requests, matched requests, completed sessions, staff count
- See pie chart of requests by status (Waiting, In Progress, Completed)
- Access **Export Statistics to PDF** button to download a snapshot of current stats

#### b. **Admin Tutoring**
- Select which classes they tutor (e.g., "Math", "Physics")
- View matching tutoring requests for those classes
- Accept requests and update progress (same as staff workflow)
- Complete sessions and receive completion notifications

#### c. **Manage Staff** (View)
- View list of all staff members and their assigned subjects

#### d. **Manage Requests** (View)
- View all tutoring requests across the system
- See request status, student info, and subject

#### e. **Audit Log** (Activity Tracking)
- **Real-time Activity Feed** — See all user actions logged with timestamps:
  - Student creates request
  - Staff accepts match
  - Request marked complete
  - Admin signs in / out
- **Compliance & Transparency** — Track who did what and when
- **Filter by Action** — View logs by event type (create, match, complete, etc.)

**Important stuff to remember:**
- Admins see all requests and activities (not filtered by subject)
- Audit log is **admin-only** (instructors can also view)
- PDF export includes charts for easy reporting

### 4. **Instructor**
Instructors have read-only access to audit logs and statistics (no tutoring capabilites).

**Current System:**
- **View Audit Logs** — See all activity in the system
- **View Statistics** — See summary stats and charts

**Important stuff to remember:**
- Instructors have max perms, so they can do all that admins can do on top of being able to remove admins.

## Key Features

### **1. Request Matching System**
When a student creates a request with a subject (e.g., "Biology"), the system automatically notifies all staff members who tutor that subject. Staff can then browse and accept matching requests.

**How it works:**
1. Student submits "(Subject: Biology, Details: Need help with photosynthesis)"
2. System finds all staff who tutor Biology
3. Staff members see the request in their "Matching Requests" panel
4. Staff clicks "Accept Match" → system:
   - Updates request status to "In Progress"
   - Sends email to student: "A staff member has been matched to your request"
   - Logs the action to audit trail

### **2. Email Notifications (EmailJS)**
Automated emails alert students and admins about tutoring events.

**Emails sent to:**
- **Students** — When a staff member is matched to their request (includes staff name/subject)
- **Admins** — When a request is marked completed (summary with student + staff info)

**Email Templates:**
- `template_request_matched` — Notifies student of staff match
- `template_matched_admin` — Notifies admin of new match/completion

All emails are sent via EmailJS (you will need to self configure) to ensure reliable delivery.

### **3. Firestore Database Structure**
Data is organized in the Firestore cloud database:

```
/users/{userID}
  - email, displayName, role, subjects (for staff/admin)

/requests/{requestID}
  - studentID, subject, details, status (waiting/in-progress/completed)
  - staffID (once matched), createdTime, updatedTime

/auditLogs/{logID}
  - userID, action, details, timestamp, userRole
  - Includes: "student_request_created", "staff_accepted_match", "request_completed", "admin_signin", etc.
```

**Security Rules:**
- Students can only read staff profiles (to see names in emails)
- Admins/Instructors can read all data
- Audit logs are write-restricted to logged-in users; read-restricted to admins/instructors
- Users can only update their own roles/subjects

### **4. PDF Statistics Export**
Admins can generate a PDF report of tutoring statistics:

**Report Contents:**
- Date/time generated
- Pie chart: Request status distribution (Waiting / In Progress / Completed)
- Summary table: Total requests, matched requests, completed requests, staff members
- Text summary of system health

**How to use:**
1. Go to Admin Dashboard
2. Click "Export Statistics to PDF"
3. PDF downloads with filename: `tutoring_stats_[date].pdf`

### **5. Audit Logging (Activity Tracking)**
Every significant user action is logged for compliance and transparency (and JPA inspection).

**Logged Actions:**
- `admin_signin` / `admin_signout` — Admin login/logout
- `student_request_created` — Student submits tutoring request
- `staff_accepted_match` — Staff accepts a tutoring request
- `request_completed` — Tutoring session marked complete
- `admin_tutoring_classes_set` — Admin selects which classes they tutor
- And more... (again adjust as needed)

**Log Details:**
- Timestamp (when action occurred)
- User role (Student / Staff / Admin / Instructor)
- User display name
- Action type
- Additional context (e.g., subject, request ID)

**Access Control:**
- Only Admins and Instructors can view logs
- Logs are live-updated (real-time feed in dashboard)

## Deploying it for your battalion

1. **Clone the repository**
   ```
   git clone https://github.com/[your-repo]/hawksBtlnTutoring.git
   cd hawksBtlnTutoring
   ```

2. **Create Firebase config**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Create a new project (or use existing)
   - Create a web app in your project
   - Copy the config object
   - Create `public/firebase-config.js`:
     ```javascript
     // Firebase config - paste from console
     const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       authDomain: "your-project.firebaseapp.com",
       projectId: "your-project-id",
       storageBucket: "your-project.appspot.com",
       messagingSenderId: "YOUR_SENDER_ID",
       appId: "YOUR_APP_ID"
     };

     firebase.initializeApp(firebaseConfig);
     ```

3. **Set up EmailJS**
   - Sign up at [EmailJS](https://www.emailjs.com)
   - Create email templates named:
     - `template_request_matched` — For student notifications
     - `template_matched_admin` — For admin notifications
   - Update service ID in [public/app.js](public/app.js#L33)
   - Update public key in [public/app.js](public/app.js#L34)

4. **Deploy Firestore Rules**
   - Update [firestore.rules](firestore.rules) if needed
   - Deploy via Firebase CLI:
     ```
     firebase deploy --only firestore:rules
     ```

5. **Deploy to Firebase Hosting**
   ```
   firebase deploy
   ```

### **Firebase Configuration**

**Authentication:**
- Enable Google Sign-In in Firebase Console
- Users sign in via popup (falls back to redirect if needed)

**Firestore:**
- Database location: auto-determined by Firebase
- Collections auto-created on first write
- See [firestore.rules](firestore.rules) for security configuration

**Hosting:**
- Deployed to: `https://hawksbtlntutoring-49974.web.app`
- Files served from `public/` directory

## What I used

| Layer | Technology | Note |
|-------|-----------|------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript | No frameworks keep it simple for your own good |
| **Authentication** | Firebase Auth (Google Sign-In) | Popup with redirect fallback (shouldn't break) |
| **Database** | Cloud Firestore | Document-based, real-time updates |
| **Email** | EmailJS | Automated notifications via SMTP |
| **Charts** | Chart.js | Pie chart for admin stats |
| **PDF Export** | jsPDF | Generate downloadable reports |
| **Hosting** | Firebase Hosting |

All libraries load via CDN (no build step required).

## File Structure

```
📁 hawksBtlnTutoring/
├── 📄 README.md                    ← You are here
├── 📄 firebase.json                ← Firebase config (generated)
├── 📄 firestore.indexes.json       ← Firestore indexes (generated)
├── 📄 firestore.rules              ← Firestore security rules
├── 📁 public/                      ← Frontend files (served to users)
│   ├── 📄 index.html               ← Single-page app shell
│   ├── 📄 app.js                   ← All app logic
│   ├── 📄 app.css                  ← Styling (Hawks colors)
│   ├── 📄 firebase-config.js       ← Firebase credentials
│   └── ... (other assets)
└── 📁 stablereleases/             ← Backup of stable versions
    └── 📁 stableRelease2.15_5.50.../  ← Version snapshot
```
## Troubleshooting

### **Login Issues**
- **"Google popup blocked"** → Check browser popup settings; app falls back to redirect signin
- **"Firebase not initialized"** → Verify `firebase-config.js` is loaded with correct credentials

### **Emails Not Sending**
- **Check EmailJS config:**
  - Service ID matches service id in [public/app.js](public/app.js#L33)
  - Public key is correct in [public/app.js](public/app.js#L34)
  - Email template names match: `template_request_matched`, `template_matched_admin`
- **Check browser console** → Look for `emailjsLoaded`, `hasPublicKey`, `hasServiceId` (should all be `true`)

### **Requests Not Appearing**
- **Check Firestore rules** → Ensure authenticated users have read/write permissions
- **Check user role** → Verify user is assigned correct role (staff, admin, etc.) in Firestore `/users/{userID}.role`

### **PDF Export Fails**
- **jsPDF library not loaded** → Check browser console for CDN errors
- **Chart.js not ready** → Ensure Chart.js loads before calling export function

If you have any problems don't hesitate to reach out.
