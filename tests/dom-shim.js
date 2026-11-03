/* tests/dom-shim.js — a tiny DOM, just enough to run ui.js render functions
 * without a browser or any dependencies. Deliberately strict: it *escapes*
 * text nodes when serializing innerHTML, so escaping bugs actually show up.
 * Copyright (c) 2026 Asdale Dynamics, LLC — MIT license.
 */
"use strict";

function DomShimText(data) {
  this.nodeType = 3;
  this.data = String(data);
  this._text = true;
}

function DomShimElement(tag, shim) {
  this.nodeType = 1;
  this.tagName = String(tag).toUpperCase();
  this._shim = shim;
  this.children = [];
  this.attributes = {};
  this.parentNode = null;
  var self = this;
  this.classList = {
    add: function (c) { var set = self._classes(); if (set.indexOf(c) === -1) set.push(c); self._setClasses(set); },
    remove: function (c) { self._setClasses(self._classes().filter(function (x) { return x !== c; })); },
    contains: function (c) { return self._classes().indexOf(c) !== -1; }
  };
  var textContentValue = "";
  Object.defineProperty(this, "textContent", {
    get: function () {
      if (this.children.some(function (c) { return c._text; })) {
        return this.children.filter(function (c) { return c._text; }).map(function (c) { return c.data; }).join("");
      }
      return this.children
        .filter(function (c) { return c.nodeType !== 3; })
        .map(function (c) { return c.textContent; })
        .join("");
    },
    set: function (v) {
      textContentValue = String(v);
      this.children = [new DomShimText(textContentValue)];
    }
  });
}

DomShimElement.prototype._classes = function () {
  var cls = this.attributes["class"] || "";
  return cls ? cls.split(/\s+/) : [];
};
DomShimElement.prototype._setClasses = function (set) {
  if (set.length) this.attributes["class"] = set.join(" ");
  else delete this.attributes["class"];
};

Object.defineProperty(DomShimElement.prototype, "className", {
  get: function () { return this.attributes["class"] || ""; },
  set: function (v) {
    if (v) this.attributes["class"] = v;
    else delete this.attributes["class"];
  }
});

Object.defineProperty(DomShimElement.prototype, "innerHTML", {
  get: function () { return serialize(this); },
  set: function (html) { this._rawHtml = String(html); this.children = []; }
});

function serialize(el) {
  if (el._text) return escapeForHtml(el.data);
  var parts = ["<" + el.tagName.toLowerCase() + serializeAttrs(el) + ">"];
  if (el._rawHtml != null) parts.push(el._rawHtml);
  el.children.forEach(function (c) { parts.push(serialize(c)); });
  parts.push("</" + el.tagName.toLowerCase() + ">");
  return parts.join("");
}

function serializeAttrs(el) {
  var out = "";
  Object.keys(el.attributes).forEach(function (k) {
    out += " " + k + '="' + escapeForHtml(el.attributes[k]) + '"';
  });
  return out;
}

function escapeForHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

DomShimElement.prototype.appendChild = function (child) {
  this.children.push(child);
  child.parentNode = this;
  return child;
};
DomShimElement.prototype.removeChild = function (child) {
  this.children = this.children.filter(function (c) { return c !== child; });
  return child;
};
DomShimElement.prototype.setAttribute = function (k, v) { this.attributes[k] = String(v); };
DomShimElement.prototype.getAttribute = function (k) { return this.attributes[k] != null ? this.attributes[k] : null; };
DomShimElement.prototype.removeAttribute = function (k) { delete this.attributes[k]; };

function DomShimDocument() {
  this.body = this.createElement("body");
  this.documentElement = this.createElement("html");
}
DomShimDocument.prototype.createElement = function (tag) { return new DomShimElement(tag, this); };
DomShimDocument.prototype.createTextNode = function (data) { return new DomShimText(data); };
DomShimDocument.prototype.createDocumentFragment = function () {
  var frag = new DomShimElement("#fragment", this);
  frag._fragment = true;
  return frag;
};
DomShimDocument.prototype.getElementById = function () { return null; };

module.exports = {
  createDoc: function () { return new DomShimDocument(); },
  escapeForHtml: escapeForHtml,
  serialize: serialize
};
