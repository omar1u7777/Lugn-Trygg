// Fails if untranslated_keys.json contains any untranslated keys
const fs = require('fs');
const path = require('path');
const untranslatedPath = path.join(__dirname, '..', 'untranslated_keys.json');
if (!fs.existsSync(untranslatedPath)) {
  process.exit(0);
}
const data = JSON.parse(fs.readFileSync(untranslatedPath, 'utf-8'));
const hasUntranslated = Object.values(data).some(arr => Array.isArray(arr) && arr.length > 0);
if (hasUntranslated) {
  console.error('\u274C Build stopped: untranslated_keys.json contains untranslated keys. Run "python sync_translations.py" and translate all keys.');
  Object.entries(data).forEach(([lang, keys]) => {
    if (Array.isArray(keys) && keys.length > 0) {
      console.error(`Untranslated in ${lang}: ${keys.length} keys`);
      keys.slice(0, 10).forEach(key => console.error(`  - ${key}`));
    }
  });
  process.exit(1);
}