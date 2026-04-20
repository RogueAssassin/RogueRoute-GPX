// ==UserScript==
// @id             rogueroute-gpx-exporter
// @name           IITC Plugin: RogueRoute GPX Exporter
// @category       Layer
// @version        6.0.0
// @description    Export selected portals, view, polygon, or circle directly into RogueRoute GPX.
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==

function wrapper(plugin_info) {
  if (typeof window.plugin !== "function") window.plugin = function () {};

  const STORAGE_KEY = "rogueroute-gpx-selected";
  const WEBSITE_URL_KEY = "rogueroute-gpx-website-url";

  window.plugin.rogueRouteGpx = {
    pluginVersion: "6.0.0",

    loadSelected() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      } catch {
        return [];
      }
    },

    saveSelected(list) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    },

    addToList(guid) {
      const portal = window.portals?.[guid];
      if (!portal) return;
      const data = portal.options?.data;
      const list = this.loadSelected();
      if (list.find((entry) => entry.guid === guid)) return;

      list.push({
        guid,
        lat: data.latE6 / 1e6,
        lng: data.lngE6 / 1e6,
        name: data.title,
        image: data.image,
      });

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

    drawPolyline() {
      if (this.polyline) window.map.removeLayer(this.polyline);
      const points = this.loadSelected().map((point) => L.latLng(point.lat, point.lng));
      if (!points.length) return;
      this.polyline = L.polyline(points, {
        color: "#22d3ee",
        weight: 4,
        opacity: 0.8,
      }).addTo(window.map);
    },

    refreshSelected() {
      const list = this.loadSelected();
      const html = list.map((portal) => `
        <div class="rogue-selected-item">
          <img src="${portal.image}" style="width:32px;height:32px;border-radius:8px;object-fit:cover;border:1px solid #334155;">
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${portal.name}</span>
          <a onclick="window.plugin.rogueRouteGpx.removeFromList('${portal.guid}')" style="cursor:pointer;color:#f87171;">✖</a>
        </div>
      `).join("");
      window.$("#rogue-selected-coordinates-mini").html(html || '<div style="color:#94a3b8;">No selected portals yet. Alt-click portals to add them.</div>');
      this.drawPolyline();
    },

    portalInPolygon(latlng, poly) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].lat, yi = poly[i].lng;
        const xj = poly[j].lat, yj = poly[j].lng;
        const intersect = ((yi > latlng.lng) !== (yj > latlng.lng)) &&
          (latlng.lat < (xj - xi) * (latlng.lng - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    },

    getWaypoints(mode) {
      const portals = Object.values(window.portals || {});
      const bounds = window.map.getBounds();
      const shape = JSON.parse(localStorage["plugin-draw-tools-layer"] || "[]")[0];

      if (mode === "SELECTED") {
        return this.loadSelected().map(({ lat, lng, name, guid }) => ({ lat, lng, name, id: guid }));
      }

      return portals.filter((portal) => {
        const ll = portal.getLatLng();
        if (mode === "VIEW") return bounds.contains(ll);
        if (mode === "POLYGON" && shape?.type === "polygon") return this.portalInPolygon(ll, shape.latLngs);
        if (mode === "CIRCLE" && shape?.type === "circle") return ll.distanceTo(shape.latLng) <= shape.radius;
        return false;
      }).map((portal) => ({
        lat: portal.getLatLng().lat,
        lng: portal.getLatLng().lng,
        name: portal.options?.data?.title || "Portal",
        id: portal.options?.guid,
      }));
    },

    getWebsiteUrl() {
      return localStorage.getItem(WEBSITE_URL_KEY) || "http://localhost:9080";
    },

    setWebsiteUrl() {
      const current = this.getWebsiteUrl();
      const next = window.prompt("RogueRoute Website URL", current);
      if (next) localStorage.setItem(WEBSITE_URL_KEY, next.trim());
    },

    buildPayload(mode) {
      const routeName = window.prompt("Enter Route Name", "RogueRoute Export") || "RogueRoute Export";
      const center = window.map?.getCenter?.();
      const zoom = window.map?.getZoom?.();
      return {
        routeName,
        map: center ? { centerLat: center.lat, centerLng: center.lng, zoom: zoom || 15 } : undefined,
        waypoints: this.getWaypoints(mode),
        source: {
          type: "iitc-ce",
          pluginVersion: this.pluginVersion,
          exportMode: mode,
        },
      };
    },

    openInWebsite(mode) {
      const payload = this.buildPayload(mode);
      if (!payload.waypoints?.length) {
        window.alert("No waypoints were found for that export mode.");
        return;
      }
      const url = `${this.getWebsiteUrl().replace(/\/+$/, "")}#import=${encodeURIComponent(JSON.stringify(payload))}`;
      window.open(url, "_blank", "noopener,noreferrer");
    },

    copyPayload(mode) {
      const payload = JSON.stringify(this.buildPayload(mode), null, 2);
      navigator.clipboard.writeText(payload).then(() => {
        window.alert("RogueRoute GPX payload copied to clipboard.");
      });
    },

    showMenu() {
      const hasSelected = this.loadSelected().length > 0;
      window.dialog({
        title: "RogueRoute GPX Export",
        html: `
          <div style="display:grid;gap:10px;">
            <p><a onclick="window.plugin.rogueRouteGpx.openInWebsite('VIEW')">Open Current View In Website</a></p>
            ${hasSelected ? `<p><a onclick="window.plugin.rogueRouteGpx.openInWebsite('SELECTED')">Open Selected In Website</a></p>` : ''}
            <p><a onclick="window.plugin.rogueRouteGpx.openInWebsite('POLYGON')">Open Polygon In Website</a></p>
            <p><a onclick="window.plugin.rogueRouteGpx.openInWebsite('CIRCLE')">Open Circle In Website</a></p>
            <hr>
            <p><a onclick="window.plugin.rogueRouteGpx.copyPayload('VIEW')">Copy Current View Payload</a></p>
            ${hasSelected ? `<p><a onclick="window.plugin.rogueRouteGpx.copyPayload('SELECTED')">Copy Selected Payload</a></p>` : ''}
            <p><a onclick="window.plugin.rogueRouteGpx.setWebsiteUrl()">Set Website URL</a></p>
          </div>
        `,
      });
    },
  };

  function onPortalAdded(data) {
    data.portal.on("click", (event) => {
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
      <div id="rogueRouteSelectedBox" style="background:#020617;color:#e2e8f0;padding:10px;border:1px solid #334155;border-radius:12px;margin-bottom:10px;">
        <p style="margin:0 0 8px 0;"><b>RogueRoute Selected Portals</b></p>
        <p style="margin:0 0 8px 0;font-size:12px;color:#94a3b8;">Alt-click portals to add them in order.</p>
        <a onclick="window.plugin.rogueRouteGpx.clearSelected()" style="cursor:pointer;color:#22d3ee;">Clear</a>
        <div id="rogue-selected-coordinates-mini" style="margin-top:8px;display:grid;gap:8px;"></div>
      </div>
    `;
    window.$(box).insertBefore("#toolbox");
    window.plugin.rogueRouteGpx.refreshSelected();
  }

  setup.info = { name: "RogueRoute GPX Exporter" };
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
