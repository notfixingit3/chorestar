const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createApp } = require('./server');

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
        assert.equal(body.version, '0.0.1-beta.5');
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
        assert.deepEqual(body.state, existing.state);
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
