/* Snail Mailkeeper — browser bootstrap and event wiring.
 * Copyright (c) 2026 Asdale Dynamics, LLC — MIT license.
 */
(function () {
  "use strict";
  var core = window.SnailCore;
  var ui = window.SnailUI;

  var today = core.todayISO();
  var state = core.loadState(window.localStorage);
  var revealedAddresses = {};

  function $(id) { return document.getElementById(id); }

  function renderAll() {
    core.saveState(window.localStorage, state);
    renderInto($("reminder-mount"), function () { return ui.renderReminders(state, document, today); });
    renderInto($("pals-mount"), function () { return ui.renderPalsList(state, document, { revealAddress: revealedAddresses }); });
    renderInto($("letters-mount"), function () { return ui.renderLetters(state, document); });
    renderInto($("ideas-mount"), function () { return ui.renderIdeas(state, document); });
    renderInto($("prompts-mount"), function () { return ui.renderPrompts(state, document); });
    renderInto($("occasions-mount"), function () { return ui.renderOccasions(state, document); });
    renderPalSelects();
  }

  function renderInto(mount, build) {
    mount.innerHTML = "";
    mount.appendChild(build());
  }

  function renderPalSelects() {
    var letterPal = $("letter-pal");
    var promptPal = $("prompt-pal");
    var keepLetter = letterPal.value, keepPrompt = promptPal.value;
    letterPal.innerHTML = ""; promptPal.innerHTML = "";
    letterPal.appendChild(ui.renderPalOptions(state, document));
    promptPal.appendChild(ui.renderPalOptions(state, document));
    promptPal.options[0].textContent = "— from anyone —";
    if (state.pals.some(function (p) { return p.id === keepLetter; })) letterPal.value = keepLetter;
    if (state.pals.some(function (p) { return p.id === keepPrompt; })) promptPal.value = keepPrompt;
  }

  function msg(text, isError) {
    var m = $("form-message");
    m.textContent = isError ? text : text;
    m.classList.toggle("error", !!isError);
  }

  function findPal(id) {
    return state.pals.find(function (p) { return p.id === id; });
  }

  function radioValue(name) {
    var checked = document.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : "sent";
  }

  /* ---------- forms ---------- */

  $("pal-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var birthday = $("pal-birthday").value.trim();
    if (birthday && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(birthday)) {
      msg("Birthdays look best as MM-DD (like 04-21). No year needed — this isn't a records office.", true);
      return;
    }
    var res = core.addPal(state, {
      name: $("pal-name").value,
      handle: $("pal-handle").value,
      birthday: birthday,
      followUpDays: $("pal-followup").value,
      address: $("pal-address").value,
      privacyNote: $("pal-privacy").value
    });
    if (!res.ok) { msg(res.error, true); return; }
    $("pal-form").reset();
    $("pal-followup").value = 30;
    msg("Added " + res.pal.name + ". First letter can wait for a good day — a postcard counts.");
    renderAll();
  });

  $("letter-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var isBirthdayCard = $("letter-birthday").checked;
    var res = core.addLetter(state, {
      palId: $("letter-pal").value,
      direction: isBirthdayCard ? "sent" : radioValue("letter-direction"),
      date: $("letter-date").value || today,
      note: $("letter-note").value,
      birthdayCard: isBirthdayCard
    });
    if (!res.ok) { msg(res.error, true); return; }
    $("letter-note").value = "";
    if (isBirthdayCard) msg("Logged. Have a small celebration — birthday card sent.");
    else msg("Letter logged. Nice work.");
    renderAll();
  });

  $("idea-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var res = core.addIdea(state, $("idea-text").value);
    if (!res.ok) { msg(res.error, true); return; }
    $("idea-text").value = "";
    renderAll();
  });

  $("prompt-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var res = core.addPrompt(state, { text: $("prompt-text").value, palId: $("prompt-pal").value });
    if (!res.ok) { msg(res.error, true); return; }
    $("prompt-text").value = "";
    renderAll();
  });

  $("occasion-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var res = core.addOccasion(state, { name: $("occasion-name").value, date: $("occasion-date").value });
    if (!res.ok) { msg(res.error, true); return; }
    $("occasion-form").reset();
    renderAll();
  });

  /* ---------- delegated clicks ---------- */

  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest("[data-action]") : null;
    if (!btn) return;
    var action = btn.getAttribute("data-action");
    var palId = btn.getAttribute("data-pal-id");

    if (action === "show-address" && palId) {
      revealedAddresses[palId] = true;
      renderAll();
    } else if (action === "hide-address" && palId) {
      delete revealedAddresses[palId];
      renderAll();
    } else if (action === "remove-pal" && palId) {
      var pal = findPal(palId);
      if (pal && window.confirm("Remove " + pal.name + "? Their letters log and parked prompts go too.")) {
        core.removePal(state, palId);
        renderAll();
      }
    } else if (action === "snooze-pal" && palId) {
      core.snoozePal(state, palId, today, 14);
      var p = findPal(palId);
      if (p) msg("Snoozed reminders for " + p.name + " for two weeks. They're not going anywhere.");
      renderAll();
    } else if (action === "snooze-all") {
      core.snoozeAll(state, today, 7);
      msg("Reminders snoozed for a week. Rest easy.");
      renderAll();
    } else if (action === "remove-letter") {
      state.letters = state.letters.filter(function (l) { return l.id !== btn.getAttribute("data-letter-id"); });
      renderAll();
    } else if (action === "toggle-idea") {
      core.toggleIdeaUsed(state, btn.getAttribute("data-idea-id"));
      renderAll();
    } else if (action === "remove-idea") {
      core.removeIdea(state, btn.getAttribute("data-idea-id"));
      renderAll();
    } else if (action === "toggle-prompt") {
      core.togglePromptAnswered(state, btn.getAttribute("data-prompt-id"));
      renderAll();
    } else if (action === "remove-prompt") {
      core.removePrompt(state, btn.getAttribute("data-prompt-id"));
      renderAll();
    } else if (action === "stamp-plus") {
      core.adjustStamps(state, 1);
      renderAll();
    } else if (action === "stamp-minus") {
      core.adjustStamps(state, -1);
      renderAll();
    } else if (action === "mark-birthday-sent" && palId) {
      core.markBirthdayCardSent(state, palId);
      var p2 = findPal(palId);
      if (p2) msg("Marked as sent for " + new Date().getUTCFullYear() + ". A little stamp of pride is deserved.");
      renderAll();
    } else if (action === "remove-occasion") {
      core.removeOccasion(state, btn.getAttribute("data-occasion-id"));
      renderAll();
    }
  });

  /* ---------- export / import / erase ---------- */

  $("export-btn").addEventListener("click", function () {
    var data = core.exportState(state);
    var blob = new Blob([data], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "snail-mailkeeper-" + today + ".json";
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
    msg("Exported. Keep a copy wherever you keep nice things.");
  });

  $("import-file").addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var res = core.importState(reader.result);
      if (!res.ok) { msg(res.error, true); return; }
      if (window.confirm("Replace what's currently on this device with the file's contents?")) {
        state = res.state;
        renderAll();
        msg("Restored.");
      }
    };
    reader.readAsText(file);
  });

  $("erase-btn").addEventListener("click", function () {
    if (window.confirm("Erase everything on this device? This can't be undone — maybe export first.")) {
      state = core.createInitialState();
      renderAll();
      msg("Erased. Clean slate, no hard feelings.");
    }
  });

  /* ---------- init ---------- */

  $("letter-date").value = today;
  renderAll();
  msg("");
})();
