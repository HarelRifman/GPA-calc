import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  query,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAnalytics,
  isSupported,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDQ0NQWE__Im-enScZkbaGsckeljEDRC8E",
  authDomain: "gpaculc.firebaseapp.com",
  projectId: "gpaculc",
  storageBucket: "gpaculc.firebasestorage.app",
  messagingSenderId: "987523583918",
  appId: "1:987523583918:web:c0f2e6fab2efb76bb1823f",
  measurementId: "G-6RST0W971R",
};

let app, auth, provider, db;
let courses = [];
let schedules = []; // New: store schedule data
let isEditMode = false; // Track edit mode state
let currentUser = null;
let otherUsersData = [];
let lastCompareFetch = 0; // timestamp ms
let compareFetchInProgress = false;
let compareVisible = false; // explicit visibility state
let currentPage = "dashboard"; // Track current page

// DOM elements - will be initialized after page loads
let statusEl, pageTitle;
let signInBtn,
  signUpBtn,
  signInRedirectBtn,
  signOutBtn,
  userName,
  userStatus,
  addCourseBtn,
  popupHelp;
let compareSection,
  refreshCompareBtn,
  compareContent,
  compareLoading,
  compareToggleBtn;
let peerModal, peerModalClose, peerModalBody;
let optOutCheckbox, optOutContainer;
let sidebar, sidebarToggle, mobileMenuToggle, mainContent;
let navItems, pages;
let scheduleModal, scheduleForm, addScheduleBtn, scheduleGrid;
let scheduleYear, scheduleSemesterType;

// Grade management elements
let gradeModal, gradeModalClose, manageGradesBtn, gradeSemesterFilter;
let addNewGradeBtn, bulkEditBtn, exportGradesBtn, gradesTableBody;
let selectAllGrades, totalCoursesCount, totalCreditsCount, currentGPA;

// Quick grade edit elements
let quickGradeModal, quickGradeModalClose, quickGradeForm, quickGradeCancelBtn;
let editCourseName, editSemester, editCredits, editPassFlag, gradeInputGroup;

// Inline editing elements
let toggleInlineEdit, addQuickGrade, inlineEditInfo;

function initializeDOM() {
  // Core elements
  statusEl = document.getElementById("status");
  pageTitle = document.getElementById("pageTitle");

  // Auth elements
  signInBtn = document.getElementById("signInBtn");
  signUpBtn = document.getElementById("signUpBtn");
  signOutBtn = document.getElementById("signOutBtn");
  signInRedirectBtn = document.getElementById("signInRedirectBtn");
  userName = document.getElementById("userName");
  userStatus = document.getElementById("userStatus");

  // Course elements
  addCourseBtn = document.getElementById("addCourseBtn");
  popupHelp = document.getElementById("popupHelp");

  // Compare elements
  compareSection = document.getElementById("compareSection");
  refreshCompareBtn = document.getElementById("refreshCompareBtn");
  compareContent = document.getElementById("compareContent");
  compareLoading = document.getElementById("compareLoading");
  compareToggleBtn = document.getElementById("compareToggleBtn");

  // Modal elements
  peerModal = document.getElementById("peerModal");
  peerModalClose = document.getElementById("peerModalClose");
  peerModalBody = document.getElementById("peerModalBody");

  // Settings elements
  optOutCheckbox = document.getElementById("optOutCompare");
  optOutContainer = document.getElementById("optOutContainer");

  // Navigation elements
  sidebar = document.getElementById("sidebar");
  sidebarToggle = document.getElementById("sidebarToggle");
  mobileMenuToggle = document.getElementById("mobileMenuToggle");
  mainContent = document.getElementById("mainContent");
  navItems = document.querySelectorAll(".nav-item");
  pages = document.querySelectorAll(".page");

  // Schedule elements
  scheduleModal = document.getElementById("scheduleModal");
  scheduleForm = document.getElementById("scheduleForm");
  addScheduleBtn = document.getElementById("addScheduleBtn");
  scheduleGrid = document.getElementById("scheduleGrid");
  scheduleYear = document.getElementById("scheduleYear");
  scheduleSemesterType = document.getElementById("scheduleSemesterType");

  // Grade management elements
  gradeModal = document.getElementById("gradeModal");
  gradeModalClose = document.getElementById("gradeModalClose");
  manageGradesBtn = document.getElementById("manageGradesBtn");
  gradeSemesterFilter = document.getElementById("gradeSemesterFilter");
  addNewGradeBtn = document.getElementById("addNewGradeBtn");
  bulkEditBtn = document.getElementById("bulkEditBtn");
  exportGradesBtn = document.getElementById("exportGradesBtn");
  gradesTableBody = document.getElementById("gradesTableBody");
  selectAllGrades = document.getElementById("selectAllGrades");
  totalCoursesCount = document.getElementById("totalCoursesCount");
  totalCreditsCount = document.getElementById("totalCreditsCount");
  currentGPA = document.getElementById("currentGPA");

  // Quick grade edit elements
  quickGradeModal = document.getElementById("quickGradeModal");
  quickGradeModalClose = document.getElementById("quickGradeModalClose");
  quickGradeForm = document.getElementById("quickGradeForm");
  quickGradeCancelBtn = document.getElementById("quickGradeCancelBtn");
  editCourseName = document.getElementById("editCourseName");
  editSemester = document.getElementById("editSemester");
  editCredits = document.getElementById("editCredits");
  editPassFlag = document.getElementById("editPassFlag");
  editGrade = document.getElementById("editGrade");
  gradeInputGroup = document.getElementById("gradeInputGroup");

  // Inline editing elements
  toggleInlineEdit = document.getElementById("toggleInlineEdit");
  addQuickGrade = document.getElementById("addQuickGrade");
  inlineEditInfo = document.getElementById("inlineEditInfo");

  // Initialize navigation
  initializeNavigation();

  // Debug logging
  console.log("DOM Elements initialized");
}

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

// Navigation Functions
function initializeNavigation() {
  // Navigation click handlers
  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const page = item.getAttribute("data-page");
      navigateToPage(page);
    });
  });

  // Mobile menu toggle
  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }

  // Sidebar toggle (for desktop)
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
    });
  }

  // Close sidebar when clicking outside on mobile
  document.addEventListener("click", (e) => {
    if (
      window.innerWidth <= 1024 &&
      !sidebar.contains(e.target) &&
      !mobileMenuToggle.contains(e.target) &&
      sidebar.classList.contains("open")
    ) {
      sidebar.classList.remove("open");
    }
  });
}

function navigateToPage(pageName) {
  // Hide all pages
  pages.forEach((page) => page.classList.remove("active"));

  // Show target page
  const targetPage = document.getElementById(pageName + "Page");
  if (targetPage) {
    targetPage.classList.add("active");
    currentPage = pageName;

    // Update page title
    if (pageTitle) {
      const titles = {
        dashboard: "Dashboard",
        schedule: "Schedule",
        grades: "Grades",
        compare: "Compare",
        settings: "Settings",
      };
      pageTitle.textContent = titles[pageName] || "AcademicHub";
    }

    // Update navigation
    navItems.forEach((item) => item.classList.remove("active"));
    const activeNav = document.querySelector(`[data-page="${pageName}"]`);
    if (activeNav) activeNav.classList.add("active");

    // Close mobile sidebar
    if (window.innerWidth <= 1024) {
      sidebar.classList.remove("open");
    }

    // Load page-specific data
    loadPageData(pageName);
  }
}

function loadPageData(pageName) {
  switch (pageName) {
    case "dashboard":
      updateDashboard();
      break;
    case "schedule":
      loadSchedules();
      updateScheduleSemesterOptions();
      break;
    case "grades":
      updateGradesPage();
      break;
    case "compare":
      updateComparePage();
      break;
    case "settings":
      updateSettingsPage();
      break;
  }
}

// Schedule Functions
async function loadSchedules() {
  if (!currentUser || !db) return;

  try {
    // Load schedules from Firebase
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      schedules = userData.schedules || [];
      console.log("Schedules loaded from Firebase:", schedules);
    } else {
      schedules = [];
      console.log("No user document found, initializing empty schedules");
    }
  } catch (error) {
    console.error("Error loading schedules from Firebase:", error);
    // Fallback to localStorage
    const savedSchedules = localStorage.getItem("schedules_" + currentUser.uid);
    if (savedSchedules) {
      schedules = JSON.parse(savedSchedules);
    } else {
      schedules = [];
    }
  }

  updateScheduleDisplay();
}

async function saveSchedules() {
  if (!currentUser || !db) return;

  try {
    // Save to Firebase
    const userRef = doc(db, "users", currentUser.uid);
    await setDoc(userRef, { schedules: schedules }, { merge: true });

    console.log("Schedules saved to Firebase:", schedules);
  } catch (error) {
    console.error("Error saving schedules to Firebase:", error);
    // Fallback to localStorage
    localStorage.setItem(
      "schedules_" + currentUser.uid,
      JSON.stringify(schedules)
    );
  }
}

function updateScheduleSemesterOptions() {
  // This function is no longer needed since we use static semester options
  // The semester options are now hardcoded in the HTML
}

function updateScheduleYearOptions() {
  // No longer needed - year options are hardcoded in HTML
}

// New Schedule Creation Functions
async function showScheduleCreationInterface() {
  const year = document.getElementById("scheduleYear").value;
  const semester = document.getElementById("scheduleSemester").value;

  if (year && semester) {
    const semesterDisplay = `Semester ${semester} Year ${year}`;
    document.getElementById("selectedSemesterDisplay").textContent =
      semesterDisplay;
    document.getElementById("scheduleCreationInterface").style.display =
      "block";
    document.getElementById("scheduleGrid").style.display = "none";

    // Generate time slots
    generateTimeSlots();

    // Load existing courses for this semester
    await loadCoursesForSemester(`${semester} ${year}`);
  } else {
    document.getElementById("scheduleCreationInterface").style.display = "none";
    document.getElementById("scheduleGrid").style.display = "block";
  }
}

function toggleEditMode() {
  isEditMode = !isEditMode;
  console.log("Edit mode toggled to:", isEditMode);

  // Update button UI FIRST
  const editBtn = document.getElementById("editScheduleBtn");
  if (isEditMode) {
    editBtn.innerHTML = '<i class="fas fa-check"></i> Exit Edit Mode';
    editBtn.classList.remove("edit-schedule-btn");
    editBtn.classList.add("exit-edit-btn");
  } else {
    editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit Mode';
    editBtn.classList.remove("exit-edit-btn");
    editBtn.classList.add("edit-schedule-btn");
  }

  // Mode indicator removed - no longer needed

  // THEN refresh the schedule after a brief delay
  setTimeout(async () => {
    const year = document.getElementById("scheduleYear").value;
    const semester = document.getElementById("scheduleSemester").value;
    if (year && semester) {
      generateTimeSlots();
      await loadCoursesForSemester(`${semester} ${year}`);
    }
  }, 50);
}

// updateModeIndicator function removed - no longer needed

// Global modal management
let currentModal = null;

function closeCurrentModal() {
  if (currentModal && currentModal.parentNode) {
    console.log("Closing current modal");
    currentModal.remove();
    currentModal = null;
  }
}

// Global modal close handler
document.addEventListener("click", function (e) {
  if (e.target.closest('[data-action="close-modal"]')) {
    e.preventDefault();
    e.stopPropagation();
    closeCurrentModal();
  }
});

function showCourseDetails(courseId) {
  const course = schedules.find((s) => s.id === courseId);
  if (!course) return;

  // Close any existing modal first
  closeCurrentModal();

  // Create course details modal
  currentModal = document.createElement("div");
  currentModal.className = "modal";
  currentModal.style.display = "flex";
  currentModal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Course Details</h3>
        <button class="modal-close" data-action="close-modal">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body">
        <div class="course-details">
          <div class="detail-item">
            <label>Course Name:</label>
            <span>${course.course || "Not specified"}</span>
          </div>
          <div class="detail-item">
            <label>Day:</label>
            <span>${course.day || "Not specified"}</span>
          </div>
          <div class="detail-item">
            <label>Time:</label>
            <span>${course.startTime || "Not specified"} - ${
    course.endTime || "Not specified"
  }</span>
          </div>
          <div class="detail-item">
            <label>Type:</label>
            <span>${course.type || "Not specified"}</span>
          </div>
          <div class="detail-item">
            <label>Duration:</label>
            <span>${course.duration || "Not specified"}</span>
          </div>
          <div class="detail-item">
            <label>Location:</label>
            <span>${course.location || "Not specified"}</span>
          </div>
          <div class="detail-item">
            <label>Semester:</label>
            <span>${course.semester || "Not specified"}</span>
          </div>
          <div class="detail-item">
            <label>Color:</label>
            <span class="color-preview" style="background: ${
              course.color || "var(--primary-color)"
            }"></span>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" data-action="close-modal">Close</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(currentModal);
}

function convertTo12Hour(time24) {
  if (!time24) return "";

  const [hours, minutes] = time24.split(":");
  const hour = parseInt(hours);
  const min = minutes || "00";

  if (hour === 0) return `12:${min} AM`;
  if (hour < 12) return `${hour}:${min} AM`;
  if (hour === 12) return `12:${min} PM`;
  return `${hour - 12}:${min} PM`;
}

function convertTo24Hour(time12) {
  if (!time12) return "";

  const [time, period] = time12.split(" ");
  const [hours, minutes] = time.split(":");
  let hour = parseInt(hours);
  const min = minutes || "00";

  if (period === "AM") {
    if (hour === 12) hour = 0;
  } else {
    // PM
    if (hour !== 12) hour += 12;
  }

  return `${hour.toString().padStart(2, "0")}:${min}`;
}

function generateTimeSlots() {
  const tableBody = document.getElementById("scheduleTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  const timeSlots = [
    "8:00 AM",
    "9:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "1:00 PM",
    "2:00 PM",
    "3:00 PM",
    "4:00 PM",
    "5:00 PM",
    "6:00 PM",
    "7:00 PM",
    "8:00 PM",
    "9:00 PM",
  ];

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

  timeSlots.forEach((timeSlot) => {
    // Add time slot header
    const timeCell = document.createElement("div");
    timeCell.className = "time-slot";
    timeCell.textContent = timeSlot;
    tableBody.appendChild(timeCell);

    // Add day cells for this time slot
    days.forEach((day) => {
      const dayCell = document.createElement("div");
      dayCell.className = "day-cell";
      dayCell.setAttribute("data-day", day);
      dayCell.setAttribute("data-time", timeSlot);

      // Add course button
      const addBtn = document.createElement("div");
      addBtn.className = "add-course-btn";
      addBtn.setAttribute("data-day", day);
      addBtn.setAttribute("data-time", timeSlot);
      addBtn.innerHTML = `<i class="fas fa-plus"></i> Add`;
      dayCell.appendChild(addBtn);

      tableBody.appendChild(dayCell);
    });
  });
}

async function loadCoursesForSemester(semester) {
  // Load courses directly from database instead of using cached schedules variable
  let semesterCourses = [];

  if (currentUser && db) {
    try {
      // Load schedules directly from Firebase
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const allSchedules = userData.schedules || [];
        semesterCourses = allSchedules.filter((s) => s.semester === semester);
        console.log(
          "Loaded courses directly from Firebase for semester:",
          semester
        );
      } else {
        console.log("No user document found, using empty schedules");
        semesterCourses = [];
      }
    } catch (error) {
      console.error("Error loading schedules from Firebase:", error);
      // Fallback to localStorage
      const savedSchedules = localStorage.getItem(
        "schedules_" + currentUser.uid
      );
      if (savedSchedules) {
        const allSchedules = JSON.parse(savedSchedules);
        semesterCourses = allSchedules.filter((s) => s.semester === semester);
        console.log(
          "Loaded courses from localStorage fallback for semester:",
          semester
        );
      } else {
        semesterCourses = [];
      }
    }
  } else {
    console.log("No user or database, using empty schedules");
    semesterCourses = [];
  }

  console.log(
    "Loading courses for semester:",
    semester,
    "Edit mode:",
    isEditMode,
    "Courses found:",
    semesterCourses.length
  );
  console.log("Semester courses loaded from database:", semesterCourses);
  console.log(
    "Courses:",
    semesterCourses.map((c) => ({
      day: c.day,
      startTime: c.startTime,
      course: c.course,
    }))
  );

  // Clear all day cells first
  const dayCells = document.querySelectorAll(".day-cell");
  console.log("Found day cells:", dayCells.length);

  let coursesShown = 0;
  let addButtonsShown = 0;

  dayCells.forEach((dayCell) => {
    const day = dayCell.getAttribute("data-day");
    const time = dayCell.getAttribute("data-time");

    // Check if there are courses for this time slot (including multi-hour courses)
    const existingCourses = semesterCourses.filter((c) => {
      if (c.day !== day) return false;

      // Convert times to comparable format (24-hour)
      const courseStart = convertTo24Hour(c.startTime);
      const courseEnd = convertTo24Hour(c.endTime);
      const currentTime = convertTo24Hour(time);

      // Check if current time slot falls within course time range
      return currentTime >= courseStart && currentTime < courseEnd;
    });

    console.log(
      `Checking day: ${day}, time: ${time}, found courses:`,
      existingCourses.length,
      existingCourses
    );

    if (existingCourses.length > 0) {
      // Show multiple courses side by side
      if (isEditMode) {
        // In edit mode, show courses with edit buttons
        console.log(
          `Edit mode: Adding ${existingCourses.length} courses with edit buttons for ${day} ${time}`
        );

        const coursesHTML = existingCourses
          .map(
            (course) => `
          <div class="schedule-course-item multi-course" style="background: ${
            course.color || "var(--primary-color)"
          }">
            <div class="course-name">${course.course}</div>
            <div class="course-time">${course.startTime} - ${
              course.endTime
            }</div>
            <div class="course-type">${course.type}</div>
            <button class="edit-btn" data-course-id="${
              course.id
            }" title="Edit Course">
              <i class="fas fa-edit"></i>
            </button>
          </div>
        `
          )
          .join("");

        // Always add an "Add Course" button in edit mode
        const addButtonHTML = `
          <div class="add-course-btn edit-mode" data-day="${day}" data-time="${time}">
            <i class="fas fa-plus"></i> Add Course
          </div>
        `;

        dayCell.innerHTML = `<div class="courses-container">${coursesHTML}${addButtonHTML}</div>`;
      } else {
        // In view mode, show only course names
        console.log(
          `View mode: Adding ${existingCourses.length} courses without edit buttons for ${day} ${time}`,
          "Courses data:",
          existingCourses
        );

        const coursesHTML = existingCourses
          .map(
            (course) => `
          <div class="schedule-course-item view-mode-course multi-course" style="background: ${
            course.color || "var(--primary-color)"
          }" data-course-id="${course.id}">
            <div class="course-name" style="color: white; font-weight: bold;">${
              course.course || "No Name"
            }</div>
          </div>
        `
          )
          .join("");

        dayCell.innerHTML = `<div class="courses-container">${coursesHTML}</div>`;
      }
      coursesShown += existingCourses.length;
    } else {
      // No course in this time slot
      if (isEditMode) {
        // In edit mode, show add button
        console.log(`Edit mode: Adding add button for ${day} ${time}`);
        dayCell.innerHTML = `
          <div class="add-course-btn edit-mode" data-day="${day}" data-time="${time}">
            <i class="fas fa-plus"></i> Add Course
          </div>
        `;
        addButtonsShown++;
      } else {
        // In view mode, show empty cell (no add button)
        console.log(`View mode: Empty cell for ${day} ${time}`);
        dayCell.innerHTML = `<div class="empty-cell"></div>`;
      }
    }
  });

  console.log(
    "=== MODE SUMMARY ===",
    "Edit mode flag:",
    isEditMode,
    "Courses shown:",
    coursesShown,
    "Add buttons shown:",
    addButtonsShown,
    "Difference:",
    isEditMode ? "Courses have EDIT buttons" : "Courses have NO edit buttons"
  );

  // Courses are now handled in the main loop above
  console.log("Course display logic completed");

  console.log(
    "Schedule refreshed. Edit mode:",
    isEditMode,
    "Day cells:",
    dayCells.length
  );
}

function addCourseToTimeSlot(course) {
  // Find the cell that matches both day and time
  const dayCell = document.querySelector(
    `[data-day="${course.day}"][data-time="${course.startTime}"]`
  );

  console.log(
    `addCourseToTimeSlot: Looking for day="${course.day}", time="${course.startTime}"`
  );
  console.log(`Found dayCell:`, dayCell);

  if (!dayCell) {
    console.log(`No dayCell found for course:`, course);
    return;
  }

  // Remove the add button
  const addBtn = dayCell.querySelector(".add-course-btn");
  if (addBtn) {
    addBtn.remove();
  }

  // Create course item
  const courseItem = document.createElement("div");
  courseItem.className = "schedule-course-item";

  // Apply custom color or default primary color
  if (course.color) {
    courseItem.style.background = course.color;
  } else {
    courseItem.style.background = "var(--primary-color)";
  }

  courseItem.innerHTML = `
    <div class="course-name">${course.course}</div>
    <div class="course-time">${course.startTime} - ${course.endTime}</div>
    <div class="course-type">${course.type}</div>
    <button class="edit-btn" data-course-id="${course.id}" title="Edit Course">
      <i class="fas fa-edit"></i>
    </button>
  `;

  dayCell.appendChild(courseItem);
}

function addCourseToDay(course) {
  // This function is kept for backward compatibility
  addCourseToTimeSlot(course);
}

function openAddCourseModal(day, time = null) {
  const year = document.getElementById("scheduleYear").value;
  const semester = document.getElementById("scheduleSemester").value;

  if (!year || !semester) {
    alert("Please select year and semester first.");
    return;
  }

  // Close any existing modal first
  closeCurrentModal();

  // Create a simple course addition modal
  currentModal = document.createElement("div");
  currentModal.className = "modal";
  currentModal.style.display = "flex";
  currentModal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Add Course to ${day}</h3>
        <button class="modal-close" data-action="close-modal">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body">
        <form id="addCourseForm">
          <div class="form-group">
            <label for="courseName">Course Name</label>
            <input type="text" id="courseName" placeholder="e.g., Linear Algebra" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="startTime">Start Time</label>
              <select id="startTime" required>
                <option value="">Select Start Time</option>
                <option value="08:00" ${
                  time === "8:00 AM" ? "selected" : ""
                }>8:00 AM</option>
                <option value="09:00" ${
                  time === "9:00 AM" ? "selected" : ""
                }>9:00 AM</option>
                <option value="10:00" ${
                  time === "10:00 AM" ? "selected" : ""
                }>10:00 AM</option>
                <option value="11:00" ${
                  time === "11:00 AM" ? "selected" : ""
                }>11:00 AM</option>
                <option value="12:00" ${
                  time === "12:00 PM" ? "selected" : ""
                }>12:00 PM</option>
                <option value="13:00" ${
                  time === "1:00 PM" ? "selected" : ""
                }>1:00 PM</option>
                <option value="14:00" ${
                  time === "2:00 PM" ? "selected" : ""
                }>2:00 PM</option>
                <option value="15:00" ${
                  time === "3:00 PM" ? "selected" : ""
                }>3:00 PM</option>
                <option value="16:00" ${
                  time === "4:00 PM" ? "selected" : ""
                }>4:00 PM</option>
                <option value="17:00" ${
                  time === "5:00 PM" ? "selected" : ""
                }>5:00 PM</option>
                <option value="18:00" ${
                  time === "6:00 PM" ? "selected" : ""
                }>6:00 PM</option>
                <option value="19:00" ${
                  time === "7:00 PM" ? "selected" : ""
                }>7:00 PM</option>
                <option value="20:00" ${
                  time === "8:00 PM" ? "selected" : ""
                }>8:00 PM</option>
              </select>
            </div>
            <div class="form-group">
              <label for="endTime">End Time</label>
              <select id="endTime" required>
                <option value="">Select End Time</option>
                <option value="09:00">9:00 AM</option>
                <option value="10:00">10:00 AM</option>
                <option value="11:00">11:00 AM</option>
                <option value="12:00">12:00 PM</option>
                <option value="13:00">1:00 PM</option>
                <option value="14:00">2:00 PM</option>
                <option value="15:00">3:00 PM</option>
                <option value="16:00">4:00 PM</option>
                <option value="17:00">5:00 PM</option>
                <option value="18:00">6:00 PM</option>
                <option value="19:00">7:00 PM</option>
                <option value="20:00">8:00 PM</option>
                <option value="21:00">9:00 PM</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="courseType">Course Type</label>
            <select id="courseType" required>
              <option value="">Select Type</option>
              <option value="Lecture">Lecture</option>
              <option value="Tutorial">Tutorial</option>
              <option value="Lab">Lab</option>
              <option value="Seminar">Seminar</option>
              <option value="Exam">Exam</option>
            </select>
          </div>
          <div class="form-group">
            <label for="courseDuration">Duration</label>
            <select id="courseDuration" required>
              <option value="">Select Duration</option>
              <option value="semester">Semester Course</option>
              <option value="yearly">Yearly Course</option>
            </select>
          </div>
          <div class="form-group">
            <label for="location">Location</label>
            <input type="text" id="location" placeholder="Room number or location">
          </div>
          <div class="form-group">
            <label for="courseColor">Course Color</label>
            <select id="courseColor" required>
              <option value="">Select Color</option>
              <option value="#3B82F6">Blue</option>
              <option value="#EF4444">Red</option>
              <option value="#10B981">Green</option>
              <option value="#F59E0B">Orange</option>
              <option value="#8B5CF6">Purple</option>
              <option value="#EC4899">Pink</option>
              <option value="#06B6D4">Cyan</option>
              <option value="#84CC16">Lime</option>
              <option value="#F97316">Orange Red</option>
              <option value="#6366F1">Indigo</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn-primary">Add Course</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(currentModal);

  // Handle form submission
  currentModal
    .querySelector("#addCourseForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();

      // Small delay to ensure form is fully rendered
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get form elements using form's querySelector (more reliable for dynamic forms)
      const form = currentModal.querySelector("#addCourseForm");
      const courseNameEl = form.querySelector("#courseName");
      const startTimeEl = form.querySelector("#startTime");
      const endTimeEl = form.querySelector("#endTime");
      const courseTypeEl = form.querySelector("#courseType");
      const courseDurationEl = form.querySelector("#courseDuration");
      const locationEl = form.querySelector("#location");
      const courseColorEl = form.querySelector("#courseColor");

      console.log("Form elements:", {
        form: form,
        courseNameEl: courseNameEl,
        startTimeEl: startTimeEl,
        endTimeEl: endTimeEl,
        courseTypeEl: courseTypeEl,
        courseDurationEl: courseDurationEl,
        locationEl: locationEl,
        courseColorEl: courseColorEl,
      });

      const courseName = courseNameEl ? courseNameEl.value.trim() : "";
      const startTime24 = startTimeEl ? startTimeEl.value : "";
      const endTime24 = endTimeEl ? endTimeEl.value : "";
      const courseType = courseTypeEl ? courseTypeEl.value : "";
      const courseDuration = courseDurationEl ? courseDurationEl.value : "";
      const location = locationEl ? locationEl.value.trim() : "";
      const courseColor = courseColorEl ? courseColorEl.value : "";

      console.log("Form values:", {
        courseName,
        startTime24,
        endTime24,
        courseType,
        courseDuration,
        location,
        courseColor,
      });

      // Validate required fields with specific feedback
      const missingFields = [];
      if (!courseName) missingFields.push("Course Name");
      if (!startTime24) missingFields.push("Start Time");
      if (!endTime24) missingFields.push("End Time");
      if (!courseType) missingFields.push("Course Type");
      if (!courseDuration) missingFields.push("Duration");
      if (!courseColor) missingFields.push("Color");

      if (missingFields.length > 0) {
        alert(
          `Please fill in the following required fields: ${missingFields.join(
            ", "
          )}`
        );
        console.log("Missing fields:", missingFields);
        console.log("Current values:", {
          courseName,
          startTime24,
          endTime24,
          courseType,
          courseDuration,
          courseColor,
        });
        return;
      }

      // Convert 24-hour format to 12-hour format to match grid
      const startTime = convertTo12Hour(startTime24);
      const endTime = convertTo12Hour(endTime24);

      // Create schedule item
      const semesterText = `${
        document.getElementById("scheduleSemester").value
      } ${document.getElementById("scheduleYear").value}`;
      const scheduleItem = {
        id: Date.now().toString(),
        course: courseName,
        day: day,
        type: courseType,
        startTime: startTime,
        endTime: endTime,
        location: location,
        semester: semesterText,
        duration: courseDuration,
        color: courseColor,
      };

      console.log("Saving schedule item:", scheduleItem);
      schedules.push(scheduleItem);
      await saveSchedules();
      console.log("All schedules after adding:", schedules);

      // Refresh the creation interface
      const currentYear = document.getElementById("scheduleYear").value;
      const currentSemester = document.getElementById("scheduleSemester").value;
      await loadCoursesForSemester(`${currentSemester} ${currentYear}`);

      // Also update the old schedule display
      updateScheduleDisplay();

      // Close modal
      closeCurrentModal();

      // Show success message
      setStatus(`Course "${courseName}" added to ${day}!`);
      setTimeout(() => setStatus("Ready"), 2000);
    });
}

async function editCourse(courseId) {
  const course = schedules.find((s) => s.id === courseId);
  if (!course) return;

  // Convert 12-hour format to 24-hour format for select options
  const startTime24 = convertTo24Hour(course.startTime);
  const endTime24 = convertTo24Hour(course.endTime);

  // Close any existing modal first
  closeCurrentModal();

  // Create edit modal
  currentModal = document.createElement("div");
  currentModal.className = "modal";
  currentModal.style.display = "flex";
  currentModal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Edit Course</h3>
        <button class="modal-close" data-action="close-modal">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body">
        <form id="editCourseForm">
          <div class="form-group">
            <label for="editCourseName">Course Name</label>
            <input type="text" id="editCourseName" value="${
              course.course
            }" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="editStartTime">Start Time</label>
              <select id="editStartTime" required>
                <option value="">Select Start Time</option>
                <option value="08:00" ${
                  startTime24 === "08:00" ? "selected" : ""
                }>8:00 AM</option>
                <option value="09:00" ${
                  startTime24 === "09:00" ? "selected" : ""
                }>9:00 AM</option>
                <option value="10:00" ${
                  startTime24 === "10:00" ? "selected" : ""
                }>10:00 AM</option>
                <option value="11:00" ${
                  startTime24 === "11:00" ? "selected" : ""
                }>11:00 AM</option>
                <option value="12:00" ${
                  startTime24 === "12:00" ? "selected" : ""
                }>12:00 PM</option>
                <option value="13:00" ${
                  startTime24 === "13:00" ? "selected" : ""
                }>1:00 PM</option>
                <option value="14:00" ${
                  startTime24 === "14:00" ? "selected" : ""
                }>2:00 PM</option>
                <option value="15:00" ${
                  startTime24 === "15:00" ? "selected" : ""
                }>3:00 PM</option>
                <option value="16:00" ${
                  startTime24 === "16:00" ? "selected" : ""
                }>4:00 PM</option>
                <option value="17:00" ${
                  startTime24 === "17:00" ? "selected" : ""
                }>5:00 PM</option>
                <option value="18:00" ${
                  startTime24 === "18:00" ? "selected" : ""
                }>6:00 PM</option>
                <option value="19:00" ${
                  startTime24 === "19:00" ? "selected" : ""
                }>7:00 PM</option>
                <option value="20:00" ${
                  startTime24 === "20:00" ? "selected" : ""
                }>8:00 PM</option>
              </select>
            </div>
            <div class="form-group">
              <label for="editEndTime">End Time</label>
              <select id="editEndTime" required>
                <option value="">Select End Time</option>
                <option value="09:00" ${
                  endTime24 === "09:00" ? "selected" : ""
                }>9:00 AM</option>
                <option value="10:00" ${
                  endTime24 === "10:00" ? "selected" : ""
                }>10:00 AM</option>
                <option value="11:00" ${
                  endTime24 === "11:00" ? "selected" : ""
                }>11:00 AM</option>
                <option value="12:00" ${
                  endTime24 === "12:00" ? "selected" : ""
                }>12:00 PM</option>
                <option value="13:00" ${
                  endTime24 === "13:00" ? "selected" : ""
                }>1:00 PM</option>
                <option value="14:00" ${
                  endTime24 === "14:00" ? "selected" : ""
                }>2:00 PM</option>
                <option value="15:00" ${
                  endTime24 === "15:00" ? "selected" : ""
                }>3:00 PM</option>
                <option value="16:00" ${
                  endTime24 === "16:00" ? "selected" : ""
                }>4:00 PM</option>
                <option value="17:00" ${
                  endTime24 === "17:00" ? "selected" : ""
                }>5:00 PM</option>
                <option value="18:00" ${
                  endTime24 === "18:00" ? "selected" : ""
                }>6:00 PM</option>
                <option value="19:00" ${
                  endTime24 === "19:00" ? "selected" : ""
                }>7:00 PM</option>
                <option value="20:00" ${
                  endTime24 === "20:00" ? "selected" : ""
                }>8:00 PM</option>
                <option value="21:00" ${
                  endTime24 === "21:00" ? "selected" : ""
                }>9:00 PM</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="editCourseType">Course Type</label>
            <select id="editCourseType" required>
              <option value="Lecture" ${
                course.type === "Lecture" ? "selected" : ""
              }>Lecture</option>
              <option value="Tutorial" ${
                course.type === "Tutorial" ? "selected" : ""
              }>Tutorial</option>
              <option value="Lab" ${
                course.type === "Lab" ? "selected" : ""
              }>Lab</option>
              <option value="Seminar" ${
                course.type === "Seminar" ? "selected" : ""
              }>Seminar</option>
              <option value="Exam" ${
                course.type === "Exam" ? "selected" : ""
              }>Exam</option>
            </select>
          </div>
          <div class="form-group">
            <label for="editLocation">Location</label>
            <input type="text" id="editLocation" value="${
              course.location || ""
            }" placeholder="Room number or location">
          </div>
          <div class="form-group">
            <label for="editCourseColor">Course Color</label>
            <select id="editCourseColor" required>
              <option value="">Select Color</option>
              <option value="#3B82F6" ${
                course.color === "#3B82F6" ? "selected" : ""
              }>Blue</option>
              <option value="#EF4444" ${
                course.color === "#EF4444" ? "selected" : ""
              }>Red</option>
              <option value="#10B981" ${
                course.color === "#10B981" ? "selected" : ""
              }>Green</option>
              <option value="#F59E0B" ${
                course.color === "#F59E0B" ? "selected" : ""
              }>Orange</option>
              <option value="#8B5CF6" ${
                course.color === "#8B5CF6" ? "selected" : ""
              }>Purple</option>
              <option value="#EC4899" ${
                course.color === "#EC4899" ? "selected" : ""
              }>Pink</option>
              <option value="#06B6D4" ${
                course.color === "#06B6D4" ? "selected" : ""
              }>Cyan</option>
              <option value="#84CC16" ${
                course.color === "#84CC16" ? "selected" : ""
              }>Lime</option>
              <option value="#F97316" ${
                course.color === "#F97316" ? "selected" : ""
              }>Orange Red</option>
              <option value="#6366F1" ${
                course.color === "#6366F1" ? "selected" : ""
              }>Indigo</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" data-action="delete-course" data-course-id="${courseId}">Delete</button>
            <button type="button" class="btn-secondary" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(currentModal);

  // Handle delete button
  currentModal
    .querySelector('[data-action="delete-course"]')
    .addEventListener("click", function () {
      const courseId = this.getAttribute("data-course-id");
      deleteCourse(courseId);
      closeCurrentModal();
    });

  // Handle form submission
  currentModal
    .querySelector("#editCourseForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();

      const courseName = document.getElementById("editCourseName").value;
      const startTime24 = document.getElementById("editStartTime").value;
      const endTime24 = document.getElementById("editEndTime").value;
      const courseType = document.getElementById("editCourseType").value;
      const location = document.getElementById("editLocation").value;
      const courseColor = document.getElementById("editCourseColor").value;

      // Convert 24-hour format to 12-hour format to match grid
      const startTime = convertTo12Hour(startTime24);
      const endTime = convertTo12Hour(endTime24);

      // Update course
      course.course = courseName;
      course.startTime = startTime;
      course.endTime = endTime;
      course.type = courseType;
      course.location = location;
      course.color = courseColor;

      await saveSchedules();

      // Refresh the creation interface
      const currentYear = document.getElementById("scheduleYear").value;
      const currentSemester = document.getElementById("scheduleSemester").value;
      await loadCoursesForSemester(`${currentSemester} ${currentYear}`);

      // Also update the old schedule display
      updateScheduleDisplay();

      // Close modal
      closeCurrentModal();

      // Show success message
      setStatus(`Course "${courseName}" updated!`);
      setTimeout(() => setStatus("Ready"), 2000);
    });
}

async function deleteCourse(courseId) {
  if (confirm("Are you sure you want to delete this course?")) {
    const courseIndex = schedules.findIndex((s) => s.id === courseId);
    if (courseIndex !== -1) {
      const courseName = schedules[courseIndex].course;
      schedules.splice(courseIndex, 1);
      await saveSchedules();

      // Refresh the creation interface
      const currentYear = document.getElementById("scheduleYear").value;
      const currentSemester = document.getElementById("scheduleSemester").value;
      await loadCoursesForSemester(`${currentSemester} ${currentYear}`);

      // Also update the old schedule display
      updateScheduleDisplay();

      // Close any open modals
      document.querySelectorAll(".modal").forEach((modal) => modal.remove());

      // Show success message
      setStatus(`Course "${courseName}" deleted!`);
      setTimeout(() => setStatus("Ready"), 2000);
    }
  }
}

function updateScheduleDisplay() {
  if (!scheduleGrid) return;

  const scheduleYearSelect = document.getElementById("scheduleYear");
  const scheduleSemesterSelect = document.getElementById("scheduleSemester");
  const selectedYear = scheduleYearSelect ? scheduleYearSelect.value : "";
  const selectedSemesterType = scheduleSemesterSelect
    ? scheduleSemesterSelect.value
    : "";
  const selectedSemester =
    selectedYear && selectedSemesterType
      ? `${selectedSemesterType} ${selectedYear}`
      : "";

  if (!selectedSemester) {
    scheduleGrid.innerHTML = `
            <div class="schedule-placeholder">
                <i class="fas fa-calendar-plus"></i>
                <h3>No Schedule Created</h3>
                <p>Select a semester and add your weekly schedule items to get started.</p>
            </div>
        `;
    return;
  }

  // Filter schedules for selected semester
  const semesterSchedules = schedules.filter(
    (s) => s.semester === selectedSemester
  );

  if (semesterSchedules.length === 0) {
    scheduleGrid.innerHTML = `
            <div class="schedule-placeholder">
                <i class="fas fa-calendar-plus"></i>
                <h3>No Schedule Items</h3>
                <p>Add schedule items for ${selectedSemester} to get started.</p>
            </div>
        `;
    return;
  }

  // Create schedule grid
  scheduleGrid.innerHTML = createScheduleGrid(semesterSchedules);
}

function createScheduleGrid(schedules) {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const timeSlots = [
    "8:00 AM",
    "9:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "1:00 PM",
    "2:00 PM",
    "3:00 PM",
    "4:00 PM",
    "5:00 PM",
    "6:00 PM",
    "7:00 PM",
    "8:00 PM",
    "9:00 PM",
  ];

  let html = '<div class="schedule-table">';

  // Header row
  html += '<div class="schedule-header-row">';
  html += '<div class="time-column">Time</div>';
  days.forEach((day) => {
    html += `<div class="day-column">${day}</div>`;
  });
  html += "</div>";

  // Time slots
  timeSlots.forEach((timeSlot) => {
    html += '<div class="schedule-row">';
    html += `<div class="time-slot">${timeSlot}</div>`;

    days.forEach((day) => {
      const daySchedules = schedules.filter(
        (s) => s.day === day && isTimeInSlot(s.startTime, timeSlot)
      );
      html += `<div class="schedule-cell">`;

      daySchedules.forEach((schedule) => {
        html += createScheduleItem(schedule);
      });

      html += "</div>";
    });

    html += "</div>";
  });

  html += "</div>";
  return html;
}

function isTimeInSlot(startTime, timeSlot) {
  const start = new Date(`2000-01-01 ${startTime}`);
  const slot = new Date(`2000-01-01 ${timeSlot}`);
  const slotEnd = new Date(slot.getTime() + 30 * 60000); // 30 minutes

  return start >= slot && start < slotEnd;
}

function createScheduleItem(schedule) {
  const colorMap = {
    blue: "#3b82f6",
    green: "#10b981",
    purple: "#8b5cf6",
    orange: "#f59e0b",
    red: "#ef4444",
    teal: "#14b8a6",
    pink: "#ec4899",
    yellow: "#eab308",
  };

  const color = colorMap[schedule.color] || "#3b82f6";

  return `
        <div class="schedule-item" style="background-color: ${color}20; border-left: 3px solid ${color};" 
             data-schedule-id="${schedule.id}">
            <div class="schedule-course">${schedule.course}</div>
            <div class="schedule-type">${schedule.type}</div>
            <div class="schedule-time">${schedule.startTime} - ${
    schedule.endTime
  }</div>
            ${
              schedule.location
                ? `<div class="schedule-location">${schedule.location}</div>`
                : ""
            }
            <div class="schedule-actions">
                <button class="schedule-edit-btn" onclick="editSchedule('${
                  schedule.id
                }')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="schedule-delete-btn" onclick="deleteSchedule('${
                  schedule.id
                }')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

// Dashboard Functions
function updateDashboard() {
  updateGPAOverview();
  updateSemesterOverview();
  updateRecentActivity();
}

function updateGPAOverview() {
  const gpaMain = document.getElementById("gpaMain");
  const gpaDetails = document.getElementById("gpaDetails");

  if (!gpaMain || !gpaDetails) return;

  if (courses.length === 0) {
    gpaMain.textContent = "-";
    gpaDetails.textContent = "No courses added yet";
    return;
  }

  const graded = courses.filter(
    (c) => !c.pass && c.grade !== null && !isNaN(c.grade) && c.credits > 0
  );
  const totalCredits = courses.reduce((sum, c) => sum + (c.credits || 0), 0);

  if (graded.length === 0) {
    gpaMain.textContent = "-";
    gpaDetails.textContent = `${totalCredits} credits (no graded courses)`;
    return;
  }

  const weightedSum = graded.reduce((sum, c) => sum + c.grade * c.credits, 0);
  const creditsWeighted = graded.reduce((sum, c) => sum + c.credits, 0);
  const gpa = creditsWeighted > 0 ? weightedSum / creditsWeighted : 0;

  gpaMain.textContent = gpa.toFixed(2);
  gpaDetails.textContent = `${totalCredits} credits • ${graded.length} graded courses`;
}

function updateSemesterOverview() {
  const semesterBlocks = document.getElementById("semesterBlocks");
  if (!semesterBlocks) return;

  semesterBlocks.innerHTML = "";

  if (courses.length === 0) {
    semesterBlocks.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-graduation-cap"></i>
                <h3>No Courses Added</h3>
                <p>Add your first course to see semester overview.</p>
            </div>
        `;
    return;
  }

  // Group courses by semester
  const semesterGroups = {};
  courses.forEach((course) => {
    if (!semesterGroups[course.semester]) {
      semesterGroups[course.semester] = [];
    }
    semesterGroups[course.semester].push(course);
  });

  // Create semester blocks
  Object.entries(semesterGroups).forEach(([semester, courses]) => {
    const block = createSemesterBlock(semester, courses);
    semesterBlocks.appendChild(block);
  });
}

function createSemesterBlock(semester, courses) {
  const totalCredits = courses.reduce((sum, c) => sum + (c.credits || 0), 0);
  const gradedCourses = courses.filter(
    (c) => !c.pass && c.grade !== null && !isNaN(c.grade)
  );
  const avgGrade =
    gradedCourses.length > 0
      ? gradedCourses.reduce((sum, c) => sum + c.grade, 0) /
        gradedCourses.length
      : 0;

  const block = document.createElement("div");
  block.className = "semester-block";
  block.innerHTML = `
        <h3>${formatSemesterDisplay(semester)}</h3>
        <div class="semester-meta">${
          courses.length
        } courses • ${totalCredits} credits</div>
        <div class="semester-summary">
            <strong>Average:</strong> ${avgGrade.toFixed(2)} | 
            <strong>Credits:</strong> ${totalCredits}
        </div>
    `;

  return block;
}

function updateRecentActivity() {
  const recentActivity = document.getElementById("recentActivity");
  if (!recentActivity) return;

  // For now, show a simple activity list
  recentActivity.innerHTML = `
        <div class="activity-item">
            <i class="fas fa-info-circle"></i>
            <span>Welcome to AcademicHub! Your academic journey starts here.</span>
        </div>
    `;
}

// Grades Page Functions
function updateGradesPage() {
  updateGradesStatistics();

  const gradesSemesterBlocks = document.getElementById("gradesSemesterBlocks");
  if (!gradesSemesterBlocks) return;

  // Use the same semester blocks as dashboard
  gradesSemesterBlocks.innerHTML = "";

  if (courses.length === 0) {
    gradesSemesterBlocks.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-line"></i>
                <h3>No Grades Available</h3>
                <p>Add courses with grades to see detailed analysis.</p>
            </div>
        `;
    return;
  }

  // Group courses by semester
  const semesterGroups = {};
  courses.forEach((course) => {
    if (!semesterGroups[course.semester]) {
      semesterGroups[course.semester] = [];
    }
    semesterGroups[course.semester].push(course);
  });

  // Create detailed semester blocks
  Object.entries(semesterGroups).forEach(([semester, courses]) => {
    const block = createDetailedSemesterBlock(semester, courses);
    gradesSemesterBlocks.appendChild(block);
  });
}

function updateGradesStatistics() {
  // Overall GPA
  const overallGPA = document.getElementById("overallGPA");
  const overallGPADetail = document.getElementById("overallGPADetail");

  // GPA without Judaism
  const gpaNoJudaism = document.getElementById("gpaNoJudaism");
  const gpaNoJudaismDetail = document.getElementById("gpaNoJudaismDetail");

  // Total Credits
  const totalCredits = document.getElementById("totalCredits");
  const totalCreditsDetail = document.getElementById("totalCreditsDetail");

  // Courses Completed
  const coursesCompleted = document.getElementById("coursesCompleted");
  const coursesCompletedDetail = document.getElementById(
    "coursesCompletedDetail"
  );

  if (!overallGPA || !gpaNoJudaism || !totalCredits || !coursesCompleted)
    return;

  if (courses.length === 0) {
    overallGPA.textContent = "-";
    overallGPADetail.textContent = "No grades yet";
    gpaNoJudaism.textContent = "-";
    gpaNoJudaismDetail.textContent = "No grades yet";
    totalCredits.textContent = "0";
    totalCreditsDetail.textContent = "credits completed";
    coursesCompleted.textContent = "0";
    coursesCompletedDetail.textContent = "courses";
    return;
  }

  // Calculate overall GPA
  const graded = courses.filter(
    (c) => !c.pass && c.grade !== null && !isNaN(c.grade) && c.credits > 0
  );
  const totalCreditsAll = courses.reduce((sum, c) => sum + (c.credits || 0), 0);

  let overallGPAValue = 0;
  if (graded.length > 0) {
    const weightedSum = graded.reduce((sum, c) => sum + c.grade * c.credits, 0);
    const creditsWeighted = graded.reduce((sum, c) => sum + c.credits, 0);
    overallGPAValue = creditsWeighted > 0 ? weightedSum / creditsWeighted : 0;
  }

  // Calculate GPA without Judaism
  const filtered = graded.filter(
    (c) => !c.course.toLowerCase().includes("judaism")
  );
  let gpaNoJudaismValue = 0;
  if (filtered.length > 0) {
    const weightedSumNoJudaism = filtered.reduce(
      (sum, c) => sum + c.grade * c.credits,
      0
    );
    const creditsWeightedNoJudaism = filtered.reduce(
      (sum, c) => sum + c.credits,
      0
    );
    gpaNoJudaismValue =
      creditsWeightedNoJudaism > 0
        ? weightedSumNoJudaism / creditsWeightedNoJudaism
        : 0;
  }

  // Update display
  overallGPA.textContent =
    overallGPAValue > 0 ? overallGPAValue.toFixed(2) : "-";
  overallGPADetail.textContent =
    overallGPAValue > 0 ? `${graded.length} graded courses` : "No grades yet";

  gpaNoJudaism.textContent =
    gpaNoJudaismValue > 0 ? gpaNoJudaismValue.toFixed(2) : "-";
  gpaNoJudaismDetail.textContent =
    gpaNoJudaismValue > 0
      ? `${filtered.length} courses (excl. Judaism)`
      : "No grades yet";

  totalCredits.textContent = totalCreditsAll;
  totalCreditsDetail.textContent = "credits completed";

  coursesCompleted.textContent = courses.length;
  coursesCompletedDetail.textContent = "courses";
}

function createDetailedSemesterBlock(semester, courses) {
  const totalCredits = courses.reduce((sum, c) => sum + (c.credits || 0), 0);
  const gradedCourses = courses.filter(
    (c) => !c.pass && c.grade !== null && !isNaN(c.grade)
  );
  const avgGrade =
    gradedCourses.length > 0
      ? gradedCourses.reduce((sum, c) => sum + c.grade, 0) /
        gradedCourses.length
      : 0;

  const block = document.createElement("div");
  block.className = "semester-block";

  let coursesHtml = "";
  courses.forEach((course, index) => {
    const courseIndex = courses.indexOf(course);
    const gradeClass = course.pass ? "" : getGradeClass(course.grade);
    const gradeDisplay = course.pass ? "P" : course.grade ?? "-";

    coursesHtml += `
            <div class="course-item">
                <span class="label">${course.course}</span>
                <span class="grade ${gradeClass}" data-course-index="${courseIndex}">${gradeDisplay}</span>
                <span class="credits" data-course-index="${courseIndex}">${
      course.credits || 0
    }</span>
            </div>
        `;
  });

  block.innerHTML = `
        <h3>${formatSemesterDisplay(semester)}</h3>
        <div class="semester-meta">${
          courses.length
        } courses • ${totalCredits} credits</div>
        <div class="courses-list">
            ${coursesHtml}
        </div>
        <div class="semester-summary">
            <strong>Average:</strong> ${avgGrade.toFixed(2)} | 
            <strong>Credits:</strong> ${totalCredits}
        </div>
    `;

  // Make grades and credits editable if inline editing is enabled
  if (inlineEditEnabled) {
    const gradeElements = block.querySelectorAll(".grade[data-course-index]");
    const creditElements = block.querySelectorAll(
      ".credits[data-course-index]"
    );

    gradeElements.forEach((element) => {
      const courseIndex = parseInt(element.dataset.courseIndex);
      makeGradeEditable(element, courseIndex);
    });

    creditElements.forEach((element) => {
      const courseIndex = parseInt(element.dataset.courseIndex);
      makeCreditsEditable(element, courseIndex);
    });
  }

  return block;
}

// Compare Page Functions
function updateComparePage() {
  // Show loading state
  const compareLoading2 = document.getElementById("compareLoading2");
  const compareContent = document.querySelector(
    "#comparePage .compare-content"
  );

  if (compareLoading2) compareLoading2.style.display = "block";
  if (compareContent) compareContent.style.display = "none";

  // Fetch data and display
  fetchOtherUsersData();
}

// Settings Page Functions
function updateSettingsPage() {
  if (!currentUser) return;

  const displayName = document.getElementById("displayName");
  const emailAddress = document.getElementById("emailAddress");
  const lastUpdated = document.getElementById("lastUpdated");

  if (displayName)
    displayName.textContent = currentUser.displayName || "Not set";
  if (emailAddress) emailAddress.textContent = currentUser.email || "Not set";
  if (lastUpdated) lastUpdated.textContent = new Date().toLocaleDateString();
}

// Add popup blocker detection
function detectPopupBlocker() {
  const popup = window.open("", "_blank", "width=1,height=1");
  if (!popup || popup.closed || typeof popup.closed === "undefined") {
    return true; // Popup blocked
  }
  popup.close();
  return false; // Popup allowed
}

// Show popup help text
function showPopupHelp() {
  if (popupHelp) popupHelp.style.display = "block";
  if (signInRedirectBtn) signInRedirectBtn.style.display = "inline-block";
}

// Hide popup help text
function hidePopupHelp() {
  if (popupHelp) popupHelp.style.display = "none";
  if (signInRedirectBtn) signInRedirectBtn.style.display = "none";
}

function getGradeClass(grade) {
  if (grade >= 95) return "green";
  if (grade >= 90) return "lightgreen";
  if (grade >= 80) return "yellow";
  return "red";
}

function formatSemesterDisplay(semester) {
  if (!semester) return "";
  const [semLabel, yearLabel] = semester.split(" ");
  return `Semester ${semLabel} Year ${yearLabel}`;
}

// Schedule Management Functions
// Old modal functions removed - now using inline creation interface

// Old saveScheduleItem function removed - now using openAddCourseModal

function hasTimeConflict(semester, day, startTime, endTime) {
  const start = new Date(`2000-01-01 ${startTime}`);
  const end = new Date(`2000-01-01 ${endTime}`);

  return schedules.some((schedule) => {
    if (schedule.semester !== semester || schedule.day !== day) return false;

    const existingStart = new Date(`2000-01-01 ${schedule.startTime}`);
    const existingEnd = new Date(`2000-01-01 ${schedule.endTime}`);

    return start < existingEnd && end > existingStart;
  });
}

function editSchedule(scheduleId) {
  const schedule = schedules.find((s) => s.id === scheduleId);
  if (!schedule) return;

  if (scheduleModal) {
    scheduleModal.style.display = "flex";
    document.getElementById("scheduleModalTitle").textContent =
      "Edit Schedule Item";

    // Populate form
    document.getElementById("scheduleCourse").value = schedule.course;
    document.getElementById("scheduleDay").value = schedule.day;
    document.getElementById("scheduleType").value = schedule.type;
    document.getElementById("scheduleStartTime").value = schedule.startTime;
    document.getElementById("scheduleEndTime").value = schedule.endTime;
    document.getElementById("scheduleLocation").value = schedule.location || "";
    document.getElementById("scheduleInstructor").value =
      schedule.instructor || "";

    // Store the schedule ID for editing
    scheduleModal.dataset.editingId = scheduleId;
  }
}

function deleteSchedule(scheduleId) {
  if (confirm("Are you sure you want to delete this schedule item?")) {
    schedules = schedules.filter((s) => s.id !== scheduleId);
    saveSchedules();
    updateScheduleDisplay();
    setStatus("Schedule item deleted successfully!");
    setTimeout(() => setStatus("Ready"), 2000);
  }
}

// Grade Management Functions
function openGradeModal() {
  if (!currentUser) {
    alert("Please sign in first.");
    return;
  }

  if (gradeModal) {
    gradeModal.style.display = "flex";
    updateGradeSemesterFilter();
    updateGradesTable();
    updateGradeSummary();
  }
}

function closeGradeModal() {
  if (gradeModal) {
    gradeModal.style.display = "none";
  }
}

function updateGradeSemesterFilter() {
  if (!gradeSemesterFilter) return;

  // Get unique semesters from courses
  const semesters = [...new Set(courses.map((c) => c.semester))].sort();

  // Clear existing options except the first one
  gradeSemesterFilter.innerHTML = '<option value="">All Semesters</option>';

  // Add semester options
  semesters.forEach((semester) => {
    const option = document.createElement("option");
    option.value = semester;
    option.textContent = semester;
    gradeSemesterFilter.appendChild(option);
  });
}

function updateGradesTable() {
  if (!gradesTableBody) return;

  const selectedSemester = gradeSemesterFilter ? gradeSemesterFilter.value : "";
  let filteredCourses = courses;

  // Filter by semester if selected
  if (selectedSemester) {
    filteredCourses = courses.filter((c) => c.semester === selectedSemester);
  }

  // Clear table body
  gradesTableBody.innerHTML = "";

  if (filteredCourses.length === 0) {
    gradesTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center" style="padding: var(--spacing-xl); color: var(--text-muted);">
          <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: var(--spacing-md); display: block;"></i>
          No grades found${selectedSemester ? ` for ${selectedSemester}` : ""}
        </td>
      </tr>
    `;
    return;
  }

  // Sort courses by semester and course name
  const sortedCourses = [...filteredCourses].sort((a, b) => {
    const semesterCompare = a.semester.localeCompare(b.semester);
    if (semesterCompare !== 0) return semesterCompare;
    return a.course.localeCompare(b.course);
  });

  // Create table rows
  sortedCourses.forEach((course, index) => {
    const row = document.createElement("tr");
    row.dataset.courseIndex = courses.indexOf(course);

    const gradeClass = course.pass ? "grade-pass" : getGradeClass(course.grade);
    const gradeDisplay = course.pass ? "P" : course.grade ?? "-";
    const courseType = determineCourseType(course.course);

    row.innerHTML = `
      <td class="checkbox-col">
        <input type="checkbox" class="grade-checkbox" data-course-index="${courses.indexOf(
          course
        )}">
      </td>
      <td title="${course.course}">${course.course}</td>
      <td>${formatSemesterDisplay(course.semester)}</td>
      <td class="grade-cell ${gradeClass}">${gradeDisplay}</td>
      <td class="credits-cell">${course.credits || 0}</td>
      <td class="type-cell">
        <span class="type-badge ${courseType.toLowerCase()}">${courseType}</span>
      </td>
      <td class="actions-cell">
        <button class="action-btn edit" onclick="editGrade(${courses.indexOf(
          course
        )})" title="Edit Grade">
          <i class="fas fa-edit"></i>
        </button>
        <button class="action-btn delete" onclick="deleteGrade(${courses.indexOf(
          course
        )})" title="Delete Grade">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;

    gradesTableBody.appendChild(row);
  });
}

function determineCourseType(courseName) {
  const name = courseName.toLowerCase();
  if (name.includes("lab") || name.includes("laboratory")) return "Lab";
  if (name.includes("seminar")) return "Seminar";
  if (name.includes("elective") || name.includes("optional")) return "Elective";
  return "Core";
}

function updateGradeSummary() {
  if (!totalCoursesCount || !totalCreditsCount || !currentGPA) return;

  const selectedSemester = gradeSemesterFilter ? gradeSemesterFilter.value : "";
  let filteredCourses = courses;

  if (selectedSemester) {
    filteredCourses = courses.filter((c) => c.semester === selectedSemester);
  }

  const totalCredits = filteredCourses.reduce(
    (sum, c) => sum + (c.credits || 0),
    0
  );
  const graded = filteredCourses.filter(
    (c) => !c.pass && c.grade !== null && !isNaN(c.grade) && c.credits > 0
  );

  let gpa = 0;
  if (graded.length > 0) {
    const weightedSum = graded.reduce((sum, c) => sum + c.grade * c.credits, 0);
    const creditsWeighted = graded.reduce((sum, c) => sum + c.credits, 0);
    gpa = creditsWeighted > 0 ? weightedSum / creditsWeighted : 0;
  }

  totalCoursesCount.textContent = filteredCourses.length;
  totalCreditsCount.textContent = totalCredits;
  currentGPA.textContent = gpa > 0 ? gpa.toFixed(2) : "-";
}

function editGrade(courseIndex) {
  const course = courses[courseIndex];
  if (!course) return;

  if (quickGradeModal) {
    quickGradeModal.style.display = "flex";

    // Populate form
    editCourseName.value = course.course;
    editSemester.value = course.semester;
    editCredits.value = course.credits || 0;
    editPassFlag.checked = course.pass || false;
    editGrade.value = course.grade || "";

    // Store course index for saving
    quickGradeModal.dataset.courseIndex = courseIndex;

    // Update grade input visibility
    updateGradeInputVisibility();
  }
}

function updateGradeInputVisibility() {
  if (editPassFlag.checked) {
    gradeInputGroup.classList.add("hidden");
    editGrade.value = "";
  } else {
    gradeInputGroup.classList.remove("hidden");
  }
}

function closeQuickGradeModal() {
  if (quickGradeModal) {
    quickGradeModal.style.display = "none";
    quickGradeForm.reset();
  }
}

function saveGradeEdit(event) {
  event.preventDefault();

  const courseIndex = parseInt(quickGradeModal.dataset.courseIndex);
  const course = courses[courseIndex];
  if (!course) return;

  const credits = parseFloat(editCredits.value) || 0;
  const passFlag = editPassFlag.checked;
  const grade = passFlag ? null : parseFloat(editGrade.value);

  if (!passFlag && (isNaN(grade) || grade < 0 || grade > 100)) {
    alert("Please enter a valid grade between 0 and 100.");
    return;
  }

  // Update course
  course.credits = credits;
  course.pass = passFlag;
  course.grade = grade;

  // Save to Firebase
  persistCourses();

  // Update displays
  updateGradesTable();
  updateGradeSummary();
  updateTable();
  updateResults();

  // Update dashboard if on dashboard page
  if (currentPage === "dashboard") {
    updateDashboard();
  }

  // Update grades page if on grades page
  if (currentPage === "grades") {
    updateGradesPage();
  }

  closeQuickGradeModal();
  setStatus("Grade updated successfully!");
  setTimeout(() => setStatus("Ready"), 2000);
}

function deleteGrade(courseIndex) {
  const course = courses[courseIndex];
  if (!course) return;

  if (confirm(`Are you sure you want to delete "${course.course}"?`)) {
    courses.splice(courseIndex, 1);

    // Save to Firebase
    persistCourses();

    // Update displays
    updateGradesTable();
    updateGradeSummary();
    updateTable();
    updateResults();

    // Update dashboard if on dashboard page
    if (currentPage === "dashboard") {
      updateDashboard();
    }

    // Update grades page if on grades page
    if (currentPage === "grades") {
      updateGradesPage();
    }

    setStatus("Grade deleted successfully!");
    setTimeout(() => setStatus("Ready"), 2000);
  }
}

function exportGrades() {
  if (courses.length === 0) {
    alert("No grades to export.");
    return;
  }

  const selectedSemester = gradeSemesterFilter ? gradeSemesterFilter.value : "";
  let filteredCourses = courses;

  if (selectedSemester) {
    filteredCourses = courses.filter((c) => c.semester === selectedSemester);
  }

  // Create CSV content
  const headers = [
    "Course",
    "Semester",
    "Grade",
    "Credits",
    "Type",
    "Pass/Fail",
  ];
  const csvContent = [
    headers.join(","),
    ...filteredCourses.map((course) =>
      [
        `"${course.course}"`,
        `"${formatSemesterDisplay(course.semester)}"`,
        course.pass ? "P" : course.grade ?? "",
        course.credits || 0,
        `"${determineCourseType(course.course)}"`,
        course.pass ? "Yes" : "No",
      ].join(",")
    ),
  ].join("\n");

  // Create and download file
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `grades${
    selectedSemester ? `_${selectedSemester.replace(/\s+/g, "_")}` : ""
  }.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);

  setStatus("Grades exported successfully!");
  setTimeout(() => setStatus("Ready"), 2000);
}

// Inline Editing Functions
let inlineEditEnabled = false;

function toggleInlineEditing() {
  inlineEditEnabled = !inlineEditEnabled;

  const toggleInlineEditElement = document.getElementById("toggleInlineEdit");
  const inlineEditInfoElement = document.getElementById("inlineEditInfo");

  if (toggleInlineEditElement) {
    toggleInlineEditElement.textContent = inlineEditEnabled
      ? "Disable Inline Editing"
      : "Enable Inline Editing";
  }

  if (inlineEditInfoElement) {
    inlineEditInfoElement.style.display = inlineEditEnabled ? "flex" : "none";
  }

  // Update all grade displays
  updateGradesPage();

  setStatus(
    inlineEditEnabled
      ? "Inline editing enabled - click on grades to edit"
      : "Inline editing disabled"
  );
  setTimeout(() => setStatus("Ready"), 2000);
}

function makeGradeEditable(element, courseIndex) {
  if (!inlineEditEnabled) return;

  element.classList.add("grade-editable");
  element.addEventListener("click", () =>
    editGradeInline(element, courseIndex)
  );
}

function makeCreditsEditable(element, courseIndex) {
  if (!inlineEditEnabled) return;

  element.classList.add("credits-editable");
  element.addEventListener("click", () =>
    editCreditsInline(element, courseIndex)
  );
}

function editGradeInline(element, courseIndex) {
  const course = courses[courseIndex];
  if (!course) return;

  element.classList.add("editing");

  const input = document.createElement("input");
  input.type = "number";
  input.className = "grade-input-inline";
  input.min = "0";
  input.max = "100";
  input.step = "0.1";
  input.value = course.grade || "";

  const originalValue = element.textContent;

  input.addEventListener("blur", () => {
    saveInlineGrade(input.value, courseIndex, element);
  });

  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      saveInlineGrade(input.value, courseIndex, element);
    } else if (e.key === "Escape") {
      element.textContent = originalValue;
      element.classList.remove("editing");
    }
  });

  element.textContent = "";
  element.appendChild(input);
  input.focus();
  input.select();
}

function editCreditsInline(element, courseIndex) {
  const course = courses[courseIndex];
  if (!course) return;

  element.classList.add("editing");

  const input = document.createElement("input");
  input.type = "number";
  input.className = "credits-input-inline";
  input.min = "0";
  input.step = "0.5";
  input.value = course.credits || 0;

  const originalValue = element.textContent;

  input.addEventListener("blur", () => {
    saveInlineCredits(input.value, courseIndex, element);
  });

  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      saveInlineCredits(input.value, courseIndex, element);
    } else if (e.key === "Escape") {
      element.textContent = originalValue;
      element.classList.remove("editing");
    }
  });

  element.textContent = "";
  element.appendChild(input);
  input.focus();
  input.select();
}

function saveInlineGrade(value, courseIndex, element) {
  const course = courses[courseIndex];
  if (!course) return;

  const grade = parseFloat(value);

  if (isNaN(grade) || grade < 0 || grade > 100) {
    element.textContent = course.grade || "-";
    element.classList.remove("editing");
    alert("Please enter a valid grade between 0 and 100.");
    return;
  }

  course.grade = grade;
  course.pass = false; // Clear pass flag when setting grade

  // Update display
  const gradeClass = getGradeClass(grade);
  element.textContent = grade.toFixed(1);
  element.className = `grade ${gradeClass} grade-editable`;

  // Save to Firebase
  persistCourses();

  // Update all displays
  updateTable();
  updateResults();
  updateDashboard();
  updateGradesPage();

  setStatus("Grade updated successfully!");
  setTimeout(() => setStatus("Ready"), 2000);
}

function saveInlineCredits(value, courseIndex, element) {
  const course = courses[courseIndex];
  if (!course) return;

  const credits = parseFloat(value);

  if (isNaN(credits) || credits < 0) {
    element.textContent = course.credits || 0;
    element.classList.remove("editing");
    alert("Please enter a valid number of credits.");
    return;
  }

  course.credits = credits;

  // Update display
  element.textContent = credits;
  element.classList.remove("editing");

  // Save to Firebase
  persistCourses();

  // Update all displays
  updateTable();
  updateResults();
  updateDashboard();
  updateGradesPage();

  setStatus("Credits updated successfully!");
  setTimeout(() => setStatus("Ready"), 2000);
}

// Course Management Functions
window.addCourse = function addCourse(event) {
  if (event) event.preventDefault();

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
    alert(
      "Please fill all fields: course, year, semester, and grade (unless Pass)."
    );
    return;
  }

  const semesterText = `${semester} ${year}`;
  courses.push({
    course,
    semester: semesterText,
    grade,
    credits,
    pass: passFlag,
  });

  updateTable();
  updateResults();
  persistCourses();

  // Update dashboard if on dashboard page
  if (currentPage === "dashboard") {
    updateDashboard();
  }

  // Update grades page if on grades page
  if (currentPage === "grades") {
    updateGradesPage();
  }

  // Update schedule semester options
  updateScheduleSemesterOptions();

  // Clear form
  document.getElementById("course").value = "";
  document.getElementById("year").value = "";
  document.getElementById("semester").value = "";
  gradeInput.value = "";
  document.getElementById("passFlag").checked = false;
  document.getElementById("credits").value = "";

  setStatus("Course added successfully!");
  setTimeout(() => setStatus("Ready"), 2000);
};

async function persistCourses() {
  if (!currentUser || !db) return;
  try {
    await setDoc(
      doc(db, "users", currentUser.uid),
      {
        courses,
        displayName: currentUser.displayName,
        email: currentUser.email,
        lastUpdated: new Date().toISOString(),
        compareOptOut: optOutCheckbox ? !!optOutCheckbox.checked : false,
      },
      { merge: true }
    );
  } catch (e) {
    console.error("Error saving courses", e);
  }
}

async function loadCourses() {
  if (!currentUser || !db) return;

  setStatus("Loading courses...");

  try {
    // Try new collection structure first
    const coursesRef = collection(db, "users", currentUser.uid, "courses");
    const coursesSnapshot = await getDocs(coursesRef);

    if (!coursesSnapshot.empty) {
      // New structure: courses in collection
      courses = [];
      coursesSnapshot.forEach((doc) => {
        courses.push({ id: doc.id, ...doc.data() });
      });
    } else {
      // Fallback to old structure: courses in single document
      const snap = await getDoc(doc(db, "users", currentUser.uid));
      if (snap.exists()) {
        courses = snap.data().courses || [];
        // Load opt-out preference
        if (optOutCheckbox && typeof snap.data().compareOptOut === "boolean") {
          optOutCheckbox.checked = snap.data().compareOptOut;
        }
      } else {
        courses = [];
      }
    }

    updateTable();
    updateResults();
    updateDashboard();
    updateGradesStatistics();
    updateComparePage();

    console.log("Courses loaded:", courses.length);
    setStatus("Ready");
  } catch (e) {
    console.error("Error loading courses", e);
    setStatus("Error loading courses");
  }
}

function updateTable() {
  // (Table hidden now, keep function minimal for compatibility)
  const blocksContainer = document.getElementById("semesterBlocks");
  if (!blocksContainer) return;
  blocksContainer.innerHTML = "";

  if (!courses.length) return;

  const orderMap = { A: 1, B: 2, Summer: 3 };
  const sorted = [...courses].sort((a, b) => {
    const [semA, yearA] = a.semester.split(" ");
    const [semB, yearB] = b.semester.split(" ");
    const yDiff = parseInt(yearA) - parseInt(yearB);
    if (yDiff !== 0) return yDiff;
    return (orderMap[semA] || 99) - (orderMap[semB] || 99);
  });

  const groups = {};
  for (const c of sorted) {
    (groups[c.semester] ||= []).push(c);
  }

  Object.entries(groups).forEach(([semester, list]) => {
    const totalCredits = list.reduce((s, c) => s + (c.credits || 0), 0);
    const gradedOnly = list.filter(
      (c) => !c.pass && c.grade !== null && !isNaN(c.grade)
    );
    const weightedSum = gradedOnly.reduce(
      (s, c) => s + c.grade * (c.credits || 0),
      0
    );
    const creditsWeighted = gradedOnly.reduce(
      (s, c) => s + (c.credits || 0),
      0
    );
    let avg = 0;
    if (creditsWeighted > 0) {
      avg = weightedSum / creditsWeighted;
    } else if (gradedOnly.length) {
      avg = gradedOnly.reduce((s, c) => s + c.grade, 0) / gradedOnly.length;
    } else {
      avg = 0;
    }
    const [semLabel, yearLabel] = semester.split(" ");
    const friendlyTitle = `Semester ${semLabel} year ${yearLabel}`;
    const block = document.createElement("div");
    block.className = "semester-block";
    block.innerHTML = `
            <h3>${friendlyTitle}</h3>
            <div class="semester-meta">${list.length} course${
      list.length !== 1 ? "s" : ""
    } • ${totalCredits} credits</div>
            <ul class="course-list"></ul>
            <div class="semester-summary"><strong>Average (Weighted):</strong> ${avg.toFixed(
              2
            )} | <strong>Credits:</strong> ${totalCredits}</div>
        `;
    const ul = block.querySelector(".course-list");

    list.forEach((courseObj) => {
      const li = document.createElement("li");
      li.className = "course-item";
      const gradeDisplay = courseObj.pass
        ? "P"
        : (courseObj.grade ?? "").toString();
      li.innerHTML = `
                <span class="label" title="${courseObj.course}">${
        courseObj.course
      }</span>
                ${
                  courseObj.pass
                    ? `<input type="text" class="grade-input" value="P" disabled />`
                    : `<input type=\"number\" class=\"grade-input\" min=\"0\" max=\"100\" value=\"${courseObj.grade}\" />`
                }
                <input type="number" class="credit-input" min="0" step="0.5" value="${
                  courseObj.credits
                }" />
                <button type="button" title="Remove">×</button>
            `;
      const gradeInput = li.querySelector(".grade-input");
      const creditInput = li.querySelector(".credit-input");
      const removeBtn = li.querySelector("button");

      function updateStyling() {
        if (courseObj.pass) {
          gradeInput.className = "grade-input editable-grade";
        } else {
          const g = parseFloat(gradeInput.value);
          gradeInput.className =
            "grade-input editable-grade " + getGradeClass(g);
        }
      }
      updateStyling();

      if (!courseObj.pass) {
        gradeInput.addEventListener("change", () => {
          const newVal = parseFloat(gradeInput.value);
          if (isNaN(newVal) || newVal < 0 || newVal > 100) {
            gradeInput.value = courseObj.grade;
            return;
          }
          courseObj.grade = newVal;
          updateStyling();
          persistCourses();
          updateResults();
          updateTable();
        });
      }

      creditInput.addEventListener("change", () => {
        const newVal = parseFloat(creditInput.value);
        if (isNaN(newVal) || newVal < 0) {
          creditInput.value = courseObj.credits;
          return;
        }
        courseObj.credits = newVal;
        persistCourses();
        updateResults();
        updateTable();
      });

      removeBtn.addEventListener("click", () => {
        courses = courses.filter((c) => c !== courseObj);
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
  const gpaElement = document.getElementById("gpa");
  const semesterMeansElement = document.getElementById("semesterMeans");

  if (courses.length === 0) {
    if (gpaElement) gpaElement.textContent = "GPA: - | Total Credits: -";
    if (semesterMeansElement) semesterMeansElement.innerHTML = "";
    return;
  }

  const graded = courses.filter(
    (c) => !c.pass && c.grade !== null && !isNaN(c.grade) && c.credits > 0
  );
  const totalCreditsAll = courses.reduce((sum, c) => sum + (c.credits || 0), 0);
  // Weighted GPA calculation
  const weightedSum = graded.reduce((sum, c) => sum + c.grade * c.credits, 0);
  const creditsWeighted = graded.reduce((sum, c) => sum + c.credits, 0);
  const gpa = creditsWeighted > 0 ? weightedSum / creditsWeighted : 0;

  // GPA without Judaism (weighted)
  const filtered = graded.filter(
    (c) => !c.course.toLowerCase().includes("judaism")
  );
  const weightedSumNoJudaism = filtered.reduce(
    (sum, c) => sum + c.grade * c.credits,
    0
  );
  const creditsWeightedNoJudaism = filtered.reduce(
    (sum, c) => sum + c.credits,
    0
  );
  const gpaNoJudaism =
    creditsWeightedNoJudaism > 0
      ? weightedSumNoJudaism / creditsWeightedNoJudaism
      : 0;
  const creditsNoJudaism = courses
    .filter((c) => !c.course.toLowerCase().includes("judaism"))
    .reduce((s, c) => s + (c.credits || 0), 0);
  if (gpaElement) {
    gpaElement.textContent = `GPA: ${
      graded.length ? gpa.toFixed(3) : "-"
    } | Total Credits: ${totalCreditsAll} | GPA w/o Judaism: ${
      filtered.length ? gpaNoJudaism.toFixed(3) : "-"
    } (Credits excl. Judaism: ${creditsNoJudaism})`;
  }

  const semesters = {};
  courses.forEach((c) => {
    if (c.pass || c.grade === null || isNaN(c.grade)) return;
    if (!semesters[c.semester]) semesters[c.semester] = [];
    semesters[c.semester].push(c.grade);
  });

  if (semesterMeansElement) {
    semesterMeansElement.innerHTML =
      "<strong>Semester Means:</strong><ul class='semester-list'></ul>";
    const ul = semesterMeansElement.querySelector("ul");

    for (const sem in semesters) {
      const mean =
        semesters[sem].reduce((a, b) => a + b, 0) / semesters[sem].length;
      const li = document.createElement("li");
      li.textContent = `${sem}: ${mean.toFixed(2)}`;
      ul.appendChild(li);
    }
  }
}

// Helper function to calculate GPA for a user's courses
function calculateGPA(userCourses) {
  if (!userCourses || userCourses.length === 0)
    return { gpa: 0, totalCredits: 0, courseCount: 0 };

  const graded = userCourses.filter(
    (c) => !c.pass && c.grade !== null && !isNaN(c.grade) && c.credits > 0
  );
  const totalCredits = userCourses.reduce(
    (sum, c) => sum + (c.credits || 0),
    0
  );

  if (graded.length === 0)
    return { gpa: 0, totalCredits, courseCount: userCourses.length };

  const weightedSum = graded.reduce((sum, c) => sum + c.grade * c.credits, 0);
  const creditsWeighted = graded.reduce((sum, c) => sum + c.credits, 0);
  const gpa = creditsWeighted > 0 ? weightedSum / creditsWeighted : 0;

  return { gpa, totalCredits, courseCount: userCourses.length };
}

// Fetch other users' data for comparison
async function fetchOtherUsersData() {
  if (compareFetchInProgress) return; // prevent parallel calls
  if (!db) {
    setStatus("DB not ready");
    return;
  }
  try {
    compareFetchInProgress = true;
    compareLoading.style.display = "block";
    compareContent.style.display = "none";
    const usersQuery = query(collection(db, "users"), limit(100));
    const querySnapshot = await getDocs(usersQuery);
    otherUsersData = [];
    querySnapshot.forEach((d) => {
      const userData = d.data();
      if (!userData) return;
      if (userData.courses && userData.courses.length) {
        if (currentUser && d.id === currentUser.uid) return; // skip self
        if (userData.compareOptOut) return; // respect opt-out
        const stats = calculateGPA(userData.courses);
        otherUsersData.push({
          uid: d.id,
          name:
            userData.displayName ||
            userData.email ||
            `User ${d.id.slice(0, 6)}`,
          courses: userData.courses,
          ...stats,
        });
      }
    });
    otherUsersData.sort((a, b) => b.gpa - a.gpa);
    lastCompareFetch = Date.now();
    displayComparisonData();
  } catch (err) {
    console.error("Compare fetch failed:", err);
    compareLoading.textContent = "Failed to load comparison data.";
  } finally {
    compareFetchInProgress = false;
  }
}

// Display comparison statistics and other users' data
function displayComparisonData() {
  console.log("displayComparisonData called"); // Debug

  // Handle grades page compare section
  if (compareLoading) compareLoading.style.display = "none";
  if (compareContent) compareContent.style.display = "block";

  // Handle dedicated compare page
  const compareLoading2 = document.getElementById("compareLoading2");
  const compareContent2 = document.querySelector(
    "#comparePage .compare-content"
  );
  if (compareLoading2) compareLoading2.style.display = "none";
  if (compareContent2) compareContent2.style.display = "block";

  if (otherUsersData.length === 0) {
    console.log("No other users data found"); // Debug
    const noDataMessage =
      '<div class="no-data">No other users with grades found for comparison.</div>';
    if (compareContent) compareContent.innerHTML = noDataMessage;
    if (compareContent2) compareContent2.innerHTML = noDataMessage;
    return;
  }

  console.log("Displaying data for", otherUsersData.length, "users"); // Debug

  // Calculate current user's stats (use default if not signed in)
  const currentStats = currentUser
    ? calculateGPA(courses)
    : { gpa: 0, totalCredits: 0, courseCount: 0 };

  // Calculate ranking
  const usersWithGPA = otherUsersData.filter((u) => u.gpa > 0);
  const betterUsers = usersWithGPA.filter(
    (u) => u.gpa > currentStats.gpa
  ).length;
  const totalUsers = usersWithGPA.length + (currentStats.gpa > 0 ? 1 : 0);
  const rank = betterUsers + 1;
  const percentile =
    totalUsers > 1
      ? Math.round(((totalUsers - rank) / (totalUsers - 1)) * 100)
      : 100;

  // Calculate averages
  const avgGPA =
    usersWithGPA.length > 0
      ? usersWithGPA.reduce((sum, u) => sum + u.gpa, 0) / usersWithGPA.length
      : 0;
  const avgCredits =
    otherUsersData.reduce((sum, u) => sum + u.totalCredits, 0) /
    otherUsersData.length;

  // Display comparison stats for both pages
  const compareStats = document.getElementById("compareStats");
  const compareStats2 = document.getElementById("compareStats2");

  const statsHTML = currentUser
    ? `
        <div class="stat-card">
            <h4>Your Rank</h4>
            <div class="stat-value ${
              rank <= Math.ceil(totalUsers * 0.25)
                ? "rank-good"
                : rank <= Math.ceil(totalUsers * 0.75)
                ? "rank-average"
                : "rank-low"
            }">
                ${rank} / ${totalUsers}
            </div>
        </div>
        <div class="stat-card">
            <h4>Percentile</h4>
            <div class="stat-value ${
              percentile >= 75
                ? "rank-good"
                : percentile >= 50
                ? "rank-average"
                : "rank-low"
            }">
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
    `
    : `
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

  if (compareStats) compareStats.innerHTML = statsHTML;
  if (compareStats2) compareStats2.innerHTML = statsHTML;

  // Display other users for both pages
  const otherUsersGrid = document.getElementById("otherUsersGrid");
  const otherUsersGrid2 = document.getElementById("otherUsersGrid2");

  const createUserGrid = (gridElement) => {
    if (!gridElement) return;

    gridElement.innerHTML = "";

    // Show top 20 users to prevent overwhelming the UI
    const displayUsers = otherUsersData.slice(0, 20);

    displayUsers.forEach((user, index) => {
      const userCard = document.createElement("div");
      userCard.className = "user-card";
      userCard.tabIndex = 0;
      userCard.setAttribute("role", "button");
      userCard.setAttribute("aria-label", `View ${user.name}'s courses`);

      const gpaClass =
        currentUser && user.gpa >= currentStats.gpa
          ? "rank-good"
          : user.gpa >= avgGPA
          ? "rank-average"
          : "rank-low";
      const difference = currentUser ? user.gpa - currentStats.gpa : 0;

      userCard.innerHTML = `
              <div class="user-header">
                  <div class="user-name">${user.name}</div>
                  <div class="user-gpa ${gpaClass}">${user.gpa.toFixed(3)}</div>
              </div>
              <div class="user-details">
                  <div><strong>Rank:</strong> #${index + 1}</div>
                  <div><strong>Total Credits:</strong> ${
                    user.totalCredits
                  }</div>
                  <div><strong>Courses:</strong> ${user.courseCount}</div>
                  ${
                    currentUser
                      ? `<div><strong>Difference:</strong> ${
                          difference > 0 ? "+" : ""
                        }${difference.toFixed(3)}</div>`
                      : ""
                  }
              </div>
          `;

      // Click/keyboard to open peer modal
      function openPeer() {
        openPeerModal(user);
      }
      userCard.addEventListener("click", openPeer);
      userCard.addEventListener("keypress", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPeer();
        }
      });
      gridElement.appendChild(userCard);
    });

    if (otherUsersData.length > 20) {
      const moreInfo = document.createElement("div");
      moreInfo.className = "no-data";
      moreInfo.innerHTML = `... and ${otherUsersData.length - 20} more users`;
      gridElement.appendChild(moreInfo);
    }
  };

  createUserGrid(otherUsersGrid);
  createUserGrid(otherUsersGrid2);

  console.log("Comparison data displayed successfully"); // Debug
}

// Show/hide compare section based on auth state
function toggleCompareSection(show) {
  if (!compareSection) return;
  compareVisible = !!show;
  if (compareVisible) {
    compareSection.style.display = "block";
  } else {
    compareSection.style.display = "none";
  }
  if (compareToggleBtn) {
    compareToggleBtn.textContent = compareVisible
      ? "✖ Hide Comparison"
      : "🏆 Compare Grades";
    compareToggleBtn.setAttribute(
      "aria-expanded",
      compareVisible ? "true" : "false"
    );
    compareToggleBtn.setAttribute(
      "aria-pressed",
      compareVisible ? "true" : "false"
    );
  }
}

// Create test data for demonstration
function createTestData() {
  console.log("Creating test data..."); // Debug
  otherUsersData = [
    {
      uid: "test1",
      name: "Alice Johnson",
      gpa: 88.5,
      totalCredits: 120,
      courseCount: 24,
      courses: [],
    },
    {
      uid: "test2",
      name: "Bob Smith",
      gpa: 92.3,
      totalCredits: 115,
      courseCount: 23,
      courses: [],
    },
    {
      uid: "test3",
      name: "Charlie Brown",
      gpa: 85.7,
      totalCredits: 110,
      courseCount: 22,
      courses: [],
    },
    {
      uid: "test4",
      name: "Diana Ross",
      gpa: 94.2,
      totalCredits: 125,
      courseCount: 25,
      courses: [],
    },
    {
      uid: "test5",
      name: "Ethan Hunt",
      gpa: 79.8,
      totalCredits: 105,
      courseCount: 21,
      courses: [],
    },
  ];

  // Sort by GPA descending
  otherUsersData.sort((a, b) => b.gpa - a.gpa);
  console.log("Test data created:", otherUsersData.length, "users"); // Debug
}

function attachEventListeners() {
  // Course form submission
  const courseForm = document.getElementById("courseForm");
  if (courseForm) {
    courseForm.addEventListener("submit", addCourse);
  }

  // Schedule form submission
  // Old form event listener removed - now using dynamic modals

  // Schedule creation button removed

  // Edit schedule button
  const editScheduleBtn = document.getElementById("editScheduleBtn");
  if (editScheduleBtn) {
    editScheduleBtn.addEventListener("click", toggleEditMode);
  }

  // Save schedule button removed

  // Old modal event listeners removed - now using inline interface

  // Schedule semester change
  const scheduleYearSelect = document.getElementById("scheduleYear");
  const scheduleSemesterSelect = document.getElementById("scheduleSemester");
  if (scheduleYearSelect) {
    scheduleYearSelect.addEventListener(
      "change",
      showScheduleCreationInterface
    );
  }
  if (scheduleSemesterSelect) {
    scheduleSemesterSelect.addEventListener(
      "change",
      showScheduleCreationInterface
    );
  }

  // Add course buttons and edit buttons
  document.addEventListener("click", function (e) {
    // Make sure we catch the button even if the icon is clicked
    const editBtn = e.target.closest(".edit-btn");
    const addBtn = e.target.closest(".add-course-btn");
    const viewCourse = e.target.closest(".view-mode-course");

    if (addBtn) {
      e.preventDefault();
      e.stopPropagation();
      const day = addBtn.getAttribute("data-day");
      const time = addBtn.getAttribute("data-time");
      openAddCourseModal(day, time);
    } else if (editBtn) {
      e.preventDefault();
      e.stopPropagation();
      const courseId = editBtn.getAttribute("data-course-id");
      editCourse(courseId);
    } else if (viewCourse) {
      e.preventDefault();
      e.stopPropagation();
      const courseId = viewCourse.getAttribute("data-course-id");
      showCourseDetails(courseId);
    }
  });

  // Grade management event listeners
  if (manageGradesBtn) {
    manageGradesBtn.addEventListener("click", openGradeModal);
  }

  if (gradeModalClose) {
    gradeModalClose.addEventListener("click", closeGradeModal);
  }

  if (gradeSemesterFilter) {
    gradeSemesterFilter.addEventListener("change", () => {
      updateGradesTable();
      updateGradeSummary();
    });
  }

  if (addNewGradeBtn) {
    addNewGradeBtn.addEventListener("click", () => {
      closeGradeModal();
      // Navigate to dashboard and focus on course form
      navigateToPage("dashboard");
      setTimeout(() => {
        const courseInput = document.getElementById("course");
        if (courseInput) {
          courseInput.focus();
          courseInput.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    });
  }

  if (bulkEditBtn) {
    bulkEditBtn.addEventListener("click", () => {
      alert("Bulk edit feature coming soon!");
    });
  }

  if (exportGradesBtn) {
    exportGradesBtn.addEventListener("click", exportGrades);
  }

  if (selectAllGrades) {
    selectAllGrades.addEventListener("change", (e) => {
      const checkboxes = document.querySelectorAll(".grade-checkbox");
      checkboxes.forEach((cb) => (cb.checked = e.target.checked));
    });
  }

  // Quick grade edit event listeners
  if (quickGradeModalClose) {
    quickGradeModalClose.addEventListener("click", closeQuickGradeModal);
  }

  if (quickGradeCancelBtn) {
    quickGradeCancelBtn.addEventListener("click", closeQuickGradeModal);
  }

  if (quickGradeForm) {
    quickGradeForm.addEventListener("submit", saveGradeEdit);
  }

  if (editPassFlag) {
    editPassFlag.addEventListener("change", updateGradeInputVisibility);
  }

  // Inline editing event listeners
  if (toggleInlineEdit) {
    toggleInlineEdit.addEventListener("click", toggleInlineEditing);
  }

  if (addQuickGrade) {
    addQuickGrade.addEventListener("click", () => {
      // Navigate to dashboard and focus on course form
      navigateToPage("dashboard");
      setTimeout(() => {
        const courseInput = document.getElementById("course");
        if (courseInput) {
          courseInput.focus();
          courseInput.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    });
  }

  // Close modals on outside click
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) {
      if (e.target.id === "scheduleModal") {
        closeScheduleModal();
      } else if (e.target.id === "gradeModal") {
        closeGradeModal();
      } else if (e.target.id === "quickGradeModal") {
        closeQuickGradeModal();
      }
    }
    if (e.target.classList.contains("peer-modal")) {
      closePeerModal();
    }
  });

  // Google sign-in listener
  if (signInBtn) {
    signInBtn.addEventListener("click", async () => {
      if (!auth || !provider) {
        alert("Auth not ready yet.");
        setStatus("Auth not ready");
        return;
      }

      // Try popup first, fallback to redirect
      try {
        setStatus("Opening sign-in popup...");

        // Clear any existing popup blockers
        if (window.opener) {
          window.opener.close();
        }

        // Add timeout to prevent stuck popups
        const popupPromise = signInWithPopup(auth, provider);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Popup timeout")), 15000)
        );

        await Promise.race([popupPromise, timeoutPromise]);
        setStatus("Signed in");
        // Hide redirect button if it was shown
        hidePopupHelp();
      } catch (e) {
        console.error("Sign-in popup failed:", e);

        // If popup fails, automatically show redirect option
        setStatus("Popup failed. Use redirect button below.");
        showPopupHelp();

        // Show specific error messages
        if (
          e.code === "auth/popup-blocked" ||
          e.code === "auth/popup-closed-by-user" ||
          e.code === "auth/cancelled-popup-request"
        ) {
          setStatus("Popup blocked by browser. Use redirect button below.");
        } else if (e.code === "auth/operation-not-allowed") {
          alert("Enable Google provider in Firebase console.");
        } else if (e.code === "auth/unauthorized-domain") {
          alert("Add this domain to Authorized domains in Firebase console.");
        } else if (e.code === "auth/network-request-failed") {
          setStatus("Network error. Check your connection.");
        } else if (e.message === "Popup timeout") {
          setStatus("Popup timed out. Use redirect button below.");
        } else {
          setStatus("Sign-in error: " + (e.code || e.message));
        }
      }
    });
  }

  // Google sign-up listener
  if (signUpBtn) {
    signUpBtn.addEventListener("click", async () => {
      if (!auth || !provider) {
        alert("Auth not ready yet.");
        setStatus("Auth not ready");
        return;
      }

      // Try popup first, fallback to redirect
      try {
        setStatus("Opening sign-up popup...");

        // Clear any existing popup blockers
        if (window.opener) {
          window.opener.close();
        }

        // Configure provider for sign-up
        provider.setCustomParameters({
          prompt: "select_account",
        });

        // Add timeout to prevent stuck popups
        const popupPromise = signInWithPopup(auth, provider);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Popup timeout")), 15000)
        );

        const result = await Promise.race([popupPromise, timeoutPromise]);
        setStatus("Signed up and signed in");

        // For new users, create their document immediately
        if (result.additionalUserInfo?.isNewUser) {
          await setDoc(
            doc(db, "users", result.user.uid),
            {
              courses: [],
              displayName: result.user.displayName,
              email: result.user.email,
              lastUpdated: new Date().toISOString(),
              compareOptOut: false,
            },
            { merge: true }
          );
          setStatus("New account created successfully");
        }

        // Hide redirect button if it was shown
        hidePopupHelp();
      } catch (e) {
        console.error("Sign-up popup failed:", e);

        // If popup fails, automatically show redirect option
        setStatus("Popup failed. Use redirect button below.");
        showPopupHelp();

        // Show specific error messages
        if (
          e.code === "auth/popup-blocked" ||
          e.code === "auth/popup-closed-by-user" ||
          e.code === "auth/cancelled-popup-request"
        ) {
          setStatus("Popup blocked by browser. Use redirect button below.");
        } else if (e.code === "auth/operation-not-allowed") {
          alert("Enable Google provider in Firebase console.");
        } else if (e.code === "auth/unauthorized-domain") {
          alert("Add this domain to Authorized domains in Firebase console.");
        } else if (e.code === "auth/network-request-failed") {
          setStatus("Network error. Check your connection.");
        } else if (e.message === "Popup timeout") {
          setStatus("Popup timed out. Use redirect button below.");
        } else {
          setStatus("Sign-up error: " + (e.code || e.message));
        }
      }
    });
  }

  if (signInRedirectBtn) {
    signInRedirectBtn.addEventListener("click", async () => {
      if (!auth || !provider) {
        setStatus("Auth not ready");
        return;
      }
      setStatus("Redirecting to Google...");
      try {
        await signInWithRedirect(auth, provider);
      } catch (e) {
        console.error("Redirect sign-in failed:", e);
        setStatus("Redirect sign-in failed: " + (e.code || e.message));
      }
    });
  }

  // Sign-out listener
  if (signOutBtn) {
    signOutBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      if (!auth) {
        setStatus("Auth not ready");
        return;
      }

      if (!auth.currentUser) {
        setStatus("No user to sign out");
        return;
      }

      signOutBtn.disabled = true;
      setStatus("Signing out...");

      try {
        await signOut(auth);

        // Reload page to ensure clean state
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (error) {
        setStatus("Sign out error: " + (error.code || error.message));

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
    refreshCompareBtn.addEventListener("click", fetchOtherUsersData);
  }

  // Refresh compare button listener for compare page
  const refreshCompareBtn2 = document.getElementById("refreshCompareBtn2");
  if (refreshCompareBtn2) {
    refreshCompareBtn2.addEventListener("click", fetchOtherUsersData);
  }

  // Compare toggle button listener
  if (compareToggleBtn) {
    compareToggleBtn.addEventListener("click", async () => {
      if (!compareVisible) {
        const stale = Date.now() - lastCompareFetch > 60_000;
        if (stale || otherUsersData.length === 0) {
          await fetchOtherUsersData();
        }
        toggleCompareSection(true);
        setTimeout(() => {
          compareSection?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 40);
      } else {
        toggleCompareSection(false);
      }
    });
  }

  if (peerModalClose) {
    peerModalClose.addEventListener("click", closePeerModal);
  }

  // Opt-out preference change
  if (optOutCheckbox) {
    optOutCheckbox.addEventListener("change", async () => {
      if (!currentUser || !db) return;
      try {
        await setDoc(
          doc(db, "users", currentUser.uid),
          {
            compareOptOut: !!optOutCheckbox.checked,
            lastUpdated: new Date().toISOString(),
          },
          { merge: true }
        );
        // If user opts out while visible remove them by refetching
        if (compareVisible) {
          fetchOtherUsersData();
        }
      } catch (e) {
        console.error("Failed to save opt-out preference", e);
      }
    });
  }
}

function attachAuthListeners() {
  if (!auth) {
    console.error("Cannot attach auth listeners - auth not initialized");
    return;
  }

  onAuthStateChanged(auth, (user) => {
    currentUser = user;

    if (user) {
      // Update user info in sidebar
      if (userName) userName.textContent = user.displayName || user.email;
      if (userStatus) userStatus.textContent = "Signed in";

      // Show/hide auth buttons
      if (signInBtn) signInBtn.style.display = "none";
      if (signUpBtn) signUpBtn.style.display = "none";
      if (signInRedirectBtn) signInRedirectBtn.style.display = "none";
      if (signOutBtn) {
        signOutBtn.style.display = "flex";
        signOutBtn.disabled = false;
      }

      // Enable course functionality
      if (addCourseBtn) addCourseBtn.disabled = false;
      if (optOutContainer) optOutContainer.style.display = "flex";

      setStatus("Authenticated. Loading courses...");
      loadCourses();
      loadSchedules(); // Load schedules for authenticated user
      toggleCompareSection(false); // Start with compare section hidden
      hidePopupHelp(); // Hide popup help on successful auth

      // Update current page if needed
      if (currentPage) {
        loadPageData(currentPage);
      }
    } else {
      // Update user info in sidebar
      if (userName) userName.textContent = "Guest User";
      if (userStatus) userStatus.textContent = "Not signed in";

      // Show/hide auth buttons
      if (signInBtn) signInBtn.style.display = "flex";
      if (signUpBtn) signUpBtn.style.display = "flex";
      if (signInRedirectBtn) signInRedirectBtn.style.display = "none";
      if (signOutBtn) {
        signOutBtn.style.display = "none";
        signOutBtn.disabled = false;
      }

      // Disable course functionality
      if (addCourseBtn) addCourseBtn.disabled = true;
      if (optOutContainer) optOutContainer.style.display = "none";

      // Clear data
      courses = [];
      schedules = [];
      updateTable();
      updateResults();
      toggleCompareSection(false);

      // Update current page
      if (currentPage) {
        loadPageData(currentPage);
      }

      setStatus("Signed out");
    }
  });
}

function initFirebase() {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);

    provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: "select_account",
    });

    db = getFirestore(app);

    isSupported().then((s) => {
      if (s) {
        getAnalytics(app);
      }
    });

    setStatus("Firebase initialized. Waiting for auth state...");

    // Check for popup blockers and show redirect button if needed
    if (detectPopupBlocker()) {
      setStatus("Popup blocker detected. Use redirect button for sign-in.");
      showPopupHelp();
    }

    attachAuthListeners();
    attachEventListeners();

    // Check for redirect result (user returning from Google sign-in)
    getRedirectResult(auth)
      .then((result) => {
        if (result && result.user) {
          setStatus("Signed in via redirect");
          hidePopupHelp();
        }
      })
      .catch((e) => {
        if (e.code !== "auth/no-auth-event") {
          console.error("Redirect result error:", e.code, e.message);
        }
      });
  } catch (e) {
    console.error("Firebase init failed:", e);
    setStatus("Firebase init failed: " + e.message);
    alert("Firebase initialization failed. Check console for details.");
  }
}

// DOM ready - initialize everything
document.addEventListener("DOMContentLoaded", () => {
  initializeDOM();
  initFirebase();
});

// Fallback if DOMContentLoaded already fired
if (document.readyState !== "loading") {
  initializeDOM();
  initFirebase();
}

// Build peer modal content
function openPeerModal(user) {
  if (!peerModal || !peerModalBody) return;
  const courses = user.courses || [];
  // Derive per-semester breakdown
  const semesterGroups = {};
  courses.forEach((c) => {
    const sem = c.semester || "Unknown";
    (semesterGroups[sem] ||= []).push(c);
  });
  // Global stats
  const stats = calculateGPA(courses);
  const graded = courses.filter(
    (c) => !c.pass && c.grade != null && !isNaN(c.grade)
  );
  const avgRaw = graded.length
    ? (graded.reduce((s, c) => s + c.grade, 0) / graded.length).toFixed(2)
    : "-";
  let chipsHtml = `
        <div class="peer-summary">
            <div class="peer-chip"><strong>Name</strong><span>${
              user.name
            }</span></div>
            <div class="peer-chip"><strong>GPA</strong><span>${
              stats.gpa ? stats.gpa.toFixed(2) : "-"
            }</span></div>
            <div class="peer-chip"><strong>Credits</strong><span>${
              stats.totalCredits
            }</span></div>
            <div class="peer-chip"><strong>Courses</strong><span>${
              stats.courseCount
            }</span></div>
            <div class="peer-chip"><strong>Avg Grade</strong><span>${avgRaw}</span></div>
        </div>`;
  // Table rows
  let rows = "";
  if (courses.length) {
    // Sort by semester (year numeric then A,B,Summer order)
    const orderMap = { A: 1, B: 2, Summer: 3 };
    const sorted = [...courses].sort((a, b) => {
      const [sa, ya] = (a.semester || "").split(" ");
      const [sb, yb] = (b.semester || "").split(" ");
      const yDiff = (parseInt(ya) || 0) - (parseInt(yb) || 0);
      if (yDiff !== 0) return yDiff;
      return (orderMap[sa] || 99) - (orderMap[sb] || 99);
    });
    sorted.forEach((c) => {
      const gradeClass = c.pass ? "" : getGradeClass(c.grade);
      rows += `<tr>
                <td title="${c.course}">${c.course}</td>
                <td>${formatSemesterDisplay(c.semester)}</td>
                <td>${
                  c.pass
                    ? '<span class="pass-badge">PASS</span>'
                    : `<span class="grade-badge ${gradeClass}">${c.grade}</span>`
                }</td>
                <td>${c.credits || 0}</td>
            </tr>`;
    });
  }
  peerModalBody.innerHTML = `
        ${chipsHtml}
        ${
          courses.length
            ? `<div style="overflow:auto; max-height:380px;">
            <table class="peer-courses-table">
                <thead><tr><th>Course</th><th>Semester</th><th>Grade</th><th>Credits</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`
            : `<div class="no-peer-courses">No courses available for this user.</div>`
        }
    `;
  peerModal.style.display = "flex";
  // Focus for accessibility
  setTimeout(() => {
    peerModal.querySelector(".peer-modal-close")?.focus();
  }, 50);
  // Close on outside click
  function outside(e) {
    if (e.target === peerModal) {
      closePeerModal();
    }
  }
  peerModal.addEventListener("click", outside, { once: true });
  // Esc key
  function esc(e) {
    if (e.key === "Escape") {
      closePeerModal();
      document.removeEventListener("keydown", esc);
    }
  }
  document.addEventListener("keydown", esc);
}

function closePeerModal() {
  if (peerModal) peerModal.style.display = "none";
}

// Initialize the app when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM loaded, initializing app...");

  // Initialize Firebase
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  provider = new GoogleAuthProvider();
  db = getFirestore(app);

  // Initialize DOM elements
  initializeDOM();

  // Set up authentication state listener
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUser = user;
      console.log("User authenticated:", user.email);
      setStatus("Authenticated. Loading courses...");
      loadCourses();
      loadSchedules();
      updateUserInfo();
    } else {
      currentUser = null;
      console.log("User not authenticated");
      setStatus("Not signed in");
      showSignIn();
    }
  });

  // Set up event listeners
  attachEventListeners();

  console.log("App initialized successfully");
});

// Initialize DOM elements - duplicate removed

// Load courses from Firebase - updated to use new collection structure

// Load schedules from localStorage - duplicate removed

// Update user info display
function updateUserInfo() {
  if (!currentUser) return;

  if (userInfo) {
    userInfo.innerHTML = `
      <div class="user-details">
        <img src="${currentUser.photoURL}" alt="Profile" class="user-avatar">
        <div class="user-text">
          <div class="user-name">${currentUser.displayName}</div>
          <div class="user-email">${currentUser.email}</div>
        </div>
      </div>
    `;
  }

  if (signInBtn) signInBtn.style.display = "none";
  if (signOutBtn) signOutBtn.style.display = "block";
}

// Show sign-in interface
function showSignIn() {
  if (signInBtn) signInBtn.style.display = "block";
  if (signOutBtn) signOutBtn.style.display = "none";
  if (userInfo) userInfo.innerHTML = "";

  // Clear data
  courses = [];
  schedules = [];
  updateResults();
  updateDashboard();
  updateScheduleDisplay();
}
