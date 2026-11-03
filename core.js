/* Snail Mailkeeper — core logic.
 * Pure, dependency-free functions that work in the browser and in Node tests.
 * Copyright (c) 2026 Asdale Dynamics, LLC — MIT license.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SnailCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var STORAGE_KEY = "snailmail.v1";

  function uid() {
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function todayISO(now) {
    // Accept a Date, an "YYYY-MM-DD" string, or nothing — callers vary.
    if (typeof now === "string") {
      var parsed = parseISO(now);
      return parsed ? formatISO(parsed) : formatISO(new Date());
    }
    return formatISO(now || new Date());
  }

  function formatISO(d) {
    return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
  }

  function parseISO(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!m) return null;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  }

  function daysBetween(fromISO, toISO) {
    var a = parseISO(fromISO);
    var b = parseISO(toISO);
    if (!a || !b) return null;
    return Math.round((b - a) / 86400000);
  }

  function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  // birthday stored as "MM-DD". Returns the next occurrence as ISO date on/after today.
  function nextBirthdayOccurrence(birthday, todayISOStr) {
    var m = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(String(birthday || ""));
    if (!m) return null;
    var t = parseISO(todayISOStr);
    if (!t) return null;
    var year = t.getUTCFullYear();
    var month = +m[1];
    var day = +m[2];
    function build(y) {
      if (month === 2 && day === 29 && !isLeapYear(y)) return new Date(Date.UTC(y, 2, 1)); // Feb 29 -> Mar 1
      return new Date(Date.UTC(y, month - 1, day));
    }
    var candidate = build(year);
    var ts = Date.UTC(year, t.getUTCMonth(), t.getUTCDate());
    if (candidate.getTime() < ts) candidate = build(year + 1);
    return formatISO(candidate);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createInitialState() {
    return {
      schema: 1,
      settings: { stamps: 20, snoozeAllUntil: null },
      pals: [],
      letters: [],
      ideas: [],
      prompts: [],
      occasions: []
    };
  }

  function isValidState(state) {
    return !!state && typeof state === "object" && Array.isArray(state.pals) && Array.isArray(state.letters);
  }

  function loadState(storage) {
    var state = createInitialState();
    if (!storage) return state;
    var raw = null;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch (e) {
      raw = null;
    }
    if (!raw) return state;
    try {
      var parsed = JSON.parse(raw);
      if (isValidState(parsed)) {
        // Merge so new fields added in later versions also get defaults.
        var fresh = createInitialState();
        return Object.assign(fresh, parsed, {
          settings: Object.assign(fresh.settings, parsed.settings || {})
        });
      }
    } catch (e) {
      // Corrupt data: fall back to a fresh, empty state rather than crashing.
    }
    return state;
  }

  function saveState(storage, state) {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Quota or privacy mode: in-memory state still works for this session.
    }
  }

  function addPal(state, data) {
    var name = String((data && data.name) || "").trim();
    if (!name) return { ok: false, error: "A name is needed — even just a first name or pen name." };
    if (state.pals.some(function (p) { return p.name.toLowerCase() === name.toLowerCase(); }))
      return { ok: false, error: "You already have a pal with that name." };
    var pal = {
      id: uid(),
      name: name,
      handle: String((data && data.handle) || "").trim(),
      address: String((data && data.address) || "").trim(),
      birthday: (data && data.birthday) || "",
      privacyNote: String((data && data.privacyNote) || "").trim(),
      followUpDays: clampInt((data && data.followUpDays) || 30, 7, 365, 30),
      snoozeUntil: null,
      birthdaySentYears: [],
      createdAt: (data && data.createdAt) || todayISO()
    };
    state.pals.push(pal);
    return { ok: true, pal: pal };
  }

  function removePal(state, palId) {
    var pal = state.pals.find(function (p) { return p.id === palId; });
    if (!pal) return { ok: false, error: "Pal not found." };
    state.letters = state.letters.filter(function (l) { return l.palId !== palId; });
    state.prompts = state.prompts.filter(function (p) { return p.palId !== palId; });
    state.occasions = state.occasions.filter(function (o) { return o.palId !== palId; });
    state.pals = state.pals.filter(function (p) { return p.id !== palId; });
    return { ok: true };
  }

  function clampInt(value, min, max, fallback) {
    var n = parseInt(value, 10);
    if (isNaN(n)) n = fallback;
    return Math.min(max, Math.max(min, n));
  }

  function addLetter(state, data, today) {
    var pal = state.pals.find(function (p) { return p.id === (data && data.palId); });
    if (!pal) return { ok: false, error: "Pick a pen pal for this letter." };
    var direction = data && data.direction === "received" ? "received" : "sent";
    var date = (data && data.date) || today || todayISO();
    if (!parseISO(date)) return { ok: false, error: "That date didn't parse — try YYYY-MM-DD." };
    var letter = {
      id: uid(),
      palId: pal.id,
      direction: direction,
      date: date,
      note: String((data && data.note) || "").trim()
    };
    state.letters.push(letter);
    if (date && data && data.birthdayCard && direction === "sent") {
      var year = date.slice(0, 4);
      if (pal.birthdaySentYears.indexOf(year) === -1) pal.birthdaySentYears.push(year);
    }
    return { ok: true, letter: letter };
  }

  function lastLetterTo(state, palId, direction) {
    var best = null;
    state.letters.forEach(function (l) {
      if (l.palId !== palId) return;
      if (direction && l.direction !== direction) return;
      if (!best || l.date > best.date) best = l;
    });
    return best;
  }

  function markBirthdayCardSent(state, palId, today) {
    var pal = state.pals.find(function (p) { return p.id === palId; });
    if (!pal) return { ok: false, error: "Pal not found." };
    var year = todayISO(today).slice(0, 4);
    if (pal.birthdaySentYears.indexOf(year) === -1) pal.birthdaySentYears.push(year);
    return { ok: true };
  }

  function addIdea(state, text) {
    var t = String(text || "").trim();
    if (!t) return { ok: false, error: "Write a little something first." };
    var idea = { id: uid(), text: t, used: false, createdAt: todayISO() };
    state.ideas.push(idea);
    return { ok: true, idea: idea };
  }

  function toggleIdeaUsed(state, ideaId) {
    var idea = state.ideas.find(function (i) { return i.id === ideaId; });
    if (!idea) return { ok: false, error: "Idea not found." };
    idea.used = !idea.used;
    return { ok: true };
  }

  function removeIdea(state, ideaId) {
    state.ideas = state.ideas.filter(function (i) { return i.id !== ideaId; });
    return { ok: true };
  }

  function addPrompt(state, data) {
    var text = String((data && data.text) || "").trim();
    if (!text) return { ok: false, error: "Write the prompt you're waiting to answer." };
    var prompt = {
      id: uid(),
      text: text,
      palId: (data && data.palId) || null,
      answered: false,
      createdAt: todayISO()
    };
    state.prompts.push(prompt);
    return { ok: true, prompt: prompt };
  }

  function togglePromptAnswered(state, promptId) {
    var prompt = state.prompts.find(function (p) { return p.id === promptId; });
    if (!prompt) return { ok: false, error: "Prompt not found." };
    prompt.answered = !prompt.answered;
    return { ok: true };
  }

  function removePrompt(state, promptId) {
    state.prompts = state.prompts.filter(function (p) { return p.id !== promptId; });
    return { ok: true };
  }

  function addOccasion(state, data) {
    var name = String((data && data.name) || "").trim();
    if (!name) return { ok: false, error: "Give the occasion a name." };
    var date = (data && data.date) || "";
    if (!parseISO(date)) return { ok: false, error: "Pick a date for the occasion." };
    var occasion = {
      id: uid(),
      name: name,
      date: date,
      palId: (data && data.palId) || null,
      kind: (data && data.kind) === "birthday" ? "birthday" : "other"
    };
    state.occasions.push(occasion);
    return { ok: true, occasion: occasion };
  }

  function removeOccasion(state, occasionId) {
    state.occasions = state.occasions.filter(function (o) { return o.id !== occasionId; });
    return { ok: true };
  }

  function snoozePal(state, palId, today, days) {
    var pal = state.pals.find(function (p) { return p.id === palId; });
    if (!pal) return { ok: false, error: "Pal not found." };
    var n = clampInt(days, 1, 365, 14);
    var d = parseISO(todayISO(today));
    d.setUTCDate(d.getUTCDate() + n);
    pal.snoozeUntil = d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
    return { ok: true };
  }

  function snoozeAll(state, today, days) {
    var n = clampInt(days, 1, 365, 7);
    var d = parseISO(todayISO(today));
    d.setUTCDate(d.getUTCDate() + n);
    state.settings.snoozeAllUntil = d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
    return { ok: true };
  }

  function adjustStamps(state, delta) {
    var current = parseInt(state.settings.stamps, 10) || 0;
    state.settings.stamps = Math.max(0, current + delta);
    return { ok: true };
  }

  /* Gentle reminders: soft language, snooze-able, never shaming.
   * Each reminder: { kind, palId, title, body, dateISO|null }
   */
  function deriveReminders(state, today) {
    var reminders = [];
    var t = todayISO(today);
    var snoozeAll = state.settings && state.settings.snoozeAllUntil;
    if (snoozeAll && daysBetween(t, snoozeAll) !== null && daysBetween(t, snoozeAll) >= 0) return reminders;

    state.pals.forEach(function (pal) {
      if (pal.snoozeUntil && daysBetween(t, pal.snoozeUntil) !== null && daysBetween(t, pal.snoozeUntil) >= 0) return;

      var birthdayISO = nextBirthdayOccurrence(pal.birthday, t);
      if (birthdayISO) {
        var untilBD = daysBetween(t, birthdayISO);
        if (untilBD <= 21) {
          var sentThisYear = pal.birthdaySentYears.indexOf(t.slice(0, 4)) !== -1;
          if (!sentThisYear) {
            var when = untilBD === 0 ? "is today" : untilBD === 1 ? "is tomorrow" : "is " + untilBD + " days away";
            reminders.push({
              kind: "birthday",
              palId: pal.id,
              dateISO: birthdayISO,
              title: pal.name + "'s birthday " + when,
              body: "If a card would land just right, no pressure — a folded note or a birthday stamp is plenty."
            });
          }
        }
      }

      var lastSent = lastLetterTo(state, pal.id, "sent");
      if (!lastSent) {
        var added = daysBetween(pal.createdAt, t);
        if (added !== null && added >= 14) {
          reminders.push({
            kind: "new-friend",
            palId: pal.id,
            dateISO: null,
            title: "A hello is waiting for " + pal.name,
            body: "You added " + pal.name + " " + added + " days ago and the first letter hasn't taken off yet. No rush — a postcard saying hi is a perfectly good start."
          });
        }
      } else {
        var gap = daysBetween(lastSent.date, t);
        if (gap !== null && gap >= pal.followUpDays) {
          reminders.push({
            kind: "follow-up",
            palId: pal.id,
            dateISO: lastSent.date,
            title: "It's been " + gap + " days since you mailed " + pal.name,
            body: "Whenever feels right is the right time. If a line feels stuck, the ideas journal is there for you."
          });
        }
      }
    });

    state.occasions.forEach(function (occ) {
      var until = daysBetween(t, occ.date);
      if (until !== null && until >= 0 && until <= 21) {
        var when = until === 0 ? "is today" : until === 1 ? "is tomorrow" : "is " + until + " days away";
        reminders.push({
          kind: "occasion",
          palId: occ.palId,
          dateISO: occ.date,
          title: occ.name + " " + when,
          body: "A little note for " + occ.name + " — only if it feels good."
        });
      }
    });

    var stamps = parseInt(state.settings.stamps, 10) || 0;
    if (stamps < 5) {
      reminders.push({
        kind: "stamps",
        palId: null,
        dateISO: null,
        title: "Your stamp jar is running low (" + stamps + " left)",
        body: "Restock next time you're out — there's no deadline on kindness."
      });
    }

    // Upcoming dates first, then gaps, then general notes.
    reminders.sort(function (a, b) {
      if (a.dateISO && b.dateISO) return a.dateISO < b.dateISO ? -1 : a.dateISO > b.dateISO ? 1 : 0;
      if (a.dateISO) return -1;
      if (b.dateISO) return 1;
      return 0;
    });
    return reminders;
  }

  function exportState(state) {
    return JSON.stringify(state, null, 2);
  }

  function importState(json) {
    try {
      var parsed = JSON.parse(String(json || ""));
      if (!isValidState(parsed)) return { ok: false, error: "That file doesn't look like a Snail Mailkeeper export." };
      var fresh = createInitialState();
      return { ok: true, state: Object.assign(fresh, parsed, { settings: Object.assign(fresh.settings, parsed.settings || {}) }) };
    } catch (e) {
      return { ok: false, error: "That file didn't parse as JSON." };
    }
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    uid: uid,
    todayISO: todayISO,
    parseISO: parseISO,
    daysBetween: daysBetween,
    nextBirthdayOccurrence: nextBirthdayOccurrence,
    escapeHtml: escapeHtml,
    createInitialState: createInitialState,
    isValidState: isValidState,
    loadState: loadState,
    saveState: saveState,
    addPal: addPal,
    removePal: removePal,
    addLetter: addLetter,
    lastLetterTo: lastLetterTo,
    markBirthdayCardSent: markBirthdayCardSent,
    addIdea: addIdea,
    toggleIdeaUsed: toggleIdeaUsed,
    removeIdea: removeIdea,
    addPrompt: addPrompt,
    togglePromptAnswered: togglePromptAnswered,
    removePrompt: removePrompt,
    addOccasion: addOccasion,
    removeOccasion: removeOccasion,
    snoozePal: snoozePal,
    snoozeAll: snoozeAll,
    adjustStamps: adjustStamps,
    deriveReminders: deriveReminders,
    exportState: exportState,
    importState: importState
  };
});
