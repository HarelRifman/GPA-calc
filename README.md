# 🎓 Grade & GPA Calculator

Modern web application with Firebase Authentication and Firestore data persistence. Features a sleek dark theme and intuitive course management.

## ✨ Features
- **Dual Authentication**: Google OAuth & Email/Password signup/login
- **Smart Course Management**: Year + Semester dropdowns (A/B/Summer)
- **Real-time Calculations**: Total mean, weighted GPA, per-semester breakdowns
- **Color-coded Grades**: Visual grade indicators with smooth gradients
- **Cloud Persistence**: Auto-saves to Firebase Firestore per user
- **Modern UI**: Dark theme with blur effects and smooth animations

## 🚀 Quick Start

### Method 1: Zero-dependency Node server
```bash
node server.js
```
Open: http://localhost:8080

### Method 2: Python (alternative)
```bash
python3 -m http.server 8080
```
Open: http://localhost:8080

## 🔧 Firebase Setup

1. **Authentication**:
   - Enable Google provider
   - Enable Email/Password provider
   - Add `localhost` to Authorized domains

2. **Firestore**: Create database (test/production mode)

3. **Security Rules** (example):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 📊 Usage

1. **Sign Up/Login**: Use email/password or Google
2. **Add Courses**: Select year (2024-2027) + semester (A/B/Summer)
3. **View Analytics**: Automatic GPA calculation and semester breakdowns
4. **Data Persistence**: Courses auto-save and sync across sessions

## 🎨 Grade Color System
- 🟢 **95-100**: Excellent (bright green)
- 🟢 **90-94**: Very Good (light green) 
- 🟡 **80-89**: Good (gold)
- 🔴 **Below 80**: Needs improvement (red)

## 📁 Data Structure
```json
{
  "users/{uid}": {
    "courses": [
      {
        "course": "Advanced Mathematics",
        "semester": "A 2025",
        "grade": 92,
        "credits": 4
      }
    ]
  }
}
```

## 🛠 Technical Stack
- **Frontend**: Vanilla JS, CSS3 (gradients, blur effects)
- **Backend**: Firebase Auth + Firestore
- **Server**: Node.js HTTP (zero dependencies)
- **Styling**: Modern dark theme with glassmorphism

## 🔮 Future Enhancements
- Course editing/deletion
- Export to PDF/Excel
- Advanced analytics & charts
- Custom GPA scales
- Offline support with sync

---
*Built with ❤️ and modern web technologies*
