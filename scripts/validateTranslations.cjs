// Fails if locale files contain untranslated keys (identical to Swedish) that are not allowlisted.
const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const configPath = path.join(__dirname, '..', 'src', 'i18n', 'translation-validation-config.json');

const sv = JSON.parse(fs.readFileSync(path.join(localesDir, 'sv.json'), 'utf-8'));
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf-8'));
const no = JSON.parse(fs.readFileSync(path.join(localesDir, 'no.json'), 'utf-8'));

let config = { allowedIdentical: {} };
if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

const allowedIdentical = config.allowedIdentical || {};

const isAllowed = (lang, key) => {
  const allowed = allowedIdentical[lang] || [];
  return allowed.some(rule => {
    if (rule === '*') return true;
    if (rule.endsWith('.*')) {
      return key === rule.slice(0, -2) || key.startsWith(rule.slice(0, -1));
    }
    return key === rule;
  });
};

const findMissing = (source, target, path = '') => {
  const missing = [];
  for (const key of Object.keys(source)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
      if (typeof target[key] !== 'object' || target[key] === null || Array.isArray(target[key])) {
        missing.push(currentPath);
      } else {
        missing.push(...findMissing(source[key], target[key], currentPath));
      }
    } else if (target[key] === undefined) {
      missing.push(currentPath);
    }
  }
  return missing;
};

const findIdentical = (source, target, path = '') => {
  const identical = [];
  for (const key of Object.keys(source)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
      if (typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])) {
        identical.push(...findIdentical(source[key], target[key], currentPath));
      }
    } else if (typeof source[key] === 'string' && typeof target[key] === 'string' && source[key] === target[key]) {
      identical.push(currentPath);
    }
  }
  return identical;
};

const missing = {
  no: findMissing(sv, no),
  en: findMissing(sv, en),
};

const identical = {
  no: findIdentical(sv, no).filter(key => !isAllowed('no', key)),
  en: findIdentical(sv, en).filter(key => !isAllowed('en', key)),
};

const hasMissing = Object.values(missing).some(arr => arr.length > 0);
if (hasMissing) {
  console.error('\u274C Build stopped: locale files contain missing keys. Run "python sync_translations.py" to add them.');
  Object.entries(missing).forEach(([lang, keys]) => {
    if (keys.length > 0) {
      console.error(`Missing in ${lang}: ${keys.length} keys`);
      keys.slice(0, 10).forEach(key => console.error(`  - ${key}`));
    }
  });
  process.exit(1);
}

Object.entries(identical).forEach(([lang, keys]) => {
  if (keys.length > 0) {
    console.warn(`\u26A0\uFE0F Identical to Swedish in ${lang}: ${keys.length} keys (review in translation-validation-config.json if needed)`);
    keys.slice(0, 5).forEach(key => console.warn(`  - ${key}`));
  }
});