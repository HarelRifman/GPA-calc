import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, limit } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDQ0NQWE__Im-enScZkbaGsckeljEDRC8E",
  authDomain: "gpaculc.firebaseapp.com",
  projectId: "gpaculc",
  storageBucket: "gpaculc.firebasestorage.app",
  messagingSenderId: "987523583918",
  appId: "1:987523583918:web:c0f2e6fab2efb76bb1823f",
  measurementId: "G-6RST0W971R"
};

let app, auth, provider, db;
let courses = [];
let currentUser = null;
let otherUsersData = [];
let lastCompareFetch = 0; // timestamp ms
let compareFetchInProgress = false;
let compareVisible = false; // explicit visibility state

// DOM elements - will be initialized after page loads
let statusEl;
let signInBtn, signUpBtn, signInRedirectBtn, signOutBtn, userInfo, addCourseBtn, popupHelp;
let compareSection, refreshCompareBtn, compareContent, compareLoading, compareToggleBtn;
let peerModal, peerModalClose, peerModalBody;

function initializeDOM() {
    statusEl = document.getElementById('status');
    signInBtn = document.getElementById('signInBtn');
    signUpBtn = document.getElementById('signUpBtn');
    signOutBtn = document.getElementById('signOutBtn');
    signInRedirectBtn = document.getElementById('signInRedirectBtn');
    userInfo = document.getElementById('userInfo');
    addCourseBtn = document.getElementById('addCourseBtn');
    popupHelp = document.getElementById('popupHelp');
    compareSection = document.getElementById('compareSection');
    refreshCompareBtn = document.getElementById('refreshCompareBtn');
    compareContent = document.getElementById('compareContent');
    compareLoading = document.getElementById('compareLoading');
    compareToggleBtn = document.getElementById('compareToggleBtn');
    peerModal = document.getElementById('peerModal');
    peerModalClose = document.getElementById('peerModalClose');
    peerModalBody = document.getElementById('peerModalBody');
    
    // Debug logging
    console.log('DOM Elements initialized:');
    console.log('compareSection:', !!compareSection);
    console.log('compareToggleBtn:', !!compareToggleBtn);
    console.log('refreshCompareBtn:', !!refreshCompareBtn);
}

function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
}

// Add popup blocker detection
function detectPopupBlocker() {
    const popup = window.open('', '_blank', 'width=1,height=1');
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        return true; // Popup blocked
    }
    popup.close();
    return false; // Popup allowed
}

// Show popup help text
function showPopupHelp() {
    if (popupHelp) popupHelp.style.display = 'block';
    if (signInRedirectBtn) signInRedirectBtn.style.display = 'inline-block';
}

// Hide popup help text
function hidePopupHelp() {
    if (popupHelp) popupHelp.style.display = 'none';
    if (signInRedirectBtn) signInRedirectBtn.style.display = 'none';
}

function getGradeClass(grade) {
    if (grade >= 95) return "green";
    if (grade >= 90) return "lightgreen";
    if (grade >= 80) return "yellow";
    return "red";
}

window.addCourse = function addCourse() {
    if (!currentUser) {
        alert("Please sign in first.");
        return;
    }
    const course = document.getElementById("course").value.trim();
    const year = document.getElementById("year").value;
    const semester = document.getElementById("semester").value;
    const gradeInput = document.getElementById("grade");
    const passFlag = document.getElementById("passFlag").checked;
    const grade = passFlag ? null : parseFloat(gradeInput.value);
    const credits = parseFloat(document.getElementById("credits").value) || 0;

    if (!course || !year || !semester || (!passFlag && isNaN(grade))) {
        alert("Please fill all fields: course, year, semester, and grade (unless Pass). ");
        return;
    }

    const semesterText = `${semester} ${year}`;
    courses.push({ course, semester: semesterText, grade, credits, pass: passFlag });
    updateTable();
    updateResults();
    persistCourses();

    document.getElementById("course").value = "";
    document.getElementById("year").value = "";
    document.getElementById("semester").value = "";
    gradeInput.value = "";
    document.getElementById("passFlag").checked = false;
    document.getElementById("credits").value = "";
}

async function persistCourses() {
    if (!currentUser || !db) return;
    try {
        await setDoc(doc(db, "users", currentUser.uid), { 
            courses,
            displayName: currentUser.displayName,
            email: currentUser.email,
            lastUpdated: new Date().toISOString()
        }, { merge: true });
    } catch (e) {
        console.error("Error saving courses", e);
    }
}

async function loadCourses() {
    if (!currentUser || !db) return;
    try {
        const snap = await getDoc(doc(db, "users", currentUser.uid));
        if (snap.exists()) {
            courses = snap.data().courses || [];
            updateTable();
            updateResults();
        } else {
            courses = [];
        }
    } catch (e) {
        console.error("Error loading courses", e);
    }
}

function updateTable() {
    // (Table hidden now, keep function minimal for compatibility)
    const blocksContainer = document.getElementById('semesterBlocks');
    if (!blocksContainer) return;
    blocksContainer.innerHTML = '';

    if (!courses.length) return;

    const orderMap = { 'A': 1, 'B': 2, 'Summer': 3 };
    const sorted = [...courses].sort((a,b) => {
        const [semA, yearA] = a.semester.split(' ');
        const [semB, yearB] = b.semester.split(' ');
        const yDiff = parseInt(yearA) - parseInt(yearB);
        if (yDiff !== 0) return yDiff;
        return (orderMap[semA]||99) - (orderMap[semB]||99);
    });

    const groups = {};
    for (const c of sorted) {
        (groups[c.semester] ||= []).push(c);
    }

    Object.entries(groups).forEach(([semester, list]) => {
        const totalCredits = list.reduce((s,c)=>s + (c.credits||0),0);
        const gradedOnly = list.filter(c=>!c.pass && c.grade !== null && !isNaN(c.grade));
        const weightedSum = gradedOnly.reduce((s,c)=> s + c.grade * (c.credits||0), 0);
        const creditsWeighted = gradedOnly.reduce((s,c)=> s + (c.credits||0), 0);
        let avg = 0;
        if (creditsWeighted > 0) {
            avg = weightedSum / creditsWeighted;
        } else if (gradedOnly.length) {
            avg = gradedOnly.reduce((s,c)=> s + c.grade,0)/gradedOnly.length;
        } else {
            avg = 0;
        }
        const [semLabel, yearLabel] = semester.split(' ');
        const friendlyTitle = `Semester ${semLabel} year ${yearLabel}`;
        const block = document.createElement('div');
        block.className = 'semester-block';
        block.innerHTML = `
            <h3>${friendlyTitle}</h3>
            <div class="semester-meta">${list.length} course${list.length!==1?'s':''} • ${totalCredits} credits</div>
            <ul class="course-list"></ul>
            <div class="semester-summary"><strong>Average (Weighted):</strong> ${avg.toFixed(2)} | <strong>Credits:</strong> ${totalCredits}</div>
        `;
        const ul = block.querySelector('.course-list');

        list.forEach(courseObj => {
            const li = document.createElement('li');
            li.className = 'course-item';
            const gradeDisplay = courseObj.pass ? 'P' : (courseObj.grade ?? '').toString();
            li.innerHTML = `
                <span class="label" title="${courseObj.course}">${courseObj.course}</span>
                ${courseObj.pass ? `<input type="text" class="grade-input" value="P" disabled />` : `<input type=\"number\" class=\"grade-input\" min=\"0\" max=\"100\" value=\"${courseObj.grade}\" />`}
                <input type="number" class="credit-input" min="0" step="0.5" value="${courseObj.credits}" />
                <button type="button" title="Remove">×</button>
            `;
            const gradeInput = li.querySelector('.grade-input');
            const creditInput = li.querySelector('.credit-input');
            const removeBtn = li.querySelector('button');

            function updateStyling(){
                if (courseObj.pass) {
                    gradeInput.className = 'grade-input editable-grade';
                } else {
                    const g = parseFloat(gradeInput.value);
                    gradeInput.className = 'grade-input editable-grade ' + getGradeClass(g);
                }
            }
            updateStyling();

            if (!courseObj.pass) {
                gradeInput.addEventListener('change', () => {
                    const newVal = parseFloat(gradeInput.value);
                    if (isNaN(newVal) || newVal < 0 || newVal > 100) { gradeInput.value = courseObj.grade; return; }
                    courseObj.grade = newVal;
                    updateStyling();
                    persistCourses();
                    updateResults();
                    updateTable();
                });
            }

            creditInput.addEventListener('change', () => {
                const newVal = parseFloat(creditInput.value);
                if (isNaN(newVal) || newVal < 0) { creditInput.value = courseObj.credits; return; }
                courseObj.credits = newVal;
                persistCourses();
                updateResults();
                updateTable();
            });

            removeBtn.addEventListener('click', () => {
                courses = courses.filter(c => c !== courseObj);
                persistCourses();
                updateResults();
                updateTable();
            });

            ul.appendChild(li);
        });

        blocksContainer.appendChild(block);
    });
}

function updateResults() {
    if (courses.length === 0) {
        document.getElementById("gpa").textContent = "GPA: - | Total Credits: -";
        document.getElementById("semesterMeans").innerHTML = "";
        return;
    }

    const graded = courses.filter(c => !c.pass && c.grade !== null && !isNaN(c.grade) && c.credits > 0);
    const totalCreditsAll = courses.reduce((sum,c)=> sum + (c.credits||0), 0);
    // Weighted GPA calculation
    const weightedSum = graded.reduce((sum, c) => sum + c.grade * c.credits, 0);
    const creditsWeighted = graded.reduce((sum, c) => sum + c.credits, 0);
    const gpa = creditsWeighted > 0 ? (weightedSum / creditsWeighted) : 0;

    // GPA without Judaism (weighted)
    const filtered = graded.filter(c => !c.course.toLowerCase().includes('judaism'));
    const weightedSumNoJudaism = filtered.reduce((sum, c) => sum + c.grade * c.credits, 0);
    const creditsWeightedNoJudaism = filtered.reduce((sum, c) => sum + c.credits, 0);
    const gpaNoJudaism = creditsWeightedNoJudaism > 0 ? (weightedSumNoJudaism / creditsWeightedNoJudaism) : 0;
    const creditsNoJudaism = courses.filter(c=> !c.course.toLowerCase().includes('judaism')).reduce((s,c)=> s + (c.credits||0),0);
    document.getElementById("gpa").textContent = `GPA: ${graded.length? gpa.toFixed(3):'-'} | Total Credits: ${totalCreditsAll} | GPA w/o Judaism: ${filtered.length? gpaNoJudaism.toFixed(3):'-'} (Credits excl. Judaism: ${creditsNoJudaism})`;

    const semesters = {};
    courses.forEach(c => {
        if (c.pass || c.grade === null || isNaN(c.grade)) return;
        if (!semesters[c.semester]) semesters[c.semester] = [];
        semesters[c.semester].push(c.grade);
    });

    const semesterMeansDiv = document.getElementById("semesterMeans");
    semesterMeansDiv.innerHTML = "<strong>Semester Means:</strong><ul class='semester-list'></ul>";
    const ul = semesterMeansDiv.querySelector("ul");

    for (const sem in semesters) {
        const mean = semesters[sem].reduce((a, b) => a + b, 0) / semesters[sem].length;
        const li = document.createElement("li");
        li.textContent = `${sem}: ${mean.toFixed(2)}`;
        ul.appendChild(li);
    }
}

// Helper function to calculate GPA for a user's courses
function calculateGPA(userCourses) {
    if (!userCourses || userCourses.length === 0) return { gpa: 0, totalCredits: 0, courseCount: 0 };
    
    const graded = userCourses.filter(c => !c.pass && c.grade !== null && !isNaN(c.grade) && c.credits > 0);
    const totalCredits = userCourses.reduce((sum, c) => sum + (c.credits || 0), 0);
    
    if (graded.length === 0) return { gpa: 0, totalCredits, courseCount: userCourses.length };
    
    const weightedSum = graded.reduce((sum, c) => sum + c.grade * c.credits, 0);
    const creditsWeighted = graded.reduce((sum, c) => sum + c.credits, 0);
    const gpa = creditsWeighted > 0 ? (weightedSum / creditsWeighted) : 0;
    
    return { gpa, totalCredits, courseCount: userCourses.length };
}

// Fetch other users' data for comparison
async function fetchOtherUsersData() {
    if (compareFetchInProgress) return; // prevent parallel calls
    if (!db) { setStatus('DB not ready'); return; }
    try {
        compareFetchInProgress = true;
        compareLoading.style.display = 'block';
        compareContent.style.display = 'none';
        const usersQuery = query(collection(db, "users"), limit(100));
        const querySnapshot = await getDocs(usersQuery);
        otherUsersData = [];
        querySnapshot.forEach((d) => {
            const userData = d.data();
            if (!userData) return;
            if (userData.courses && userData.courses.length) {
                if (currentUser && d.id === currentUser.uid) return; // skip self
                const stats = calculateGPA(userData.courses);
                otherUsersData.push({
                    uid: d.id,
                    name: userData.displayName || userData.email || `User ${d.id.slice(0,6)}`,
                    courses: userData.courses,
                    ...stats
                });
            }
        });
        otherUsersData.sort((a,b)=> b.gpa - a.gpa);
        lastCompareFetch = Date.now();
        displayComparisonData();
    } catch(err){
        console.error('Compare fetch failed:', err);
        compareLoading.textContent = 'Failed to load comparison data.';
    } finally {
        compareFetchInProgress = false;
    }
}

// Display comparison statistics and other users' data
function displayComparisonData() {
    console.log('displayComparisonData called'); // Debug
    compareLoading.style.display = 'none';
    compareContent.style.display = 'block';
    
    if (otherUsersData.length === 0) {
        console.log('No other users data found'); // Debug
        compareContent.innerHTML = '<div class="no-data">No other users with grades found for comparison.</div>';
        return;
    }
    
    console.log('Displaying data for', otherUsersData.length, 'users'); // Debug
    
    // Calculate current user's stats (use default if not signed in)
    const currentStats = currentUser ? calculateGPA(courses) : { gpa: 0, totalCredits: 0, courseCount: 0 };
    
    // Calculate ranking
    const usersWithGPA = otherUsersData.filter(u => u.gpa > 0);
    const betterUsers = usersWithGPA.filter(u => u.gpa > currentStats.gpa).length;
    const totalUsers = usersWithGPA.length + (currentStats.gpa > 0 ? 1 : 0);
    const rank = betterUsers + 1;
    const percentile = totalUsers > 1 ? Math.round(((totalUsers - rank) / (totalUsers - 1)) * 100) : 100;
    
    // Calculate averages
    const avgGPA = usersWithGPA.length > 0 ? usersWithGPA.reduce((sum, u) => sum + u.gpa, 0) / usersWithGPA.length : 0;
    const avgCredits = otherUsersData.reduce((sum, u) => sum + u.totalCredits, 0) / otherUsersData.length;
    
    // Display comparison stats
    const compareStats = document.getElementById('compareStats');
    const statsHTML = currentUser ? `
        <div class="stat-card">
            <h4>Your Rank</h4>
            <div class="stat-value ${rank <= Math.ceil(totalUsers * 0.25) ? 'rank-good' : rank <= Math.ceil(totalUsers * 0.75) ? 'rank-average' : 'rank-low'}">
                ${rank} / ${totalUsers}
            </div>
        </div>
        <div class="stat-card">
            <h4>Percentile</h4>
            <div class="stat-value ${percentile >= 75 ? 'rank-good' : percentile >= 50 ? 'rank-average' : 'rank-low'}">
                ${percentile}th
            </div>
        </div>
        <div class="stat-card">
            <h4>Your GPA</h4>
            <div class="stat-value">${currentStats.gpa.toFixed(3)}</div>
        </div>
        <div class="stat-card">
            <h4>Average GPA</h4>
            <div class="stat-value">${avgGPA.toFixed(3)}</div>
        </div>
        <div class="stat-card">
            <h4>Your Credits</h4>
            <div class="stat-value">${currentStats.totalCredits}</div>
        </div>
        <div class="stat-card">
            <h4>Average Credits</h4>
            <div class="stat-value">${Math.round(avgCredits)}</div>
        </div>
    ` : `
        <div class="stat-card">
            <h4>Total Users</h4>
            <div class="stat-value">${usersWithGPA.length}</div>
        </div>
        <div class="stat-card">
            <h4>Average GPA</h4>
            <div class="stat-value">${avgGPA.toFixed(3)}</div>
        </div>
        <div class="stat-card">
            <h4>Average Credits</h4>
            <div class="stat-value">${Math.round(avgCredits)}</div>
        </div>
        <div class="stat-card">
            <h4>Sign In</h4>
            <div class="stat-value">To Compare</div>
        </div>
    `;
    
    compareStats.innerHTML = statsHTML;
    
    // Display other users
    const otherUsersGrid = document.getElementById('otherUsersGrid');
    otherUsersGrid.innerHTML = '';
    
    // Show top 20 users to prevent overwhelming the UI
    const displayUsers = otherUsersData.slice(0, 20);
    
    displayUsers.forEach((user, index) => {
        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        userCard.tabIndex = 0;
        userCard.setAttribute('role','button');
        userCard.setAttribute('aria-label', `View ${user.name}'s courses`);
        
        const gpaClass = currentUser && user.gpa >= currentStats.gpa ? 'rank-good' : user.gpa >= avgGPA ? 'rank-average' : 'rank-low';
        const difference = currentUser ? user.gpa - currentStats.gpa : 0;
        
        userCard.innerHTML = `
            <div class="user-header">
                <div class="user-name">${user.name}</div>
                <div class="user-gpa ${gpaClass}">${user.gpa.toFixed(3)}</div>
            </div>
            <div class="user-details">
                <div><strong>Rank:</strong> #${index + 1}</div>
                <div><strong>Total Credits:</strong> ${user.totalCredits}</div>
                <div><strong>Courses:</strong> ${user.courseCount}</div>
                ${currentUser ? `<div><strong>Difference:</strong> ${difference > 0 ? '+' : ''}${difference.toFixed(3)}</div>` : ''}
            </div>
        `;
        
        // Click/keyboard to open peer modal
        function openPeer(){
            openPeerModal(user);
        }
        userCard.addEventListener('click', openPeer);
        userCard.addEventListener('keypress', e=>{ if (e.key==='Enter' || e.key===' ') { e.preventDefault(); openPeer(); }});
        otherUsersGrid.appendChild(userCard);
    });
    
    if (otherUsersData.length > 20) {
        const moreInfo = document.createElement('div');
        moreInfo.className = 'no-data';
        moreInfo.innerHTML = `... and ${otherUsersData.length - 20} more users`;
        otherUsersGrid.appendChild(moreInfo);
    }
    
    console.log('Comparison data displayed successfully'); // Debug
}

// Show/hide compare section based on auth state
function toggleCompareSection(show) {
    if (!compareSection) return;
    compareVisible = !!show;
    if (compareVisible) {
        compareSection.style.display = 'block';
    } else {
        compareSection.style.display = 'none';
    }
    if (compareToggleBtn){
        compareToggleBtn.textContent = compareVisible ? '✖ Hide Comparison' : '🏆 Compare Grades';
        compareToggleBtn.setAttribute('aria-expanded', compareVisible ? 'true':'false');
        compareToggleBtn.setAttribute('aria-pressed', compareVisible ? 'true':'false');
    }
}

// Create test data for demonstration
function createTestData() {
    console.log('Creating test data...'); // Debug
    otherUsersData = [
        {
            uid: 'test1',
            name: 'Alice Johnson',
            gpa: 88.5,
            totalCredits: 120,
            courseCount: 24,
            courses: []
        },
        {
            uid: 'test2', 
            name: 'Bob Smith',
            gpa: 92.3,
            totalCredits: 115,
            courseCount: 23,
            courses: []
        },
        {
            uid: 'test3',
            name: 'Charlie Brown',
            gpa: 85.7,
            totalCredits: 110,
            courseCount: 22,
            courses: []
        },
        {
            uid: 'test4',
            name: 'Diana Ross',
            gpa: 94.2,
            totalCredits: 125,
            courseCount: 25,
            courses: []
        },
        {
            uid: 'test5',
            name: 'Ethan Hunt',
            gpa: 79.8,
            totalCredits: 105,
            courseCount: 21,
            courses: []
        }
    ];
    
    // Sort by GPA descending
    otherUsersData.sort((a, b) => b.gpa - a.gpa);
    console.log('Test data created:', otherUsersData.length, 'users'); // Debug
}

function attachEventListeners() {
    // Google sign-in listener
    if (signInBtn) {
        signInBtn.addEventListener('click', async () => {
            if (!auth || !provider) {
                alert('Auth not ready yet.');
                setStatus('Auth not ready');
                return;
            }
            
            // Try popup first, fallback to redirect
            try {
                setStatus('Opening sign-in popup...');
                
                // Clear any existing popup blockers
                if (window.opener) {
                    window.opener.close();
                }
                
                // Add timeout to prevent stuck popups
                const popupPromise = signInWithPopup(auth, provider);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Popup timeout')), 15000)
                );
                
                await Promise.race([popupPromise, timeoutPromise]);
                setStatus('Signed in');
                // Hide redirect button if it was shown
                hidePopupHelp();
            } catch (e) {
                console.error('Sign-in popup failed:', e);
                
                // If popup fails, automatically show redirect option
                setStatus('Popup failed. Use redirect button below.');
                showPopupHelp();
                
                // Show specific error messages
                if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
                    setStatus('Popup blocked by browser. Use redirect button below.');
                } else if (e.code === 'auth/operation-not-allowed') {
                    alert('Enable Google provider in Firebase console.');
                } else if (e.code === 'auth/unauthorized-domain') {
                    alert('Add this domain to Authorized domains in Firebase console.');
                } else if (e.code === 'auth/network-request-failed') {
                    setStatus('Network error. Check your connection.');
                } else if (e.message === 'Popup timeout') {
                    setStatus('Popup timed out. Use redirect button below.');
                } else {
                    setStatus('Sign-in error: ' + (e.code || e.message));
                }
            }
        });
    }

    // Google sign-up listener
    if (signUpBtn) {
        signUpBtn.addEventListener('click', async () => {
            if (!auth || !provider) {
                alert('Auth not ready yet.');
                setStatus('Auth not ready');
                return;
            }
            
            // Try popup first, fallback to redirect
            try {
                setStatus('Opening sign-up popup...');
                
                // Clear any existing popup blockers
                if (window.opener) {
                    window.opener.close();
                }
                
                // Configure provider for sign-up
                provider.setCustomParameters({
                    prompt: 'select_account'
                });
                
                // Add timeout to prevent stuck popups
                const popupPromise = signInWithPopup(auth, provider);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Popup timeout')), 15000)
                );
                
                const result = await Promise.race([popupPromise, timeoutPromise]);
                setStatus('Signed up and signed in');
                
                // For new users, create their document immediately
                if (result.additionalUserInfo?.isNewUser) {
                    await setDoc(doc(db, 'users', result.user.uid), { 
                        courses: [],
                        displayName: result.user.displayName,
                        email: result.user.email,
                        lastUpdated: new Date().toISOString()
                    }, { merge: true });
                    setStatus('New account created successfully');
                }
                
                // Hide redirect button if it was shown
                hidePopupHelp();
            } catch (e) {
                console.error('Sign-up popup failed:', e);
                
                // If popup fails, automatically show redirect option
                setStatus('Popup failed. Use redirect button below.');
                showPopupHelp();
                
                // Show specific error messages
                if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
                    setStatus('Popup blocked by browser. Use redirect button below.');
                } else if (e.code === 'auth/operation-not-allowed') {
                    alert('Enable Google provider in Firebase console.');
                } else if (e.code === 'auth/unauthorized-domain') {
                    alert('Add this domain to Authorized domains in Firebase console.');
                } else if (e.code === 'auth/network-request-failed') {
                    setStatus('Network error. Check your connection.');
                } else if (e.message === 'Popup timeout') {
                    setStatus('Popup timed out. Use redirect button below.');
                } else {
                    setStatus('Sign-up error: ' + (e.code || e.message));
                }
            }
        });
    }

    if (signInRedirectBtn){
        signInRedirectBtn.addEventListener('click', async () => {
            if (!auth || !provider){ setStatus('Auth not ready'); return; }
            setStatus('Redirecting to Google...');
            try {
                await signInWithRedirect(auth, provider);
            } catch(e){
                console.error('Redirect sign-in failed:', e);
                setStatus('Redirect sign-in failed: ' + (e.code || e.message));
            }
        });
    }

    // Sign-out listener
    if (signOutBtn) {
        signOutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            if (!auth) { 
                setStatus('Auth not ready'); 
                return; 
            }
            
            if (!auth.currentUser) { 
                setStatus('No user to sign out'); 
                return; 
            }
            
            signOutBtn.disabled = true;
            setStatus('Signing out...');
            
            try { 
                await signOut(auth);
                
                // Reload page to ensure clean state
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
                
            } catch(error) { 
                setStatus('Sign out error: ' + (error.code || error.message));
                
                // If sign out fails, try force reload anyway
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } finally { 
                signOutBtn.disabled = false; 
            }
        });
    }
    
    // Refresh compare button listener
    if (refreshCompareBtn) {
        refreshCompareBtn.addEventListener('click', fetchOtherUsersData);
    }
    
    // Compare toggle button listener
    if (compareToggleBtn) {
        compareToggleBtn.addEventListener('click', async () => {
            if (!compareVisible) {
                const stale = Date.now() - lastCompareFetch > 60_000;
                if (stale || otherUsersData.length === 0) {
                    await fetchOtherUsersData();
                }
                toggleCompareSection(true);
                setTimeout(()=>{ compareSection?.scrollIntoView({behavior:'smooth', block:'start'}); }, 40);
            } else {
                toggleCompareSection(false);
            }
        });
    }

    if (peerModalClose){
        peerModalClose.addEventListener('click', closePeerModal);
    }
}

function attachAuthListeners() {
    if (!auth) {
        console.error('Cannot attach auth listeners - auth not initialized');
        return;
    }
    
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        
        if (user) {
            if (userInfo) userInfo.textContent = `Signed in as ${user.displayName || user.email}`;
            if (signInBtn) signInBtn.style.display = 'none';
            if (signUpBtn) signUpBtn.style.display = 'none';
            if (signOutBtn) {
                signOutBtn.style.display = 'inline-block';
                signOutBtn.disabled = false;
            }
            if (compareToggleBtn) compareToggleBtn.style.display = 'inline-block';
            if (addCourseBtn) addCourseBtn.disabled = false;
            setStatus('Authenticated. Loading courses...');
            loadCourses();
            toggleCompareSection(false); // Start with compare section hidden
            hidePopupHelp(); // Hide popup help on successful auth
        } else {
            if (userInfo) userInfo.textContent = '';
            if (signInBtn) signInBtn.style.display = 'inline-block';
            if (signUpBtn) signUpBtn.style.display = 'inline-block';
            if (signInRedirectBtn) signInRedirectBtn.style.display = 'none';
            if (signOutBtn) {
                signOutBtn.style.display = 'none';
                signOutBtn.disabled = false;
            }
            if (compareToggleBtn) compareToggleBtn.style.display = 'none';
            if (addCourseBtn) addCourseBtn.disabled = true;
            courses = [];
            updateTable();
            updateResults();
            toggleCompareSection(false);
            setStatus('Signed out');
        }
    });
}

function initFirebase() {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        
        provider = new GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        
        db = getFirestore(app);
        
        isSupported().then(s => { 
            if (s) {
                getAnalytics(app);
            }
        });
        
        setStatus('Firebase initialized. Waiting for auth state...');
        
        // Check for popup blockers and show redirect button if needed
        if (detectPopupBlocker()) {
            setStatus('Popup blocker detected. Use redirect button for sign-in.');
            showPopupHelp();
        }
        
        attachAuthListeners();
        attachEventListeners();
        
        // Check for redirect result (user returning from Google sign-in)
        getRedirectResult(auth).then(result => {
            if (result && result.user) {
                setStatus('Signed in via redirect');
                hidePopupHelp();
            }
        }).catch(e => { 
            if (e.code !== 'auth/no-auth-event') {
                console.error('Redirect result error:', e.code, e.message); 
            }
        });
        
    } catch (e) {
        console.error('Firebase init failed:', e);
        setStatus('Firebase init failed: ' + e.message);
        alert('Firebase initialization failed. Check console for details.');
    }
}

// DOM ready - initialize everything
document.addEventListener('DOMContentLoaded', () => {
    initializeDOM();
    initFirebase();
});

// Fallback if DOMContentLoaded already fired
if (document.readyState !== 'loading') {
    initializeDOM();
    initFirebase();
}

// Build peer modal content
function openPeerModal(user){
    if (!peerModal || !peerModalBody) return;
    const courses = user.courses || [];
    // Derive per-semester breakdown
    const semesterGroups = {};
    courses.forEach(c=>{
        const sem = c.semester || 'Unknown';
        (semesterGroups[sem] ||= []).push(c);
    });
    // Global stats
    const stats = calculateGPA(courses);
    const graded = courses.filter(c=> !c.pass && c.grade!=null && !isNaN(c.grade));
    const avgRaw = graded.length? (graded.reduce((s,c)=> s + c.grade,0)/graded.length).toFixed(2):'-';
    let chipsHtml = `
        <div class="peer-summary">
            <div class="peer-chip"><strong>Name</strong><span>${user.name}</span></div>
            <div class="peer-chip"><strong>GPA</strong><span>${stats.gpa? stats.gpa.toFixed(2):'-'}</span></div>
            <div class="peer-chip"><strong>Credits</strong><span>${stats.totalCredits}</span></div>
            <div class="peer-chip"><strong>Courses</strong><span>${stats.courseCount}</span></div>
            <div class="peer-chip"><strong>Avg Grade</strong><span>${avgRaw}</span></div>
        </div>`;
    // Table rows
    let rows = '';
    if (courses.length){
        // Sort by semester (year numeric then A,B,Summer order)
        const orderMap = { 'A':1, 'B':2, 'Summer':3 };
        const sorted = [...courses].sort((a,b)=>{
            const [sa, ya] = (a.semester||'').split(' ');
            const [sb, yb] = (b.semester||'').split(' ');
            const yDiff = (parseInt(ya)||0) - (parseInt(yb)||0);
            if (yDiff!==0) return yDiff;
            return (orderMap[sa]||99) - (orderMap[sb]||99);
        });
        sorted.forEach(c=>{
            const gradeClass = c.pass? '': getGradeClass(c.grade);
            rows += `<tr>
                <td title="${c.course}">${c.course}</td>
                <td>${c.semester||''}</td>
                <td>${c.pass? '<span class="pass-badge">PASS</span>': `<span class="grade-badge ${gradeClass}">${c.grade}</span>`}</td>
                <td>${c.credits||0}</td>
            </tr>`;
        });
    }
    peerModalBody.innerHTML = `
        ${chipsHtml}
        ${courses.length? `<div style="overflow:auto; max-height:380px;">
            <table class="peer-courses-table">
                <thead><tr><th>Course</th><th>Semester</th><th>Grade</th><th>Credits</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`: `<div class="no-peer-courses">No courses available for this user.</div>`}
    `;
    peerModal.style.display = 'flex';
    // Focus for accessibility
    setTimeout(()=>{
        peerModal.querySelector('.peer-modal-close')?.focus();
    }, 50);
    // Close on outside click
    function outside(e){ if (e.target === peerModal){ closePeerModal(); } }
    peerModal.addEventListener('click', outside, { once:true });
    // Esc key
    function esc(e){ if (e.key==='Escape'){ closePeerModal(); document.removeEventListener('keydown', esc); } }
    document.addEventListener('keydown', esc);
}

function closePeerModal(){ if (peerModal) peerModal.style.display='none'; }