// ==UserScript==
// @id             rogueroute-gpx-exporter
// @name           IITC Plugin: RogueRoute GPX Exporter
// @namespace      https://github.com/RogueAssassin/RogueRoute-GPX
// @category       Layer
// @version        6.4.5
// @description    Smart IITC exporter for RogueRoute GPX v6.4.5 with selected/view/polygon/circle export, loop building, preflight checks, and direct website handoff.
// @author         RogueAssassin
// @homepageURL    https://github.com/RogueAssassin/RogueRoute-GPX
// @supportURL     https://github.com/RogueAssassin/RogueRoute-GPX/issues
// @updateURL      https://raw.githubusercontent.com/RogueAssassin/RogueRoute-GPX/main/plugins/iitc/gpx-route-generator.user.js
// @downloadURL    https://raw.githubusercontent.com/RogueAssassin/RogueRoute-GPX/main/plugins/iitc/gpx-route-generator.user.js
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==

function wrapper(plugin_info) {
  if (typeof window.plugin !== "function") window.plugin = function () {};

  const SELECTED_KEY = "rogueroute-gpx-selected";
  const WEBSITE_URL_KEY = "rogueroute-gpx-website-url";
  const SETTINGS_KEY = "rogueroute-gpx-settings";
  const DEFAULT_WEBSITE_URL = "https://gpx.roguegaming.com.au/";

  const DEFAULT_SETTINGS = {
    keepFirstAsStart: true,
    optimizeRoute: true,
    returnToStart: true,
    preserveExactOrder: false,
    clearAfterExport: false,
  };

  const plugin = {
    pluginVersion: "6.4.5",
    polyline: null,

    loadSelected() {
      try {
        const parsed = JSON.parse(localStorage.getItem(SELECTED_KEY) || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },

    saveSelected(list) {
      localStorage.setItem(SELECTED_KEY, JSON.stringify(list));
    },

    loadSettings() {
      try {
        const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
        return { ...DEFAULT_SETTINGS, ...(parsed || {}) };
      } catch {
        return { ...DEFAULT_SETTINGS };
      }
    },

    saveSettings(settings) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...(settings || {}) }));
    },

    getWebsiteUrl() {
      return localStorage.getItem(WEBSITE_URL_KEY) || DEFAULT_WEBSITE_URL;
    },

    setWebsiteUrl() {
      const current = this.getWebsiteUrl();
      const next = window.prompt("RogueRoute Website URL", current);
      if (next && next.trim()) {
        localStorage.setItem(WEBSITE_URL_KEY, next.trim());
        this.toast("Website URL saved.");
      }
    },

    toast(message) {
      if (window.dialog && typeof window.dialog === "function") {
        console.log(`[RogueRoute GPX] ${message}`);
      }
      window.alert(message);
    },

    portalToEntry(portal) {
      const data = portal?.options?.data || {};
      const lat = data.latE6 != null ? data.latE6 / 1e6 : portal.getLatLng().lat;
      const lng = data.lngE6 != null ? data.lngE6 / 1e6 : portal.getLatLng().lng;
      return {
        guid: portal.options?.guid,
        lat,
        lng,
        name: data.title || portal.options?.data?.title || "Portal",
        image: data.image || "",
      };
    },

    addToList(guid) {
      const portal = window.portals?.[guid];
      if (!portal) return;
      const list = this.loadSelected();
      const existingIndex = list.findIndex((entry) => entry.guid === guid);
      if (existingIndex >= 0) {
        list.splice(existingIndex, 1);
      } else {
        list.push(this.portalToEntry(portal));
      }
      this.saveSelected(list);
      this.refreshSelected();
    },

    setStartPortal(guid) {
      const list = this.loadSelected();
      const index = list.findIndex((entry) => entry.guid === guid);
      if (index <= 0) return;
      const [entry] = list.splice(index, 1);
      list.unshift(entry);
      this.saveSelected(list);
      this.refreshSelected();
      this.toast(`Start portal set to ${entry.name}.`);
    },

    moveUp(guid) {
      const list = this.loadSelected();
      const index = list.findIndex((entry) => entry.guid === guid);
      if (index <= 0) return;
      [list[index - 1], list[index]] = [list[index], list[index - 1]];
      this.saveSelected(list);
      this.refreshSelected();
    },

    moveDown(guid) {
      const list = this.loadSelected();
      const index = list.findIndex((entry) => entry.guid === guid);
      if (index < 0 || index >= list.length - 1) return;
      [list[index + 1], list[index]] = [list[index], list[index + 1]];
      this.saveSelected(list);
      this.refreshSelected();
    },

    removeFromList(guid) {
      this.saveSelected(this.loadSelected().filter((entry) => entry.guid !== guid));
      this.refreshSelected();
    },

    clearSelected() {
      this.saveSelected([]);
      this.refreshSelected();
    },

    reverseSelected() {
      const list = this.loadSelected().slice().reverse();
      this.saveSelected(list);
      this.refreshSelected();
    },

    distance(a, b) {
      const dx = a.lat - b.lat;
      const dy = a.lng - b.lng;
      return Math.sqrt(dx * dx + dy * dy);
    },

    nearestNeighbor(points, fixedStart) {
      if (points.length <= 2) return points.slice();
      const remaining = points.slice();
      const ordered = [];

      if (fixedStart) {
        ordered.push(remaining.shift());
      } else {
        ordered.push(remaining.shift());
      }

      while (remaining.length) {
        const current = ordered[ordered.length - 1];
        let bestIndex = 0;
        let bestDistance = this.distance(current, remaining[0]);
        for (let i = 1; i < remaining.length; i += 1) {
          const nextDistance = this.distance(current, remaining[i]);
          if (nextDistance < bestDistance) {
            bestDistance = nextDistance;
            bestIndex = i;
          }
        }
        ordered.push(remaining.splice(bestIndex, 1)[0]);
      }

      return ordered;
    },

    normalizeWaypoints(points, options) {
      let normalized = points.map((point, index) => ({
        ...point,
        order: index + 1,
      }));

      if (!options.preserveExactOrder && options.optimizeRoute) {
        normalized = this.nearestNeighbor(normalized, options.keepFirstAsStart);
      }

      if (options.returnToStart && normalized.length > 1) {
        const start = normalized[0];
        normalized = normalized.concat({
          ...start,
          id: `${start.id || start.guid || start.name}-loop`,
          loopClosure: true,
          order: normalized.length + 1,
        });
      }

      return normalized.map((point, index) => ({ ...point, order: index + 1 }));
    },

    portalInPolygon(latlng, poly) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].lat;
        const yi = poly[i].lng;
        const xj = poly[j].lat;
        const yj = poly[j].lng;
        const intersect = ((yi > latlng.lng) !== (yj > latlng.lng)) &&
          (latlng.lat < ((xj - xi) * (latlng.lng - yi)) / ((yj - yi) || 1e-12) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    },

    getDrawToolsShapes() {
      try {
        const raw = localStorage.getItem("plugin-draw-tools-layer") || "[]";
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },

    getShape(mode) {
      const shapes = this.getDrawToolsShapes();
      if (mode === "POLYGON") return shapes.find((shape) => shape?.type === "polygon") || null;
      if (mode === "CIRCLE") return shapes.find((shape) => shape?.type === "circle") || null;
      return null;
    },

    getWaypoints(mode) {
      const portals = Object.values(window.portals || {});
      const bounds = window.map?.getBounds?.();
      const shape = this.getShape(mode);

      if (mode === "SELECTED") {
        return this.loadSelected().map(({ lat, lng, name, guid }) => ({ lat, lng, name, id: guid, guid }));
      }

      return portals
        .filter((portal) => {
          const ll = portal.getLatLng();
          if (mode === "VIEW") return bounds ? bounds.contains(ll) : false;
          if (mode === "POLYGON" && shape?.type === "polygon") return this.portalInPolygon(ll, shape.latLngs || []);
          if (mode === "CIRCLE" && shape?.type === "circle") return ll.distanceTo(shape.latLng) <= shape.radius;
          return false;
        })
        .map((portal) => ({
          lat: portal.getLatLng().lat,
          lng: portal.getLatLng().lng,
          name: portal.options?.data?.title || "Portal",
          id: portal.options?.guid,
          guid: portal.options?.guid,
        }));
    },

    getSettingsFromDialog() {
      const read = (id, fallback) => {
        const node = document.getElementById(id);
        return node ? !!node.checked : fallback;
      };
      const settings = {
        keepFirstAsStart: read("rogueroute-keep-first", DEFAULT_SETTINGS.keepFirstAsStart),
        optimizeRoute: read("rogueroute-optimize", DEFAULT_SETTINGS.optimizeRoute),
        returnToStart: read("rogueroute-loop", DEFAULT_SETTINGS.returnToStart),
        preserveExactOrder: read("rogueroute-preserve", DEFAULT_SETTINGS.preserveExactOrder),
        clearAfterExport: read("rogueroute-clear-after", DEFAULT_SETTINGS.clearAfterExport),
      };
      if (settings.preserveExactOrder) {
        settings.optimizeRoute = false;
      }
      this.saveSettings(settings);
      return settings;
    },

    preflight(mode) {
      const issues = [];
      const warnings = [];

      if (!window.map) issues.push("IITC map is not ready yet.");
      if (!window.portals || Object.keys(window.portals).length === 0) issues.push("No portals are loaded in the current map view.");

      if (mode === "SELECTED") {
        const selected = this.loadSelected();
        if (selected.length === 0) issues.push("No selected portals yet. Alt-click portals to add them.");
        if (selected.length === 1) issues.push("Only 1 selected portal found. At least 2 are needed to build a route.");
      }

      if (mode === "POLYGON" && !this.getShape("POLYGON")) {
        issues.push("No polygon found. Draw one with Draw Tools first.");
      }

      if (mode === "CIRCLE" && !this.getShape("CIRCLE")) {
        issues.push("No circle found. Draw one with Draw Tools first.");
      }

      const websiteUrl = this.getWebsiteUrl();
      if (!websiteUrl || !/^https?:\/\//i.test(websiteUrl)) {
        warnings.push("Website URL is missing or does not look valid. Set it before opening RogueRoute.");
      }

      const points = this.getWaypoints(mode);
      if (points.length === 0) issues.push(`No portals were found for ${mode.toLowerCase()} export.`);
      if (points.length === 1) issues.push(`Only 1 portal was found for ${mode.toLowerCase()} export.`);

      return { issues, warnings, pointsCount: points.length };
    },

    showPreflight(mode) {
      const report = this.preflight(mode);
      const titleMode = mode.charAt(0) + mode.slice(1).toLowerCase();
      const body = [
        `<p><b>Mode:</b> ${titleMode}</p>`,
        `<p><b>Portals found:</b> ${report.pointsCount}</p>`,
        report.issues.length
          ? `<div style="color:#fecaca;"><b>Blocking issues</b><ul>${report.issues.map((item) => `<li>${item}</li>`).join("")}</ul></div>`
          : `<p style="color:#86efac;"><b>Ready:</b> No blocking issues found.</p>`,
        report.warnings.length
          ? `<div style="color:#fde68a;"><b>Warnings</b><ul>${report.warnings.map((item) => `<li>${item}</li>`).join("")}</ul></div>`
          : "",
      ].join("");
      window.dialog({ title: `RogueRoute Preflight - ${titleMode}`, html: body });
      return report;
    },

    ensurePreflight(mode) {
      const report = this.preflight(mode);
      if (report.issues.length) {
        this.showPreflight(mode);
        return false;
      }
      return true;
    },

    promptRouteName(defaultName) {
      const value = window.prompt("Enter Route Name", defaultName || "RogueRoute Export");
      return value && value.trim() ? value.trim() : null;
    },

    buildPayload(mode) {
      const options = this.getSettingsFromDialog();
      const points = this.getWaypoints(mode);
      const normalized = this.normalizeWaypoints(points, options);
      const routeName = this.promptRouteName(
        mode === "SELECTED" ? "Selected Portal Route" : `${mode.charAt(0) + mode.slice(1).toLowerCase()} Portal Route`
      );

      if (!routeName) return null;

      const center = window.map?.getCenter?.();
      const zoom = window.map?.getZoom?.();
      return {
        routeName,
        map: center ? { centerLat: center.lat, centerLng: center.lng, zoom: zoom || 15 } : undefined,
        waypoints: normalized,
        routeOptions: {
          keepFirstAsStart: options.keepFirstAsStart,
          optimizeRoute: options.optimizeRoute,
          returnToStart: options.returnToStart,
          preserveExactOrder: options.preserveExactOrder,
        },
        source: {
          type: "iitc-ce",
          pluginVersion: this.pluginVersion,
          exportMode: mode,
          selectedCount: points.length,
        },
      };
    },

    afterSuccessfulExport() {
      const options = this.getSettingsFromDialog();
      if (options.clearAfterExport) {
        this.clearSelected();
      }
      this.refreshSelected();
    },

    openInWebsite(mode) {
      if (!this.ensurePreflight(mode)) return;
      const payload = this.buildPayload(mode);
      if (!payload) return;
      const baseUrl = this.getWebsiteUrl().replace(/\/+$/, "");
      const url = `${baseUrl}#import=${encodeURIComponent(JSON.stringify(payload))}`;
      window.open(url, "_blank", "noopener,noreferrer");
      this.afterSuccessfulExport();
    },

    copyPayload(mode) {
      if (!this.ensurePreflight(mode)) return;
      const payload = this.buildPayload(mode);
      if (!payload) return;
      const text = JSON.stringify(payload, null, 2);
      const onDone = () => {
        this.afterSuccessfulExport();
        this.toast("RogueRoute payload copied to clipboard.");
      };
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(onDone, () => {
          window.prompt("Copy payload manually:", text);
        });
      } else {
        window.prompt("Copy payload manually:", text);
      }
    },

    copyCoords(mode) {
      if (!this.ensurePreflight(mode)) return;
      const options = this.getSettingsFromDialog();
      const coords = this.normalizeWaypoints(this.getWaypoints(mode), options).map((point) => `${point.lat},${point.lng}`).join("\n");
      const onDone = () => this.toast("Coordinates copied to clipboard.");
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(coords).then(onDone, () => {
          window.prompt("Copy coordinates manually:", coords);
        });
      } else {
        window.prompt("Copy coordinates manually:", coords);
      }
    },

    optimizeSelected() {
      const settings = this.loadSettings();
      const selected = this.loadSelected();
      if (selected.length < 2) {
        this.toast("Select at least 2 portals before optimizing.");
        return;
      }
      const normalized = this.normalizeWaypoints(selected, {
        keepFirstAsStart: settings.keepFirstAsStart,
        optimizeRoute: true,
        returnToStart: false,
        preserveExactOrder: false,
      }).map(({ order, loopClosure, ...rest }) => rest);
      this.saveSelected(normalized);
      this.refreshSelected();
      this.toast("Selected portals optimized.");
    },

    makeLoopPreview() {
      const settings = this.loadSettings();
      settings.returnToStart = true;
      this.saveSettings(settings);
      this.refreshSelected();
      this.toast("Loop mode enabled. Exports will return to the start portal.");
    },

    drawPolyline() {
      if (!window.map) return;
      if (this.polyline) window.map.removeLayer(this.polyline);
      const settings = this.loadSettings();
      const selected = this.loadSelected();
      if (!selected.length) return;
      const normalized = this.normalizeWaypoints(selected, settings);
      const points = normalized.map((point) => L.latLng(point.lat, point.lng));
      this.polyline = L.polyline(points, {
        color: "#22d3ee",
        weight: 4,
        opacity: 0.85,
        dashArray: settings.returnToStart ? "8, 6" : null,
      }).addTo(window.map);
    },

    renderStatus() {
      const list = this.loadSelected();
      const settings = this.loadSettings();
      const parts = [
        `${list.length} selected`,
        settings.preserveExactOrder ? "Exact order" : settings.optimizeRoute ? "Optimized" : "Manual order",
        settings.returnToStart ? "Loop on" : "Loop off",
      ];
      return parts.join(" • ");
    },

    refreshSelected() {
      const list = this.loadSelected();
      const container = window.$("#rogue-selected-coordinates-mini");
      const status = window.$("#rogueroute-status-line");
      if (status.length) status.text(this.renderStatus());

      const html = list.length
        ? list.map((portal, index) => `
            <div class="rogue-selected-item" style="display:flex;align-items:center;gap:8px;background:#0f172a;border:1px solid #334155;border-radius:10px;padding:6px;">
              <div style="width:22px;height:22px;border-radius:999px;background:${index === 0 ? "#a855f7" : "#1e293b"};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">${index + 1}</div>
              <img src="${portal.image || ""}" style="width:28px;height:28px;border-radius:8px;object-fit:cover;border:1px solid #334155;background:#020617;" onerror="this.style.display='none'">
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${portal.name}</span>
              <a onclick="window.plugin.rogueRouteGpx.setStartPortal('${portal.guid}')" title="Set as start" style="cursor:pointer;color:${index === 0 ? "#c084fc" : "#93c5fd"};text-decoration:none;">★</a>
              <a onclick="window.plugin.rogueRouteGpx.moveUp('${portal.guid}')" title="Move up" style="cursor:pointer;color:#67e8f9;text-decoration:none;">↑</a>
              <a onclick="window.plugin.rogueRouteGpx.moveDown('${portal.guid}')" title="Move down" style="cursor:pointer;color:#67e8f9;text-decoration:none;">↓</a>
              <a onclick="window.plugin.rogueRouteGpx.removeFromList('${portal.guid}')" title="Remove" style="cursor:pointer;color:#f87171;text-decoration:none;">✖</a>
            </div>
          `).join("")
        : '<div style="color:#94a3b8;">No selected portals yet. Alt-click portals to add/remove. Shift+Alt-click sets a selected portal as the start.</div>';
      container.html(html);
      this.drawPolyline();
    },

    modeActionLinks(mode) {
      const name = mode.charAt(0) + mode.slice(1).toLowerCase();
      return `
        <div style="display:grid;gap:6px;padding:8px 0;border-top:1px solid #1e293b;">
          <div style="font-weight:700;color:#e2e8f0;">${name}</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <a onclick="window.plugin.rogueRouteGpx.openInWebsite('${mode}')" style="cursor:pointer;">Open in RogueRoute</a>
            <a onclick="window.plugin.rogueRouteGpx.copyPayload('${mode}')" style="cursor:pointer;">Copy payload</a>
            <a onclick="window.plugin.rogueRouteGpx.copyCoords('${mode}')" style="cursor:pointer;">Copy coords</a>
            <a onclick="window.plugin.rogueRouteGpx.showPreflight('${mode}')" style="cursor:pointer;">Run checks</a>
          </div>
        </div>
      `;
    },

    showMenu() {
      const settings = this.loadSettings();
      const html = `
        <div style="display:grid;gap:12px;color:#e2e8f0;min-width:320px;">
          <div>
            <div style="font-weight:700;margin-bottom:6px;">Source + Output</div>
            ${this.modeActionLinks("SELECTED")}
            ${this.modeActionLinks("VIEW")}
            ${this.modeActionLinks("POLYGON")}
            ${this.modeActionLinks("CIRCLE")}
          </div>
          <div style="padding-top:8px;border-top:1px solid #1e293b;">
            <div style="font-weight:700;margin-bottom:6px;">Route Options</div>
            <label style="display:flex;gap:8px;align-items:center;"><input id="rogueroute-keep-first" type="checkbox" ${settings.keepFirstAsStart ? "checked" : ""}>Keep first portal as start</label>
            <label style="display:flex;gap:8px;align-items:center;"><input id="rogueroute-optimize" type="checkbox" ${settings.optimizeRoute ? "checked" : ""}>Optimize route</label>
            <label style="display:flex;gap:8px;align-items:center;"><input id="rogueroute-loop" type="checkbox" ${settings.returnToStart ? "checked" : ""}>Return to start</label>
            <label style="display:flex;gap:8px;align-items:center;"><input id="rogueroute-preserve" type="checkbox" ${settings.preserveExactOrder ? "checked" : ""}>Use exact list order</label>
            <label style="display:flex;gap:8px;align-items:center;"><input id="rogueroute-clear-after" type="checkbox" ${settings.clearAfterExport ? "checked" : ""}>Clear selected after export</label>
          </div>
          <div style="padding-top:8px;border-top:1px solid #1e293b;">
            <div style="font-weight:700;margin-bottom:6px;">Quick Actions</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
              <a onclick="window.plugin.rogueRouteGpx.optimizeSelected()" style="cursor:pointer;">Optimize selected</a>
              <a onclick="window.plugin.rogueRouteGpx.reverseSelected()" style="cursor:pointer;">Reverse selected</a>
              <a onclick="window.plugin.rogueRouteGpx.makeLoopPreview()" style="cursor:pointer;">Enable loop</a>
              <a onclick="window.plugin.rogueRouteGpx.setWebsiteUrl()" style="cursor:pointer;">Set website URL</a>
            </div>
          </div>
          <div style="padding-top:8px;border-top:1px solid #1e293b;color:#94a3b8;">
            Alt-click: add/remove portal • Shift+Alt-click: set selected portal as start
          </div>
        </div>
      `;
      window.dialog({ title: `RogueRoute GPX Exporter v${this.pluginVersion}`, html });
    },
  };

  window.plugin.rogueRouteGpx = plugin;

  function onPortalAdded(data) {
    data.portal.on("click", (event) => {
      if (event.originalEvent?.altKey && event.originalEvent?.shiftKey) {
        window.plugin.rogueRouteGpx.setStartPortal(data.portal.options.guid);
        return;
      }
      if (event.originalEvent?.altKey) {
        window.plugin.rogueRouteGpx.addToList(data.portal.options.guid);
      }
    });
  }

  function setup() {
    window.addHook("portalAdded", onPortalAdded);

    if (window.plugin?.toolbox?.addButton) {
      window.plugin.toolbox.addButton({
        id: "rogueroute-gpx-export",
        label: "RogueRoute GPX",
        action: () => window.plugin.rogueRouteGpx.showMenu(),
      });
    }

    const box = `
      <div id="rogueRouteSelectedBox" style="background:#020617;color:#e2e8f0;padding:10px;border:1px solid #334155;border-radius:12px;margin-bottom:10px;box-shadow:0 0 0 1px rgba(34,211,238,.08),0 0 18px rgba(168,85,247,.14);">
        <p style="margin:0 0 6px 0;"><b>RogueRoute Selected Portals</b></p>
        <p id="rogueroute-status-line" style="margin:0 0 8px 0;font-size:12px;color:#94a3b8;"></p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
          <a onclick="window.plugin.rogueRouteGpx.showMenu()" style="cursor:pointer;color:#22d3ee;">Export</a>
          <a onclick="window.plugin.rogueRouteGpx.optimizeSelected()" style="cursor:pointer;color:#22d3ee;">Optimize</a>
          <a onclick="window.plugin.rogueRouteGpx.reverseSelected()" style="cursor:pointer;color:#22d3ee;">Reverse</a>
          <a onclick="window.plugin.rogueRouteGpx.clearSelected()" style="cursor:pointer;color:#f87171;">Clear</a>
        </div>
        <div id="rogue-selected-coordinates-mini" style="display:grid;gap:8px;"></div>
      </div>
    `;
    window.$(box).insertBefore("#toolbox");
    window.plugin.rogueRouteGpx.refreshSelected();
  }

  setup.info = { name: "RogueRoute GPX Exporter" };
  if (!window.bootPlugins) window.bootPlugins = [];
  window.bootPlugins.push(setup);
  if (window.iitcLoaded) setup();
}

const script = document.createElement("script");
const info = {};
if (typeof GM_info !== "undefined" && GM_info && GM_info.script) {
  info.script = {
    version: GM_info.script.version,
    name: GM_info.script.name,
    description: GM_info.script.description,
  };
}
script.appendChild(document.createTextNode("(" + wrapper + ")(" + JSON.stringify(info) + ");"));
(document.body || document.head || document.documentElement).appendChild(script);
