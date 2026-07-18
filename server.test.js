const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createApp, createDefaultState, ensureCurrentDay } = require('./server');

async function withServer(run) {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chorestar-test-'));
    const server = createApp({ dataDir }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    try {
        await run({ baseUrl, dataDir });
    } finally {
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(dataDir, { recursive: true, force: true });
    }
}

test('first run returns a complete seeded dashboard', async () => {
    await withServer(async ({ baseUrl }) => {
        const response = await fetch(`${baseUrl}/api/state`);
        const body = await response.json();
        assert.equal(response.status, 200);
        assert.equal(body.version, '0.0.1-beta.6');
        assert.ok(body.state.kids.length >= 1);
        assert.ok(body.state.activeChores.length >= 1);
        assert.match(body.state.lastResetDate, /^\d{4}-\d{2}-\d{2}$/);
        assert.equal(body.pinEnabled, false);
    });
});

test('upgrade preserves an existing household state file', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chorestar-upgrade-'));
    const stateFile = path.join(dataDir, 'state.json');
    const existing = {
        revision: 42,
        pinHash: 'stored-pin-hash',
        state: {
            kids: [
                { id: 'existing-child', name: 'Existing Child', color: '#123456', points: 87, role: 'kid', avatar: 'EC' },
                { id: 'existing-parent', name: 'Existing Parent', color: '#654321', points: 0, role: 'parent', avatar: 'EP' }
            ],
            chores: [
                { id: 'existing-chore', title: 'Existing chore', points: 13, frequency: 'weekly', daysOfWeek: [], kidId: 'existing-child' }
            ],
            activeChores: [{
                id: 'existing-active',
                choreId: 'existing-chore',
                kidId: 'existing-child',
                title: 'Existing chore',
                points: 13,
                frequency: 'weekly',
                daysOfWeek: [],
                completed: true,
                dateAssigned: '2026-07-01'
            }],
            rewards: [{ id: 'existing-reward', title: 'Existing reward', cost: 75 }],
            events: [{ id: 'existing-event', title: 'Existing event', date: '2026-08-01', time: '6:30 PM', color: '#123456' }],
            lastResetDate: new Date().toLocaleDateString('en-CA')
        }
    };
    fs.writeFileSync(stateFile, JSON.stringify(existing));

    const server = createApp({ dataDir }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
        const body = await fetch(`http://127.0.0.1:${server.address().port}/api/state`).then(response => response.json());
        assert.equal(body.revision, existing.revision);
        assert.equal(body.pinEnabled, true);
        assert.deepEqual(body.state.kids, existing.state.kids);
        assert.deepEqual(body.state.events, existing.state.events);
        assert.equal(body.state.chores[0].id, existing.state.chores[0].id);
        assert.equal(body.state.chores[0].title, existing.state.chores[0].title);
        assert.equal(body.state.activeChores[0].id, existing.state.activeChores[0].id);
        assert.equal(body.state.activeChores[0].completed, true);
        assert.equal(body.state.rewards[0].title, existing.state.rewards[0].title);
        assert.equal(body.state.lastResetDate, existing.state.lastResetDate);
        assert.deepEqual(body.state.approvals, []);
        assert.deepEqual(body.state.history, []);
        assert.deepEqual(body.state.exceptions, []);
        assert.deepEqual(body.state.notes, []);
    } finally {
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(dataDir, { recursive: true, force: true });
    }
});

test('only public assets are served', async () => {
    await withServer(async ({ baseUrl }) => {
        assert.equal((await fetch(`${baseUrl}/`)).status, 200);
        assert.equal((await fetch(`${baseUrl}/styles.css`)).status, 200);
        assert.equal((await fetch(`${baseUrl}/package.json`)).status, 404);
        assert.equal((await fetch(`${baseUrl}/data/state.json`)).status, 404);
    });
});

test('browser shell has no public CDN or inline event-handler dependency', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /https?:\/\//);
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
});

test('toggle action updates completion and points atomically', async () => {
    await withServer(async ({ baseUrl }) => {
        const initial = await fetch(`${baseUrl}/api/state`).then(response => response.json());
        const active = initial.state.activeChores.find(chore => {
            const member = initial.state.kids.find(kid => kid.id === chore.kidId);
            return member?.role === 'kid';
        });
        const pointsBefore = initial.state.kids.find(kid => kid.id === active.kidId).points;
        const response = await fetch(`${baseUrl}/api/actions/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activeChoreId: active.id })
        });
        const body = await response.json();
        assert.equal(response.status, 200);
        assert.equal(body.state.activeChores.find(chore => chore.id === active.id).completed, true);
        assert.equal(body.state.kids.find(kid => kid.id === active.kidId).points, pointsBefore + active.points);
        assert.equal(body.revision, initial.revision + 1);
        assert.equal(body.state.history.at(-1).type, 'chore_completed');
    });
});

test('one-off chore approval awards points only after parent review', async () => {
    await withServer(async ({ baseUrl }) => {
        const initial = await fetch(`${baseUrl}/api/state`).then(response => response.json());
        const kid = initial.state.kids.find(member => member.role === 'kid');
        const today = initial.state.lastResetDate;
        const configured = structuredClone(initial.state);
        configured.chores.push({
            id: 'one-off-approved',
            title: 'Organize the garage shelf',
            points: 35,
            frequency: 'once',
            daysOfWeek: [],
            kidId: kid.id,
            dueDate: today,
            requiresApproval: true,
            completedAt: ''
        });
        const saved = await fetch(`${baseUrl}/api/admin/state`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ revision: initial.revision, state: configured })
        }).then(response => response.json());
        const active = saved.state.activeChores.find(chore => chore.choreId === 'one-off-approved');
        const pointsBefore = saved.state.kids.find(member => member.id === kid.id).points;

        const requested = await fetch(`${baseUrl}/api/actions/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activeChoreId: active.id })
        }).then(response => response.json());
        assert.equal(requested.state.activeChores.find(chore => chore.id === active.id).pendingApproval, true);
        assert.equal(requested.state.kids.find(member => member.id === kid.id).points, pointsBefore);
        assert.equal(requested.state.approvals.length, 1);
        assert.equal(requested.state.history.length, 0);

        const approval = requested.state.approvals[0];
        const approved = await fetch(`${baseUrl}/api/admin/approvals/${approval.id}/approve`, { method: 'POST' })
            .then(response => response.json());
        assert.equal(approved.state.activeChores.find(chore => chore.id === active.id).completed, true);
        assert.equal(approved.state.kids.find(member => member.id === kid.id).points, pointsBefore + 35);
        assert.equal(approved.state.approvals.length, 0);
        assert.match(approved.state.chores.find(chore => chore.id === 'one-off-approved').completedAt, /^\d{4}-\d{2}-\d{2}T/);
        assert.equal(approved.state.history.at(-1).type, 'chore_completed');
    });
});

test('overdue one-off chores carry forward without duplication', () => {
    const state = createDefaultState();
    state.chores = [{
        id: 'one-off-carry',
        title: 'Return library books',
        points: 20,
        frequency: 'once',
        daysOfWeek: [],
        kidId: state.kids.find(member => member.role === 'kid').id,
        dueDate: '2026-07-01',
        requiresApproval: false,
        completedAt: ''
    }];
    state.activeChores = [];
    state.lastResetDate = '2026-07-01';

    ensureCurrentDay(state, '2026-07-03');
    assert.equal(state.activeChores.length, 1);
    assert.equal(state.activeChores[0].dateAssigned, '2026-07-01');

    const activeId = state.activeChores[0].id;
    ensureCurrentDay(state, '2026-07-04');
    assert.equal(state.activeChores.length, 1);
    assert.equal(state.activeChores[0].id, activeId);
});

test('reward approval defers point deduction and records the claim', async () => {
    await withServer(async ({ baseUrl }) => {
        const initial = await fetch(`${baseUrl}/api/state`).then(response => response.json());
        const configured = structuredClone(initial.state);
        const kid = configured.kids.find(member => member.role === 'kid');
        kid.points = 100;
        configured.rewards[0].requiresApproval = true;
        const saved = await fetch(`${baseUrl}/api/admin/state`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ revision: initial.revision, state: configured })
        }).then(response => response.json());
        const reward = saved.state.rewards[0];

        const requested = await fetch(`${baseUrl}/api/actions/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kidId: kid.id, rewardId: reward.id })
        }).then(response => response.json());
        assert.equal(requested.pendingApproval, true);
        assert.equal(requested.state.kids.find(member => member.id === kid.id).points, 100);

        const approved = await fetch(`${baseUrl}/api/admin/approvals/${requested.state.approvals[0].id}/approve`, { method: 'POST' })
            .then(response => response.json());
        assert.equal(approved.state.kids.find(member => member.id === kid.id).points, 100 - reward.cost);
        assert.equal(approved.state.history.at(-1).type, 'reward_claimed');
        assert.equal(approved.state.history.at(-1).points, -reward.cost);
    });
});

test('routine pause removes incomplete recurring work and resumes it safely', async () => {
    await withServer(async ({ baseUrl }) => {
        const initial = await fetch(`${baseUrl}/api/state`).then(response => response.json());
        const configured = structuredClone(initial.state);
        const kid = configured.kids.find(member => member.role === 'kid');
        configured.notes.push({ id: 'note-test', text: 'Trash pickup is early', expiresDate: configured.lastResetDate, createdAt: new Date().toISOString() });
        configured.exceptions.push({
            id: 'pause-test',
            kidId: kid.id,
            startDate: configured.lastResetDate,
            endDate: configured.lastResetDate,
            reason: 'Away for the day'
        });
        const paused = await fetch(`${baseUrl}/api/admin/state`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ revision: initial.revision, state: configured })
        }).then(response => response.json());
        assert.equal(paused.state.activeChores.some(chore => chore.kidId === kid.id && chore.frequency !== 'once'), false);
        assert.equal(paused.state.notes[0].text, 'Trash pickup is early');

        const resumedState = structuredClone(paused.state);
        resumedState.exceptions = [];
        const resumed = await fetch(`${baseUrl}/api/admin/state`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ revision: paused.revision, state: resumedState })
        }).then(response => response.json());
        assert.equal(resumed.state.activeChores.some(chore => chore.kidId === kid.id), true);
        assert.equal(resumed.state.notes[0].text, 'Trash pickup is early');
    });
});

test('stale administrative writes return the latest state', async () => {
    await withServer(async ({ baseUrl }) => {
        const initial = await fetch(`${baseUrl}/api/state`).then(response => response.json());
        const firstState = structuredClone(initial.state);
        firstState.events.push({
            id: 'event-test',
            title: 'Test event',
            date: firstState.lastResetDate,
            time: '4:00 PM',
            color: '#4f7cff'
        });
        const firstResponse = await fetch(`${baseUrl}/api/admin/state`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ revision: initial.revision, state: firstState })
        });
        assert.equal(firstResponse.status, 200);

        const staleResponse = await fetch(`${baseUrl}/api/admin/state`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ revision: initial.revision, state: initial.state })
        });
        const staleBody = await staleResponse.json();
        assert.equal(staleResponse.status, 409);
        assert.ok(staleBody.state.events.some(event => event.id === 'event-test'));
    });
});

test('parent PIN is hashed and protects administrative writes', async () => {
    await withServer(async ({ baseUrl, dataDir }) => {
        const initial = await fetch(`${baseUrl}/api/state`).then(response => response.json());
        const pinResponse = await fetch(`${baseUrl}/api/admin/pin`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: '2468' })
        });
        const pinBody = await pinResponse.json();
        assert.equal(pinResponse.status, 200);
        assert.equal(pinBody.pinEnabled, true);
        assert.equal(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8').includes('2468'), false);

        const blocked = await fetch(`${baseUrl}/api/admin/state`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ revision: pinBody.revision, state: initial.state })
        });
        assert.equal(blocked.status, 401);

        const wrongPin = await fetch(`${baseUrl}/api/admin/unlock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: '1111' })
        });
        assert.equal(wrongPin.status, 401);

        const unlock = await fetch(`${baseUrl}/api/admin/unlock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: '2468' })
        });
        assert.equal(unlock.status, 200);
        const cookie = unlock.headers.get('set-cookie').split(';')[0];
        const allowed = await fetch(`${baseUrl}/api/admin/state`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ revision: pinBody.revision, state: initial.state })
        });
        assert.equal(allowed.status, 200);
    });
});

test('parent PIN protects approval decisions', async () => {
    await withServer(async ({ baseUrl }) => {
        const initial = await fetch(`${baseUrl}/api/state`).then(response => response.json());
        const configured = structuredClone(initial.state);
        const active = configured.activeChores.find(chore => {
            const member = configured.kids.find(item => item.id === chore.kidId);
            return member?.role === 'kid';
        });
        active.requiresApproval = true;
        const saved = await fetch(`${baseUrl}/api/admin/state`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ revision: initial.revision, state: configured })
        }).then(response => response.json());
        const requested = await fetch(`${baseUrl}/api/actions/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activeChoreId: active.id })
        }).then(response => response.json());
        const approvalId = requested.state.approvals[0].id;

        const pinResponse = await fetch(`${baseUrl}/api/admin/pin`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: '2468' })
        });
        assert.equal(pinResponse.status, 200);

        const blocked = await fetch(`${baseUrl}/api/admin/approvals/${approvalId}/approve`, { method: 'POST' });
        assert.equal(blocked.status, 401);

        const unlock = await fetch(`${baseUrl}/api/admin/unlock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: '2468' })
        });
        const cookie = unlock.headers.get('set-cookie').split(';')[0];
        const approved = await fetch(`${baseUrl}/api/admin/approvals/${approvalId}/approve`, {
            method: 'POST',
            headers: { Cookie: cookie }
        });
        assert.equal(approved.status, 200);
        const body = await approved.json();
        assert.equal(body.state.activeChores.find(chore => chore.id === active.id).completed, true);
    });
});
