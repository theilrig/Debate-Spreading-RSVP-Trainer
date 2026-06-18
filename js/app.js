const SAMPLE_TEXT = `<div><u><b>Contention Sample</b></u></div>
<div><b>War powers now</b></div>
<div>Congressional authorization solves democratic accountability and prevents reckless escalation.</div>

<div><b>Executive flexibility backfires</b></div>
<div>Fast deployment sounds efficient, but unchecked discretion increases miscalculation, weakens legitimacy, and normalizes forever war.</div>

<div><b>Prefer the constitutional check</b></div>
<div>Deliberation is not delay. It filters bad interventions, improves signaling, and reduces extinction-risk pathways from accidental great-power conflict.</div>`;
const DEFAULT_TAGLINE_TO_CARD_GAP_MS = 150;
const DEFAULT_NEXT_CARD_GAP_MS = 350;
const TAGLINE_MAX_FONT_SIZE = 64;
const MIN_RSVP_INTERVAL_MS = 110;
const els = {
  scriptInput: document.getElementById('inputText'),
  parseBtn: document.getElementById('parseBtn'),
  sampleBtn: document.getElementById('sampleBtn'),
  saveCaseBtn: document.getElementById('saveCaseBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  wpmRange: document.getElementById('wpmRange'),
  wpmValue: document.getElementById('wpmValue'),
  bufferRange: document.getElementById('bufferRange'),
  bufferValue: document.getElementById('bufferValue'),
  hangRange: document.getElementById('hangRange'),
  hangValue: document.getElementById('hangValue'),
  totalTime: document.getElementById('totalTime'),
  sectionStatus: document.getElementById('sectionStatus'),
  progressStatus: document.getElementById('progressStatus'),
  prevBtn: document.getElementById('prevBtn'),
  startBtn: document.getElementById('startBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  resumeBtn: document.getElementById('resumeBtn'),
  restartCardBtn: document.getElementById('restartCardBtn'),
  restartAllBtn: document.getElementById('restartAllBtn'),
  nextBtn: document.getElementById('nextBtn'),
  fullscreenBtn: document.getElementById('fullscreenBtn'),
  stopBtn: document.getElementById('stopBtn'),
  modeLabel: document.getElementById('modeLabel'),
  modeSelect: document.getElementById('modeSelect'),
  displayArea: document.getElementById('displayArea'),
  guideLine: document.getElementById('guideLine'),
  focusTip: document.getElementById('focusTip'),
  viewer: document.getElementById('viewer')
};

    const state = {
      sections: [],
      sectionIndex: 0,
      wordIndex: 0,
      currentWords: [],
      currentTagline: '',
      currentBody: '',
      timer: null,
      mode: 'idle', // idle, tagline, rsvp, paused, done
      lastModeBeforePause: 'idle',
      isFullscreen: false,
      displayMode: 'word', // word, scroll
      scrollTrack: null
    };

const ICON_MOON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const ICON_SUN  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

function initDarkMode() {
  const btn = document.getElementById('darkToggle');
  const isDark = localStorage.getItem('pf-rsvp-dark') === 'true';
  btn.innerHTML = isDark ? ICON_SUN : ICON_MOON;
  if (isDark) document.body.classList.add('dark');
  btn.addEventListener('click', () => {
    const on = document.body.classList.toggle('dark');
    btn.innerHTML = on ? ICON_SUN : ICON_MOON;
    localStorage.setItem('pf-rsvp-dark', on);
  });
}

function initSidebar() {
  const btn = document.getElementById('sidebarToggle');
  const app = document.querySelector('.app');
  if (localStorage.getItem('pf-sidebar-collapsed') === 'true') {
    app.classList.add('sidebar-collapsed');
    btn.textContent = '›';
  }
  btn.addEventListener('click', () => {
    const collapsed = app.classList.toggle('sidebar-collapsed');
    btn.textContent = collapsed ? '›' : '‹';
    localStorage.setItem('pf-sidebar-collapsed', collapsed);
  });
}

function init() {
  const savedCase = localStorage.getItem('pf-rsvp-case');
  const savedWpm = localStorage.getItem('pf-rsvp-wpm');
  const savedBufferMs = localStorage.getItem('pf-rsvp-buffer-ms');
  const savedHangMs = localStorage.getItem('pf-rsvp-hang-ms');
  const savedDisplayMode = localStorage.getItem('pf-rsvp-display-mode');

  els.scriptInput.innerHTML = savedCase || SAMPLE_TEXT;
  if (savedWpm) els.wpmRange.value = savedWpm;
  if (savedBufferMs) els.bufferRange.value = savedBufferMs;
  if (savedHangMs) els.hangRange.value = savedHangMs;
  if (savedDisplayMode === 'word' || savedDisplayMode === 'scroll') {
    state.displayMode = savedDisplayMode;
    els.modeSelect.value = savedDisplayMode;
  }
  els.wpmValue.textContent = els.wpmRange.value;
  els.bufferValue.textContent = formatBufferSeconds(getNextCardGapMs());
  els.hangValue.textContent = formatBufferSeconds(getTaglineToCardGapMs());
  initDarkMode();
  initSidebar();
  wireEvents();
  parseScript();
}

function hasUnderlineInBlock(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
  if (node.tagName === 'U') return true;
  const decoration = window.getComputedStyle(node).textDecoration || '';
  if (decoration.includes('underline')) return true;
  for (const child of Array.from(node.children)) {
    if (hasUnderlineInBlock(child)) return true;
  }
  return false;
}

function isContentionHeader(text) {
  const t = (text || '').trim();
  if (/^(contention|cont\.?)\s*\d+/i.test(t)) return true;
  if (/^c\s*\d+\s*[:\-–—]/i.test(t)) return true;
  if (/^(observation|obs\.?)\s*\d+/i.test(t)) return true;
  if (/^(advantage|adv\.?|disad(?:vantage)?|da\b|counterplan|cp\b)\b/i.test(t)) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 6 && /[:\-–—]\s*$/.test(t)) return true;
  return false;
}

function parseBoldSections(rootEl) {
  const sections = [];
  let currentTagline = null;
  let currentTaglineIsHeader = false;
  let currentBodyParts = [];

  function normalizeText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function flush() {
    if (!currentTagline) return;

    const body = normalizeText(currentBodyParts.join(' '));
    sections.push({
      tagline: currentTagline,
      isHeader: currentTaglineIsHeader,
      body
    });

    currentBodyParts = [];
    currentTaglineIsHeader = false;
  }

  function getTopLevelBlocks(root) {
    const blockTags = new Set(['DIV', 'P', 'LI']);
    const children = Array.from(root.children).filter(el => blockTags.has(el.tagName));
    if (children.length) return children;

    // Fallback for editors that flatten pasted content into plain text nodes.
    const text = normalizeText(root.innerText || root.textContent || '');
    if (!text) return [];
    return [{ __plainTextFallback: true, innerText: text, textContent: text }];
  }

  function isBoldNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;

    const tag = node.tagName.toLowerCase();
    if (tag === 'b' || tag === 'strong') return true;

    const weight = window.getComputedStyle(node).fontWeight;
    const numeric = parseInt(weight, 10);
    if (!Number.isNaN(numeric) && numeric >= 600) return true;
    return weight === 'bold';
  }

  function collectSegments(node, inheritedBold = false, segments = []) {
    if (!node) return segments;

    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').replace(/\s+/g, ' ');
      if (text.trim()) {
        segments.push({ text, isBold: inheritedBold });
      }
      return segments;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return segments;

    if (node.tagName === 'BR') {
      segments.push({ text: ' ', isBold: inheritedBold });
      return segments;
    }

    const isBold = inheritedBold || isBoldNode(node);
    for (const child of Array.from(node.childNodes)) {
      collectSegments(child, isBold, segments);
    }

    return segments;
  }

  const blocks = getTopLevelBlocks(rootEl);

  for (const block of blocks) {
    if (block.__plainTextFallback) continue;

    const segments = collectSegments(block).filter(segment => normalizeText(segment.text));
    if (!segments.length) continue;

    const firstMeaningful = segments[0];
    const fullText = normalizeText(segments.map(segment => segment.text).join(' '));
    if (!fullText) continue;

    if (firstMeaningful.isBold) {
      const taglineParts = [];
      let idx = 0;

      while (idx < segments.length && segments[idx].isBold) {
        taglineParts.push(segments[idx].text);
        idx += 1;
      }

      let tagline = normalizeText(taglineParts.join(' '));
      let remainder = normalizeText(segments.slice(idx).map(s => s.text).join(' '));

      // Debate citations: bold ends at author name, year is non-bold (e.g. "Lippert et al" bold, "26 body..." not bold).
      // Fold a bare 2- or 4-digit year into the tagline when the bold part ends with a name or "et al".
      if (remainder && /\b(?:et\s+al\.?|[A-Z][a-z]+)\s*$/.test(tagline)) {
        const yearMatch = remainder.match(/^(\d{2}|\d{4})\b\s*/);
        if (yearMatch) {
          tagline += ' ' + yearMatch[1];
          remainder = remainder.slice(yearMatch[0].length);
        }
      }

      flush();
      currentTagline = tagline;
      currentTaglineIsHeader = hasUnderlineInBlock(block) || isContentionHeader(tagline);
      if (remainder) currentBodyParts.push(remainder);
    } else if (currentTagline) {
      currentBodyParts.push(fullText);
    }
  }

  flush();
  return sections;
}

function splitAtCitation(text) {
  // Finds the last "Author(s) Year" pattern and splits tagline from body there.
  // Handles: "Smith 2023", "Lippert et al 26", "Brown et al. 2024"
  const re = /\b[A-Z][A-Za-z'-]+(?:\s+et\s+al\.?)?\s+(?:\d{2}|\d{4})\b/g;
  let lastMatch = null;
  let m;
  while ((m = re.exec(text)) !== null) lastMatch = m;
  if (!lastMatch) return null;
  const end = lastMatch.index + lastMatch[0].length;
  return { tagline: text.slice(0, end).trim(), body: text.slice(end).trim() };
}

function parseParagraphFallback(rootEl) {
  const raw = (rootEl.innerText || rootEl.textContent || '').replace(/\r/g, '').trim();
  if (!raw) return [];

  const paragraphs = raw
    .split(/\n+/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return paragraphs.map((paragraph, idx) => {
    const colonIndex = paragraph.indexOf(':');
    let tagline;
    let body;

    if (colonIndex !== -1 && colonIndex < 120) {
      tagline = paragraph.slice(0, colonIndex).trim();
      body = paragraph.slice(colonIndex + 1).trim();
    } else {
      const citSplit = splitAtCitation(paragraph);
      if (citSplit) {
        tagline = citSplit.tagline;
        body = citSplit.body;
      } else {
        const words = paragraph.split(/\s+/);
        tagline = words.slice(0, Math.min(10, words.length)).join(' ').trim() || `Card ${idx + 1}`;
        body = words.slice(10).join(' ');
      }
    }

    return {
      tagline,
      body,
      isHeader: isContentionHeader(tagline),
      tokens: tokenize(body)
    };
  }).filter(section => section.tagline);
}


function wireEvents() {
  els.parseBtn.addEventListener('click', parseScript);

  els.sampleBtn.addEventListener('click', () => {
    els.scriptInput.innerHTML = SAMPLE_TEXT;
    parseScript();
  });

  els.saveCaseBtn.addEventListener('click', saveCase);
  els.saveSettingsBtn.addEventListener('click', saveSettings);

  els.wpmRange.addEventListener('input', () => {
    els.wpmValue.textContent = els.wpmRange.value;
    updateTotalTime();
  });

  els.bufferRange.addEventListener('input', () => {
    els.bufferValue.textContent = formatBufferSeconds(getNextCardGapMs());
    updateTotalTime();
  });

  els.hangRange.addEventListener('input', () => {
    els.hangValue.textContent = formatBufferSeconds(getTaglineToCardGapMs());
    updateTotalTime();
  });

  els.modeSelect.addEventListener('change', () => {
    state.displayMode = els.modeSelect.value;
    localStorage.setItem('pf-rsvp-display-mode', state.displayMode);
    redrawCurrent();
  });

  els.prevBtn.addEventListener('click', prevSection);
  els.startBtn.addEventListener('click', start);
  els.pauseBtn.addEventListener('click', pause);
  els.resumeBtn.addEventListener('click', resume);
  els.restartCardBtn.addEventListener('click', restartSection);
  els.restartAllBtn.addEventListener('click', restartAllSections);
  els.nextBtn.addEventListener('click', nextSection);
  els.fullscreenBtn.addEventListener('click', toggleFullscreen);
  els.stopBtn.addEventListener('click', stop);

  document.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    const tag = active?.tagName?.toLowerCase();
    const isTyping =
      tag === 'textarea' ||
      tag === 'input' ||
      active?.id === 'inputText';

    if (isTyping && e.code !== 'Space') return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (state.mode === 'idle' || state.mode === 'done') start();
      else if (state.mode === 'paused') resume();
      else pause();
    } else if (e.key === 'ArrowRight') {
      nextSection();
    } else if (e.key === 'ArrowLeft') {
      prevSection();
    } else if ((e.key === 'r' || e.key === 'R') && e.shiftKey) {
      restartAllSections();
    } else if (e.key === 'r' || e.key === 'R') {
      restartSection();
    } else if (e.key === 's' || e.key === 'S') {
      stop();
    } else if (e.key === 'f' || e.key === 'F') {
      toggleFullscreen();
    } else if (e.key === 'Escape' && state.isFullscreen) {
      toggleFullscreen(false);
    }
  });

  window.addEventListener('resize', redrawCurrent);
}

function saveCase() {
  localStorage.setItem('pf-rsvp-case', els.scriptInput.innerHTML);
  els.focusTip.textContent = 'Case saved.';
}

function saveSettings() {
  localStorage.setItem('pf-rsvp-wpm', els.wpmRange.value);
  localStorage.setItem('pf-rsvp-buffer-ms', String(getNextCardGapMs()));
  localStorage.setItem('pf-rsvp-hang-ms', String(getTaglineToCardGapMs()));
  els.focusTip.textContent = 'Settings saved.';
}

    function getTokenCoreLength(token) {
      return (token.match(/[A-Za-z]+/g) || []).join('').length;
    }

    function tokenize(text) {
      const rawTokens = text.match(/\S+/g) || [];
      const filteredTokens = rawTokens.filter(token => getTokenCoreLength(token) !== 1);
      const mergedTokens = [];

      for (let i = 0; i < filteredTokens.length; i += 1) {
        const current = filteredTokens[i];
        const next = filteredTokens[i + 1];

        if (
          next &&
          getTokenCoreLength(current) === 2 &&
          getTokenCoreLength(next) === 2
        ) {
          mergedTokens.push(`${current}${next}`);
          i += 1;
          continue;
        }

        mergedTokens.push(current);
      }

      return mergedTokens;
    }

function parseScript() {
  let parsed = parseBoldSections(els.scriptInput).map(section => ({
    tagline: section.tagline,
    body: section.body,
    tokens: tokenize(section.body)
  })).filter(section => section.tagline);

  if (!parsed.length) {
    parsed = parseParagraphFallback(els.scriptInput);
  }

  state.sections = parsed;
  state.sectionIndex = 0;
  state.wordIndex = 0;
  cancelTimer();

  if (!state.sections.length) {
    state.mode = 'idle';
    els.sectionStatus.textContent = 'No valid sections found';
    els.progressStatus.textContent = '0 / 0';
    setMode('ready');
    drawPlain('No cards found');
    els.focusTip.textContent = 'Paste bold taglines or separate plain-text cards with blank lines.';
    updateTotalTime();
    return;
  }

  updateTotalTime();
  loadSection(0);
}

    function loadSection(index) {
      state.sectionIndex = Math.max(0, Math.min(index, state.sections.length - 1));
      const section = state.sections[state.sectionIndex];
      state.currentTagline = section.tagline;
      state.currentBody = section.body || '';
      state.currentWords = section.tokens.slice();
      state.wordIndex = 0;
      state.mode = 'idle';
      updateStatus();
      setMode('ready');
      drawPlain(state.currentTagline, { showGuideLine: true });
      els.focusTip.textContent = 'Tagline first, then RSVP.';
    }

    function updateStatus() {
      if (!state.sections.length) {
        els.sectionStatus.textContent = 'No section loaded';
        els.progressStatus.textContent = '0 / 0';
        return;
      }

      const total = state.sections.length;
      const current = state.sectionIndex + 1;
      const totalWords = Math.max(0, state.currentWords.length || state.sections[state.sectionIndex].tokens.length || 0);
      const shownWord = totalWords === 0 ? 0 : Math.min(state.wordIndex + 1, totalWords);

      els.sectionStatus.textContent = `Section ${current}/${total}: ${state.sections[state.sectionIndex].tagline}`;
      els.progressStatus.textContent = `${shownWord} / ${totalWords}`;
    }

    function setMode(label) {
      els.modeLabel.textContent = label.toUpperCase();
    }

    function clearDisplay() {
      els.displayArea.innerHTML = '';
      els.guideLine.style.display = 'none';
      els.guideLine.classList.remove('guide-line--horizontal');
      state.scrollTrack = null;
    }

    function drawHeader(text) {
      clearDisplay();
      els.guideLine.style.display = 'none';
      const div = document.createElement('div');
      div.className = 'contention-header';
      div.textContent = text;
      els.displayArea.appendChild(div);
    }

    function drawPlain(text, options = {}) {
      const { showGuideLine = false } = options;
      clearDisplay();
      els.guideLine.style.display = showGuideLine ? 'block' : 'none';
      const div = document.createElement('div');
      div.className = 'tagline';
      div.textContent = text;
      div.style.fontSize = `${getTaglineFontSize(text)}px`;
      div.style.maxWidth = `${getTaglineColumnWidth()}px`;
      els.displayArea.appendChild(div);
    }

    function getPivotIndex(word) {
      const clean = word.trim();
      const len = clean.length;
      if (len <= 1) return 0;
      if (len <= 5) return 1;
      if (len <= 9) return 2;
      if (len <= 13) return 3;
      return Math.min(4, len - 1);
    }

    function drawRSVP(text, options = {}) {
      const { showGuideLine = true } = options;
      clearDisplay();
      els.guideLine.style.display = showGuideLine ? 'block' : 'none';

      const size = getRSVPFontSize(text);
      const idx = getPivotIndex(text);

      const prefix = text.slice(0, idx);
      const pivot = text.slice(idx, idx + 1);
      const suffix = text.slice(idx + 1);

      const wrap = document.createElement('div');
      wrap.className = 'word-wrap';
      wrap.style.fontSize = `${size}px`;

      const pre = document.createElement('span');
      pre.className = 'prefix';
      pre.textContent = prefix;

      const piv = document.createElement('span');
      piv.className = 'pivot';
      piv.textContent = pivot;

      const suf = document.createElement('span');
      suf.className = 'suffix';
      suf.textContent = suffix;

      wrap.appendChild(pre);
      wrap.appendChild(piv);
      wrap.appendChild(suf);
      els.displayArea.appendChild(wrap);

      requestAnimationFrame(() => {
        const pivotRect = piv.getBoundingClientRect();
        const viewerRect = els.viewer.getBoundingClientRect();
        const viewerCenter = viewerRect.left + viewerRect.width / 2;
        const pivotLeft = pivotRect.left;
        const dx = viewerCenter - pivotLeft;
        wrap.style.transform = `translateX(${dx}px)`;
      });
    }

    function drawScroll(tokens, index) {
      const SLOT_H = 80; // must match CSS .scroll-word height

      // Build track once per card; reuse on subsequent word advances
      if (!state.scrollTrack || state.scrollTrack.parentNode !== els.displayArea) {
        els.displayArea.innerHTML = '';
        state.scrollTrack = document.createElement('div');
        state.scrollTrack.className = 'scroll-track';
        tokens.forEach(token => {
          const span = document.createElement('span');
          span.className = 'scroll-word';
          const pi = getPivotIndex(token);
          const pre = document.createElement('span'); pre.className = 'prefix'; pre.textContent = token.slice(0, pi);
          const piv = document.createElement('span'); piv.className = 'pivot';  piv.textContent = token.slice(pi, pi + 1);
          const suf = document.createElement('span'); suf.className = 'suffix'; suf.textContent = token.slice(pi + 1);
          span.appendChild(pre); span.appendChild(piv); span.appendChild(suf);
          state.scrollTrack.appendChild(span);
        });
        els.displayArea.appendChild(state.scrollTrack);
      }

      if (!('baseY' in state.scrollTrack.dataset)) {
        // First word only: measure word[0]'s natural position and center it.
        // All subsequent words march upward by SLOT_H each — no re-centering.
        requestAnimationFrame(() => {
          if (!state.scrollTrack) return;
          const word0 = state.scrollTrack.children[0];
          if (!word0) return;
          const viewerRect = els.viewer.getBoundingClientRect();
          const word0Rect = word0.getBoundingClientRect();
          const baseY = Math.round(
            (viewerRect.top + viewerRect.height / 2) - (word0Rect.top + word0Rect.height / 2)
          );
          state.scrollTrack.dataset.baseY = baseY;
          state.scrollTrack.style.transform = `translateY(${baseY - index * SLOT_H}px)`;
        });
      } else {
        const baseY = Number(state.scrollTrack.dataset.baseY);
        state.scrollTrack.style.transform = `translateY(${baseY - index * SLOT_H}px)`;
      }
    }

    function getTokenDisplayLength(token) {
      return (token || '').replace(/[^A-Za-z]/g, '').length;
    }

    function getRSVPFontSize(token) {
      const baseSize = 68;
      const cleanLength = getTokenDisplayLength(token);

      if (cleanLength <= 11) return baseSize;

      return Math.max(42, baseSize - ((cleanLength - 11) * 3));
    }

    function getTaglineWords(tagline) {
      return (tagline || '').trim().split(/\s+/).filter(Boolean);
    }

    function estimateSyllables(token) {
      const w = (token || '').toLowerCase().replace(/[^a-z]/g, '');
      if (!w) return 1;
      if (w.length <= 2) return 1;

      const vowels = new Set(['a', 'e', 'i', 'o', 'u', 'y']);
      let count = 0;
      let prevVowel = false;
      for (const ch of w) {
        const v = vowels.has(ch);
        if (v && !prevVowel) count++;
        prevVowel = v;
      }
      // Silent trailing e (make → 1, not 2)
      if (w.endsWith('e') && count > 1) count--;
      // Consonant + le ending adds a syllable (bottle, purple)
      if (w.length >= 3 && w.endsWith('le') && !vowels.has(w[w.length - 3])) count++;
      // Silent -ed after consonant (jumped → 1, created → 2)
      if (w.length >= 3 && w.endsWith('ed') && !vowels.has(w[w.length - 3]) && count > 1) count--;

      return Math.max(1, count);
    }

    function getTaglineSyllables(tagline) {
      return getTaglineWords(tagline).reduce((sum, word) => sum + estimateSyllables(word), 0);
    }

    function getTaglineFontSize(tagline) {
      const syllables = getTaglineSyllables(tagline);

      if (syllables <= 10) return TAGLINE_MAX_FONT_SIZE;

      return Math.max(44, TAGLINE_MAX_FONT_SIZE - ((syllables - 10) * 1.5));
    }

    function getAverageSyllables(tokens) {
      if (!tokens.length) return 1;
      const totalSyllables = getTotalSyllables(tokens);
      return totalSyllables / tokens.length;
    }

    function getTotalSyllables(tokens) {
      return tokens.reduce((sum, token) => sum + estimateSyllables(token), 0);
    }

    function getProgressiveIntervalMultiplier(index, tokens) {
      if (tokens.length <= 1) return 1.05;

      const totalSyllables = getTotalSyllables(tokens);
      if (totalSyllables <= 0) return 1.05;

      const passedSyllables = tokens
        .slice(0, index)
        .reduce((sum, token) => sum + estimateSyllables(token), 0);
      const currentSyllables = estimateSyllables(tokens[index] || '');
      const progress = Math.min(1, (passedSyllables + (currentSyllables / 2)) / totalSyllables);

      return 1.05 - (0.20 * progress);
    }

    function getIntervalMs(token, index, tokens) {
      const wpm = Math.max(120, parseInt(els.wpmRange.value, 10) || 500);
      const baseWordMs = 60000 / wpm;
      const averageSyllables = getAverageSyllables(tokens);
      const rawSyllableRatio = estimateSyllables(token) / averageSyllables;
      const syllableRatio = Math.max(0.6, Math.min(2.5, rawSyllableRatio));
      const progressiveMultiplier = getProgressiveIntervalMultiplier(index, tokens);
      let penalty = 1.0;

      if (/[,;:]$/.test(token)) penalty += 0.35;
      if (/[.!?]$/.test(token)) penalty += 0.60;

      const intervalMs = baseWordMs * syllableRatio * progressiveMultiplier * penalty;
      return Math.max(MIN_RSVP_INTERVAL_MS, Math.round(intervalMs));
    }

function getTaglineDelayMs(tagline) {
  const words = getTaglineWords(tagline).length;
  const chars = (tagline || '').trim().length;
  const syllables = getTaglineSyllables(tagline);

  let delay = 700;
  delay += words * 140;
  delay += Math.min(chars, 80) * 8;
  delay += syllables * 55;
  if (words >= 8) delay += 350;
  if (words > 10) delay += 225;
  if (words > 12) delay += 150;
  if (syllables >= 14) delay += 175;
  if (syllables >= 18) delay += 125;

  return Math.max(900, Math.min(3200, delay));
}

function getNextCardGapMs() {
  const parsed = parseInt(els.bufferRange.value, 10);
  return Number.isNaN(parsed) ? DEFAULT_NEXT_CARD_GAP_MS : Math.max(0, parsed);
}

function getTaglineToCardGapMs() {
  const parsed = parseInt(els.hangRange.value, 10);
  return Number.isNaN(parsed) ? DEFAULT_TAGLINE_TO_CARD_GAP_MS : Math.max(0, parsed);
}

function formatBufferSeconds(ms) {
  return (ms / 1000).toFixed(2);
}

function getTaglineColumnWidth() {
  return Math.max(240, Math.floor(els.viewer.clientWidth * 0.4));
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

    function estimateSectionDurationMs(section) {
      const taglineMs = getTaglineDelayMs(section.tagline);
      const bodyMs = section.tokens.reduce((sum, token, index, tokens) => sum + getIntervalMs(token, index, tokens), 0);
      const taglineToCardGapMs = section.tokens.length ? getTaglineToCardGapMs() : 0;
      const nextCardGapMs = section.tokens.length ? getNextCardGapMs() : 0;
      return taglineMs + taglineToCardGapMs + bodyMs + nextCardGapMs;
    }

    function updateTotalTime() {
      if (!state.sections.length) {
        els.totalTime.textContent = '0:00';
        return;
      }

      const totalMs = state.sections.reduce((sum, section) => sum + estimateSectionDurationMs(section), 0);
      els.totalTime.textContent = formatDuration(totalMs);
    }

    function cancelTimer() {
      if (state.timer !== null) {
        clearTimeout(state.timer);
        state.timer = null;
      }
    }

    function start() {
      if (!state.sections.length) return;

      cancelTimer();
      const section = state.sections[state.sectionIndex];

      if (section.isHeader) {
        state.mode = 'header';
        setMode('section');
        drawHeader(state.currentTagline);
        updateStatus();
        els.focusTip.textContent = 'New section.';
        state.timer = setTimeout(() => completeSection(), 1200);
        return;
      }

      state.currentWords = section.tokens.slice();
      state.wordIndex = 0;
      state.mode = 'tagline';
      setMode('tagline');
      drawPlain(state.currentTagline, { showGuideLine: true });
      updateStatus();
      els.focusTip.textContent = 'Read the roadmap. Then lock onto the red pivot letter.';

      const delay = getTaglineDelayMs(state.currentTagline);
      if (!state.currentWords.length) {
        state.timer = setTimeout(() => {
          completeSection();
        }, delay);
        return;
      }

      state.timer = setTimeout(beginRSVP, delay + getTaglineToCardGapMs());
    }

    function beginRSVP() {
      cancelTimer();

      if (!state.currentWords.length) {
        completeSection();
        return;
      }

      state.mode = 'rsvp';
      els.focusTip.textContent = 'Card RSVP mode.';
      showNextToken();
    }

function showNextToken() {
  cancelTimer();

  if (state.wordIndex >= state.currentWords.length) {
    completeSection();
    return;
  }

  const token = state.currentWords[state.wordIndex];
  setMode('rsvp');
  if (state.displayMode === 'scroll') {
    drawScroll(state.currentWords, state.wordIndex);
  } else {
    drawRSVP(token, { showGuideLine: true });
  }
  updateStatus();
  const intervalMs = getIntervalMs(token, state.wordIndex, state.currentWords);
  state.wordIndex += 1;
  state.timer = setTimeout(showNextToken, intervalMs);
}

    function completeSection() {
      if (state.sectionIndex < state.sections.length - 1) {
        state.timer = setTimeout(() => {
          loadSection(state.sectionIndex + 1);
          start();
        }, getNextCardGapMs());
        return;
      }

      state.mode = 'done';
      setMode('done');
      drawPlain('Case Complete');
      updateStatus();
      els.focusTip.textContent = 'All cards complete.';
    }

    function pause() {
      if (state.mode !== 'tagline' && state.mode !== 'rsvp' && state.mode !== 'header') return;
      state.lastModeBeforePause = state.mode;
      state.mode = 'paused';
      cancelTimer();
      setMode('paused');
      els.focusTip.textContent = 'Paused.';
    }

    function resume() {
      if (state.mode !== 'paused') return;

      if (state.lastModeBeforePause === 'tagline') {
        state.mode = 'tagline';
        setMode('tagline');
        drawPlain(state.currentTagline, { showGuideLine: true });
        state.timer = setTimeout(beginRSVP, getTaglineDelayMs(state.currentTagline) + getTaglineToCardGapMs());
      } else {
        state.mode = 'rsvp';
        showNextToken();
      }
    }

    function restartSection() {
      if (!state.sections.length) return;
      cancelTimer();
      loadSection(state.sectionIndex);
      start();
    }

    function restartAllSections() {
      if (!state.sections.length) return;
      cancelTimer();
      loadSection(0);
      state.lastModeBeforePause = 'tagline';
      state.mode = 'paused';
      setMode('paused');
      drawPlain(state.currentTagline, { showGuideLine: true });
      els.focusTip.textContent = 'Paused.';
    }

    function nextSection() {
      if (!state.sections.length) return;
      cancelTimer();
      loadSection(Math.min(state.sectionIndex + 1, state.sections.length - 1));
    }

    function prevSection() {
      if (!state.sections.length) return;
      cancelTimer();
      loadSection(Math.max(state.sectionIndex - 1, 0));
    }

    function stop() {
      cancelTimer();
      state.mode = 'idle';
      if (state.sections.length) {
        state.wordIndex = 0;
        drawPlain(state.sections[state.sectionIndex].tagline, { showGuideLine: true });
        updateStatus();
      } else {
        drawPlain('Stopped');
      }
      setMode('stopped');
      els.focusTip.textContent = 'Stopped.';
    }

    function toggleFullscreen(force) {
      const nextState = typeof force === 'boolean' ? force : !state.isFullscreen;
      state.isFullscreen = nextState;
      els.viewer.classList.toggle('fullscreen', nextState);
      els.fullscreenBtn.textContent = nextState ? 'Exit Fullscreen' : 'Fullscreen';
      requestAnimationFrame(redrawCurrent);
    }

    function redrawCurrent() {
      if (!state.sections.length) return;

      if (state.mode === 'rsvp' && state.wordIndex > 0) {
        const idx = Math.max(0, state.wordIndex - 1);
        if (state.displayMode === 'scroll') {
          drawScroll(state.currentWords, idx);
        } else {
          drawRSVP(state.currentWords[idx], { showGuideLine: true });
        }
      } else if (state.mode === 'done') {
        drawPlain('Case Complete');
      } else if (state.mode === 'header') {
        drawHeader(state.sections[state.sectionIndex].tagline);
      } else {
        drawPlain(state.sections[state.sectionIndex].tagline, { showGuideLine: true });
      }
    }

    init();
