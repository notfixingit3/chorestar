const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 80;
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

app.use(express.json({ limit: '10mb' }));

// Serve static dashboard files from current directory
app.use(express.static(__dirname));

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// GET /api/state
app.get('/api/state', (req, res) => {
    if (fs.existsSync(STATE_FILE)) {
        fs.readFile(STATE_FILE, 'utf8', (err, data) => {
            if (err) {
                console.error("Read state error:", err);
                return res.status(500).json({ error: "Failed to read state" });
            }
            try {
                return res.json(JSON.parse(data));
            } catch (e) {
                return res.status(500).json({ error: "State file contains invalid JSON" });
            }
        });
    } else {
        // Return empty object if file doesn't exist
        return res.json({});
    }
});

// POST /api/state
app.post('/api/state', (req, res) => {
    const stateData = req.body;
    fs.writeFile(STATE_FILE, JSON.stringify(stateData, null, 2), 'utf8', (err) => {
        if (err) {
            console.error("Write state error:", err);
            return res.status(500).json({ error: "Failed to write state" });
        }
        res.json({ success: true });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`ChoreStar server running on port ${PORT}`);
});
