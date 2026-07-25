const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'bug-config.json');

function loadBugs() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  return JSON.parse(raw).bugs || {};
}

function isEnabled(name) {
  const bugs = loadBugs();
  return Boolean(bugs[name] && bugs[name].enabled);
}

function listEnabled() {
  const bugs = loadBugs();
  return Object.entries(bugs)
    .filter(([, v]) => v.enabled)
    .map(([name, v]) => ({ name, ...v }));
}

module.exports = { isEnabled, listEnabled };
