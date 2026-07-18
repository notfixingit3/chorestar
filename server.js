const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const path = require('path');

const { version: APP_VERSION } = require('./package.json');
const DEFAULT_PORT = 80;
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const ASSET_PATHS = new Map([
    ['/app.js', path.join(__dirname, 'app.js')],
    ['/styles.css', path.join(__dirname, 'styles.css')],
    ['/chorestar-mark.svg', path.join(__dirname, 'chorestar-mark.svg')],
    ['/vendor/lucide.js', path.join(__dirname, 'node_modules/lucide/dist/umd/lucide.min.js')],
    ['/vendor/confetti.js', path.join(__dirname, 'node_modules/canvas-confetti/dist/confetti.browser.js')],
    ['/vendor/atkinson-400.woff2', path.join(__dirname, 'node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2')],
    ['/vendor/atkinson-700.woff2', path.join(__dirname, 'node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2')]
]);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dateString(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function relativeDateString(offsetDays) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return dateString(date);
}

function createDefaultState() {
    return {
        kids: [
            { id: 'kid-one', name: 'Kid 1', color: '#e84d8a', points: 0, role: 'kid', avatar: 'K1' },
            { id: 'kid-two', name: 'Kid 2', color: '#4f7cff', points: 0, role: 'kid', avatar: 'K2' },
            { id: 'parent-one', name: 'Parent 1', color: '#f0bd3d', points: 0, role: 'parent', avatar: 'P1' },
            { id: 'parent-two', name: 'Parent 2', color: '#3fa675', points: 0, role: 'parent', avatar: 'P2' }
        ],
        chores: [
            { id: 'chore-1', title: 'Make your bed', points: 5, frequency: 'daily', daysOfWeek: [], kidId: 'all', dueDate: '', requiresApproval: false, completedAt: '' },
            { id: 'chore-2', title: 'Brush teeth and wash face', points: 5, frequency: 'daily', daysOfWeek: [], kidId: 'all', dueDate: '', requiresApproval: false, completedAt: '' },
            { id: 'chore-3', title: 'Empty dishwasher', points: 10, frequency: 'daily', daysOfWeek: [], kidId: 'all', dueDate: '', requiresApproval: false, completedAt: '' },
            { id: 'chore-4', title: 'Put out trash bins', points: 15, frequency: 'days', daysOfWeek: ['Tue', 'Fri'], kidId: 'all', dueDate: '', requiresApproval: false, completedAt: '' },
            { id: 'chore-5', title: 'Clean bedroom', points: 25, frequency: 'weekly', daysOfWeek: [], kidId: 'all', dueDate: '', requiresApproval: false, completedAt: '' }
        ],
        activeChores: [],
        rewards: [
            { id: 'reward-1', title: '30 minutes of screen time', cost: 30, requiresApproval: false },
            { id: 'reward-2', title: 'Ice cream sundae', cost: 50, requiresApproval: false },
            { id: 'reward-3', title: 'Stay up 30 minutes late', cost: 60, requiresApproval: false },
            { id: 'reward-4', title: 'New toy under $10', cost: 100, requiresApproval: false }
        ],
        events: [
            { id: 'event-1', title: 'Soccer practice', date: relativeDateString(0), time: '5:00 PM', color: '#e84d8a' },
            { id: 'event-2', title: 'Dentist appointment', date: relativeDateString(1), time: '10:00 AM', color: '#4f7cff' },
            { id: 'event-3', title: 'Family movie night', date: relativeDateString(2), time: '7:00 PM', color: '#3fa675' }
        ],
        approvals: [],
        history: [],
        exceptions: [],
        notes: [],
        lastResetDate: ''
    };
}

function cleanText(value, maxLength) {
    return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

function cleanId(value, prefix) {
    const id = cleanText(value, 96);
    return /^[a-zA-Z0-9_-]+$/.test(id) ? id : `${prefix}-${crypto.randomUUID()}`;
}

function cleanNumber(value, min, max, fallback = min) {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function cleanColor(value) {
    const color = cleanText(value, 7).toLowerCase();
    return /^#[0-9a-f]{6}$/.test(color) ? color : '#4f7cff';
}

function cleanDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

function cleanTimestamp(value) {
    const timestamp = cleanText(value, 40);
    return timestamp && Number.isFinite(Date.parse(timestamp)) ? timestamp : '';
}

function normalizeState(input) {
    const source = input && typeof input === 'object' ? input : {};
    const kids = Array.isArray(source.kids) ? source.kids.slice(0, 32).map(kid => ({
        id: cleanId(kid.id, 'member'),
        name: cleanText(kid.name, 48) || 'Family member',
        color: cleanColor(kid.color),
        points: cleanNumber(kid.points, 0, 100000, 0),
        role: kid.role === 'parent' ? 'parent' : 'kid',
        avatar: cleanText(kid.avatar, 8) || cleanText(kid.name, 1).toUpperCase() || '?'
    })) : [];
    const kidIds = new Set(kids.map(kid => kid.id));
    const chores = Array.isArray(source.chores) ? source.chores.slice(0, 256).map(chore => ({
        id: cleanId(chore.id, 'chore'),
        title: cleanText(chore.title, 120) || 'Untitled chore',
        points: cleanNumber(chore.points, 0, 1000, 5),
        frequency: ['daily', 'weekly', 'days', 'once'].includes(chore.frequency) ? chore.frequency : 'daily',
        daysOfWeek: Array.isArray(chore.daysOfWeek) ? chore.daysOfWeek.filter(day => DAYS.includes(day)).slice(0, 7) : [],
        kidId: chore.kidId === 'all' || kidIds.has(chore.kidId) ? chore.kidId : 'all',
        dueDate: cleanDate(chore.dueDate),
        requiresApproval: Boolean(chore.requiresApproval),
        completedAt: cleanTimestamp(chore.completedAt)
    })) : [];
    const choreIds = new Set(chores.map(chore => chore.id));
    const activeChores = Array.isArray(source.activeChores) ? source.activeChores.slice(0, 4096)
        .filter(chore => kidIds.has(chore.kidId) && choreIds.has(chore.choreId))
        .map(chore => ({
            id: cleanId(chore.id, 'active'),
            choreId: cleanId(chore.choreId, 'chore'),
            kidId: cleanId(chore.kidId, 'member'),
            title: cleanText(chore.title, 120) || 'Untitled chore',
            points: cleanNumber(chore.points, 0, 1000, 5),
            frequency: ['daily', 'weekly', 'days', 'once'].includes(chore.frequency) ? chore.frequency : 'daily',
            daysOfWeek: Array.isArray(chore.daysOfWeek) ? chore.daysOfWeek.filter(day => DAYS.includes(day)).slice(0, 7) : [],
            completed: Boolean(chore.completed),
            pendingApproval: Boolean(chore.pendingApproval) && !chore.completed,
            requiresApproval: Boolean(chore.requiresApproval),
            completedAt: cleanTimestamp(chore.completedAt),
            dateAssigned: cleanDate(chore.dateAssigned) || dateString()
        })) : [];
    const activeChoreIds = new Set(activeChores.map(chore => chore.id));
    const rewards = Array.isArray(source.rewards) ? source.rewards.slice(0, 256).map(reward => ({
        id: cleanId(reward.id, 'reward'),
        title: cleanText(reward.title, 100) || 'Untitled reward',
        cost: cleanNumber(reward.cost, 1, 100000, 10),
        requiresApproval: Boolean(reward.requiresApproval)
    })) : [];
    const events = Array.isArray(source.events) ? source.events.slice(0, 256).map(event => ({
        id: cleanId(event.id, 'event'),
        title: cleanText(event.title, 120) || 'Untitled event',
        date: /^\d{4}-\d{2}-\d{2}$/.test(event.date) ? event.date : dateString(),
        time: cleanText(event.time, 48),
        color: cleanColor(event.color)
    })) : [];
    const rewardIds = new Set(rewards.map(reward => reward.id));
    const approvals = Array.isArray(source.approvals) ? source.approvals.slice(0, 256)
        .filter(approval => kidIds.has(approval.memberId) && (
            (approval.type === 'chore' && activeChoreIds.has(approval.activeChoreId)) ||
            (approval.type === 'reward' && rewardIds.has(approval.rewardId))
        ))
        .map(approval => ({
            id: cleanId(approval.id, 'approval'),
            type: approval.type === 'reward' ? 'reward' : 'chore',
            memberId: cleanId(approval.memberId, 'member'),
            memberName: cleanText(approval.memberName, 48) || 'Family member',
            activeChoreId: approval.type === 'chore' ? cleanId(approval.activeChoreId, 'active') : '',
            rewardId: approval.type === 'reward' ? cleanId(approval.rewardId, 'reward') : '',
            title: cleanText(approval.title, 120) || 'Untitled request',
            points: cleanNumber(approval.points, 0, 100000, 0),
            requestedAt: cleanTimestamp(approval.requestedAt) || new Date().toISOString()
        })) : [];
    const history = Array.isArray(source.history) ? source.history.slice(-1000).map(entry => ({
        id: cleanId(entry.id, 'history'),
        type: ['chore_completed', 'chore_reopened', 'reward_claimed'].includes(entry.type) ? entry.type : 'chore_completed',
        memberId: cleanId(entry.memberId, 'member'),
        memberName: cleanText(entry.memberName, 48) || 'Family member',
        title: cleanText(entry.title, 120) || 'Untitled activity',
        points: cleanNumber(entry.points, -100000, 100000, 0),
        occurredAt: cleanTimestamp(entry.occurredAt) || new Date().toISOString()
    })) : [];
    const exceptions = Array.isArray(source.exceptions) ? source.exceptions.slice(0, 128).map(exception => ({
        id: cleanId(exception.id, 'pause'),
        kidId: exception.kidId === 'all' || kidIds.has(exception.kidId) ? exception.kidId : 'all',
        startDate: cleanDate(exception.startDate) || dateString(),
        endDate: cleanDate(exception.endDate) || cleanDate(exception.startDate) || dateString(),
        reason: cleanText(exception.reason, 120)
    })).map(exception => exception.endDate < exception.startDate ? { ...exception, endDate: exception.startDate } : exception) : [];
    const notes = Array.isArray(source.notes) ? source.notes.slice(0, 128).map(note => ({
        id: cleanId(note.id, 'note'),
        text: cleanText(note.text, 240) || 'Household note',
        expiresDate: cleanDate(note.expiresDate),
        createdAt: cleanTimestamp(note.createdAt) || new Date().toISOString()
    })) : [];

    return {
        kids,
        chores,
        activeChores,
        rewards,
        events,
        approvals,
        history,
        exceptions,
        notes,
        lastResetDate: /^\d{4}-\d{2}-\d{2}$/.test(source.lastResetDate) ? source.lastResetDate : ''
    };
}

function isRoutinePaused(state, kidId, day) {
    return state.exceptions.some(exception =>
        (exception.kidId === 'all' || exception.kidId === kidId) &&
        exception.startDate <= day && exception.endDate >= day);
}

function initializeActiveChores(state, today) {
    const [year, month, day] = today.split('-').map(Number);
    const dayName = DAYS[new Date(year, month - 1, day).getDay()];
    for (const chore of state.chores) {
        const scheduled = chore.frequency === 'daily' || chore.frequency === 'weekly' ||
            (chore.frequency === 'days' && chore.daysOfWeek.includes(dayName)) ||
            (chore.frequency === 'once' && chore.dueDate && chore.dueDate <= today && !chore.completedAt);
        if (!scheduled) continue;

        const memberIds = chore.kidId === 'all' ? state.kids.map(kid => kid.id) : [chore.kidId];
        for (const kidId of memberIds) {
            if (chore.frequency !== 'once' && isRoutinePaused(state, kidId, today)) continue;
            const exists = state.activeChores.some(active =>
                active.choreId === chore.id && active.kidId === kidId &&
                (active.pendingApproval || active.frequency === 'weekly' || active.frequency === 'once' || active.dateAssigned === today));
            if (exists) continue;
            state.activeChores.push({
                id: `${kidId}-${chore.id}-${today}`,
                choreId: chore.id,
                kidId,
                title: chore.title,
                points: chore.points,
                frequency: chore.frequency,
                daysOfWeek: chore.daysOfWeek,
                completed: false,
                pendingApproval: false,
                requiresApproval: chore.requiresApproval,
                completedAt: '',
                dateAssigned: chore.frequency === 'once' ? chore.dueDate : today
            });
        }
    }
}

function ensureCurrentDay(state, today = dateString()) {
    let changed = false;
    if (state.lastResetDate !== today) {
        const [year, month, day] = today.split('-').map(Number);
        const isMonday = new Date(year, month - 1, day).getDay() === 1;
        state.activeChores = state.activeChores.filter(chore =>
            chore.pendingApproval ||
            (chore.frequency === 'once' && !chore.completed) ||
            (chore.frequency === 'weekly' && !isMonday));
        state.lastResetDate = today;
        changed = true;
    }
    const beforePauseReconcile = state.activeChores.length;
    state.activeChores = state.activeChores.filter(chore =>
        chore.completed || chore.pendingApproval || chore.frequency === 'once' || !isRoutinePaused(state, chore.kidId, today));
    if (state.activeChores.length !== beforePauseReconcile) changed = true;
    const before = state.activeChores.length;
    initializeActiveChores(state, today);
    return changed || before !== state.activeChores.length;
}

function appendHistory(state, entry) {
    state.history.push({
        id: `history-${crypto.randomUUID()}`,
        occurredAt: new Date().toISOString(),
        ...entry
    });
    if (state.history.length > 1000) state.history = state.history.slice(-1000);
}

function completeActiveChore(state, active) {
    const member = state.kids.find(item => item.id === active.kidId);
    if (!member || active.completed) return false;
    active.completed = true;
    active.pendingApproval = false;
    active.completedAt = new Date().toISOString();
    if (member.role !== 'parent') member.points += active.points;
    const template = state.chores.find(chore => chore.id === active.choreId);
    if (template?.frequency === 'once') {
        const instances = state.activeChores.filter(chore => chore.choreId === active.choreId);
        template.completedAt = instances.length > 0 && instances.every(chore => chore.completed) ? active.completedAt : '';
    }
    appendHistory(state, {
        type: 'chore_completed',
        memberId: member.id,
        memberName: member.name,
        title: active.title,
        points: member.role === 'parent' ? 0 : active.points
    });
    return true;
}

function reopenActiveChore(state, active) {
    const member = state.kids.find(item => item.id === active.kidId);
    if (!member || !active.completed) return false;
    active.completed = false;
    active.completedAt = '';
    if (member.role !== 'parent') member.points = Math.max(0, member.points - active.points);
    const template = state.chores.find(chore => chore.id === active.choreId);
    if (template?.frequency === 'once') template.completedAt = '';
    appendHistory(state, {
        type: 'chore_reopened',
        memberId: member.id,
        memberName: member.name,
        title: active.title,
        points: member.role === 'parent' ? 0 : -active.points
    });
    return true;
}

function hashPin(pin) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(pin, salt, 32).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPin(pin, storedHash) {
    if (!storedHash || !storedHash.includes(':')) return false;
    const [salt, expectedHex] = storedHash.split(':');
    const actual = crypto.scryptSync(pin, salt, 32);
    const expected = Buffer.from(expectedHex, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function parseCookies(header = '') {
    return Object.fromEntries(header.split(';').map(part => part.trim().split('=').map(decodeURIComponent)).filter(pair => pair.length === 2));
}

function createApp(options = {}) {
    const app = express();
    const dataDir = options.dataDir || path.join(__dirname, 'data');
    const stateFile = path.join(dataDir, 'state.json');
    const sessions = new Map();
    let document = { revision: 0, state: createDefaultState(), pinHash: '' };
    let mutationQueue = Promise.resolve();

    fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(stateFile)) {
        try {
            const stored = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
            if (stored && stored.state) {
                document = {
                    revision: cleanNumber(stored.revision, 0, Number.MAX_SAFE_INTEGER, 0),
                    state: normalizeState(stored.state),
                    pinHash: typeof stored.pinHash === 'string' ? stored.pinHash : ''
                };
            } else {
                const legacyPin = /^\d{4}$/.test(stored.parentPin) ? hashPin(stored.parentPin) : '';
                document = { revision: 0, state: normalizeState(stored), pinHash: legacyPin };
            }
        } catch (error) {
            console.error('State file could not be read; starting from defaults:', error.message);
        }
    }
    ensureCurrentDay(document.state);

    const envelope = () => ({
        version: APP_VERSION,
        revision: document.revision,
        pinEnabled: Boolean(document.pinHash),
        state: document.state
    });

    const persist = async () => {
        const temporaryFile = `${stateFile}.${process.pid}.tmp`;
        await fs.promises.writeFile(temporaryFile, JSON.stringify(document, null, 2), { encoding: 'utf8', mode: 0o600 });
        await fs.promises.rename(temporaryFile, stateFile);
    };

    const mutate = handler => {
        const operation = mutationQueue.then(async () => {
            const result = await handler();
            if (result !== false) await persist();
            return result;
        });
        mutationQueue = operation.catch(() => {});
        return operation;
    };

    const hasAdminSession = req => {
        if (!document.pinHash) return true;
        const token = parseCookies(req.headers.cookie).chorestar_admin;
        const expiresAt = token && sessions.get(token);
        if (!expiresAt || expiresAt < Date.now()) {
            if (token) sessions.delete(token);
            return false;
        }
        return true;
    };

    const requireAdmin = (req, res, next) => {
        if (hasAdminSession(req)) return next();
        return res.status(401).json({ error: 'Parent unlock required' });
    };

    app.disable('x-powered-by');
    app.use(express.json({ limit: '1mb' }));
    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
        next();
    });

    app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
    app.get([...ASSET_PATHS.keys()], (req, res) => res.sendFile(ASSET_PATHS.get(req.path)));
    app.get('/healthz', (req, res) => res.json({ status: 'ok', version: APP_VERSION }));

    app.get('/api/state', async (req, res, next) => {
        try {
            if (ensureCurrentDay(document.state)) {
                document.revision += 1;
                await mutate(() => true);
            }
            res.setHeader('Cache-Control', 'no-store');
            res.json(envelope());
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/actions/toggle', async (req, res, next) => {
        try {
            const activeChoreId = cleanText(req.body?.activeChoreId, 128);
            let found = false;
            await mutate(() => {
                ensureCurrentDay(document.state);
                const active = document.state.activeChores.find(chore => chore.id === activeChoreId);
                if (!active) return false;
                found = true;
                const member = document.state.kids.find(item => item.id === active.kidId);
                if (!member) return false;
                if (active.completed) {
                    reopenActiveChore(document.state, active);
                } else if (active.pendingApproval) {
                    active.pendingApproval = false;
                    document.state.approvals = document.state.approvals.filter(approval => approval.activeChoreId !== active.id);
                } else if (active.requiresApproval && member.role !== 'parent') {
                    active.pendingApproval = true;
                    document.state.approvals.push({
                        id: `approval-${crypto.randomUUID()}`,
                        type: 'chore',
                        memberId: member.id,
                        memberName: member.name,
                        activeChoreId: active.id,
                        rewardId: '',
                        title: active.title,
                        points: active.points,
                        requestedAt: new Date().toISOString()
                    });
                } else {
                    completeActiveChore(document.state, active);
                }
                document.revision += 1;
                return true;
            });
            if (!found) return res.status(404).json({ error: 'Chore was not found', ...envelope() });
            res.json(envelope());
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/actions/claim', async (req, res, next) => {
        try {
            const kidId = cleanText(req.body?.kidId, 96);
            const rewardId = cleanText(req.body?.rewardId, 96);
            let claimed = false;
            let pendingApproval = false;
            await mutate(() => {
                const kid = document.state.kids.find(member => member.id === kidId && member.role !== 'parent');
                const reward = document.state.rewards.find(item => item.id === rewardId);
                if (!kid || !reward || kid.points < reward.cost) return false;
                if (document.state.approvals.some(approval => approval.type === 'reward' && approval.memberId === kidId && approval.rewardId === rewardId)) {
                    return false;
                }
                if (reward.requiresApproval) {
                    pendingApproval = true;
                    document.state.approvals.push({
                        id: `approval-${crypto.randomUUID()}`,
                        type: 'reward',
                        memberId: kid.id,
                        memberName: kid.name,
                        activeChoreId: '',
                        rewardId: reward.id,
                        title: reward.title,
                        points: reward.cost,
                        requestedAt: new Date().toISOString()
                    });
                } else {
                    kid.points -= reward.cost;
                    appendHistory(document.state, {
                        type: 'reward_claimed',
                        memberId: kid.id,
                        memberName: kid.name,
                        title: reward.title,
                        points: -reward.cost
                    });
                }
                document.revision += 1;
                claimed = true;
                return true;
            });
            if (!claimed) return res.status(409).json({ error: 'Reward is no longer available', ...envelope() });
            return res.json({ pendingApproval, ...envelope() });
        } catch (error) {
            return next(error);
        }
    });

    app.get('/api/admin/session', (req, res) => res.json({ unlocked: hasAdminSession(req), pinEnabled: Boolean(document.pinHash) }));

    app.post('/api/admin/unlock', (req, res) => {
        const pin = cleanText(req.body?.pin, 4);
        if (!/^\d{4}$/.test(pin) || !verifyPin(pin, document.pinHash)) {
            return res.status(401).json({ error: 'Incorrect PIN' });
        }
        const token = crypto.randomBytes(32).toString('base64url');
        sessions.set(token, Date.now() + SESSION_TTL_SECONDS * 1000);
        res.setHeader('Set-Cookie', `chorestar_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}`);
        return res.json({ unlocked: true });
    });

    app.put('/api/admin/state', requireAdmin, async (req, res, next) => {
        try {
            const revision = Number.parseInt(req.body?.revision, 10);
            let conflict = false;
            await mutate(() => {
                if (revision !== document.revision) {
                    conflict = true;
                    return false;
                }
                document.state = normalizeState(req.body?.state);
                ensureCurrentDay(document.state);
                document.revision += 1;
                return true;
            });
            if (conflict) return res.status(409).json({ error: 'State changed on another device', ...envelope() });
            return res.json(envelope());
        } catch (error) {
            return next(error);
        }
    });

    app.post('/api/admin/approvals/:id/approve', requireAdmin, async (req, res, next) => {
        try {
            const approvalId = cleanText(req.params.id, 128);
            let outcome = 'missing';
            await mutate(() => {
                const approval = document.state.approvals.find(item => item.id === approvalId);
                if (!approval) return false;
                if (approval.type === 'chore') {
                    const active = document.state.activeChores.find(chore => chore.id === approval.activeChoreId);
                    if (!active || !completeActiveChore(document.state, active)) return false;
                } else {
                    const member = document.state.kids.find(item => item.id === approval.memberId && item.role !== 'parent');
                    const reward = document.state.rewards.find(item => item.id === approval.rewardId);
                    if (!member || !reward || member.points < reward.cost) {
                        outcome = 'insufficient';
                        return false;
                    }
                    member.points -= reward.cost;
                    appendHistory(document.state, {
                        type: 'reward_claimed',
                        memberId: member.id,
                        memberName: member.name,
                        title: reward.title,
                        points: -reward.cost
                    });
                }
                document.state.approvals = document.state.approvals.filter(item => item.id !== approvalId);
                ensureCurrentDay(document.state);
                document.revision += 1;
                outcome = 'approved';
                return true;
            });
            if (outcome === 'insufficient') return res.status(409).json({ error: 'The member no longer has enough points', ...envelope() });
            if (outcome !== 'approved') return res.status(404).json({ error: 'Approval request was not found', ...envelope() });
            return res.json(envelope());
        } catch (error) {
            return next(error);
        }
    });

    app.post('/api/admin/approvals/:id/reject', requireAdmin, async (req, res, next) => {
        try {
            const approvalId = cleanText(req.params.id, 128);
            let rejected = false;
            await mutate(() => {
                const approval = document.state.approvals.find(item => item.id === approvalId);
                if (!approval) return false;
                if (approval.type === 'chore') {
                    const active = document.state.activeChores.find(chore => chore.id === approval.activeChoreId);
                    if (active) active.pendingApproval = false;
                }
                document.state.approvals = document.state.approvals.filter(item => item.id !== approvalId);
                document.revision += 1;
                rejected = true;
                return true;
            });
            if (!rejected) return res.status(404).json({ error: 'Approval request was not found', ...envelope() });
            return res.json(envelope());
        } catch (error) {
            return next(error);
        }
    });

    app.put('/api/admin/pin', requireAdmin, async (req, res, next) => {
        try {
            const pin = cleanText(req.body?.pin, 4);
            if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN must contain exactly four digits' });
            await mutate(() => {
                document.pinHash = hashPin(pin);
                document.revision += 1;
                sessions.clear();
                return true;
            });
            return res.json({ success: true, ...envelope() });
        } catch (error) {
            return next(error);
        }
    });

    app.delete('/api/admin/pin', requireAdmin, async (req, res, next) => {
        try {
            await mutate(() => {
                document.pinHash = '';
                document.revision += 1;
                sessions.clear();
                return true;
            });
            res.setHeader('Set-Cookie', 'chorestar_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
            return res.json({ success: true, ...envelope() });
        } catch (error) {
            return next(error);
        }
    });

    app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
    app.use((req, res) => res.status(404).send('Not found'));
    app.use((error, req, res, next) => {
        console.error(error);
        if (res.headersSent) return next(error);
        return res.status(500).json({ error: 'Request failed' });
    });

    return app;
}

if (require.main === module) {
    const port = Number.parseInt(process.env.PORT, 10) || DEFAULT_PORT;
    createApp().listen(port, '0.0.0.0', () => {
        console.log(`ChoreStar ${APP_VERSION} running on port ${port}`);
    });
}

module.exports = { APP_VERSION, createApp, createDefaultState, ensureCurrentDay, normalizeState };
