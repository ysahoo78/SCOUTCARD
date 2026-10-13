import { SPORT_OPTIONS, presetFor } from './sport-presets-data.js';

const sport = document.getElementById('sport');
const otherWrap = document.getElementById('sport-other-wrap');
const other = document.getElementById('sport-other');
const section = document.getElementById('sport-preset-fields');
const metricGrid = document.getElementById('sport-metrics-grid');
const note = document.getElementById('sport-preset-help');
const drafts = new Map();
let activePreset = '';

for (const name of SPORT_OPTIONS) {
  const option = document.createElement('option');
  option.value = name;
  option.textContent = name === 'Other sport' ? 'Another sport' : name;
  sport.append(option);
}

function capture() {
  if (!activePreset) return;
  drafts.set(activePreset, Object.fromEntries(
    [...metricGrid.querySelectorAll('[data-metric-key]')]
      .map(input => [input.dataset.metricKey, input.value.trim()])
  ));
}

function render(preserveCurrent = true) {
  if (preserveCurrent) capture();
  const selected = sport.value;
  otherWrap.hidden = selected !== 'Other sport';
  other.required = selected === 'Other sport';
  section.hidden = !selected;
  activePreset = selected;
  metricGrid.replaceChildren();
  if (!selected) return;
  note.textContent = selected === 'Other sport'
    ? 'Add the results that matter in your sport. All fields are optional.'
    : `Suggested ${selected.toLowerCase()} fields. Fill in only what applies to you; include units and season when helpful.`;
  for (const definition of presetFor(selected)) {
    const wrapper = document.createElement('div');
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.id = 'metric-' + definition.key;
    input.type = 'text';
    input.maxLength = 120;
    input.placeholder = definition.placeholder;
    input.dataset.metricKey = definition.key;
    input.value = drafts.get(selected)?.[definition.key] || '';
    label.htmlFor = input.id;
    label.textContent = definition.label;
    wrapper.append(label, input);
    metricGrid.append(wrapper);
  }
}

sport.addEventListener('change', () => render());
sport.addEventListener('input', () => render());
render();

export function getSportName() {
  return sport.value === 'Other sport' ? other.value.trim() : sport.value;
}

export function setSportName(value) {
  const label = SPORT_OPTIONS.find(option => option.toLowerCase() === String(value || '').trim().toLowerCase());
  sport.value = label || (value ? 'Other sport' : '');
  other.value = label ? '' : String(value || '');
  render();
}

export function getSportMetrics() {
  capture();
  return Object.fromEntries(Object.entries(drafts.get(sport.value) || {})
    .filter(([, value]) => value));
}

export function setSportMetrics(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const allowed = new Set(presetFor(sport.value).map(item => item.key));
  drafts.set(sport.value, Object.fromEntries(Object.entries(value)
    .filter(([key, entry]) => allowed.has(key) && typeof entry === 'string')
    .map(([key, entry]) => [key, entry.slice(0, 120)])));
  render(false);
}

export function resetSportPresets() {
  drafts.clear();
  activePreset = '';
  sport.value = '';
  other.value = '';
  render(false);
}
