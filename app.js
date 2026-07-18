/* ==========================================
   FAMILY CHORE DASHBOARD - LOGIC
   ========================================== */

const APP_VERSION = '0.0.1-beta.6';

// --- Constants & State ---
const STORAGE_KEYS = {
    KIDS: 'chorestar_kids',
    CHORES: 'chorestar_chores',
    ACTIVE_CHORES: 'chorestar_active_chores',
    REWARDS: 'chorestar_rewards',
    LAST_RESET: 'chorestar_last_reset',
    EVENTS: 'chorestar_events',
    APPROVALS: 'chorestar_approvals',
    HISTORY: 'chorestar_history',
    EXCEPTIONS: 'chorestar_exceptions',
    NOTES: 'chorestar_notes'
};

let state = {
    kids: [],
    chores: [],
    activeChores: [],
    rewards: [],
    events: [],
    approvals: [],
    history: [],
    exceptions: [],
    notes: [],
    lastResetDate: ''
};

let stateRevision = 0;
let pinEnabled = false;
let selectedMemberId = '';
let toastTimer = null;

// Helper for dynamic seeding of calendar dates
function getRelativeDateString(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// --- Initial Demo Data Seed ---
const DEMO_DATA = {
    kids: [
        { id: 'kid-one', name: 'Kid 1', color: '#e84d8a', points: 0, role: 'kid', avatar: 'K1' },
        { id: 'kid-two', name: 'Kid 2', color: '#4f7cff', points: 0, role: 'kid', avatar: 'K2' },
        { id: 'parent-one', name: 'Parent 1', color: '#f0bd3d', points: 0, role: 'parent', avatar: 'P1' },
        { id: 'parent-two', name: 'Parent 2', color: '#3fa675', points: 0, role: 'parent', avatar: 'P2' }
    ],
    chores: [
        { id: 'chore-1', title: 'Make your bed', points: 5, frequency: 'daily', kidId: 'all', dueDate: '', requiresApproval: false, completedAt: '' },
        { id: 'chore-2', title: 'Brush teeth & wash face', points: 5, frequency: 'daily', kidId: 'all', dueDate: '', requiresApproval: false, completedAt: '' },
        { id: 'chore-3', title: 'Empty dishwasher', points: 10, frequency: 'daily', kidId: 'all', dueDate: '', requiresApproval: false, completedAt: '' },
        { id: 'chore-4', title: 'Put out trash bins', points: 15, frequency: 'days', daysOfWeek: ['Tue', 'Fri'], kidId: 'all', dueDate: '', requiresApproval: false, completedAt: '' },
        { id: 'chore-5', title: 'Clean bedroom', points: 25, frequency: 'weekly', kidId: 'all', dueDate: '', requiresApproval: false, completedAt: '' }
    ],
    activeChores: [],
    rewards: [
        { id: 'reward-1', title: '30 min Screen Time', cost: 30, requiresApproval: false },
        { id: 'reward-2', title: 'Ice Cream Sundae', cost: 50, requiresApproval: false },
        { id: 'reward-3', title: 'Stay up 30 min late', cost: 60, requiresApproval: false },
        { id: 'reward-4', title: 'New Toy under $10', cost: 100, requiresApproval: false }
    ],
    events: [
        { id: 'event-1', title: 'Soccer practice', date: getRelativeDateString(0), time: '5:00 PM', color: '#ec4899' },
        { id: 'event-2', title: 'Dentist appointment', date: getRelativeDateString(1), time: '10:00 AM', color: '#3b82f6' },
        { id: 'event-3', title: 'Family Movie Night 🍿', date: getRelativeDateString(2), time: '7:00 PM', color: '#10b981' }
    ],
    approvals: [],
    history: [],
    exceptions: [],
    notes: [],
    lastResetDate: ''
};

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    loadLocalCache();
    initClock();
    checkDailyReset();
    renderDashboard();
    renderSidebarEventsList();
    initEventListeners();
    initWakeLock();
    if (window.lucide) lucide.createIcons();
    document.getElementById('app-version').innerText = `Beta 6 · ${APP_VERSION}`;
    
    await syncWithServer();
    startServerSyncPolling();
});

// --- Data Management (LocalStorage Cache & Server Sync) ---
let lastStateString = '';

function loadLocalCache() {
    try {
        const storedKids = localStorage.getItem(STORAGE_KEYS.KIDS);
        const storedChores = localStorage.getItem(STORAGE_KEYS.CHORES);
        const storedActive = localStorage.getItem(STORAGE_KEYS.ACTIVE_CHORES);
        const storedRewards = localStorage.getItem(STORAGE_KEYS.REWARDS);
        const storedReset = localStorage.getItem(STORAGE_KEYS.LAST_RESET);
        const storedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
        const storedApprovals = localStorage.getItem(STORAGE_KEYS.APPROVALS);
        const storedHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
        const storedExceptions = localStorage.getItem(STORAGE_KEYS.EXCEPTIONS);
        const storedNotes = localStorage.getItem(STORAGE_KEYS.NOTES);

        if (storedKids && storedChores) {
            state.kids = JSON.parse(storedKids);
            // Ensure older local caches have the fields introduced by later releases.
            state.kids.forEach(k => {
                if (!k.role) k.role = 'kid';
                if (!k.avatar) k.avatar = k.name.charAt(0).toUpperCase();
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
            state.lastResetDate = storedReset || '';
            state.approvals = storedApprovals ? JSON.parse(storedApprovals) : [];
            state.history = storedHistory ? JSON.parse(storedHistory) : [];
            state.exceptions = storedExceptions ? JSON.parse(storedExceptions) : [];
            state.notes = storedNotes ? JSON.parse(storedNotes) : [];
            lastStateString = JSON.stringify(state);
        } else {
            state = JSON.parse(JSON.stringify(DEMO_DATA));
            state.lastResetDate = getTodayString();
            saveLocalCache();
            lastStateString = JSON.stringify(state);
        }
    } catch (e) {
        console.error("Error reading localStorage, using blank state", e);
        state = { kids: [], chores: [], activeChores: [], rewards: [], events: [], approvals: [], history: [], exceptions: [], notes: [], lastResetDate: getTodayString() };
    }
}

function saveLocalCache() {
    localStorage.setItem(STORAGE_KEYS.KIDS, JSON.stringify(state.kids));
    localStorage.setItem(STORAGE_KEYS.CHORES, JSON.stringify(state.chores));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CHORES, JSON.stringify(state.activeChores));
    localStorage.setItem(STORAGE_KEYS.REWARDS, JSON.stringify(state.rewards));
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(state.events));
    localStorage.setItem(STORAGE_KEYS.APPROVALS, JSON.stringify(state.approvals || []));
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(state.history || []));
    localStorage.setItem(STORAGE_KEYS.EXCEPTIONS, JSON.stringify(state.exceptions || []));
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(state.notes || []));
    localStorage.setItem(STORAGE_KEYS.LAST_RESET, state.lastResetDate);
}

function applyServerEnvelope(envelope, rerender = true) {
    if (!envelope || !envelope.state) return;
    state = envelope.state;
    stateRevision = Number(envelope.revision) || 0;
    pinEnabled = Boolean(envelope.pinEnabled);
    if (envelope.version) document.getElementById('app-version').innerText = `Beta 6 · ${envelope.version}`;
    lastStateString = JSON.stringify(state);
    saveLocalCache();
    setSyncStatus(true);
    if (rerender) {
        renderDashboard();
        renderSidebarEventsList();
    }
}

async function syncWithServer() {
    try {
        const response = await fetch('/api/state', { cache: 'no-store' });
        if (!response.ok) throw new Error("Server error fetching state");
        const envelope = await response.json();
        if (envelope.revision !== stateRevision || JSON.stringify(envelope.state) !== lastStateString) {
            applyServerEnvelope(envelope);
            
            const settingsModal = document.getElementById('settings-modal');
            if (settingsModal && !settingsModal.classList.contains('hidden')) {
                const activeTab = document.querySelector('.tab-btn.active');
                if (activeTab) {
                    const tabId = activeTab.id.replace('tab-', '');
                    switchTab(tabId);
                }
            }
        } else setSyncStatus(true);
    } catch (err) {
        console.warn("Failed server state sync, using offline cache.", err);
        setSyncStatus(false);
    }
}

function startServerSyncPolling() {
    setInterval(syncWithServer, 5000);
}

async function saveAllToStorage() {
    saveLocalCache();
    try {
        const response = await fetch('/api/admin/state', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ revision: stateRevision, state })
        });
        const envelope = await response.json();
        if (response.status === 401) {
            showToast('Parent access expired. Unlock Manage to save changes.', true);
            document.getElementById('settings-modal').classList.add('hidden');
            openPinModal();
            return false;
        }
        if (response.status === 409) {
            applyServerEnvelope(envelope);
            showToast('Another device changed the board. Latest household state restored.', true);
            return false;
        }
        if (!response.ok) throw new Error(envelope.error || 'Save failed');
        applyServerEnvelope(envelope, false);
        setSyncStatus(true);
        return true;
    } catch (err) {
        console.error("Failed to push state update to server:", err);
        setSyncStatus(false);
        showToast('Changes are cached here and will need to be saved when the server returns.', true);
        return false;
    }
}

function setSyncStatus(isOnline) {
    const label = document.getElementById('sync-status');
    const dot = document.querySelector('.status-dot');
    if (label) label.innerText = isOnline ? 'Synced to this household' : 'Offline · using this device';
    if (dot) dot.classList.toggle('offline', !isOnline);
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.innerText = message;
    toast.classList.toggle('error', isError);
    toast.classList.remove('hidden');
    toastTimer = window.setTimeout(() => toast.classList.add('hidden'), 4000);
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
}

function safeColor(value) {
    return /^#[0-9a-f]{6}$/i.test(value) ? value : '#4f7cff';
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
function isRoutinePaused(memberId, date) {
    return (state.exceptions || []).some(exception =>
        (exception.kidId === 'all' || exception.kidId === memberId) &&
        exception.startDate <= date && exception.endDate >= date);
}

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
    const weeklyToKeep = state.activeChores.filter(chore =>
        chore.pendingApproval ||
        (chore.frequency === 'once' && !chore.completed) ||
        (chore.frequency === 'weekly' && !isMonday));
        
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
        } else if (chore.frequency === 'once') {
            shouldAdd = Boolean(chore.dueDate && chore.dueDate <= today && !chore.completedAt);
        }
        
        if (!shouldAdd) return;
        
        const addChoreForKid = (kidId) => {
            if (chore.frequency !== 'once' && isRoutinePaused(kidId, today)) return;
            // Check if chore instance already exists for today
            const exists = state.activeChores.some(ac => 
                ac.choreId === chore.id && ac.kidId === kidId &&
                (ac.pendingApproval || ac.frequency === 'weekly' || ac.frequency === 'once' || ac.dateAssigned === today)
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
                    pendingApproval: false,
                    requiresApproval: Boolean(chore.requiresApproval),
                    completedAt: '',
                    dateAssigned: chore.frequency === 'once' ? chore.dueDate : today
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

    saveLocalCache();
}

function rebuildActiveChoresForToday() {
    const previous = new Map(state.activeChores.map(active => [`${active.kidId}:${active.choreId}`, active]));
    state.activeChores = [];
    initializeActiveChores(getTodayString());
    state.activeChores.forEach(active => {
        const oldActive = previous.get(`${active.kidId}:${active.choreId}`);
        if (!oldActive) return;
        active.completed = Boolean(oldActive.completed);
        active.pendingApproval = Boolean(oldActive.pendingApproval);
        active.completedAt = oldActive.completedAt || '';
        const approval = (state.approvals || []).find(item => item.activeChoreId === oldActive.id);
        if (approval) approval.activeChoreId = active.id;
        const member = state.kids.find(kid => kid.id === active.kidId);
        if (active.completed && member && member.role !== 'parent' && active.points !== oldActive.points) {
            member.points = Math.max(0, member.points + active.points - oldActive.points);
        }
    });
    const activeIds = new Set(state.activeChores.map(active => active.id));
    state.approvals = (state.approvals || []).filter(approval => approval.type !== 'chore' || activeIds.has(approval.activeChoreId));
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
    
    if (!state.kids.some(kid => kid.id === selectedMemberId)) selectedMemberId = state.kids[0].id;
    renderMemberSwitcher();

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
        card.className = `kid-card ${isAllDone ? 'all-done' : ''} ${role === 'parent' ? 'parent-role' : ''} ${kid.id === selectedMemberId ? 'mobile-selected' : ''}`;
        card.style.setProperty('--kid-accent-color', safeColor(kid.color));
        card.dataset.memberId = kid.id;
        
        // Role sub-text/badge
        const roleLabel = role === 'parent' ? 'Parent' : 'Kid';
        
        // Points Badge (Kids only)
        const scoreBadgeHTML = role !== 'parent' 
            ? `
            <div class="kid-score-badge">
                <span class="kid-score-val">${kid.points}</span>
                <span class="kid-score-lbl">Points</span>
            </div>
            `
            : '';
            
        // Card Header
        let cardHTML = `
            <div class="kid-card-header">
                <div class="kid-info">
                    <div class="kid-avatar">${escapeHTML(kid.avatar || kid.name.charAt(0).toUpperCase())}</div>
                    <div class="kid-name-container">
                        <span class="kid-name">${escapeHTML(kid.name)}</span>
                        <span class="kid-sub-stat"><span class="role-label">${roleLabel}</span> · ${completedChores.length}/${kidChores.length} done</span>
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
                    <h4><i data-lucide="trophy"></i> Lineup complete</h4>
                    <p>Everything for today is checked off.</p>
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
                } else if (chore.frequency === 'once') {
                    frequencyText = chore.dateAssigned === getTodayString() ? 'One time' : `Due ${friendlyDateLabel(chore.dateAssigned)}`;
                }
                
                // Points indicators (Kids only)
                const pointsIndicatorHTML = role !== 'parent'
                    ? `<div class="chore-right"><span class="chore-points">${chore.pendingApproval ? 'Review' : `+${chore.points}`}</span></div>`
                    : '';
                    
                cardHTML += `
                    <button type="button" class="chore-item ${chore.completed ? 'completed' : ''} ${chore.pendingApproval ? 'pending' : ''}" data-chore-id="${escapeHTML(chore.id)}" aria-pressed="${chore.completed}">
                        <div class="chore-left">
                            <div class="chore-checkbox">
                                <i data-lucide="${chore.pendingApproval ? 'clock-3' : 'check'}"></i>
                            </div>
                            <div>
                                <div class="chore-title">${escapeHTML(chore.title)}</div>
                                <div class="chore-badge-row">
                                    <span class="chore-frequency-badge">${escapeHTML(frequencyText)}</span>
                                    ${chore.pendingApproval ? '<span class="chore-frequency-badge approval-badge">Awaiting approval</span>' : ''}
                                </div>
                            </div>
                        </div>
                        ${pointsIndicatorHTML}
                    </button>
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
                const isPending = (state.approvals || []).some(approval => approval.type === 'reward' && approval.memberId === kid.id && approval.rewardId === reward.id);
                const canAfford = kid.points >= reward.cost && !isPending;
                const claimLabel = isPending ? 'Pending' : canAfford ? (reward.requiresApproval ? 'Request' : 'Claim') : 'Locked';
                cardHTML += `
                    <button type="button" class="reward-claim-card ${!canAfford ? 'disabled' : ''}"
                         data-kid-id="${escapeHTML(kid.id)}" data-reward-id="${escapeHTML(reward.id)}" ${canAfford ? '' : 'disabled'}>
                        <div class="reward-claim-title">${escapeHTML(reward.title)}</div>
                        <div class="reward-claim-footer">
                            <span class="reward-cost-tag">${reward.cost} pts</span>
                            <span class="claim-indicator">${claimLabel}</span>
                        </div>
                    </button>
                `;
            });
            
            cardHTML += `</div>`; // Close rewards-grid-small
        }
        
        card.innerHTML = cardHTML;
        card.querySelectorAll('[data-chore-id]').forEach(button => {
            button.addEventListener('click', () => toggleChore(button.dataset.choreId));
        });
        card.querySelectorAll('[data-reward-id]').forEach(button => {
            button.addEventListener('click', () => claimReward(button.dataset.kidId, button.dataset.rewardId));
        });
        kidsGrid.appendChild(card);
    });
    
    // Update Family-wide Progress stats
    updateFamilyProgressCircle(totalCompletedCount, totalChoresCount);
    
    // Refresh icons
    if (window.lucide) lucide.createIcons();
}

function renderMemberSwitcher() {
    const switcher = document.getElementById('member-switcher');
    if (!switcher) return;
    switcher.innerHTML = '';
    state.kids.forEach(kid => {
        const button = document.createElement('button');
        button.type = 'button';
        button.innerText = kid.name;
        button.classList.toggle('active', kid.id === selectedMemberId);
        button.style.setProperty('--member-color', safeColor(kid.color));
        button.addEventListener('click', () => selectMember(kid.id));
        switcher.appendChild(button);
    });
}

window.selectMember = function(memberId) {
    selectedMemberId = memberId;
    document.querySelectorAll('.kid-card').forEach(card => {
        card.classList.toggle('mobile-selected', card.dataset.memberId === memberId);
    });
    renderMemberSwitcher();
};

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
window.toggleChore = async function(activeChoreId) {
    const previous = state.activeChores.find(chore => chore.id === activeChoreId);
    if (!previous) return;
    try {
        const response = await fetch('/api/actions/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activeChoreId })
        });
        const envelope = await response.json();
        if (!response.ok) throw new Error(envelope.error || 'Chore could not be updated');
        applyServerEnvelope(envelope);
        const updated = state.activeChores.find(chore => chore.id === activeChoreId);
        if (updated?.pendingApproval && !previous.pendingApproval) {
            showToast(`${updated.title} is ready for parent review.`);
        }
        if (updated?.completed && !previous.completed) {
            celebrate({ particleCount: 28, spread: 46, origin: { y: 0.72 } });
            const memberChores = state.activeChores.filter(chore => chore.kidId === updated.kidId);
            if (memberChores.length && memberChores.every(chore => chore.completed)) {
                window.setTimeout(celebrateKidCompletion, 250);
            }
        }
    } catch (error) {
        setSyncStatus(false);
        showToast(error.message, true);
    }
}

function celebrateKidCompletion() {
    if (!canCelebrate()) return;
    const duration = 2.5 * 1000;
    const end = Date.now() + duration;
    
    (function frame() {
        window.confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
        });
        window.confetti({
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

function canCelebrate() {
    return Boolean(window.confetti) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function celebrate(options) {
    if (canCelebrate()) window.confetti(options);
}

window.claimReward = async function(kidId, rewardId) {
    const kid = state.kids.find(k => k.id === kidId);
    const reward = state.rewards.find(r => r.id === rewardId);
    
    if (!kid || !reward || kid.points < reward.cost) return;
    
    const confirmTitle = reward.requiresApproval ? 'Request Reward?' : 'Claim Reward?';
    const confirmText = reward.requiresApproval
        ? `Request "${reward.title}" for ${kid.name}? ${reward.cost} points will be spent after parent approval.`
        : `Deduct ${reward.cost} points from ${kid.name} for "${reward.title}"?`;
    const confirmed = await showConfirm(confirmTitle, confirmText);
    
    if (confirmed) {
        try {
            const response = await fetch('/api/actions/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kidId, rewardId })
            });
            const envelope = await response.json();
            if (!response.ok) throw new Error(envelope.error || 'Reward could not be claimed');
            applyServerEnvelope(envelope);
            if (envelope.pendingApproval) {
                showToast(`${reward.title} is ready for parent review.`);
            } else {
                celebrate({
                    particleCount: 64,
                    spread: 76,
                    colors: ['#f0bd3d', '#e84d63', '#4f7cff', '#3fa675'],
                    origin: { y: 0.62 }
                });
                showToast(`${kid.name} claimed ${reward.title}.`);
            }
        } catch (error) {
            showToast(error.message, true);
        }
    }
}

// --- Tab Navigation in Settings ---
window.switchTab = function(tabName) {
    const tabs = ['kids', 'chores', 'household', 'activity', 'rewards'];
    let activeButton = null;
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        const content = document.getElementById(`tab-content-${t}`);
        
        if (t === tabName) {
            if (btn) btn.classList.add('active');
            activeButton = btn;
            if (content) content.classList.remove('hidden');
        } else {
            if (btn) btn.classList.remove('active');
            if (content) content.classList.add('hidden');
        }
    });

    if (activeButton && window.matchMedia('(max-width: 800px)').matches) {
        activeButton.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    
    if (tabName === 'kids') renderSettingsKidsList();
    if (tabName === 'chores') renderSettingsChoresList();
    if (tabName === 'household') {
        populateExceptionMemberSelect();
        renderHouseholdSettings();
    }
    if (tabName === 'activity') renderActivitySettings();
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
    
    initializeActiveChores(getTodayString());
    saveAllToStorage();
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
                <div class="kid-avatar" style="background-color: ${safeColor(kid.color)}; width: 40px; height: 40px; font-size: 1.1rem;">
                    ${escapeHTML(kid.avatar || kid.name.charAt(0).toUpperCase())}
                </div>
                <div>
                    <strong>${escapeHTML(kid.name)} <span style="font-size:0.75rem; opacity:0.6; font-weight:normal;">(${roleLabel})</span></strong>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${ptsText}</div>
                </div>
            </div>
            <div class="settings-item-actions">
                <button type="button" aria-label="Edit ${escapeHTML(kid.name)}" data-action="edit-kid" data-id="${kid.id}" class="icon-only-btn edit"><i data-lucide="edit-3"></i></button>
                <button type="button" aria-label="Delete ${escapeHTML(kid.name)}" data-action="delete-kid" data-id="${kid.id}" class="icon-only-btn delete"><i data-lucide="trash-2"></i></button>
            </div>
        `;
        container.appendChild(item);
    });
    if (window.lucide) lucide.createIcons();
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
        state.approvals = (state.approvals || []).filter(approval => approval.memberId !== id);
        state.exceptions = (state.exceptions || []).filter(exception => exception.kidId !== id);
        
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
    document.getElementById('chore-date-container').classList.add('hidden');
    document.getElementById('chore-due-date').value = '';
    document.getElementById('chore-requires-approval').checked = false;
    document.querySelectorAll('input[name="chore-days"]').forEach(cb => cb.checked = false);
};

window.hideChoreForm = function() {
    document.getElementById('chore-form').classList.add('hidden');
};

function populateChoreKidSelect() {
    const select = document.getElementById('chore-kid');
    select.replaceChildren();
    const everyoneOption = document.createElement('option');
    everyoneOption.value = 'all';
    everyoneOption.innerText = 'Everyone (creates one chore per member)';
    select.appendChild(everyoneOption);
    state.kids.forEach(kid => {
        const option = document.createElement('option');
        option.value = kid.id;
        option.innerText = kid.name;
        select.appendChild(option);
    });
}

window.handleChoreFrequencyChange = function() {
    const freq = document.getElementById('chore-frequency').value;
    const container = document.getElementById('chore-days-container');
    const dateContainer = document.getElementById('chore-date-container');
    const dueDate = document.getElementById('chore-due-date');
    if (freq === 'days') {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
        document.querySelectorAll('input[name="chore-days"]').forEach(cb => cb.checked = false);
    }
    dateContainer.classList.toggle('hidden', freq !== 'once');
    dueDate.required = freq === 'once';
    if (freq !== 'once') dueDate.value = '';
};

window.saveChore = function(event) {
    event.preventDefault();
    const id = document.getElementById('edit-chore-id').value;
    const title = document.getElementById('chore-title').value.trim();
    const points = parseInt(document.getElementById('chore-points').value);
    const kidId = document.getElementById('chore-kid').value;
    const frequency = document.getElementById('chore-frequency').value;
    const dueDate = frequency === 'once' ? document.getElementById('chore-due-date').value : '';
    const requiresApproval = document.getElementById('chore-requires-approval').checked;
    
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
            chore.dueDate = dueDate;
            chore.requiresApproval = requiresApproval;
            if (frequency !== 'once') chore.completedAt = '';
        }
        
        // Also update existing today's active chore instances if they match
        state.activeChores = state.activeChores.map(ac => {
            if (ac.choreId === id) {
                return {
                    ...ac,
                    title: title,
                    points: points,
                    frequency: frequency,
                    daysOfWeek: daysOfWeek,
                    requiresApproval: requiresApproval
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
            daysOfWeek: daysOfWeek,
            dueDate: dueDate,
            requiresApproval: requiresApproval,
            completedAt: ''
        });
    }
    
    rebuildActiveChoresForToday();
    saveAllToStorage();
    
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
        } else if (chore.frequency === 'once') {
            freqLabel = `One time · ${chore.dueDate}`;
        }
        
        const item = document.createElement('div');
        item.className = 'settings-list-item';
        item.innerHTML = `
            <div class="settings-list-item-info">
                <div>
                    <strong>${escapeHTML(chore.title)}</strong>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.15rem;">
                        <span style="color:var(--color-primary); font-weight:700;">+${chore.points} pts</span>
                        &bull; ${escapeHTML(freqLabel)}
                        &bull; Assigned to: <strong>${escapeHTML(assignedName)}</strong>
                        ${chore.requiresApproval ? '&bull; Approval required' : ''}
                    </div>
                </div>
            </div>
            <div class="settings-item-actions">
                <button type="button" aria-label="Edit ${escapeHTML(chore.title)}" data-action="edit-chore" data-id="${chore.id}" class="icon-only-btn edit"><i data-lucide="edit-3"></i></button>
                <button type="button" aria-label="Delete ${escapeHTML(chore.title)}" data-action="delete-chore" data-id="${chore.id}" class="icon-only-btn delete"><i data-lucide="trash-2"></i></button>
            </div>
        `;
        container.appendChild(item);
    });
    if (window.lucide) lucide.createIcons();
}

window.editChore = function(id) {
    const chore = state.chores.find(c => c.id === id);
    if (!chore) return;
    
    document.getElementById('edit-chore-id').value = chore.id;
    document.getElementById('chore-title').value = chore.title;
    document.getElementById('chore-points').value = chore.points;
    document.getElementById('chore-kid').value = chore.kidId;
    document.getElementById('chore-frequency').value = chore.frequency;
    document.getElementById('chore-due-date').value = chore.dueDate || '';
    document.getElementById('chore-requires-approval').checked = Boolean(chore.requiresApproval);
    
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
    document.getElementById('chore-date-container').classList.toggle('hidden', chore.frequency !== 'once');
    document.getElementById('chore-due-date').required = chore.frequency === 'once';
    
    document.getElementById('chore-form').classList.remove('hidden');
};

window.deleteChore = async function(id) {
    const chore = state.chores.find(c => c.id === id);
    if (!chore) return;
    
    const confirmed = await showConfirm("Delete Chore?", `Delete "${chore.title}" chore template? Today's instances will also be deleted.`);
    if (confirmed) {
        state.activeChores.filter(active => active.choreId === id && active.completed).forEach(active => {
            const member = state.kids.find(kid => kid.id === active.kidId);
            if (member && member.role !== 'parent') member.points = Math.max(0, member.points - active.points);
        });
        state.chores = state.chores.filter(c => c.id !== id);
        state.activeChores = state.activeChores.filter(ac => ac.choreId !== id);
        const activeChoreIds = new Set(state.activeChores.map(active => active.id));
        state.approvals = (state.approvals || []).filter(approval => (
            approval.type !== 'chore' || activeChoreIds.has(approval.activeChoreId)
        ));
        
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
    const requiresApproval = document.getElementById('reward-requires-approval').checked;
    
    if (title && cost > 0) {
        state.rewards.push({
            id: `reward-${Date.now()}`,
            title: title,
            cost: cost,
            requiresApproval: requiresApproval
        });
        saveAllToStorage();
        document.getElementById('reward-title').value = '';
        document.getElementById('reward-cost').value = '';
        document.getElementById('reward-requires-approval').checked = false;
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
                    <strong>${escapeHTML(reward.title)}</strong>
                    <div style="font-size:0.8rem; color:var(--color-accent); font-weight:700;">Cost: ${reward.cost} pts</div>
                    ${reward.requiresApproval ? '<div class="settings-meta">Parent approval required</div>' : ''}
                </div>
            </div>
            <div class="settings-item-actions">
                <button type="button" aria-label="Delete ${escapeHTML(reward.title)}" data-action="delete-reward" data-id="${reward.id}" class="icon-only-btn delete"><i data-lucide="trash-2"></i></button>
            </div>
        `;
        container.appendChild(item);
    });
    if (window.lucide) lucide.createIcons();
}

window.deleteReward = async function(id) {
    const reward = state.rewards.find(r => r.id === id);
    if (!reward) return;
    
    const confirmed = await showConfirm("Delete Reward?", `Remove reward "${reward.title}"?`);
    if (confirmed) {
        state.rewards = state.rewards.filter(r => r.id !== id);
        state.approvals = (state.approvals || []).filter(approval => approval.rewardId !== id);
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
    const confirmed = await showConfirm("Reset Today's Chores?", "Reset today's chores and refund the points earned from completed items?");
    if (confirmed) {
        state.activeChores.forEach(active => {
            if (!active.completed) return;
            const member = state.kids.find(kid => kid.id === active.kidId);
            if (member && member.role !== 'parent') member.points = Math.max(0, member.points - active.points);
            active.completed = false;
        });
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
            btn.querySelector('span').innerText = "Unavailable";
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
    const icon = btn.querySelector('[data-lucide]');
    
    if (isActive) {
        btn.classList.add('active-glow');
        textSpan.innerText = "Screen on";
        if (icon) icon.setAttribute('data-lucide', 'sun-dim');
    } else {
        btn.classList.remove('active-glow');
        textSpan.innerText = "Screen";
        if (icon) icon.setAttribute('data-lucide', 'sun');
    }
    if (window.lucide) lucide.createIcons();
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
    const btnSettingsMobile = document.getElementById('btn-settings-mobile');
    
    const openSettings = () => openSettingsForTab('kids');
    
    const closeSettings = () => {
        settingsModal.classList.add('hidden');
    };
    
    if (btnSettings) btnSettings.addEventListener('click', openSettings);
    if (btnCloseModal) btnCloseModal.addEventListener('click', closeSettings);
    if (btnSetupFirst) btnSetupFirst.addEventListener('click', openSettings);
    if (btnWakeLock) btnWakeLock.addEventListener('click', toggleWakeLock);
    if (btnSettingsMobile) btnSettingsMobile.addEventListener('click', openSettings);

    document.getElementById('kid-form')?.addEventListener('submit', saveKid);
    document.getElementById('chore-form')?.addEventListener('submit', saveChore);
    document.getElementById('event-form')?.addEventListener('submit', saveEvent);
    document.getElementById('reward-form')?.addEventListener('submit', saveReward);
    document.getElementById('note-form')?.addEventListener('submit', saveNote);
    document.getElementById('exception-form')?.addEventListener('submit', saveException);
    document.getElementById('chore-frequency')?.addEventListener('change', handleChoreFrequencyChange);

    document.addEventListener('click', event => {
        const trigger = event.target.closest('[data-action]');
        if (!trigger) return;
        const action = trigger.dataset.action;
        const id = trigger.dataset.id;
        const actions = {
            'open-household': () => openHouseholdSettings(),
            'scroll-panel': () => scrollToPanel(trigger.dataset.panel),
            'switch-tab': () => switchTab(trigger.dataset.tab),
            'show-add-kid': () => showAddKidForm(),
            'hide-kid-form': () => hideKidForm(),
            'show-add-chore': () => showAddChoreForm(),
            'hide-chore-form': () => hideChoreForm(),
            'reset-points': () => resetAllPointsConfirm(),
            'reset-chores': () => resetAllChoresConfirm(),
            'save-pin': () => saveParentPin(),
            'disable-pin': () => disableParentPin(),
            'pin-key': () => pressPinKey(trigger.dataset.key),
            'clear-pin': () => clearPin(),
            'backspace-pin': () => backspacePin(),
            'close-pin': () => closePinModal(),
            'edit-kid': () => editKid(id),
            'delete-kid': () => deleteKid(id),
            'edit-chore': () => editChore(id),
            'delete-chore': () => deleteChore(id),
            'delete-reward': () => deleteReward(id),
            'delete-event': () => deleteEvent(id),
            'delete-note': () => deleteNote(id),
            'delete-exception': () => deleteException(id),
            'approve-request': () => reviewApproval(id, 'approve'),
            'reject-request': () => reviewApproval(id, 'reject')
        };
        actions[action]?.();
    });
    
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

async function openSettingsForTab(tabName = 'kids') {
    if (pinEnabled) {
        try {
            const response = await fetch('/api/admin/session', { cache: 'no-store' });
            const session = await response.json();
            if (!session.unlocked) {
                openPinModal(tabName);
                return;
            }
        } catch (error) {
            showToast('The household server is unavailable.', true);
            return;
        }
    }
    document.getElementById('settings-modal').classList.remove('hidden');
    populateChoreKidSelect();
    populateExceptionMemberSelect();
    switchTab(tabName);
}

window.scrollToPanel = function(panelId) {
    document.getElementById(panelId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ==========================================
// HOUSEHOLD UP NEXT
// ==========================================

function friendlyDateLabel(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
    const today = getTodayString();
    if (value === today) return 'Today';
    const [year, month, day] = value.split('-').map(Number);
    const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const todayDate = new Date(todayYear, todayMonth - 1, todayDay);
    const difference = Math.round((date - todayDate) / 86400000);
    if (difference === 1) return 'Tomorrow';
    if (difference < 0) return `${Math.abs(difference)}d overdue`;
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function renderSidebarEventsList() {
    const container = document.getElementById('sidebar-up-next-list');
    if (!container) return;
    const today = getTodayString();
    const items = [];

    (state.approvals || []).forEach(approval => items.push({
        priority: 0,
        date: today,
        icon: approval.type === 'chore' ? 'badge-check' : 'gift',
        color: '#f0bd3d',
        title: `${approval.memberName} · ${approval.title}`,
        meta: approval.type === 'chore' ? 'Chore needs approval' : 'Reward request'
    }));

    (state.notes || []).filter(note => !note.expiresDate || note.expiresDate >= today).forEach(note => items.push({
        priority: 1,
        date: note.expiresDate || today,
        icon: 'pin',
        color: '#3fa675',
        title: note.text,
        meta: note.expiresDate ? `Household note · through ${friendlyDateLabel(note.expiresDate)}` : 'Household note'
    }));

    (state.chores || []).filter(chore => chore.frequency === 'once' && chore.dueDate && !chore.completedAt).forEach(chore => {
        const member = chore.kidId === 'all' ? null : state.kids.find(item => item.id === chore.kidId);
        items.push({
            priority: 2,
            date: chore.dueDate,
            icon: 'circle-check-big',
            color: member?.color || '#4f7cff',
            title: chore.title,
            meta: `${member?.name || 'Everyone'} · ${friendlyDateLabel(chore.dueDate)}`
        });
    });

    (state.exceptions || []).filter(exception => exception.endDate >= today).forEach(exception => {
        const member = exception.kidId === 'all' ? null : state.kids.find(item => item.id === exception.kidId);
        items.push({
            priority: 3,
            date: exception.startDate,
            icon: 'pause',
            color: '#e84d63',
            title: exception.reason || 'Routines paused',
            meta: `${member?.name || 'Everyone'} · ${friendlyDateLabel(exception.startDate)}–${friendlyDateLabel(exception.endDate)}`
        });
    });

    (state.events || []).filter(event => event.date >= today).forEach(event => items.push({
        priority: 4,
        date: event.date,
        icon: 'calendar-days',
        color: safeColor(event.color),
        title: event.title,
        meta: event.time ? `${friendlyDateLabel(event.date)} · ${event.time}` : friendlyDateLabel(event.date)
    }));

    items.sort((a, b) => a.priority - b.priority || a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
    container.innerHTML = '';
    if (!items.length) {
        container.innerHTML = '<div class="up-next-empty"><i data-lucide="check-check"></i><span>Nothing needs attention.</span></div>';
    } else {
        items.slice(0, 7).forEach(entry => {
            const item = document.createElement('div');
            item.className = 'sidebar-event-item up-next-item';
            item.innerHTML = `
                <span class="up-next-icon" style="--item-color:${safeColor(entry.color)}"><i data-lucide="${entry.icon}"></i></span>
                <span class="sidebar-event-details">
                    <span class="sidebar-event-title">${escapeHTML(entry.title)}</span>
                    <span class="sidebar-event-time">${escapeHTML(entry.meta)}</span>
                </span>`;
            container.appendChild(item);
        });
    }
    if (window.lucide) lucide.createIcons();
}

function populateExceptionMemberSelect() {
    const select = document.getElementById('exception-member');
    if (!select) return;
    const selected = select.value || 'all';
    select.innerHTML = '<option value="all">Everyone</option>';
    state.kids.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.innerText = member.name;
        select.appendChild(option);
    });
    select.value = [...select.options].some(option => option.value === selected) ? selected : 'all';
}

function renderHouseholdSettings() {
    renderSettingsNotesList();
    renderSettingsExceptionsList();
    renderSettingsEventsList();
    const today = getTodayString();
    if (!document.getElementById('exception-start').value) document.getElementById('exception-start').value = today;
    if (!document.getElementById('exception-end').value) document.getElementById('exception-end').value = today;
}

window.saveNote = async function(event) {
    event.preventDefault();
    const text = document.getElementById('note-text').value.trim();
    const expiresDate = document.getElementById('note-expires').value;
    if (!text) return;
    state.notes.push({ id: `note-${Date.now()}`, text, expiresDate, createdAt: new Date().toISOString() });
    if (!await saveAllToStorage()) return;
    document.getElementById('note-text').value = '';
    document.getElementById('note-expires').value = '';
    renderSettingsNotesList();
    renderSidebarEventsList();
};

function renderSettingsNotesList() {
    const container = document.getElementById('notes-list-container');
    if (!container) return;
    container.innerHTML = '';
    if (!(state.notes || []).length) {
        container.innerHTML = '<div class="settings-empty">No household notes.</div>';
        return;
    }
    [...state.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).forEach(note => {
        const item = document.createElement('div');
        item.className = 'settings-list-item';
        item.innerHTML = `
            <div class="settings-list-item-info">
                <i data-lucide="pin"></i>
                <div><strong>${escapeHTML(note.text)}</strong><div class="settings-meta">${note.expiresDate ? `Through ${escapeHTML(friendlyDateLabel(note.expiresDate))}` : 'No expiration'}</div></div>
            </div>
            <div class="settings-item-actions"><button type="button" aria-label="Delete note" data-action="delete-note" data-id="${note.id}" class="icon-only-btn delete"><i data-lucide="trash-2"></i></button></div>`;
        container.appendChild(item);
    });
    if (window.lucide) lucide.createIcons();
}

window.deleteNote = async function(id) {
    state.notes = (state.notes || []).filter(note => note.id !== id);
    if (!await saveAllToStorage()) return;
    renderSettingsNotesList();
    renderSidebarEventsList();
};

window.saveException = async function(event) {
    event.preventDefault();
    const kidId = document.getElementById('exception-member').value;
    const reason = document.getElementById('exception-reason').value.trim();
    const startDate = document.getElementById('exception-start').value;
    const endDate = document.getElementById('exception-end').value;
    if (!startDate || !endDate || endDate < startDate) {
        showToast('Pause end date must be on or after its start date.', true);
        return;
    }
    state.exceptions.push({ id: `pause-${Date.now()}`, kidId, startDate, endDate, reason });
    if (!await saveAllToStorage()) return;
    document.getElementById('exception-reason').value = '';
    renderSettingsExceptionsList();
    renderDashboard();
    renderSidebarEventsList();
};

function renderSettingsExceptionsList() {
    const container = document.getElementById('exceptions-list-container');
    if (!container) return;
    container.innerHTML = '';
    if (!(state.exceptions || []).length) {
        container.innerHTML = '<div class="settings-empty">No routine pauses.</div>';
        return;
    }
    [...state.exceptions].sort((a, b) => b.endDate.localeCompare(a.endDate)).forEach(exception => {
        const member = exception.kidId === 'all' ? null : state.kids.find(item => item.id === exception.kidId);
        const item = document.createElement('div');
        item.className = 'settings-list-item';
        item.innerHTML = `
            <div class="settings-list-item-info">
                <i data-lucide="pause"></i>
                <div><strong>${escapeHTML(exception.reason || 'Routines paused')}</strong><div class="settings-meta">${escapeHTML(member?.name || 'Everyone')} · ${escapeHTML(exception.startDate)} through ${escapeHTML(exception.endDate)}</div></div>
            </div>
            <div class="settings-item-actions"><button type="button" aria-label="Delete routine pause" data-action="delete-exception" data-id="${exception.id}" class="icon-only-btn delete"><i data-lucide="trash-2"></i></button></div>`;
        container.appendChild(item);
    });
    if (window.lucide) lucide.createIcons();
}

window.deleteException = async function(id) {
    state.exceptions = (state.exceptions || []).filter(exception => exception.id !== id);
    if (!await saveAllToStorage()) return;
    renderSettingsExceptionsList();
    renderDashboard();
    renderSidebarEventsList();
};

function renderActivitySettings() {
    const approvalsContainer = document.getElementById('approvals-list-container');
    const historyContainer = document.getElementById('history-list-container');
    if (!approvalsContainer || !historyContainer) return;
    approvalsContainer.innerHTML = '';
    if (!(state.approvals || []).length) {
        approvalsContainer.innerHTML = '<div class="settings-empty"><i data-lucide="check-check"></i> Nothing needs approval.</div>';
    } else {
        [...state.approvals].sort((a, b) => a.requestedAt.localeCompare(b.requestedAt)).forEach(approval => {
            const item = document.createElement('div');
            item.className = 'settings-list-item approval-request';
            item.innerHTML = `
                <div class="settings-list-item-info">
                    <i data-lucide="${approval.type === 'chore' ? 'badge-check' : 'gift'}"></i>
                    <div><strong>${escapeHTML(approval.memberName)} · ${escapeHTML(approval.title)}</strong><div class="settings-meta">${approval.type === 'chore' ? `Award ${approval.points} points` : `Spend ${approval.points} points`} · ${escapeHTML(formatActivityTime(approval.requestedAt))}</div></div>
                </div>
                <div class="approval-actions">
                    <button type="button" class="icon-only-btn delete" data-action="reject-request" data-id="${approval.id}" aria-label="Reject request"><i data-lucide="x"></i></button>
                    <button type="button" class="icon-only-btn approve" data-action="approve-request" data-id="${approval.id}" aria-label="Approve request"><i data-lucide="check"></i></button>
                </div>`;
            approvalsContainer.appendChild(item);
        });
    }

    historyContainer.innerHTML = '';
    const history = [...(state.history || [])].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 100);
    if (!history.length) {
        historyContainer.innerHTML = '<div class="settings-empty">Completed chores and claimed rewards will appear here.</div>';
    } else {
        history.forEach(entry => {
            const row = document.createElement('div');
            row.className = 'activity-row';
            const icon = entry.type === 'reward_claimed' ? 'gift' : entry.type === 'chore_reopened' ? 'undo-2' : 'check';
            const verb = entry.type === 'reward_claimed' ? 'claimed' : entry.type === 'chore_reopened' ? 'reopened' : 'completed';
            row.innerHTML = `
                <span class="activity-icon"><i data-lucide="${icon}"></i></span>
                <span class="activity-copy"><strong>${escapeHTML(entry.memberName)}</strong> ${verb} ${escapeHTML(entry.title)}<small>${escapeHTML(formatActivityTime(entry.occurredAt))}</small></span>
                <span class="activity-points ${entry.points < 0 ? 'negative' : ''}">${entry.points > 0 ? '+' : ''}${entry.points}</span>`;
            historyContainer.appendChild(row);
        });
    }
    if (window.lucide) lucide.createIcons();
}

function formatActivityTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    const day = getTodayString() === `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        ? 'Today'
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${day} · ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

window.reviewApproval = async function(id, action) {
    try {
        const response = await fetch(`/api/admin/approvals/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
        const envelope = await response.json();
        if (response.status === 401) {
            document.getElementById('settings-modal').classList.add('hidden');
            openPinModal('activity');
            return;
        }
        if (!response.ok) throw new Error(envelope.error || 'Request could not be reviewed');
        applyServerEnvelope(envelope);
        renderActivitySettings();
        if (action === 'approve') {
            celebrate({ particleCount: 36, spread: 54, origin: { y: 0.7 } });
            showToast('Request approved.');
        } else showToast('Request declined.');
    } catch (error) {
        showToast(error.message, true);
    }
};

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
                <div class="sidebar-event-dot" style="background-color: ${safeColor(ev.color)}; width:12px; height:12px;"></div>
                <div>
                    <strong>${escapeHTML(ev.title)}</strong>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.15rem;">
                        ${escapeHTML(ev.date)} ${ev.time ? `&bull; ${escapeHTML(ev.time)}` : ''}
                    </div>
                </div>
            </div>
            <div class="settings-item-actions">
                <button type="button" aria-label="Delete ${escapeHTML(ev.title)}" data-action="delete-event" data-id="${ev.id}" class="icon-only-btn delete"><i data-lucide="trash-2"></i></button>
            </div>
        `;
        container.appendChild(item);
    });
    if (window.lucide) lucide.createIcons();
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

window.saveParentPin = async function() {
    const pinInput = document.getElementById('parent-pin-input');
    const pin = pinInput.value.trim();
    
    if (pin.length !== 4 || isNaN(pin)) {
        showToast('Enter exactly four digits.', true);
        return;
    }

    try {
        const response = await fetch('/api/admin/pin', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'PIN could not be saved');
        pinEnabled = true;
        if (result.state) applyServerEnvelope(result, false);
        updatePinSecurityUI();
        document.getElementById('settings-modal').classList.add('hidden');
        showToast('Parent PIN enabled. Unlock Manage to make changes.');
    } catch (error) {
        showToast(error.message, true);
    }
};

window.disableParentPin = async function() {
    const confirmed = await showConfirm("Disable Security PIN?", "Are you sure you want to disable the Settings lock? Anyone will be able to edit chores and points.");
    if (confirmed) {
        try {
            const response = await fetch('/api/admin/pin', { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'PIN could not be disabled');
            pinEnabled = false;
            if (result.state) applyServerEnvelope(result, false);
            updatePinSecurityUI();
            showToast('Parent PIN disabled.');
        } catch (error) {
            showToast(error.message, true);
        }
    }
};

function updatePinSecurityUI() {
    const pinInput = document.getElementById('parent-pin-input');
    const btnSave = document.getElementById('btn-save-pin');
    const btnDisable = document.getElementById('btn-disable-pin');
    if (!pinInput || !btnSave || !btnDisable) return;
    
    if (pinEnabled) {
        pinInput.value = '0000';
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
        setTimeout(async () => {
            try {
                const response = await fetch('/api/admin/unlock', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin: pinBuffer })
                });
                if (response.ok) {
                closePinModal();
                document.getElementById('settings-modal').classList.remove('hidden');
                populateChoreKidSelect();
                populateExceptionMemberSelect();
                switchTab(targetSettingsTab);
                return;
                }
            } catch (error) {
                showToast('The household server is unavailable.', true);
            }

                const card = document.querySelector('.pin-card');
                if (card) {
                    card.classList.add('shake');
                    setTimeout(() => card.classList.remove('shake'), 400);
                }
                pinBuffer = '';
                updatePinDotsDisplay();
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

window.openHouseholdSettings = function() {
    openSettingsForTab('household');
};
