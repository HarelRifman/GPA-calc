# 🎓 AcademicHub - GPA Calculator & Schedule Manager

**Live Demo**: [https://gpa-calc-dw6q.onrender.com/](https://gpa-calc-dw6q.onrender.com/)

Modern web application with Firebase Authentication and Firestore data persistence. Features a sleek dark theme and intuitive course management with schedule planning capabilities.

## ✨ Features

- **Dual Authentication**: Google OAuth & Email/Password signup/login
- **Smart Course Management**: Year + Semester dropdowns (A/B/Summer)
- **Real-time Calculations**: Total mean, weighted GPA, per-semester breakdowns
- **Weekly Schedule Planner**: Visual calendar with course scheduling
- **Color-coded Grades**: Visual grade indicators with smooth gradients
- **Cloud Persistence**: Auto-saves to Firebase Firestore per user
- **Modern UI**: Dark theme with blur effects and smooth animations
- **Peer Comparison**: Compare your grades with other students

## 🔧 Firebase Configuration

1. **Authentication**: Enable Google provider and Email/Password provider
2. **Firestore**: Create database in test or production mode
3. **Authorized Domains**: Add your Render domain (`gpa-calc-dw6q.onrender.com`) to Firebase authorized domains
4. **Security Rules**: Configure Firestore rules for user data access

## 🎨 Grade Color System

- 🟢 **95-100**: Excellent (bright green)
- 🟢 **90-94**: Very Good (light green)
- 🟡 **80-89**: Good (gold)
- 🔴 **Below 80**: Needs improvement (red)

## 📁 Project Structure

```
├── index.html          # Main HTML structure
├── app.js             # Core application logic
├── style.css          # Styling and themes
├── server.js          # Express server
├── package.json       # Dependencies
└── render.yaml        # Deployment config
```

## 🛠 Technical Stack

- **Frontend**: Vanilla JavaScript, CSS3 (gradients, blur effects)
- **Backend**: Firebase Authentication + Firestore
- **Server**: Node.js with Express
- **Deployment**: Render.com
- **Styling**: Modern dark theme with glassmorphism

## 🔮 Future Enhancements

- Advanced analytics & charts
- Custom GPA scales
- Offline support with sync
- Mobile app version

---

_Built with ❤️ and modern web technologies_
