/* Snail Mailkeeper — UI rendering.
 * Every render function takes (state, doc) and returns a DOM node,
 * so tests can run it against a real document or the lightweight shim.
 * Copyright (c) 2026 Asdale Dynamics, LLC — MIT license.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./core.js"));
  else root.SnailUI = factory(root.SnailCore);
})(typeof self !== "undefined" ? self : this, function (core) {
  "use strict";

  function el(doc, tag, className, text) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function fmtDate(iso, doc, node) {
    var d = core.parseISO(iso);
    if (!d) return "";
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
  }

  function att(node, name, value) {
    node.setAttribute(name, value);
  }

  /* ---------- Reminders (gentle, snooze-able) ---------- */

  function renderReminders(state, doc, today) {
    var wrap = el(doc, "section", "reminders");
    att(wrap, "data-testid", "reminders");
    var head = el(doc, "div", "reminders-head");
    head.appendChild(el(doc, "h2", null, "Maybe these feel worth a look"));
    var snoozeBtn = el(doc, "button", "btn btn-ghost", "Snooze all for a week");
    att(snoozeBtn, "type", "button");
    att(snoozeBtn, "data-action", "snooze-all");
    head.appendChild(snoozeBtn);
    wrap.appendChild(head);

    var list = deriveRemindersList(state, today);
    if (!list.length) {
      wrap.appendChild(el(doc, "p", "muted", "Nothing needs you right now. Enjoy the quiet — your letters will still be there when you're ready."));
      return wrap;
    }
    var ul = el(doc, "ul", "reminder-list");
    list.forEach(function (r) {
      var li = el(doc, "li", "reminder reminder-" + r.kind);
      li.appendChild(el(doc, "strong", null, r.title));
      li.appendChild(el(doc, "p", "reminder-body", r.body));
      if (r.palId && (r.kind === "follow-up" || r.kind === "new-friend")) {
        var b = el(doc, "button", "btn btn-tiny", "Snooze " + r.palName + " for a while");
        att(b, "type", "button");
        att(b, "data-action", "snooze-pal");
        att(b, "data-pal-id", r.palId);
        li.appendChild(b);
      }
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    return wrap;
  }

  function deriveRemindersList(state, today) {
    var raw = core.deriveReminders(state, today || core.todayISO());
    return raw.map(function (r) {
      var pal = r.palId ? state.pals.find(function (p) { return p.id === r.palId; }) : null;
      return Object.assign({}, r, { palName: pal ? pal.name : null });
    });
  }

  /* ---------- Pen pals ---------- */

  function renderPalsList(state, doc, options) {
    var opts = options || {};
    var wrap = el(doc, "section", "pals");
    att(wrap, "data-testid", "pals-list");
    if (!state.pals.length) {
      wrap.appendChild(el(doc, "p", "muted", "No pen pals yet. Add one above — a person you send real mail to, even rarely."));
      return wrap;
    }
    var ul = el(doc, "ul", "pal-list");
    state.pals.forEach(function (pal) {
      ul.appendChild(renderPalCard(pal, state, doc, opts));
    });
    wrap.appendChild(ul);
    return wrap;
  }

  function renderPalCard(pal, state, doc, opts) {
    var li = el(doc, "li", "pal-card");
    att(li, "data-testid", "pal-card");
    att(li, "data-pal-id", pal.id);

    var nameRow = el(doc, "div", "pal-name-row");
    nameRow.appendChild(el(doc, "strong", "pal-name", pal.name));
    if (pal.handle) nameRow.appendChild(el(doc, "span", "muted pal-handle", "@" + pal.handle));
    var sentThisYear = pal.birthdaySentYears.indexOf(core.todayISO().slice(0, 4)) !== -1;
    if (sentThisYear) {
      var badge = el(doc, "span", "badge badge-birthday", "birthday stamp " + core.todayISO().slice(0, 4));
      att(badge, "data-testid", "birthday-stamp");
      att(badge, "title", "You mailed them a birthday card this year");
      nameRow.appendChild(badge);
    }
    li.appendChild(nameRow);

    if (pal.birthday) {
      li.appendChild(el(doc, "p", "pal-meta", "Birthday: " + pal.birthday));
    }
    if (pal.privacyNote) {
      var pn = el(doc, "p", "privacy-note");
      att(pn, "data-testid", "privacy-note");
      pn.appendChild(el(doc, "span", null, "Privacy: "));
      pn.appendChild(el(doc, "span", null, pal.privacyNote));
      li.appendChild(pn);
    }

    // Address is deliberately hidden until revealed — a privacy-friendly default.
    var addrBlock = el(doc, "div", "address-block");
    if (pal.address) {
      var reveal = el(doc, "button", "btn btn-tiny", opts.revealAddress && opts.revealAddress[pal.id] ? "Hide address" : "Show address");
      att(reveal, "type", "button");
      att(reveal, "data-action", opts.revealAddress && opts.revealAddress[pal.id] ? "hide-address" : "show-address");
      att(reveal, "data-pal-id", pal.id);
      addrBlock.appendChild(reveal);
      if (opts.revealAddress && opts.revealAddress[pal.id]) {
        addrBlock.appendChild(el(doc, "p", "address", pal.address));
      } else {
        addrBlock.appendChild(el(doc, "p", "address address-hidden", "(hidden until you show it — stays on this device either way)"));
      }
    } else {
      addrBlock.appendChild(el(doc, "p", "address address-hidden", "No address saved. That's okay — some pen pals are pen names only."));
    }
    li.appendChild(addrBlock);

    var last = core.lastLetterTo(state, pal.id);
    if (last) {
      var dir = last.direction === "sent" ? "You mailed" : "You received";
      li.appendChild(el(doc, "p", "pal-meta", "Last letter: " + dir + " one on " + fmtDate(last.date)));
    } else {
      li.appendChild(el(doc, "p", "pal-meta muted", "No letters logged yet — whenever you're ready."));
    }

    var actions = el(doc, "div", "pal-actions");
    var snooze = el(doc, "button", "btn btn-tiny", "Snooze reminders for " + pal.name);
    att(snooze, "type", "button");
    att(snooze, "data-action", "snooze-pal");
    att(snooze, "data-pal-id", pal.id);
    actions.appendChild(snooze);
    var remove = el(doc, "button", "btn btn-tiny btn-danger", "Remove " + pal.name);
    att(remove, "type", "button");
    att(remove, "data-action", "remove-pal");
    att(remove, "data-pal-id", pal.id);
    actions.appendChild(remove);
    li.appendChild(actions);
    return li;
  }

  /* ---------- Letters ---------- */

  function renderLetters(state, doc) {
    var wrap = el(doc, "section", "letters");
    att(wrap, "data-testid", "letters-list");
    if (!state.letters.length) {
      wrap.appendChild(el(doc, "p", "muted", "No letters logged yet. When an envelope actually leaves your hands, write it down — that little checkmark feels good."));
      return wrap;
    }
    var sorted = state.letters.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var ul = el(doc, "ul", "letter-list");
    sorted.forEach(function (l) {
      var pal = state.pals.find(function (p) { return p.id === l.palId; });
      var li = el(doc, "li", "letter letter-" + l.direction);
      att(li, "data-testid", "letter-item");
      li.appendChild(el(doc, "strong", null, (l.direction === "sent" ? "\u2192 sent to " : "\u2190 received from ") + (pal ? pal.name : "someone")));
      li.appendChild(el(doc, "span", "muted", " " + fmtDate(l.date)));
      if (l.note) li.appendChild(el(doc, "p", "letter-note", l.note));
      var del = el(doc, "button", "btn btn-tiny btn-danger", "Remove");
      att(del, "type", "button");
      att(del, "data-action", "remove-letter");
      att(del, "data-letter-id", l.id);
      li.appendChild(del);
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    return wrap;
  }

  /* ---------- Ideas journal ---------- */

  function renderIdeas(state, doc) {
    var wrap = el(doc, "section", "ideas");
    att(wrap, "data-testid", "ideas-list");
    if (!state.ideas.length) {
      wrap.appendChild(el(doc, "p", "muted", "Journal leftover ideas here — half-thoughts, things you'd write about someday. They keep without guilt."));
      return wrap;
    }
    var ul = el(doc, "ul", "idea-list");
    state.ideas.forEach(function (idea) {
      var li = el(doc, "li", "idea" + (idea.used ? " idea-used" : ""));
      att(li, "data-testid", "idea-item");
      var check = el(doc, "button", "btn btn-tiny", idea.used ? "Used" : "Mark used");
      att(check, "type", "button");
      att(check, "data-action", "toggle-idea");
      att(check, "data-idea-id", idea.id);
      li.appendChild(check);
      li.appendChild(el(doc, "span", "idea-text", idea.text));
      var del = el(doc, "button", "btn btn-tiny btn-danger", "Delete");
      att(del, "type", "button");
      att(del, "data-action", "remove-idea");
      att(del, "data-idea-id", idea.id);
      li.appendChild(del);
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    return wrap;
  }

  /* ---------- Unanswered prompts ---------- */

  function renderPrompts(state, doc) {
    var wrap = el(doc, "section", "prompts");
    att(wrap, "data-testid", "prompts-list");
    if (!state.prompts.length) {
      wrap.appendChild(el(doc, "p", "muted", "When a friend asks you something in a letter you don't want to forget, park it here. Guilt-free parking."));
      return wrap;
    }
    var ul = el(doc, "ul", "prompt-list");
    var open = state.prompts.filter(function (p) { return !p.answered; });
    var done = state.prompts.filter(function (p) { return p.answered; });
    open.concat(done).forEach(function (pr) {
      var pal = pr.palId ? state.pals.find(function (p) { return p.id === pr.palId; }) : null;
      var li = el(doc, "li", "prompt" + (pr.answered ? " prompt-answered" : ""));
      att(li, "data-testid", "prompt-item");
      var text = (pr.answered ? "\u2713 answered: " : "\u2026 waiting: ") + pr.text;
      li.appendChild(el(doc, "span", "prompt-text", text));
      if (pal) li.appendChild(el(doc, "span", "muted", " (" + pal.name + ")"));
      var toggle = el(doc, "button", "btn btn-tiny", pr.answered ? "Un-answer" : "Mark answered");
      att(toggle, "type", "button");
      att(toggle, "data-action", "toggle-prompt");
      att(toggle, "data-prompt-id", pr.id);
      li.appendChild(toggle);
      var del = el(doc, "button", "btn btn-tiny btn-danger", "Delete");
      att(del, "type", "button");
      att(del, "data-action", "remove-prompt");
      att(del, "data-prompt-id", pr.id);
      li.appendChild(del);
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    return wrap;
  }

  /* ---------- Occasions / birthdays / stamp jar ---------- */

  function renderOccasions(state, doc) {
    var wrap = el(doc, "section", "occasions");
    att(wrap, "data-testid", "occasions-list");
    var jar = el(doc, "div", "stamp-jar");
    att(jar, "data-testid", "stamp-jar");
    jar.appendChild(el(doc, "strong", null, "Stamp jar: " + state.settings.stamps));
    var plus = el(doc, "button", "btn btn-tiny", "+ stamp");
    att(plus, "type", "button");
    att(plus, "data-action", "stamp-plus");
    jar.appendChild(plus);
    var minus = el(doc, "button", "btn btn-tiny", "\u2212 stamp");
    att(minus, "type", "button");
    att(minus, "data-action", "stamp-minus");
    jar.appendChild(minus);
    wrap.appendChild(jar);

    var birthdays = state.pals.filter(function (p) { return p.birthday; });
    if (birthdays.length || state.occasions.length) {
      var ul = el(doc, "ul", "occasion-list");
      birthdays.forEach(function (p) {
        var li = el(doc, "li", "occasion");
        att(li, "data-testid", "occasion-item");
        li.appendChild(el(doc, "span", null, "\uD83C\uDF82 " + p.name + " \u2014 " + p.birthday + " every year"));
        var markBtn = el(doc, "button", "btn btn-tiny", "Mark card sent this year");
        att(markBtn, "type", "button");
        att(markBtn, "data-action", "mark-birthday-sent");
        att(markBtn, "data-pal-id", p.id);
        li.appendChild(markBtn);
        ul.appendChild(li);
      });
      state.occasions.forEach(function (o) {
        var li = el(doc, "li", "occasion");
        li.appendChild(el(doc, "span", null, "\u2600 " + o.name + " \u2014 " + o.date));
        var del = el(doc, "button", "btn btn-tiny btn-danger", "Delete");
        att(del, "type", "button");
        att(del, "data-action", "remove-occasion");
        att(del, "data-occasion-id", o.id);
        li.appendChild(del);
        ul.appendChild(li);
      });
      wrap.appendChild(ul);
    } else {
      wrap.appendChild(el(doc, "p", "muted", "Track birthdays and small occasions so a card can catch them early — or don't track anything at all."));
    }
    return wrap;
  }

  /* ---------- Forms ---------- */

  function renderPalOptions(state, doc) {
    var frag = doc.createDocumentFragment();
    var blank = el(doc, "option", null, "\u2014 pick a pen pal \u2014");
    blank.setAttribute("value", "");
    frag.appendChild(blank);
    state.pals.forEach(function (p) {
      var o = el(doc, "option", null, p.name);
      o.setAttribute("value", p.id);
      frag.appendChild(o);
    });
    return frag;
  }

  return {
    renderReminders: renderReminders,
    deriveRemindersList: deriveRemindersList,
    renderPalsList: renderPalsList,
    renderPalCard: renderPalCard,
    renderLetters: renderLetters,
    renderIdeas: renderIdeas,
    renderPrompts: renderPrompts,
    renderOccasions: renderOccasions,
    renderPalOptions: renderPalOptions,
    fmtDate: fmtDate
  };
});
