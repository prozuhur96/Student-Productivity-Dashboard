// --- Import Firebase SDKs from CDN ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    updateDoc,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Your Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyCqeKNnVoQH_pJ7R9blqYjuQG5OF5DDkVY",
    authDomain: "student-productivity-das-f8c60.firebaseapp.com",
    projectId: "student-productivity-das-f8c60",
    storageBucket: "student-productivity-das-f8c60.firebasestorage.app",
    messagingSenderId: "816861609216",
    appId: "1:816861609216:web:5440aa31aa7ec3735307e5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// App State
let tasks = [];
let currentUser = null;
let userProfile = { name: 'Student', major: 'General Studies' };
let currentScheduleDate = new Date();

// --- Authentication State & UI Toggle ---
document.addEventListener('DOMContentLoaded', () => {
    initAuthListener();
    initAuthForm();
    initNavigation();
    initProfile();
    initTaskForm();
});

function initAuthListener() {
    const authContainer = document.getElementById('auth-container');
    const mainContent = document.querySelector('main');
    const headerContent = document.querySelector('header');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            // Hide auth overlay, show app
            if (authContainer) authContainer.classList.add('hidden');
            if (mainContent) mainContent.classList.remove('hidden');
            if (headerContent) headerContent.classList.remove('hidden');

            // Load user profile & tasks from Firestore
            await loadUserData(user.uid);
            renderProfile();
            renderAll();
        } else {
            currentUser = null;
            // Show auth overlay, hide app
            if (authContainer) authContainer.classList.remove('hidden');
            if (mainContent) mainContent.classList.add('hidden');
            if (headerContent) headerContent.classList.add('hidden');
        }
    });
}

function initAuthForm() {
    const authForm = document.getElementById('auth-form');
    const authEmail = document.getElementById('auth-email');
    const authPassword = document.getElementById('auth-password');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authSubtitle = document.getElementById('auth-subtitle');
    const authToggleBtn = document.getElementById('auth-toggle-btn');
    const authTogglePrompt = document.getElementById('auth-toggle-prompt');
    const forgotPasswordBtn = document.getElementById('forgot-password-btn'); // <-- ADD THIS

    let isSignUp = false;

    // Toggle between Log In and Sign Up mode
    if (authToggleBtn) {
        authToggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isSignUp = !isSignUp;
            if (isSignUp) {
                authSubtitle.textContent = 'Create an account to get started';
                authSubmitBtn.textContent = 'Sign Up';
                authTogglePrompt.textContent = 'Already have an account?';
                authToggleBtn.textContent = 'Log In';
            } else {
                authSubtitle.textContent = 'Log in to sync your tasks';
                authSubmitBtn.textContent = 'Log In';
                authTogglePrompt.textContent = "Don't have an account?";
                authToggleBtn.textContent = 'Sign Up';
            }
        });
    }

    // Handle form submission
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = authEmail.value.trim();
            const password = authPassword.value.trim();

            try {
                if (isSignUp) {
                    await createUserWithEmailAndPassword(auth, email, password);
                } else {
                    await signInWithEmailAndPassword(auth, email, password);
                }
            } catch (error) {
                alert('Authentication Error: ' + error.message);
            }
        });
    }

    // --- ADD THE PASSWORD RESET LISTENER HERE ---
    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = authEmail ? authEmail.value.trim() : '';

            if (!email) {
                alert('Please enter your email address in the email field above first, then click "Forgot Password?".');
                return;
            }

            try {
                await sendPasswordResetEmail(auth, email);
                alert(`Password reset email sent to ${email}. Check your inbox!`);
            } catch (error) {
                console.error("Error sending password reset email:", error);
                alert(`Error: ${error.message}`);
            }
        });
    }
}
// --- Firestore Data Sync ---
async function loadUserData(uid) {
    try {
        // Fetch tasks for this specific user
        const q = query(collection(db, 'tasks'), where('uid', '==', uid));
        const querySnapshot = await getDocs(q);
        tasks = [];
        querySnapshot.forEach((docSnap) => {
            tasks.push({ firestoreId: docSnap.id, ...docSnap.data() });
        });

        // Fetch user profile
        const profileDoc = await getDocs(query(collection(db, 'profiles'), where('uid', '==', uid)));
        if (!profileDoc.empty) {
            userProfile = profileDoc.docs[0].data();
        }
    } catch (error) {
        console.error("Error loading data from Firestore:", error);
    }
}

// --- SPA Navigation Logic ---
function initNavigation() {
    const navButtons = document.querySelectorAll('header nav button');
    const views = document.querySelectorAll('main > section');

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetView = button.getAttribute('data-view');
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            views.forEach(view => {
                if (view.id === `${targetView}-view`) {
                    view.classList.remove('hidden');
                } else {
                    view.classList.add('hidden');
                }
            });
        });
    });
}

// --- Profile Management & Cloud Sync ---
function initProfile() {
    const welcomeNameSpan = document.getElementById('welcome-user-name');
    const profileNameDisplay = document.getElementById('profile-name-display');
    const profileMajorDisplay = document.getElementById('profile-major-display');
    const usernameInput = document.getElementById('username-input');
    const majorInput = document.getElementById('major-input');
    const profileForm = document.getElementById('profile-form');
    const avatarDisplay = document.getElementById('avatar-display');
    const toggleEditBtn = document.getElementById('toggle-edit-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // Populate UI with current user profile data
    if (userProfile.name) {
        if (welcomeNameSpan) welcomeNameSpan.textContent = `, ${userProfile.name}`;
        if (profileNameDisplay) profileNameDisplay.textContent = userProfile.name;
        if (usernameInput) usernameInput.value = userProfile.name;
        if (avatarDisplay) avatarDisplay.textContent = userProfile.name.charAt(0).toUpperCase();
    }

    if (userProfile.major) {
        if (profileMajorDisplay) profileMajorDisplay.textContent = userProfile.major;
        if (majorInput) majorInput.value = userProfile.major;
    }

    // Toggle Edit Form Visibility
    if (toggleEditBtn && profileForm) {
        toggleEditBtn.addEventListener('click', () => {
            profileForm.classList.toggle('hidden');
            toggleEditBtn.textContent = profileForm.classList.contains('hidden') ? 'Edit Profile' : 'Cancel';
        });
    }

    // Handle Profile Form Submission & Cloud Sync
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return;

            userProfile.name = usernameInput.value.trim() || 'Student';
            userProfile.major = majorInput.value.trim() || 'General Studies';
            userProfile.uid = currentUser.uid;

            // Update UI elements instantly
            if (welcomeNameSpan) welcomeNameSpan.textContent = `, ${userProfile.name}`;
            if (profileNameDisplay) profileNameDisplay.textContent = userProfile.name;
            if (profileMajorDisplay) profileMajorDisplay.textContent = userProfile.major;
            if (avatarDisplay) avatarDisplay.textContent = userProfile.name.charAt(0).toUpperCase();

            // Hide the form and reset the edit button text after saving
            profileForm.classList.add('hidden');
            if (toggleEditBtn) toggleEditBtn.textContent = 'Edit Profile';

            // Save to Firestore
            try {
                const profilesRef = collection(db, 'profiles');
                const q = query(profilesRef, where('uid', '==', currentUser.uid));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const docId = querySnapshot.docs[0].id;
                    await updateDoc(doc(db, 'profiles', docId), userProfile);
                } else {
                    await addDoc(profilesRef, userProfile);
                }
                alert('Profile saved to cloud successfully!');
            } catch (error) {
                console.error("Error saving profile:", error);
            }
        });
    }

    // Handle Logout Session
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
            } catch (error) {
                console.error("Error signing out:", error);
            }
        });
    }
}

// --- Task Management & Firestore Sync ---
function initTaskForm() {
    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const taskDate = document.getElementById('task-date');
    const taskTime = document.getElementById('task-time');

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentHourStr = String(now.getHours()).padStart(2, '0') + ':00';

    if (taskDate) taskDate.value = todayStr;
    if (taskTime) taskTime.value = currentHourStr;

    if (taskForm) {
        taskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return;

            const newTask = {
                uid: currentUser.uid,
                id: Date.now(),
                text: taskInput.value.trim(),
                date: taskDate.value,
                time: taskTime ? taskTime.value : '09:00',
                completed: false
            };

            try {
                const docRef = await addDoc(collection(db, 'tasks'), newTask);
                newTask.firestoreId = docRef.id;
                tasks.push(newTask);
                renderAll();

                taskInput.value = '';
                if (taskDate) taskDate.value = todayStr;
                if (taskTime) taskTime.value = currentHourStr;
            } catch (error) {
                console.error("Error adding task:", error);
            }
        });
    }
}


// --- Tasks List Rendering ---
function renderTasksList() {
    const taskList = document.getElementById('task-list');
    if (!taskList) return;

    taskList.innerHTML = '';
    if (tasks.length === 0) {
        taskList.innerHTML = '<p class="placeholder-text">No tasks added yet. Create one above!</p>';
        return;
    }

    const sortedTasks = [...tasks].sort((a, b) => {
        return new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`);
    });

    sortedTasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;

        li.innerHTML = `
            <div>
                <input type="checkbox" ${task.completed ? 'checked' : ''} onclick="toggleTask('${task.firestoreId}')">
                <span>${task.text}</span>
                <small style="display: block; color: var(--text-light); margin-left: 1.5rem;">
                    Due: ${task.date} ${task.time ? 'at ' + task.time : ''}
                </small>
            </div>
            <button onclick="deleteTask('${task.firestoreId}')" style="background: none; border: none; color: #ff9aa2; cursor: pointer; font-weight: bold;">Delete</button>
        `;
        taskList.appendChild(li);
    });
}


function renderProfile() {
    const welcomeNameSpan = document.getElementById('welcome-user-name');
    const profileNameDisplay = document.getElementById('profile-name-display');
    const profileMajorDisplay = document.getElementById('profile-major-display');
    const usernameInput = document.getElementById('username-input');
    const majorInput = document.getElementById('major-input');
    const avatarDisplay = document.getElementById('avatar-display');

    if (userProfile.name) {
        if (welcomeNameSpan) welcomeNameSpan.textContent = `, ${userProfile.name}`;
        if (profileNameDisplay) profileNameDisplay.textContent = userProfile.name;
        if (usernameInput) usernameInput.value = userProfile.name;
        if (avatarDisplay) avatarDisplay.textContent = userProfile.name.charAt(0).toUpperCase();
    }

    if (userProfile.major) {
        if (profileMajorDisplay) profileMajorDisplay.textContent = userProfile.major;
        if (majorInput) majorInput.value = userProfile.major;
    }
}

window.toggleTask = async function(firestoreId) {
    const task = tasks.find(t => t.firestoreId === firestoreId);
    if (!task) return;

    task.completed = !task.completed;
    renderAll();

    try {
        await updateDoc(doc(db, 'tasks', firestoreId), { completed: task.completed });
    } catch (error) {
        console.error("Error updating task status:", error);
    }
};

window.deleteTask = async function(firestoreId) {
    tasks = tasks.filter(t => t.firestoreId !== firestoreId);
    renderAll();

    try {
        await deleteDoc(doc(db, 'tasks', firestoreId));
    } catch (error) {
        console.error("Error deleting task:", error);
    }
};

// --- Render Statistics, Today, Upcoming, Calendar, Daily Schedule ---
function renderStatistics() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const todayStr = new Date().toISOString().split('T')[0];
    const dueToday = tasks.filter(t => t.date === todayStr && !t.completed).length;
    const outstanding = total - completed;

    if (document.getElementById('stats-completed')) document.getElementById('stats-completed').textContent = completed;
    if (document.getElementById('stats-total')) document.getElementById('stats-total').textContent = total;
    if (document.getElementById('stats-due-today')) document.getElementById('stats-due-today').textContent = dueToday;
    if (document.getElementById('stats-outstanding')) document.getElementById('stats-outstanding').textContent = outstanding;
}

function renderTodaysTasks() {
    const list = document.getElementById('todays-tasks-list');
    if (!list) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const todaysTasks = tasks.filter(t => t.date === todayStr);

    list.innerHTML = '';
    if (todaysTasks.length === 0) {
        list.innerHTML = '<li class="placeholder-text">No tasks due today.</li>';
        return;
    }

    todaysTasks.forEach(task => {
        const li = document.createElement('li');
        li.className = task.completed ? 'completed' : '';
        li.textContent = `• ${task.text} ${task.time ? '(' + task.time + ')' : ''}`;
        list.appendChild(li);
    });
}

function renderUpcomingDeadlines() {
    const list = document.getElementById('upcoming-deadlines-list');
    if (!list) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const upcoming = tasks
        .filter(t => t.date >= todayStr && !t.completed)
        .sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`))
        .slice(0, 4);

    list.innerHTML = '';
    if (upcoming.length === 0) {
        list.innerHTML = '<li class="placeholder-text">No upcoming deadlines!</li>';
        return;
    }

    upcoming.forEach(task => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${task.date}:</strong> ${task.text}`;
        list.appendChild(li);
    });
}

function renderCalendar() {
    const calendarContainer = document.getElementById('calendar-container');
    if (!calendarContainer) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const todayDate = now.getDate();
    const currentMonthName = now.toLocaleString('default', { month: 'long' });

    const taskDates = new Set(tasks.filter(t => !t.completed).map(t => t.date));

    let html = `<div style="font-weight: 600; text-align: center; margin-bottom: 0.5rem; color: #2d3748;">${currentMonthName} ${year}</div>`;
    html += `<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; font-size: 0.85rem;">`;

    ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(d => {
        html += `<div style="color: var(--text-light); font-weight: bold;">${d}</div>`;
    });

    for (let i = 0; i < firstDayIndex; i++) {
        html += `<div></div>`;
    }

    for (let day = 1; day <= totalDays; day++) {
        const formattedMonth = String(month + 1).padStart(2, '0');
        const formattedDay = String(day).padStart(2, '0');
        const dateString = `${year}-${formattedMonth}-${formattedDay}`;

        const hasTask = taskDates.has(dateString);
        const isToday = day === todayDate;

        let style = `padding: 4px 0; border-radius: 4px;`;
        if (isToday) style += ` background-color: var(--accent-color); font-weight: bold;`;
        if (hasTask && !isToday) style += ` border: 1px dashed var(--primary-color); background-color: #f0fff4;`;

        html += `<div style="${style}">${day}</div>`;
    }

    html += `</div>`;
    calendarContainer.innerHTML = html;
}

function renderDailySchedule() {
    const scheduleWidget = document.querySelector('.daily-schedule');
    if (!scheduleWidget) return;

    const options = { weekday: 'long', month: 'short', day: 'numeric' };

    // Check if currentScheduleDate is actually today
    const today = new Date();
    const isToday = currentScheduleDate.getDate() === today.getDate() &&
                    currentScheduleDate.getMonth() === today.getMonth() &&
                    currentScheduleDate.getFullYear() === today.getFullYear();

    // Format the base date string (e.g., "Sunday, Oct 18")
    const formattedDateStr = currentScheduleDate.toLocaleDateString('en-US', options);

    // Only prepend "Today" if it's actually today
    const headerTitle = isToday ? `Today — ${formattedDateStr}` : formattedDateStr;

    // Format as YYYY-MM-DD to match task.date strings
    const year = currentScheduleDate.getFullYear();
    const month = String(currentScheduleDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentScheduleDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const scheduledTasks = tasks.filter(t => t.date === dateStr);

    // Build HTML header with navigation arrows and Today button
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #edf2f7; padding-bottom: 0.5rem; margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <button id="prev-day-btn" style="background: none; border: 1px solid #cbd5e0; border-radius: 4px; padding: 0.2rem 0.6rem; cursor: pointer; font-weight: bold;">&larr;</button>
                <h3 style="margin: 0; border: none; padding: 0;">${headerTitle}</h3>
                <button id="next-day-btn" style="background: none; border: 1px solid #cbd5e0; border-radius: 4px; padding: 0.2rem 0.6rem; cursor: pointer; font-weight: bold;">&rarr;</button>
            </div>
            <button id="today-btn" style="background: var(--accent-color); border: none; border-radius: 4px; padding: 0.3rem 0.6rem; font-size: 0.8rem; font-weight: 600; cursor: pointer;">Today</button>
        </div>
    `;

    html += `<div class="schedule-timeline" style="max-height: 350px; overflow-y: auto; padding-right: 5px;">`;

    for (let i = 0; i < 24; i++) {
        const displayHour = i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`;
        const tasksInThisHour = scheduledTasks.filter(t => t.time && t.time.startsWith(String(i).padStart(2, '0')));

        html += `
            <div style="display: flex; border-bottom: 1px solid #edf2f7; padding: 0.5rem 0; align-items: flex-start;">
                <div style="width: 80px; font-size: 0.85rem; color: var(--text-light); font-weight: 600; padding-top: 2px;">
                    ${displayHour}
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
        `;

        if (tasksInThisHour.length > 0) {
            tasksInThisHour.forEach(task => {
                const textDecoration = task.completed ? 'line-through' : 'none';
                const opacity = task.completed ? '0.6' : '1';
                html += `
                    <div style="background-color: var(--primary-color); padding: 4px 8px; border-radius: 6px; font-size: 0.9rem; text-decoration: ${textDecoration}; opacity: ${opacity};">
                        ${task.text} <span style="font-size: 0.75rem; opacity: 0.8;">(${task.time})</span>
                    </div>
                `;
            });
        } else {
            html += `<span style="color: #cbd5e0; font-size: 0.85rem; font-style: italic;">—</span>`;
        }

        html += `</div></div>`;
    }

    html += `</div>`;
    scheduleWidget.innerHTML = html;

    // Attach event listeners for date navigation buttons
    document.getElementById('prev-day-btn').addEventListener('click', () => {
        currentScheduleDate.setDate(currentScheduleDate.getDate() - 1);
        renderDailySchedule();
    });

    document.getElementById('next-day-btn').addEventListener('click', () => {
        currentScheduleDate.setDate(currentScheduleDate.getDate() + 1);
        renderDailySchedule();
    });

    document.getElementById('today-btn').addEventListener('click', () => {
        currentScheduleDate = new Date();
        renderDailySchedule();
    });
}

function renderProfileDetails() {
    const emailDisplay = document.getElementById('profile-email-display');
    const memberSinceDisplay = document.getElementById('profile-member-since');
    const totalCompletedDisplay = document.getElementById('profile-total-completed');

    if (currentUser) {
        // 1. Set Email from Firebase Auth
        if (emailDisplay) emailDisplay.textContent = currentUser.email || 'N/A';

        // 2. Extract Member Since Date from Firebase metadata
        if (memberSinceDisplay && currentUser.metadata && currentUser.metadata.creationTime) {
            const creationDate = new Date(currentUser.metadata.creationTime);
            memberSinceDisplay.textContent = creationDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    }

    // 3. Count total completed tasks
    if (totalCompletedDisplay) {
        const completedCount = tasks.filter(t => t.completed === true || t.completed === "true" || t.done === true).length;
        totalCompletedDisplay.textContent = completedCount;
    }
}

// Quote Logic
const motivationalQuotes = [
    "“The secret of getting ahead is getting started.” - Mark Twain",
    "“It always seems impossible until it's done.” - Nelson Mandela",
    "“Don't watch the clock; do what it does. Keep going.” - Sam Levenson",
    "“Success is the sum of small efforts, repeated day in and day out.” - Robert Collier",
    "“Your education is an investment in your future.”",
    "“Focus on being productive instead of busy.” - Tim Ferriss",
    "“Small progress each day adds up to big results.”",
    "“Education is the passport to the future, for tomorrow belongs to those who prepare for it today.” - Malcolm X",
    "“Start where you are. Use what you have. Do what you can.” - Arthur Ashe",
    "“The expert in anything was once a beginner.” - Helen Hayes",
    "“Doubt kills more dreams than failure ever will.” - Suzy Kassem",
    "“Push yourself, because no one else is going to do it for you.”"
];

function renderMotivationalQuote() {
    const quoteElement = document.getElementById('motivational-quote');
    if (quoteElement) {
        const randomIndex = Math.floor(Math.random() * motivationalQuotes.length);
        quoteElement.textContent = motivationalQuotes[randomIndex];
    }
}

function renderAll() {
    renderTasksList();
    renderStatistics();
    renderTodaysTasks();
    renderUpcomingDeadlines();
    renderCalendar();
    renderDailySchedule();
    renderProfileDetails();
    renderMotivationalQuote();
}