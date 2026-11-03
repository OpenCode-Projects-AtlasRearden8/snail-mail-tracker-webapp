/* tests/run-tests.js — lightweight DOM + logic tests, runnable with `node tests/run-tests.js`.
 * ASCII-only pass/fail marks so output stays readable anywhere.
 * Copyright (c) 2026 Asdale Dynamics, LLC — MIT license.
 */
"use strict";

var core = require("../core.js");
var ui = require("../ui.js");
var shim = require("./dom-shim.js");

var passed = 0;
var failed = 0;
var failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("PASS  " + name);
  } catch (e) {
    failed++;
    failures.push(name + " -> " + (e && e.message));
    console.log("FAIL  " + name + " -> " + (e && e.message));
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || "not equal") + ": expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
  }
}

// ---------------------------------------------------------------------------
// core logic
// ---------------------------------------------------------------------------

test("todayISO formats UTC date", function () {
  assertEq(core.todayISO(new Date(Date.UTC(2026, 10, 3))), "2026-11-03");
});

test("daysBetween counts whole days", function () {
  assertEq(core.daysBetween("2026-01-01", "2026-01-31"), 30);
  assertEq(core.daysBetween("2026-02-28", "2026-03-01"), 1);
});

test("nextBirthdayOccurrence wraps to next year", function () {
  assertEq(core.nextBirthdayOccurrence("01-05", "2026-11-03"), "2027-01-05");
  assertEq(core.nextBirthdayOccurrence("11-10", "2026-11-03"), "2026-11-10"); // today counts
  assertEq(core.nextBirthdayOccurrence("02-29", "2026-01-01"), "2026-03-01"); // non-leap fallback, same year
  assertEq(core.nextBirthdayOccurrence("02-29", "2027-06-01"), "2028-02-29"); // leap year keeps it
});

test("escapeHtml defuses script injection", function () {
  var out = core.escapeHtml('<img src=x onerror="alert(1)">');
  assertEq(out, "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

test("addPal validates and rejects duplicates case-insensitively", function () {
  var s = core.createInitialState();
  var a = core.addPal(s, { name: "Miriam" });
  assert(a.ok, "first add should work");
  var dup = core.addPal(s, { name: "  miriam " });
  assert(!dup.ok, "duplicate should be rejected");
  assert(!core.addPal(s, { name: "   " }).ok, "blank name rejected");
});

test("addPal clamps followUpDays into range", function () {
  var s = core.createInitialState();
  var p = core.addPal(s, { name: "Ana", followUpDays: 99999 }).pal;
  assertEq(p.followUpDays, 365);
  var q = core.addPal(s, { name: "Bo", followUpDays: -3 }).pal;
  assertEq(q.followUpDays, 7);
});

test("addLetter records birthday card in birthdaySentYears", function () {
  var s = core.createInitialState();
  var pal = core.addPal(s, { name: "Ana", createdAt: "2026-01-01" }).pal;
  var r1 = core.addLetter(s, { palId: pal.id, direction: "sent", date: "2026-05-01", birthdayCard: true }, "2026-05-01");
  assert(r1.ok, "letter should log");
  assertEq(pal.birthdaySentYears[0], "2026");
  core.addLetter(s, { palId: pal.id, direction: "sent", date: "2026-05-02", birthdayCard: true });
  assertEq(pal.birthdaySentYears.length, 1, "no duplicate year badge");
  assertEq(core.addLetter(s, { palId: "missing" }).ok, false, "unknown pal rejected");
});

test("lastLetterTo finds most recent in either direction", function () {
  var s = core.createInitialState();
  var pal = core.addPal(s, { name: "Ana" }).pal;
  core.addLetter(s, { palId: pal.id, direction: "sent", date: "2026-01-10" });
  core.addLetter(s, { palId: pal.id, direction: "received", date: "2026-02-11" });
  assertEq(core.lastLetterTo(s, pal.id).date, "2026-02-11");
  assertEq(core.lastLetterTo(s, pal.id, "sent").date, "2026-01-10");
});

test("removePal cleans up letters, prompts and occasions", function () {
  var s = core.createInitialState();
  var pal = core.addPal(s, { name: "Ana" }).pal;
  core.addLetter(s, { palId: pal.id, direction: "sent" });
  core.addPrompt(s, { text: "q", palId: pal.id });
  core.addOccasion(s, { name: "swap day", date: "2026-12-01", palId: pal.id });
  var r = core.removePal(s, pal.id);
  assert(r.ok, "removal works");
  assertEq(s.letters.length, 0);
  assertEq(s.prompts.length, 0);
  assertEq(s.occasions.length, 0);
  assertEq(s.pals.length, 0);
});

test("idea / prompt / occasion validation", function () {
  var s = core.createInitialState();
  assert(!core.addIdea(s, "  ").ok, "blank idea rejected");
  assert(!core.addPrompt(s, { text: "" }).ok, "blank prompt rejected");
  assert(!core.addOccasion(s, { name: "x", date: "not-a-date" }).ok, "bad occasion date rejected");
  assert(core.addOccasion(s, { name: "x", date: "2026-12-01" }).ok, "good occasion accepted");
  var idea = core.addIdea(s, "press a leaf").idea;
  assertEq(core.toggleIdeaUsed(s, idea.id).ok, true);
  assertEq(idea.used, true);
  assertEq(core.removeIdea(s, idea.id).ok, true);
  assertEq(s.ideas.length, 0);
});

test("snoozeAll and snoozePal set future dates", function () {
  var s = core.createInitialState();
  var pal = core.addPal(s, { name: "Ana" }).pal;
  core.snoozePal(s, pal.id, "2026-11-03", 14);
  assertEq(pal.snoozeUntil, "2026-11-17");
  core.snoozeAll(s, "2026-11-03", 7);
  assertEq(s.settings.snoozeAllUntil, "2026-11-10");
  core.snoozeAll(s, "2026-11-03", 999999);
  assertEq(s.settings.snoozeAllUntil, "2027-11-03", "snooze clamped to max 365 days");
});

test("adjustStamps floors at zero", function () {
  var s = core.createInitialState();
  assertEq(s.settings.stamps, 20);
  core.adjustStamps(s, -100);
  assertEq(s.settings.stamps, 0);
  core.adjustStamps(s, 5);
  assertEq(s.settings.stamps, 5);
});

test("state round-trips through storage", function () {
  var backing = {};
  var storage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(backing, k) ? backing[k] : null; },
    setItem: function (k, v) { backing[k] = String(v); }
  };
  var s1 = core.createInitialState();
  core.addPal(s1, { name: "Ana" });
  core.saveState(storage, s1);
  var s2 = core.loadState(storage);
  assertEq(s2.pals.length, 1);
  assertEq(s2.pals[0].name, "Ana");
  assertEq(s2.schema, 1);
});

test("loadState survives corrupt json", function () {
  var storage = { getItem: function () { return "{broken"; }, setItem: function () {} };
  var s = core.loadState(storage);
  assert(core.isValidState(s), "falls back to a valid empty state");
});

test("loadState survives wrong-shaped json", function () {
  var storage = { getItem: function () { return "42"; }, setItem: function () {} };
  assert(core.isValidState(core.loadState(storage)), "falls back to a valid empty state");
});

test("import validates shape and merges settings", function () {
  var r1 = core.importState('{"schema":1,"pals":[],"letters":[],"ideas":[],"prompts":[],"occasions":[],"settings":{"stamps":3}}');
  assert(r1.ok, "good import accepted");
  assertEq(r1.state.settings.stamps, 3);
  assert(!core.importState("[]").ok, "array rejected");
  assert(!core.importState("nope").ok, "garbage rejected");
});

// ---------------------------------------------------------------------------
// gentle reminders
// ---------------------------------------------------------------------------

function palWith(name, props) {
  var s = core.createInitialState();
  var pal = core.addPal(s, Object.assign({ name: name, createdAt: "2026-01-01" }, props)).pal;
  return { state: s, pal: pal };
}

test("quiet app produces zero reminders — silence is okay", function () {
  var s = core.createInitialState();
  core.addPal(s, { name: "Ana", createdAt: core.todayISO() });
  assertEq(core.deriveReminders(s, core.todayISO()).length, 0);
});

test("recent pen pal with fresh letter -> no reminder", function () {
  var c = palWith("Ana");
  core.addLetter(c.state, { palId: c.pal.id, direction: "sent", date: "2026-10-30" });
  var rem = core.deriveReminders(c.state, "2026-11-03");
  assertEq(rem.length, 0, "only 4 days since last letter");
});

test("old letter past follow-up window -> soft gentle reminder", function () {
  var c = palWith("Ana", { createdAt: "2026-01-01" });
  core.addLetter(c.state, { palId: c.pal.id, direction: "sent", date: "2026-01-10" });
  var rem = core.deriveReminders(c.state, "2026-11-03");
  assert(rem.length === 1, "one reminder");
  assertEq(rem[0].kind, "follow-up");
  assert(rem[0].body.indexOf("Whenever feels right") !== -1, "tone stays gentle");
  assert(rem[0].body.indexOf("should") === -1 && rem[0].body.indexOf("owe") === -1, "no shaming language");
});

test("pal added 14+ days ago with nothing sent -> first-letter nudge, still kind", function () {
  var c = palWith("Bo", { createdAt: "2026-10-01" });
  var rem = core.deriveReminders(c.state, "2026-11-03");
  assertEq(rem[0].kind, "new-friend");
  assert(rem[0].body.indexOf("No rush") !== -1, "explicitly no-rush");
  var fresh = palWith("Cy", { createdAt: "2026-11-01" });
  assertEq(core.deriveReminders(fresh.state, "2026-11-03").length, 0, "added 2 days ago stays silent");
});

test("per-pal snooze silences reminders", function () {
  var c = palWith("Ana", { createdAt: "2026-01-01" });
  core.addLetter(c.state, { palId: c.pal.id, direction: "sent", date: "2026-01-10" });
  core.snoozePal(c.state, c.pal.id, "2026-11-03", 14);
  assertEq(core.deriveReminders(c.state, "2026-11-03").length, 0);
  assertEq(core.deriveReminders(c.state, "2026-12-01").length, 1, "comes back after snooze ends");
});

test("snooze-all silences everything", function () {
  var c = palWith("Ana", { createdAt: "2026-01-01" });
  core.addLetter(c.state, { palId: c.pal.id, direction: "sent", date: "2026-01-10" });
  core.snoozeAll(c.state, "2026-11-03", 7);
  assertEq(core.deriveReminders(c.state, "2026-11-03").length, 0);
});

test("birthday within 21 days surfaces a gentle birthday reminder", function () {
  var c = palWith("Ana", { createdAt: "2026-01-01", birthday: "11-20" });
  core.addLetter(c.state, { palId: c.pal.id, direction: "sent", date: "2026-10-30" });
  var rem = core.deriveReminders(c.state, "2026-11-03");
  assert(rem.some(function (r) { return r.kind === "birthday"; }), "birthday reminder exists");
});

test("birthday card already sent this year -> no birthday reminder", function () {
  var c = palWith("Ana", { createdAt: "2026-01-01", birthday: "11-20" });
  core.addLetter(c.state, { palId: c.pal.id, direction: "sent", date: "2026-11-01", birthdayCard: true });
  var rem = core.deriveReminders(c.state, "2026-11-03");
  assert(!rem.some(function (r) { return r.kind === "birthday"; }), "no dup birthday nagging");
});

test("low stamp count reminds; healthy count is silent", function () {
  var s = core.createInitialState();
  s.settings.stamps = 2;
  assert(core.deriveReminders(s, "2026-11-03").some(function (r) { return r.kind === "stamps"; }));
  s.settings.stamps = 20;
  assert(!core.deriveReminders(s, "2026-11-03").some(function (r) { return r.kind === "stamps"; }));
});

test("occasions outside window are silent, inside window surface", function () {
  var s = core.createInitialState();
  core.addOccasion(s, { name: "card swap", date: "2027-05-01" });
  assertEq(core.deriveReminders(s, "2026-11-03").length, 0);
  core.addOccasion(s, { name: "card swap", date: "2026-11-15" });
  assertEq(core.deriveReminders(s, "2026-11-03").length, 1);
});

// ---------------------------------------------------------------------------
// ui rendering against the lightweight DOM shim
// ---------------------------------------------------------------------------

function doc() { return shim.createDoc(); }

test("renderReminders shows gentle copy and snooze buttons", function () {
  var c = palWith("Ana", { createdAt: "2026-01-01" });
  core.addLetter(c.state, { palId: c.pal.id, direction: "sent", date: "2026-01-10" });
  var node = ui.renderReminders(c.state, doc(), "2026-11-03");
  var html = node.innerHTML;
  assert(html.indexOf("Ana") !== -1, "mentions pal by name");
  assert(html.indexOf("Whenever feels right") !== -1, "gentle phrasing");
  assert(html.indexOf('data-action="snooze-pal"') !== -1, "per-pal snooze present");
  assert(html.indexOf('data-action="snooze-all"') !== -1, "snooze-all present");
});

test("renderReminders empty state is warm, not clinical", function () {
  var node = ui.renderReminders(core.createInitialState(), doc(), "2026-11-03");
  assert(node.innerHTML.indexOf("Nothing needs you right now") !== -1, "calm empty state");
});

test("renderReminders uses shim-safe attributes not innerHTML injection", function () {
  var c = palWith('Evil<script>alert(1)</script>', { createdAt: "2026-01-01" });
  core.addLetter(c.state, { palId: c.pal.id, direction: "sent", date: "2026-01-10" });
  var node = ui.renderReminders(c.state, doc(), "2026-11-03");
  var html = node.innerHTML;
  assert(html.indexOf("<script>") === -1, "script tag never lands in markup");
  assert(html.indexOf("&lt;script&gt;") !== -1, "hostile text arrives escaped");
});

test("renderPalsList hides addresses until revealed", function () {
  var c = palWith("Ana", { createdAt: "2026-01-01" });
  var s = c.state;
  s.pals[0].address = "12 Quiet Lane, Hobbiton";
  var html = ui.renderPalsList(s, doc(), { revealAddress: {} }).innerHTML;
  assert(html.indexOf("12 Quiet Lane") === -1, "address hidden by default");
  assert(html.indexOf("Show address") !== -1, "reveal control present");
  var open = ui.renderPalsList(s, doc(), { revealAddress: {} });
  open = ui.renderPalsList(s, doc(), { revealAddress: (function () { var o = {}; o[c.pal.id] = true; return o; })() });
  assert(open.innerHTML.indexOf("12 Quiet Lane") !== -1, "address visible when revealed");
});

test("renderPalCard shows privacy note and birthday stamp badge", function () {
  var s = core.createInitialState();
  var pal = core.addPal(s, { name: "Ana", privacyNote: "PO box only" }).pal;
  pal.birthday = "05-01";
  pal.birthdaySentYears.push("2026");
  var html = ui.renderPalCard(pal, s, doc(), {}).innerHTML;
  assert(html.indexOf("PO box only") !== -1, "privacy note rendered");
  assert(html.indexOf("birthday stamp 2026") !== -1, "birthday stamp badge");
  var html2 = ui.renderPalCard(core.addPal(s, { name: "Bo" }).pal, s, doc(), {}).innerHTML;
  assert(html2.indexOf("birthday stamp") === -1, "no badge when none sent");
});

test("pal with empty state renders warm empty copy", function () {
  var html = ui.renderPalsList(core.createInitialState(), doc(), {}).innerHTML;
  assert(html.indexOf("No pen pals yet") !== -1);
});

test("renderLetters sorts newest first and labels direction", function () {
  var s = core.createInitialState();
  var pal = core.addPal(s, { name: "Ana" }).pal;
  core.addLetter(s, { palId: pal.id, direction: "sent", date: "2026-01-10", note: "first" });
  core.addLetter(s, { palId: pal.id, direction: "received", date: "2026-03-11" });
  var html = ui.renderLetters(s, doc()).innerHTML;
  assert(html.indexOf("received from Ana") > 0, "received label");
  assert(html.indexOf("sent to Ana") !== -1, "sent label");
  assert(html.indexOf("first") !== -1, "note shown");
  assert(html.indexOf("Mar 11, 2026") < html.indexOf("Jan 10, 2026"), "newest first");
});

test("renderLetters empty state is encouraging not scolding", function () {
  var html = ui.renderLetters(core.createInitialState(), doc()).innerHTML;
  assert(html.indexOf("No letters logged yet") !== -1);
  assert(html.indexOf("should have") === -1 && html.indexOf("behind") === -1, "no shame words");
});

test("renderIdeas escapes hostile input", function () {
  var s = core.createInitialState();
  core.addIdea(s, '<img src=x onerror="steal()">');
  var html = ui.renderIdeas(s, doc()).innerHTML;
  assert(html.indexOf("<img") === -1, "no raw tag");
  assert(html.indexOf("&lt;img") !== -1, "escaped instead");
});

test("renderIdeas marks used ideas with class", function () {
  var s = core.createInitialState();
  var idea = core.addIdea(s, "press a leaf").idea;
  var before = ui.renderIdeas(s, doc()).innerHTML;
  assert(before.indexOf("idea-used") === -1, "fresh idea not marked");
  core.toggleIdeaUsed(s, idea.id);
  var after = ui.renderIdeas(s, doc()).innerHTML;
  assert(after.indexOf("idea-used") !== -1, "used idea marked");
});

test("renderPrompts lists unanswered before answered", function () {
  var s = core.createInitialState();
  var pal = core.addPal(s, { name: "Ana" }).pal;
  var p1 = core.addPrompt(s, { text: "what music at 15?", palId: pal.id }).prompt;
  var p2 = core.addPrompt(s, { text: "favorite stamp?" }).prompt;
  core.togglePromptAnswered(s, p2.id);
  var html = ui.renderPrompts(s, doc()).innerHTML;
  assert(html.indexOf("waiting: what music at 15?") !== -1, "open prompt labeled waiting");
  assert(html.indexOf("answered: favorite stamp?") !== -1, "answered prompt labeled");
  assert(html.indexOf("what music") < html.indexOf("favorite stamp?"), "open ones float to top");
  assert(html.indexOf("(Ana)") !== -1, "shows who asked");
});

test("renderOccasions renders stamp jar with counts and buttons", function () {
  var s = core.createInitialState();
  var html = ui.renderOccasions(s, doc()).innerHTML;
  assert(html.indexOf("Stamp jar: 20") !== -1, "stamp count shown");
  assert(html.indexOf('data-action="stamp-plus"') !== -1);
  assert(html.indexOf('data-action="stamp-minus"') !== -1);
});

test("renderOccasions lists birthday pals with mark-sent action", function () {
  var s = core.createInitialState();
  var pal = core.addPal(s, { name: "Ana" }).pal;
  pal.birthday = "05-01";
  var html = ui.renderOccasions(s, doc()).innerHTML;
  assert(html.indexOf("Ana — 05-01 every year") !== -1, "birthday line");
  assert(html.indexOf('data-action="mark-birthday-sent"') !== -1);
});

test("renderPalOptions offers a blank first option plus all pals", function () {
  var s = core.createInitialState();
  core.addPal(s, { name: "Ana" });
  core.addPal(s, { name: "Bo" });
  var frag = ui.renderPalOptions(s, doc());
  var texts = frag.children.map(function (o) { return o.textContent; });
  var values = frag.children.map(function (o) { return o.getAttribute("value"); });
  assertEq(texts[0], "— pick a pen pal —");
  assertEq(values[0], "");
  assertEq(texts[2], "Bo");
  assert(values.indexOf(null) === -1, "every option has a value");
});

test("ui deriveRemindersList attaches pal names for snooze buttons", function () {
  var c = palWith("Ana", { createdAt: "2026-01-01" });
  core.addLetter(c.state, { palId: c.pal.id, direction: "sent", date: "2026-01-10" });
  var list = ui.deriveRemindersList(c.state, "2026-11-03");
  assertEq(list[0].palName, "Ana");
});

// ---------------------------------------------------------------------------

console.log("");
console.log("Passed: " + passed + "  Failed: " + failed);
process.exit(failed ? 1 : 0);
