/* ==========================================
   FAMILY CHORE DASHBOARD - LOGIC
   ========================================== */

// --- Constants & State ---
const STORAGE_KEYS = {
    KIDS: 'chorestar_kids',
    CHORES: 'chorestar_chores',
    ACTIVE_CHORES: 'chorestar_active_chores',
    REWARDS: 'chorestar_rewards',
    LAST_RESET: 'chorestar_last_reset',
    EVENTS: 'chorestar_events',
    PARENT_PIN: 'chorestar_parent_pin'
};

let state = {
    kids: [],
    chores: [],
    activeChores: [],
    rewards: [],
    events: [],
    parentPin: '',
    lastResetDate: ''
};

// Helper for dynamic seeding of calendar dates
function getRelativeDateString(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// --- Initial Demo Data Seed ---
const DEMO_DATA = {
    kids: [
        { id: 'kid-one', name: 'Kid 1', color: '#ec4899', points: 0, role: 'kid', avatar: '🦄' },
        { id: 'kid-two', name: 'Kid 2', color: '#3b82f6', points: 0, role: 'kid', avatar: '🎮' },
        { id: 'parent-one', name: 'Parent 1', color: '#6366f1', points: 0, role: 'parent', avatar: '👨' },
        { id: 'parent-two', name: 'Parent 2', color: '#f97316', points: 0, role: 'parent', avatar: '👩' }
    ],
    chores: [
        { id: 'chore-1', title: 'Make your bed', points: 5, frequency: 'daily', kidId: 'all' },
        { id: 'chore-2', title: 'Brush teeth & wash face', points: 5, frequency: 'daily', kidId: 'all' },
        { id: 'chore-3', title: 'Empty dishwasher', points: 10, frequency: 'daily', kidId: 'all' },
        { id: 'chore-4', title: 'Put out trash bins', points: 15, frequency: 'days', daysOfWeek: ['Tue', 'Fri'], kidId: 'all' },
        { id: 'chore-5', title: 'Clean bedroom', points: 25, frequency: 'weekly', kidId: 'all' }
    ],
    rewards: [
        { id: 'reward-1', title: '30 min Screen Time', cost: 30 },
        { id: 'reward-2', title: 'Ice Cream Sundae', cost: 50 },
        { id: 'reward-3', title: 'Stay up 30 min late', cost: 60 },
        { id: 'reward-4', title: 'New Toy under $10', cost: 100 }
    ],
    events: [
        { id: 'event-1', title: 'Kid 1: Soccer Practice', date: getRelativeDateString(0), time: '5:00 PM', color: '#ec4899' },
        { id: 'event-2', title: 'Kid 2: Dentist Appointment', date: getRelativeDateString(1), time: '10:00 AM', color: '#3b82f6' },
        { id: 'event-3', title: 'Family Movie Night 🍿', date: getRelativeDateString(2), time: '7:00 PM', color: '#10b981' }
    ],
    parentPin: '',
    lastResetDate: ''
};

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initClock();
    checkDailyReset();
    renderDashboard();
    renderSidebarEventsList();
    initEventListeners();
    initWakeLock();
    lucide.createIcons();
});

// --- Data Management (LocalStorage) ---
function loadData() {
    try {
        const storedKids = localStorage.getItem(STORAGE_KEYS.KIDS);
        const storedChores = localStorage.getItem(STORAGE_KEYS.CHORES);
        const storedActive = localStorage.getItem(STORAGE_KEYS.ACTIVE_CHORES);
        const storedRewards = localStorage.getItem(STORAGE_KEYS.REWARDS);
        const storedReset = localStorage.getItem(STORAGE_KEYS.LAST_RESET);
        const storedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
        const storedPin = localStorage.getItem(STORAGE_KEYS.PARENT_PIN);

        if (storedKids && storedChores) {
            state.kids = JSON.parse(storedKids);
            // Ensure kids have role and avatar, migrate old data
            state.kids.forEach(k => {
                if (!k.role) k.role = 'kid';
                if (!k.avatar) {
                    if (k.name === 'Kid 1') k.avatar = '🦄';
                    else if (k.name === 'Kid 2') k.avatar = '🎮';
                    else if (k.name === 'Parent 1') k.avatar = '👨';
                    else if (k.name === 'Parent 2') k.avatar = '👩';
                    else k.avatar = k.name.charAt(0).toUpperCase();
                }
            });
            state.chores = JSON.parse(storedChores);
            state.activeChores = storedActive ? JSON.parse(storedActive) : [];
            state.rewards = storedRewards ? JSON.parse(storedRewards) : [];
            const parsedEvents = storedEvents ? JSON.parse(storedEvents) : [];
            if (!storedEvents || parsedEvents.length === 0) {
                state.events = [...DEMO_DATA.events];
            } else {
                state.events = parsedEvents;
            }
            state.parentPin = storedPin || '';
            state.lastResetDate = storedReset || '';
        } else {
            // Seed with Demo Data first time
            state = { ...DEMO_DATA };
            state.lastResetDate = getTodayString();
            saveAllToStorage();
        }
    } catch (e) {
        console.error("Error reading localStorage, using blank state", e);
        state = { kids: [], chores: [], activeChores: [], rewards: [], events: [], parentPin: '', lastResetDate: getTodayString() };
    }
}

function saveAllToStorage() {
    localStorage.setItem(STORAGE_KEYS.KIDS, JSON.stringify(state.kids));
    localStorage.setItem(STORAGE_KEYS.CHORES, JSON.stringify(state.chores));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CHORES, JSON.stringify(state.activeChores));
    localStorage.setItem(STORAGE_KEYS.REWARDS, JSON.stringify(state.rewards));
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(state.events));
    localStorage.setItem(STORAGE_KEYS.PARENT_PIN, state.parentPin);
    localStorage.setItem(STORAGE_KEYS.LAST_RESET, state.lastResetDate);
}

// --- Date / Time Utilities ---
function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function initClock() {
    const updateTime = () => {
        const now = new Date();
        
        // Time format
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        
        document.getElementById('current-time').innerText = `${hours}:${minutes} ${ampm}`;
        
        // Date format
        const options = { weekday: 'long', month: 'long', day: 'numeric' };
        document.getElementById('current-date').innerText = now.toLocaleDateString('en-US', options);
    };
    
    updateTime();
    setInterval(updateTime, 1000 * 60); // update every minute
}

// --- Daily Chore Reset Check ---
function checkDailyReset() {
    const today = getTodayString();
    if (state.lastResetDate !== today) {
        // Day has changed! Reset daily chores
        resetDailyChoresForNewDay(today);
    } else if (state.activeChores.length === 0 && state.kids.length > 0) {
        // No active chores initialized for today yet
        initializeActiveChores(today);
    }
}

function resetDailyChoresForNewDay(todayDate) {
    console.log("New day detected. Resetting daily and scheduled chores.");
    
    const parts = todayDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const isMonday = d.getDay() === 1; // 1 is Monday
    
    // Filter out yesterday's daily and specific-days chores, keep weekly chores depending on if it's Monday
    const weeklyToKeep = isMonday 
        ? [] 
        : state.activeChores.filter(c => c.frequency === 'weekly');
        
    state.activeChores = [...weeklyToKeep];
    state.lastResetDate = todayDate;
    
    // Generate new daily instances for all chores assigned
    initializeActiveChores(todayDate);
}

function initializeActiveChores(dateStr) {
    const today = dateStr || getTodayString();
    
    // Determine day of the week
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const parts = today.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayOfWeekStr = days[d.getDay()];
    
    state.chores.forEach(chore => {
        // Check if chore should run today
        let shouldAdd = false;
        if (chore.frequency === 'daily') {
            shouldAdd = true;
        } else if (chore.frequency === 'weekly') {
            shouldAdd = true;
        } else if (chore.frequency === 'days') {
            shouldAdd = chore.daysOfWeek && chore.daysOfWeek.includes(dayOfWeekStr);
        }
        
        if (!shouldAdd) return;
        
        const addChoreForKid = (kidId) => {
            // Check if chore instance already exists for today
            const exists = state.activeChores.some(ac => 
                ac.choreId === chore.id && ac.kidId === kidId && ac.dateAssigned === today
            );
            
            if (!exists) {
                state.activeChores.push({
                    id: `${kidId}-${chore.id}-${today}`,
                    choreId: chore.id,
                    kidId: kidId,
                    title: chore.title,
                    points: parseInt(chore.points) || 5,
                    frequency: chore.frequency,
                    daysOfWeek: chore.daysOfWeek || [],
                    completed: false,
                    dateAssigned: today
                });
            }
        };

        if (chore.kidId === 'all') {
            state.kids.forEach(kid => addChoreForKid(kid.id));
        } else {
            // Confirm kid still exists before adding
            if (state.kids.some(k => k.id === chore.kidId)) {
                addChoreForKid(chore.kidId);
            }
        }
    });

    saveAllToStorage();
}

// --- Custom Dialog Modal Helper ---
function showConfirm(title, message) {
    return new Promise((resolve) => {
        const dialog = document.getElementById('dialog-confirm');
        document.getElementById('dialog-title').innerText = title;
        document.getElementById('dialog-message').innerText = message;
        dialog.classList.remove('hidden');
        
        const btnYes = document.getElementById('dialog-btn-yes');
        const btnNo = document.getElementById('dialog-btn-no');
        
        const cleanup = (value) => {
            dialog.classList.add('hidden');
            btnYes.onclick = null;
            btnNo.onclick = null;
            resolve(value);
        };
        
        btnYes.onclick = () => cleanup(true);
        btnNo.onclick = () => cleanup(false);
    });
}

// --- Render Functions ---
function renderDashboard() {
    const kidsGrid = document.getElementById('kids-grid');
    const emptyState = document.getElementById('empty-state');
    
    kidsGrid.innerHTML = '';
    
    if (state.kids.length === 0) {
        emptyState.classList.remove('hidden');
        kidsGrid.classList.add('hidden');
        updateFamilyProgressCircle(0, 0);
        return;
    }
    
    emptyState.classList.add('hidden');
    kidsGrid.classList.remove('hidden');
    
    let totalChoresCount = 0;
    let totalCompletedCount = 0;
    
    state.kids.forEach(kid => {
        // Ensure role exists
        const role = kid.role || 'kid';
        
        // Filter active chores for this kid
        const kidChores = state.activeChores.filter(ac => ac.kidId === kid.id);
        const completedChores = kidChores.filter(ac => ac.completed);
        
        totalChoresCount += kidChores.length;
        totalCompletedCount += completedChores.length;
        
        const isAllDone = kidChores.length > 0 && kidChores.length === completedChores.length;
        
        // Calculate kid percentage
        const progressPercentage = kidChores.length > 0 
            ? Math.round((completedChores.length / kidChores.length) * 100) 
            : 0;

        // Create kid card
        const card = document.createElement('div');
        card.className = `kid-card ${isAllDone ? 'all-done' : ''} ${role === 'parent' ? 'parent-role' : ''}`;
        card.style.setProperty('--kid-accent-color', kid.color);
        
        // Role sub-text/badge
        const roleLabel = role === 'parent' ? 'Parent' : 'Kid';
        
        // Points Badge (Kids only)
        const scoreBadgeHTML = role !== 'parent' 
            ? `
            <div class="kid-score-badge">
                <span class="kid-score-val" id="score-val-${kid.id}">${kid.points}</span>
                <span class="kid-score-lbl">Points</span>
            </div>
            `
            : '';
            
        // Card Header
        let cardHTML = `
            <div class="kid-card-header">
                <div class="kid-info">
                    <div class="kid-avatar">${kid.avatar || kid.name.charAt(0).toUpperCase()}</div>
                    <div class="kid-name-container">
                        <span class="kid-name">${kid.name} <span style="font-size:0.8rem; font-weight:500; opacity:0.6;">(${roleLabel})</span></span>
                        <span class="kid-sub-stat">${completedChores.length}/${kidChores.length} Chores Done</span>
                    </div>
                </div>
                ${scoreBadgeHTML}
            </div>
            
            <div class="kid-progress-bar-container">
                <div class="kid-progress-header">
                    <span>Daily Progress</span>
                    <span>${progressPercentage}%</span>
                </div>
                <div class="kid-progress-track">
                    <div class="kid-progress-fill" style="width: ${progressPercentage}%"></div>
                </div>
            </div>
        `;
        
        // Congrats Banner if All Done
        if (isAllDone) {
            cardHTML += `
                <div class="congrats-card">
                    <h4><i data-lucide="trophy"></i> Awesome Job!</h4>
                    <p>All chores completed for today! 🎉</p>
                </div>
            `;
        }
        
        // Chores List
        cardHTML += `<div class="chores-list">`;
        if (kidChores.length === 0) {
            cardHTML += `<div style="text-align:center; color:var(--text-dim); padding: 1.5rem; font-size: 0.95rem;">No chores assigned today.</div>`;
        } else {
            kidChores.forEach(chore => {
                // Formatting frequency badge text
                let frequencyText = chore.frequency;
                if (chore.frequency === 'days') {
                    frequencyText = (chore.daysOfWeek && chore.daysOfWeek.length > 0) 
                        ? chore.daysOfWeek.join(', ') 
                        : 'Scheduled';
                }
                
                // Points indicators (Kids only)
                const pointsIndicatorHTML = role !== 'parent'
                    ? `<div class="chore-right"><span class="chore-points">+${chore.points}</span></div>`
                    : '';
                    
                cardHTML += `
                    <div class="chore-item ${chore.completed ? 'completed' : ''}" onclick="toggleChore('${chore.id}')">
                        <div class="chore-left">
                            <div class="chore-checkbox">
                                <i data-lucide="check"></i>
                            </div>
                            <div>
                                <div class="chore-title">${chore.title}</div>
                                <div class="chore-badge-row">
                                    <span class="chore-frequency-badge">${frequencyText}</span>
                                </div>
                            </div>
                        </div>
                        ${pointsIndicatorHTML}
                    </div>
                `;
            });
        }
        cardHTML += `</div>`; // Close chores-list
        
        // Rewards Section (Claiming - Kids only)
        if (state.rewards.length > 0 && role !== 'parent') {
            cardHTML += `
                <h4 class="rewards-section-title">Claim Rewards</h4>
                <div class="rewards-grid-small">
            `;
            
            state.rewards.forEach(reward => {
                const canAfford = kid.points >= reward.cost;
                cardHTML += `
                    <div class="reward-claim-card ${!canAfford ? 'disabled' : ''}" 
                         onclick="${canAfford ? `claimReward('${kid.id}', '${reward.id}')` : ''}">
                        <div class="reward-claim-title">${reward.title}</div>
                        <div class="reward-claim-footer">
                            <span class="reward-cost-tag">${reward.cost} pts</span>
                            <span class="claim-indicator">${canAfford ? 'Claim' : 'Locked'}</span>
                        </div>
                    </div>
                `;
            });
            
            cardHTML += `</div>`; // Close rewards-grid-small
        }
        
        card.innerHTML = cardHTML;
        kidsGrid.appendChild(card);
    });
    
    // Update Family-wide Progress stats
    updateFamilyProgressCircle(totalCompletedCount, totalChoresCount);
    
    // Refresh icons
    lucide.createIcons();
}

function updateFamilyProgressCircle(completed, total) {
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    document.getElementById('family-percentage').innerText = `${percentage}%`;
    document.getElementById('family-done').innerText = completed;
    document.getElementById('family-total').innerText = total;
    
    const ring = document.getElementById('family-progress-ring');
    const radius = ring.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    
    ring.style.strokeDasharray = `${circumference} ${circumference}`;
    
    // Calculate the stroke dash offset
    const offset = circumference - (percentage / 100) * circumference;
    ring.style.strokeDashoffset = offset;
}

// --- Interaction Logics ---
function toggleChore(activeChoreId) {
    const choreIndex = state.activeChoreInstancesIndex = state.activeChores.findIndex(c => c.id === activeChoreId);
    if (choreIndex === -1) return;
    
    const activeChore = state.activeChores[choreIndex];
    activeChore.completed = !activeChore.completed;
    
    // Adjust kid points (Kids only)
    const kidIndex = state.kids.findIndex(k => k.id === activeChore.kidId);
    if (kidIndex !== -1) {
        const kid = state.kids[kidIndex];
        if (kid.role !== 'parent') {
            const pointsDiff = activeChore.completed ? activeChore.points : -activeChore.points;
            kid.points = Math.max(0, kid.points + pointsDiff);
        }
    }
    
    saveAllToStorage();
    
    // Fun particles
    if (activeChore.completed) {
        // Small confetti pop
        confetti({
            particleCount: 40,
            spread: 50,
            origin: { y: 0.75 }
        });
        
        // Check if this makes the kid completely done with all their chores
        const kidChores = state.activeChores.filter(ac => ac.kidId === activeChore.kidId);
        const kidDone = kidChores.every(ac => ac.completed);
        if (kidDone) {
            // Trigger massive celebration after a tiny delay for visual flow
            setTimeout(celebrateKidCompletion, 300);
        }
    }
    
    renderDashboard();
}

function celebrateKidCompletion() {
    const duration = 2.5 * 1000;
    const end = Date.now() + duration;
    
    (function frame() {
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
        });
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
        });
        
        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}

async function claimReward(kidId, rewardId) {
    const kid = state.kids.find(k => k.id === kidId);
    const reward = state.rewards.find(r => r.id === rewardId);
    
    if (!kid || !reward || kid.points < reward.cost) return;
    
    const confirmText = `Deduct ${reward.cost} points from ${kid.name} for "${reward.title}"?`;
    const confirmed = await showConfirm("Claim Reward?", confirmText);
    
    if (confirmed) {
        // Deduct points
        kid.points -= reward.cost;
        saveAllToStorage();
        
        // Explode purple reward confetti!
        confetti({
            particleCount: 80,
            spread: 80,
            colors: ['#a855f7', '#d8b4fe', '#f3e8ff'],
            origin: { y: 0.6 }
        });
        
        renderDashboard();
    }
}

// --- Tab Navigation in Settings ---
window.switchTab = function(tabName) {
    const tabs = ['kids', 'chores', 'calendar', 'rewards'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        const content = document.getElementById(`tab-content-${t}`);
        
        if (t === tabName) {
            if (btn) btn.classList.add('active');
            if (content) content.classList.remove('hidden');
        } else {
            if (btn) btn.classList.remove('active');
            if (content) content.classList.add('hidden');
        }
    });
    
    if (tabName === 'kids') renderSettingsKidsList();
    if (tabName === 'chores') renderSettingsChoresList();
    if (tabName === 'calendar') renderSettingsEventsList();
    if (tabName === 'rewards') {
        renderSettingsRewardsList();
        updatePinSecurityUI();
    }
};

// --- Settings Section: Kids CRUD ---
window.showAddKidForm = function() {
    document.getElementById('kid-form').classList.remove('hidden');
    document.getElementById('edit-kid-id').value = '';
    document.getElementById('kid-name').value = '';
    document.getElementById('kid-role').value = 'kid';
    
    // Safely uncheck current active colors
    const activeColor = document.querySelector('input[name="kid-color"]:checked');
    if (activeColor) activeColor.checked = false;
    
    const defaultColor = document.querySelector('input[name="kid-color"][value="#ef4444"]');
    if (defaultColor) defaultColor.checked = true; // default red
    
    // Safely uncheck current active avatars
    const activeAvatar = document.querySelector('input[name="kid-avatar"]:checked');
    if (activeAvatar) activeAvatar.checked = false;
    
    const defaultAvatar = document.querySelector('input[name="kid-avatar"][value="🦄"]');
    if (defaultAvatar) defaultAvatar.checked = true; // default unicorn
};

window.hideKidForm = function() {
    document.getElementById('kid-form').classList.add('hidden');
};

window.saveKid = function(event) {
    event.preventDefault();
    const id = document.getElementById('edit-kid-id').value;
    const name = document.getElementById('kid-name').value.trim();
    const role = document.getElementById('kid-role').value;
    
    const colorRadio = document.querySelector('input[name="kid-color"]:checked');
    const color = colorRadio ? colorRadio.value : '#ef4444';
    
    const avatarRadio = document.querySelector('input[name="kid-avatar"]:checked');
    const avatar = avatarRadio ? avatarRadio.value : '🦄';
    
    if (id) {
        // Edit Mode
        const kid = state.kids.find(k => k.id === id);
        if (kid) {
            kid.name = name;
            kid.role = role;
            kid.color = color;
            kid.avatar = avatar;
        }
    } else {
        // Add Mode
        const newId = `kid-${Date.now()}`;
        state.kids.push({
            id: newId,
            name: name,
            role: role,
            color: color,
            avatar: avatar,
            points: 0
        });
    }
    
    saveAllToStorage();
    checkDailyReset(); // update chores instances for new kids
    hideKidForm();
    renderSettingsKidsList();
    renderDashboard();
    populateChoreKidSelect();
};

function renderSettingsKidsList() {
    const container = document.getElementById('kids-list-container');
    container.innerHTML = '';
    
    if (state.kids.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:var(--text-dim); padding:1rem;">No profiles yet.</div>`;
        return;
    }
    
    state.kids.forEach(kid => {
        const roleLabel = kid.role === 'parent' ? 'Parent' : 'Kid';
        const ptsText = kid.role === 'parent' ? 'No points' : `${kid.points} pts`;
        
        const item = document.createElement('div');
        item.className = 'settings-list-item';
        item.innerHTML = `
            <div class="settings-list-item-info">
                <div class="kid-avatar" style="background-color: ${kid.color}; width: 40px; height: 40px; font-size: 1.1rem;">
                    ${kid.avatar || kid.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <strong>${kid.name} <span style="font-size:0.75rem; opacity:0.6; font-weight:normal;">(${roleLabel})</span></strong>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${ptsText}</div>
                </div>
            </div>
            <div class="settings-item-actions">
                <button onclick="editKid('${kid.id}')" class="icon-only-btn edit"><i data-lucide="edit-3"></i></button>
                <button onclick="deleteKid('${kid.id}')" class="icon-only-btn delete"><i data-lucide="trash-2"></i></button>
            </div>
        `;
        container.appendChild(item);
    });
    lucide.createIcons();
}

window.editKid = function(id) {
    const kid = state.kids.find(k => k.id === id);
    if (!kid) return;
    
    document.getElementById('edit-kid-id').value = kid.id;
    document.getElementById('kid-name').value = kid.name;
    document.getElementById('kid-role').value = kid.role || 'kid';
    
    // Normalize color value for case-insensitive matching
    const colorVal = (kid.color || '#ef4444').toLowerCase();
    const radio = document.querySelector(`input[name="kid-color"][value="${colorVal}"]`);
    if (radio) {
        radio.checked = true;
    } else {
        const firstRadio = document.querySelector('input[name="kid-color"]');
        if (firstRadio) firstRadio.checked = true;
    }
    
    // Set checked state of the avatar emoji
    const avatarVal = kid.avatar || '🦄';
    const avatarRadio = document.querySelector(`input[name="kid-avatar"][value="${avatarVal}"]`);
    if (avatarRadio) {
        avatarRadio.checked = true;
    } else {
        const firstAvatar = document.querySelector('input[name="kid-avatar"]');
        if (firstAvatar) firstAvatar.checked = true;
    }
    
    document.getElementById('kid-form').classList.remove('hidden');
};

window.deleteKid = async function(id) {
    const kid = state.kids.find(k => k.id === id);
    if (!kid) return;
    
    const confirmed = await showConfirm("Delete Member Profile?", `Delete ${kid.name}? All points and assigned daily chores will be removed.`);
    if (confirmed) {
        state.kids = state.kids.filter(k => k.id !== id);
        // Remove active chore instances for this kid
        state.activeChores = state.activeChores.filter(ac => ac.kidId !== id);
        // Clean up chores templates specifically assigned to this kid, or reset them?
        state.chores = state.chores.filter(c => c.kidId !== id);
        
        saveAllToStorage();
        renderSettingsKidsList();
        renderDashboard();
        populateChoreKidSelect();
    }
};

// --- Settings Section: Chores CRUD ---
window.showAddChoreForm = function() {
    document.getElementById('chore-form').classList.remove('hidden');
    document.getElementById('edit-chore-id').value = '';
    document.getElementById('chore-title').value = '';
    document.getElementById('chore-points').value = '10';
    document.getElementById('chore-kid').value = 'all';
    document.getElementById('chore-frequency').value = 'daily';
    document.getElementById('chore-days-container').classList.add('hidden');
    document.querySelectorAll('input[name="chore-days"]').forEach(cb => cb.checked = false);
};

window.hideChoreForm = function() {
    document.getElementById('chore-form').classList.add('hidden');
};

function populateChoreKidSelect() {
    const select = document.getElementById('chore-kid');
    select.innerHTML = '<option value="all">Everyone (Creates chore for each member)</option>';
    
    state.kids.forEach(kid => {
        select.innerHTML += `<option value="${kid.id}">${kid.name}</option>`;
    });
}

window.handleChoreFrequencyChange = function() {
    const freq = document.getElementById('chore-frequency').value;
    const container = document.getElementById('chore-days-container');
    if (freq === 'days') {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
        document.querySelectorAll('input[name="chore-days"]').forEach(cb => cb.checked = false);
    }
};

window.saveChore = function(event) {
    event.preventDefault();
    const id = document.getElementById('edit-chore-id').value;
    const title = document.getElementById('chore-title').value.trim();
    const points = parseInt(document.getElementById('chore-points').value);
    const kidId = document.getElementById('chore-kid').value;
    const frequency = document.getElementById('chore-frequency').value;
    
    const daysOfWeek = [];
    if (frequency === 'days') {
        document.querySelectorAll('input[name="chore-days"]:checked').forEach(cb => {
            daysOfWeek.push(cb.value);
        });
    }
    
    if (id) {
        // Edit Mode - Update template
        const chore = state.chores.find(c => c.id === id);
        if (chore) {
            chore.title = title;
            chore.points = points;
            chore.kidId = kidId;
            chore.frequency = frequency;
            chore.daysOfWeek = daysOfWeek;
        }
        
        // Also update existing today's active chore instances if they match
        state.activeChores = state.activeChores.map(ac => {
            if (ac.choreId === id) {
                return {
                    ...ac,
                    title: title,
                    points: points,
                    frequency: frequency,
                    daysOfWeek: daysOfWeek
                };
            }
            return ac;
        });
    } else {
        // Add Mode
        const newId = `chore-${Date.now()}`;
        state.chores.push({
            id: newId,
            title: title,
            points: points,
            kidId: kidId,
            frequency: frequency,
            daysOfWeek: daysOfWeek
        });
    }
    
    saveAllToStorage();
    // Regenerate active chores to match new templates
    state.activeChores = []; // Clear and re-init active chores for a fresh sync
    initializeActiveChores(getTodayString());
    
    hideChoreForm();
    renderSettingsChoresList();
    renderDashboard();
};

function renderSettingsChoresList() {
    const container = document.getElementById('chores-list-container');
    container.innerHTML = '';
    
    if (state.chores.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:var(--text-dim); padding:1rem;">No chores added yet.</div>`;
        return;
    }
    
    state.chores.forEach(chore => {
        // Find assigned name
        let assignedName = 'Everyone';
        if (chore.kidId !== 'all') {
            const kid = state.kids.find(k => k.id === chore.kidId);
            assignedName = kid ? kid.name : 'Unknown';
        }
        
        let freqLabel = chore.frequency;
        if (chore.frequency === 'days') {
            freqLabel = (chore.daysOfWeek && chore.daysOfWeek.length > 0) 
                ? `Repeat: ${chore.daysOfWeek.join(', ')}` 
                : 'Scheduled';
        }
        
        const item = document.createElement('div');
        item.className = 'settings-list-item';
        item.innerHTML = `
            <div class="settings-list-item-info">
                <div>
                    <strong>${chore.title}</strong>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.15rem;">
                        <span style="color:var(--color-primary); font-weight:700;">+${chore.points} pts</span>
                        &bull; ${freqLabel}
                        &bull; Assigned to: <strong>${assignedName}</strong>
                    </div>
                </div>
            </div>
            <div class="settings-item-actions">
                <button onclick="editChore('${chore.id}')" class="icon-only-btn edit"><i data-lucide="edit-3"></i></button>
                <button onclick="deleteChore('${chore.id}')" class="icon-only-btn delete"><i data-lucide="trash-2"></i></button>
            </div>
        `;
        container.appendChild(item);
    });
    lucide.createIcons();
}

window.editChore = function(id) {
    const chore = state.chores.find(c => c.id === id);
    if (!chore) return;
    
    document.getElementById('edit-chore-id').value = chore.id;
    document.getElementById('chore-title').value = chore.title;
    document.getElementById('chore-points').value = chore.points;
    document.getElementById('chore-kid').value = chore.kidId;
    document.getElementById('chore-frequency').value = chore.frequency;
    
    // Show/hide specific days checklist
    const daysContainer = document.getElementById('chore-days-container');
    if (chore.frequency === 'days') {
        daysContainer.classList.remove('hidden');
        const checkedDays = chore.daysOfWeek || [];
        document.querySelectorAll('input[name="chore-days"]').forEach(cb => {
            cb.checked = checkedDays.includes(cb.value);
        });
    } else {
        daysContainer.classList.add('hidden');
        document.querySelectorAll('input[name="chore-days"]').forEach(cb => {
            cb.checked = false;
        });
    }
    
    document.getElementById('chore-form').classList.remove('hidden');
};

window.deleteChore = async function(id) {
    const chore = state.chores.find(c => c.id === id);
    if (!chore) return;
    
    const confirmed = await showConfirm("Delete Chore?", `Delete "${chore.title}" chore template? Today's instances will also be deleted.`);
    if (confirmed) {
        state.chores = state.chores.filter(c => c.id !== id);
        state.activeChores = state.activeChores.filter(ac => ac.choreId !== id);
        
        saveAllToStorage();
        renderSettingsChoresList();
        renderDashboard();
    }
};

// --- Settings Section: Rewards Goal CRUD ---
window.saveReward = function(event) {
    event.preventDefault();
    const title = document.getElementById('reward-title').value.trim();
    const cost = parseInt(document.getElementById('reward-cost').value);
    
    if (title && cost > 0) {
        state.rewards.push({
            id: `reward-${Date.now()}`,
            title: title,
            cost: cost
        });
        saveAllToStorage();
        document.getElementById('reward-title').value = '';
        document.getElementById('reward-cost').value = '';
        renderSettingsRewardsList();
        renderDashboard();
    }
};

function renderSettingsRewardsList() {
    const container = document.getElementById('rewards-list-container');
    container.innerHTML = '';
    
    if (state.rewards.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:var(--text-dim); padding:1rem;">No rewards added yet.</div>`;
        return;
    }
    
    state.rewards.forEach(reward => {
        const item = document.createElement('div');
        item.className = 'settings-list-item';
        item.innerHTML = `
            <div class="settings-list-item-info">
                <div>
                    <strong>${reward.title}</strong>
                    <div style="font-size:0.8rem; color:var(--color-accent); font-weight:700;">Cost: ${reward.cost} pts</div>
                </div>
            </div>
            <div class="settings-item-actions">
                <button onclick="deleteReward('${reward.id}')" class="icon-only-btn delete"><i data-lucide="trash-2"></i></button>
            </div>
        `;
        container.appendChild(item);
    });
    lucide.createIcons();
}

window.deleteReward = async function(id) {
    const reward = state.rewards.find(r => r.id === id);
    if (!reward) return;
    
    const confirmed = await showConfirm("Delete Reward?", `Remove reward "${reward.title}"?`);
    if (confirmed) {
        state.rewards = state.rewards.filter(r => r.id !== id);
        saveAllToStorage();
        renderSettingsRewardsList();
        renderDashboard();
    }
};

// --- Settings Admin: Bulk Actions ---
window.resetAllPointsConfirm = async function() {
    const confirmed = await showConfirm("Reset All Points?", "Are you sure you want to set ALL kids' scores back to 0 points? This does not reset chores.");
    if (confirmed) {
        state.kids.forEach(k => k.points = 0);
        saveAllToStorage();
        renderDashboard();
        if (!document.getElementById('settings-modal').classList.contains('hidden')) {
            renderSettingsKidsList();
        }
    }
};

window.resetAllChoresConfirm = async function() {
    const confirmed = await showConfirm("Reset Today's Chores?", "Reset all today's chores to 'incomplete'? Completed chores points won't be refunded (they keep their current points).");
    if (confirmed) {
        state.activeChores.forEach(ac => ac.completed = false);
        saveAllToStorage();
        renderDashboard();
    }
};

// --- Wake Lock (Prevent Screen Timeout) ---
let wakeLock = null;
let isWakeLockActive = false;

async function initWakeLock() {
    if ('wakeLock' in navigator) {
        // Re-request wake lock when page becomes visible again
        document.addEventListener('visibilitychange', async () => {
            if (isWakeLockActive && document.visibilityState === 'visible') {
                await requestWakeLock(true); // silent re-lock
            }
        });
    } else {
        // Wake lock API not supported on this browser (older browsers / Silk versions)
        const btn = document.getElementById('btn-wake-lock');
        if (btn) {
            btn.style.opacity = '0.5';
            btn.title = "Screen Wake Lock not supported by this browser";
            btn.querySelector('span').innerText = "Screen On (Unsupported)";
        }
    }
}

async function requestWakeLock(silent = false) {
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        isWakeLockActive = true;
        updateWakeLockUI(true);
        console.log("Screen Wake Lock successfully acquired.");
    } catch (err) {
        isWakeLockActive = false;
        updateWakeLockUI(false);
        if (!silent) {
            console.error(`Failed to lock screen wake: ${err.name}, ${err.message}`);
        }
    }
}

function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release()
            .then(() => {
                wakeLock = null;
                isWakeLockActive = false;
                updateWakeLockUI(false);
                console.log("Screen Wake Lock released manually.");
            });
    }
}

function updateWakeLockUI(isActive) {
    const btn = document.getElementById('btn-wake-lock');
    if (!btn) return;
    
    const textSpan = btn.querySelector('span');
    const icon = btn.querySelector('i');
    
    if (isActive) {
        btn.classList.add('active-glow');
        textSpan.innerText = "Screen stays ON";
        if (icon) icon.setAttribute('data-lucide', 'sun-dim');
    } else {
        btn.classList.remove('active-glow');
        textSpan.innerText = "Keep Screen On";
        if (icon) icon.setAttribute('data-lucide', 'sun');
    }
    lucide.createIcons();
}

function toggleWakeLock() {
    if (!('wakeLock' in navigator)) {
        alert("Screen Wake Lock is not supported by your current browser. You can prevent sleep in your Echo Show's settings or keep a video playing.");
        return;
    }
    if (isWakeLockActive) {
        releaseWakeLock();
    } else {
        requestWakeLock();
    }
}

// --- Modal Controls & General Event Listeners ---
function initEventListeners() {
    const btnSettings = document.getElementById('btn-settings');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const settingsModal = document.getElementById('settings-modal');
    const btnSetupFirst = document.getElementById('btn-setup-first');
    const btnWakeLock = document.getElementById('btn-wake-lock');
    
    const openSettings = () => {
        if (state.parentPin) {
            openPinModal();
        } else {
            settingsModal.classList.remove('hidden');
            populateChoreKidSelect();
            switchTab('kids');
        }
    };
    
    const closeSettings = () => {
        settingsModal.classList.add('hidden');
    };
    
    if (btnSettings) btnSettings.addEventListener('click', openSettings);
    if (btnCloseModal) btnCloseModal.addEventListener('click', closeSettings);
    if (btnSetupFirst) btnSetupFirst.addEventListener('click', openSettings);
    if (btnWakeLock) btnWakeLock.addEventListener('click', toggleWakeLock);
    
    // Close modal on clicking backdrop
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeSettings();
        }
    });
    
    // Close PIN modal on clicking backdrop
    const pinModal = document.getElementById('pin-modal');
    if (pinModal) {
        pinModal.addEventListener('click', (e) => {
            if (e.target === pinModal) {
                closePinModal();
            }
        });
    }
}

// ==========================================
// FAMILY CALENDAR & AGENDA WIDGET
// ==========================================

function renderSidebarEventsList() {
    const container = document.getElementById('sidebar-events-list');
    if (!container) return;
    container.innerHTML = '';
    
    const todayStr = getTodayString();
    
    // Filter out events that are older than today (comparing dates as strings)
    const activeEvents = (state.events || []).filter(ev => ev.date >= todayStr);
    
    // Sort events chronologically
    activeEvents.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.time || '').localeCompare(b.time || '');
    });
    
    if (activeEvents.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:var(--text-dim); padding:1rem; font-size:0.8rem;">No events scheduled.</div>`;
        return;
    }
    
    // Get names of weekdays for friendly display
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    activeEvents.slice(0, 4).forEach(ev => { // Limit to 4 events on sidebar for height limits
        // Format date nicely (e.g. "Today", "Tomorrow", "Mon, Jul 20")
        let dateLabel = '';
        if (ev.date === todayStr) {
            dateLabel = 'Today';
        } else {
            const evParts = ev.date.split('-').map(Number);
            const todayParts = todayStr.split('-').map(Number);
            const evDate = new Date(evParts[0], evParts[1] - 1, evParts[2]);
            const todayDate = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);
            const relativeDiff = Math.round((evDate - todayDate) / (1000 * 60 * 60 * 24));
            
            if (relativeDiff === 1) {
                dateLabel = 'Tomorrow';
            } else {
                const weekday = days[evDate.getDay()];
                const month = evDate.toLocaleDateString('en-US', { month: 'short' });
                const dayNum = evDate.getDate();
                dateLabel = `${weekday}, ${month} ${dayNum}`;
            }
        }
        
        const timeLabel = ev.time ? `${dateLabel} • ${ev.time}` : dateLabel;
        
        const item = document.createElement('div');
        item.className = 'sidebar-event-item';
        item.innerHTML = `
            <div class="sidebar-event-dot" style="background-color: ${ev.color || '#3b82f6'};"></div>
            <div class="sidebar-event-details">
                <span class="sidebar-event-title">${ev.title}</span>
                <span class="sidebar-event-time">${timeLabel}</span>
            </div>
        `;
        container.appendChild(item);
    });
}

function renderSettingsEventsList() {
    const container = document.getElementById('events-list-container');
    if (!container) return;
    container.innerHTML = '';
    
    if (!state.events || state.events.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:var(--text-dim); padding:1rem;">No events in the calendar yet.</div>`;
        return;
    }
    
    // Sort events chronologically
    state.events.sort((a, b) => a.date.localeCompare(b.date));
    
    state.events.forEach(ev => {
        const item = document.createElement('div');
        item.className = 'settings-list-item';
        item.innerHTML = `
            <div class="settings-list-item-info">
                <div class="sidebar-event-dot" style="background-color: ${ev.color || '#3b82f6'}; width:12px; height:12px;"></div>
                <div>
                    <strong>${ev.title}</strong>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.15rem;">
                        ${ev.date} ${ev.time ? `&bull; ${ev.time}` : ''}
                    </div>
                </div>
            </div>
            <div class="settings-item-actions">
                <button onclick="deleteEvent('${ev.id}')" class="icon-only-btn delete"><i data-lucide="trash-2"></i></button>
            </div>
        `;
        container.appendChild(item);
    });
    lucide.createIcons();
}

window.saveEvent = function(event) {
    event.preventDefault();
    const title = document.getElementById('event-title').value.trim();
    const date = document.getElementById('event-date').value;
    const time = document.getElementById('event-time').value.trim();
    const color = document.getElementById('event-color').value;
    
    if (title && date) {
        state.events.push({
            id: `event-${Date.now()}`,
            title: title,
            date: date,
            time: time,
            color: color
        });
        
        saveAllToStorage();
        document.getElementById('event-title').value = '';
        document.getElementById('event-date').value = '';
        document.getElementById('event-time').value = '';
        
        renderSettingsEventsList();
        renderSidebarEventsList();
    }
};

window.deleteEvent = async function(id) {
    const ev = state.events.find(e => e.id === id);
    if (!ev) return;
    
    const confirmed = await showConfirm("Delete Event?", `Remove "${ev.title}" from schedule?`);
    if (confirmed) {
        state.events = state.events.filter(e => e.id !== id);
        saveAllToStorage();
        renderSettingsEventsList();
        renderSidebarEventsList();
    }
};

// ==========================================
// PARENT SECURITY PIN CODE LOCK
// ==========================================

let pinBuffer = '';

window.saveParentPin = function() {
    const pinInput = document.getElementById('parent-pin-input');
    const pin = pinInput.value.trim();
    
    if (pin.length !== 4 || isNaN(pin)) {
        alert("Please enter a valid 4-digit numeric PIN.");
        return;
    }
    
    state.parentPin = pin;
    saveAllToStorage();
    updatePinSecurityUI();
    alert("Parent Security PIN has been set successfully!");
};

window.disableParentPin = async function() {
    const confirmed = await showConfirm("Disable Security PIN?", "Are you sure you want to disable the Settings lock? Anyone will be able to edit chores and points.");
    if (confirmed) {
        state.parentPin = '';
        saveAllToStorage();
        updatePinSecurityUI();
    }
};

function updatePinSecurityUI() {
    const pinInput = document.getElementById('parent-pin-input');
    const btnSave = document.getElementById('btn-save-pin');
    const btnDisable = document.getElementById('btn-disable-pin');
    if (!pinInput || !btnSave || !btnDisable) return;
    
    if (state.parentPin) {
        pinInput.value = '••••';
        pinInput.disabled = true;
        btnSave.classList.add('hidden');
        btnDisable.classList.remove('hidden');
    } else {
        pinInput.value = '';
        pinInput.disabled = false;
        btnSave.classList.remove('hidden');
        btnDisable.classList.add('hidden');
    }
}

// Pin Pad keypad controls
let targetSettingsTab = 'kids';

window.openPinModal = function(targetTab = 'kids') {
    pinBuffer = '';
    targetSettingsTab = targetTab;
    updatePinDotsDisplay();
    document.getElementById('pin-modal').classList.remove('hidden');
};

window.closePinModal = function() {
    document.getElementById('pin-modal').classList.add('hidden');
    pinBuffer = '';
};

window.pressPinKey = function(num) {
    if (pinBuffer.length >= 4) return;
    
    pinBuffer += num;
    updatePinDotsDisplay();
    
    if (pinBuffer.length === 4) {
        // Wait 200ms to let the last dot fill visually
        setTimeout(() => {
            if (pinBuffer === state.parentPin) {
                closePinModal();
                // Open Settings modal
                document.getElementById('settings-modal').classList.remove('hidden');
                populateChoreKidSelect();
                switchTab(targetSettingsTab);
            } else {
                // Vibrate/Shake card
                const card = document.querySelector('.pin-card');
                if (card) {
                    card.classList.add('shake');
                    // Clear shake class after animation completes
                    setTimeout(() => card.classList.remove('shake'), 400);
                }
                
                // Clear buffer and dots
                pinBuffer = '';
                updatePinDotsDisplay();
            }
        }, 200);
    }
};

window.clearPin = function() {
    pinBuffer = '';
    updatePinDotsDisplay();
};

window.backspacePin = function() {
    if (pinBuffer.length > 0) {
        pinBuffer = pinBuffer.slice(0, -1);
        updatePinDotsDisplay();
    }
};

function updatePinDotsDisplay() {
    const dots = document.querySelectorAll('.pin-display .pin-dot');
    dots.forEach((dot, index) => {
        if (index < pinBuffer.length) {
            dot.classList.add('filled');
        } else {
            dot.classList.remove('filled');
        }
    });
}

// Global click handler for family calendar widget
window.openCalendarSettings = function() {
    if (state.parentPin) {
        openPinModal('calendar');
    } else {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.remove('hidden');
            populateChoreKidSelect();
            switchTab('calendar');
        }
    }
};
