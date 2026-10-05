/* Room Vibez planner-flows prototype — simulated UI, not official Planner 5D */
(function () {
  "use strict";

  const state = {
    role: null,
    email: "",
    project: null,
    fmt: null,
    tool: "select",
    mode: "2d",
    selectedSku: "CHAIR-LOFT-01",
    selectedId: null,
    lightPreset: "Soft day",
    renderPreset: "Preview",
    starterApplied: false,
    furniture: [],
    materials: { wood: { id: "oak", color: "#8b5a2b" }, plastic: { id: "slate", color: "#6a7c8a" }, wool: { id: "sand", color: "#c4b59a" } },
    prices: { "CHAIR-LOFT-01": 249, "TABLE-OAK-02": 179 },
    names: { "CHAIR-LOFT-01": "Loft Chair", "TABLE-OAK-02": "Oak Side Table" },
    three: { ready: false, renderer: null, scene: null, camera: null, mesh: null, anim: 0 },
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const ROLE_LABELS = { consumer: "Consumer", designer: "Interior designer", architect: "Architect", reseller: "Reseller / ops" };
  // Slot and finish ids are lower-case ("wood", "oak"); on screen they read "Wood", "Oak".
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const pluralRules = new Intl.PluralRules("en");
  const plural = (n, one, other) => (pluralRules.select(n) === "one" ? one : other);

  function showScreen(id) {
    $$(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
  }

  function toast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function setRole(role) {
    state.role = role;
    $$(".role-card[data-role]").forEach((b) => b.classList.toggle("selected", b.dataset.role === role));
    $("#btnContinueAuth").disabled = !role;
    $("#rolePill").textContent = ROLE_LABELS[role] || "No account needed";
    $("#architectNote").hidden = role !== "architect";
  }

  function createProject(fromTemplate) {
    state.project = {
      name: $("#projectName").value.trim() || "Untitled",
      template: fromTemplate ? "Warm loft" : null,
    };
    $("#projectPill").textContent = state.project.name;
    if (fromTemplate) {
      // seed a chair for designers
      state.furniture = [];
      addFurniture("CHAIR-LOFT-01", 360, 240);
      toast("Template added.");
    }
    showScreen("screen-upload");
  }

  function startAiDemo() {
    // A new file gives a new result, so the review starts again: untick and re-disable (stress test R2).
    $("#confirmDims").checked = false;
    $("#btnConfirmPlan").disabled = true;
    $("#aiCard").hidden = false;
    $("#confirmCard").hidden = true;
    const bar = $("#aiBar");
    const status = $("#aiStatus");
    let p = 0;
    status.textContent = `Reading your ${state.fmt || "file"}…`;
    bar.style.width = "0%";
    clearInterval(startAiDemo._i);
    startAiDemo._i = setInterval(() => {
      p += 12;
      bar.style.width = Math.min(p, 100) + "%";
      if (p >= 40 && p < 70) status.textContent = "Finding walls…";
      if (p >= 70 && p < 100) status.textContent = "Building the room…";
      if (p >= 100) {
        clearInterval(startAiDemo._i);
        status.textContent = "Ready to review.";
        $("#confirmCard").hidden = false;
      }
    }, 280);
  }

  function openEditor(manual) {
    if (manual) toast("Drawing from scratch.");
    else toast("Plan confirmed.");
    showScreen("screen-editor");
    renderFurniture();
    updateBom();
    updateSelectionUi();
    if (state.mode === "3d") ensure3d();
  }

  function addFurniture(sku, x, y) {
    const id = "f" + (state.furniture.length + 1) + "-" + Date.now().toString(36);
    const item = {
      id,
      sku,
      x: x ?? 320 + state.furniture.length * 40,
      y: y ?? 220 + state.furniture.length * 20,
      slots: sku === "CHAIR-LOFT-01"
        ? { wood: { ...state.materials.wood }, plastic: { ...state.materials.plastic }, wool: { ...state.materials.wool } }
        : { wood: { id: "oak", color: "#a67c52" } },
    };
    state.furniture.push(item);
    state.selectedId = id;
    renderFurniture();
    updateBom();
    updateSelectionUi();
    sync3dMaterials();
    return item;
  }

  function renderFurniture() {
    const g = $("#furnGroup");
    g.innerHTML = "";
    state.furniture.forEach((f) => {
      const wrap = document.createElementNS("http://www.w3.org/2000/svg", "g");
      wrap.classList.add("furniture");
      if (f.id === state.selectedId) wrap.classList.add("selected");
      wrap.dataset.id = f.id;
      wrap.setAttribute("transform", `translate(${f.x},${f.y})`);
      if (f.sku === "CHAIR-LOFT-01") {
        wrap.innerHTML = `
          <rect class="furn-body slot-wool" x="-28" y="-18" width="56" height="36" rx="6" fill="${f.slots.wool.color}" />
          <rect class="slot-wood" x="-24" y="18" width="8" height="22" fill="${f.slots.wood.color}" />
          <rect class="slot-wood" x="16" y="18" width="8" height="22" fill="${f.slots.wood.color}" />
          <rect class="slot-plastic" x="24" y="-10" width="10" height="20" rx="2" fill="${f.slots.plastic.color}" />
          <text x="0" y="-28" text-anchor="middle" font-size="11" fill="#5a675e">${state.names[f.sku]}</text>`;
      } else {
        wrap.innerHTML = `
          <rect class="furn-body slot-wood" x="-32" y="-18" width="64" height="36" rx="4" fill="${f.slots.wood.color}" />
          <text x="0" y="-28" text-anchor="middle" font-size="11" fill="#5a675e">${state.names[f.sku]}</text>`;
      }
      wrap.addEventListener("click", (e) => {
        e.stopPropagation();
        state.selectedId = f.id;
        renderFurniture();
        updateSelectionUi();
      });
      g.appendChild(wrap);
    });
  }

  function updateSelectionUi() {
    const f = state.furniture.find((x) => x.id === state.selectedId);
    if (!f) {
      $("#selTitle").textContent = "Nothing selected";
      $("#selMeta").textContent = "Place a Loft Chair, then pick it to change its finishes.";
      return;
    }
    $("#selTitle").textContent = state.names[f.sku];
    const slotTxt = Object.entries(f.slots).map(([k, v]) => `${cap(k)}: ${cap(v.id)}`).join(" · ");
    $("#selMeta").textContent = `${f.sku} · ${slotTxt}`;
  }

  function bomLines() {
    const map = {};
    state.furniture.forEach((f) => {
      if (!map[f.sku]) map[f.sku] = { sku: f.sku, name: state.names[f.sku], qty: 0, price: state.prices[f.sku], slots: [] };
      map[f.sku].qty += 1;
      map[f.sku].slots.push(f.slots);
    });
    return Object.values(map);
  }

  function updateBom() {
    const lines = bomLines();
    const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
    const render = (host) => {
      host.innerHTML = lines.length
        ? lines.map((l) => `<div class="bom-item"><div><strong>${l.name}</strong><br /><span class="muted">${l.sku} × ${l.qty}</span></div><div>€${l.qty * l.price}</div></div>`).join("")
        : `<p class="muted">Nothing here yet. Place a product to start your list.</p>`;
    };
    render($("#bomList"));
    render($("#bomListFull"));
    $("#bomTotal").textContent = `Total (placeholder prices): €${total}`;
    $("#bomTotalFull").textContent = `Total (placeholder prices): €${total}`;
    $("#skuListFull").innerHTML = Object.keys(state.prices)
      .map((sku) => `<div class="sku-item"><div><strong>${state.names[sku]}</strong><br /><span class="muted">${sku}</span></div><div>€${state.prices[sku]}</div></div>`)
      .join("");
  }

  function applyMaterial(slot, matId, color) {
    const f = state.furniture.find((x) => x.id === state.selectedId);
    if (!f || !f.slots[slot]) {
      toast("Select a Loft Chair to change its finishes.");
      return;
    }
    f.slots[slot] = { id: matId, color };
    state.materials[slot] = { id: matId, color };
    renderFurniture();
    updateSelectionUi();
    sync3dMaterials();
    toast(`${cap(slot)} changed to ${cap(matId)}.`);
  }

  /* Three.js optional CDN */
  function ensure3d() {
    const host = $("#three-host");
    const fallback = $("#css3d");
    if (typeof THREE === "undefined") {
      host.hidden = true;
      fallback.hidden = false;
      syncCss3d();
      toast("3D preview needs an internet connection. Showing a simple version instead.");
      return;
    }
    host.hidden = false;
    fallback.hidden = true;
    if (state.three.ready) {
      sync3dMaterials();
      return;
    }
    const w = host.clientWidth || 640;
    const h = host.clientHeight || 420;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (err) {
      host.hidden = true;
      fallback.hidden = false;
      syncCss3d();
      toast("Your browser can't run full 3D. Showing a simple version instead.");
      return;
    }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeef2ec);
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(2.4, 2.2, 2.8);
    camera.lookAt(0, 0.3, 0);
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.innerHTML = "";
    host.appendChild(renderer.domElement);
    // Probe: if context lost immediately, fall back
    const gl = renderer.getContext();
    if (!gl) {
      host.hidden = true;
      fallback.hidden = false;
      syncCss3d();
      toast("Your browser can't run full 3D. Showing a simple version instead.");
      return;
    }

    const amb = new THREE.AmbientLight(0xffffff, 0.65);
    const dir = new THREE.DirectionalLight(0xffffff, 0.75);
    dir.position.set(3, 5, 2);
    scene.add(amb, dir);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 3),
      new THREE.MeshStandardMaterial({ color: 0xd5ddd4, roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const group = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: 0xc4b59a, roughness: 0.85 }));
    seat.position.y = 0.35;
    seat.name = "wool";
    const legGeo = new THREE.BoxGeometry(0.08, 0.35, 0.08);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7 });
    const legL = new THREE.Mesh(legGeo, legMat); legL.position.set(-0.18, 0.17, 0.15); legL.name = "wood";
    const legR = new THREE.Mesh(legGeo, legMat.clone()); legR.position.set(0.18, 0.17, 0.15); legR.name = "wood";
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), new THREE.MeshStandardMaterial({ color: 0x6a7c8a, roughness: 0.4 }));
    handle.position.set(0.28, 0.42, 0); handle.name = "plastic";
    group.add(seat, legL, legR, handle);
    scene.add(group);

    state.three = { ready: true, renderer, scene, camera, mesh: group, anim: 0, seat, legL, legR, handle, dir };
    // Same chip, same corner as the 2D hint: at the bottom of the stage it fell below the window and sat on the grey floor.
    const note = document.createElement("div");
    note.className = "draw-hint";
    note.textContent = "3D preview shows one sample chair, not your whole room yet.";
    host.style.position = "relative";
    host.appendChild(note);

    function tick() {
      state.three.anim += 0.008;
      group.rotation.y = Math.sin(state.three.anim) * 0.35;
      renderer.render(scene, camera);
      state.three.raf = requestAnimationFrame(tick);
    }
    tick();
    sync3dMaterials();
  }

  function sync3dMaterials() {
    const f = state.furniture.find((x) => x.id === state.selectedId) || state.furniture[0];
    if (!f) return;
    if (state.three.ready && state.three.seat) {
      if (f.slots.wool) state.three.seat.material.color.set(f.slots.wool.color);
      if (f.slots.wood) {
        state.three.legL.material.color.set(f.slots.wood.color);
        state.three.legR.material.color.set(f.slots.wood.color);
      }
      if (f.slots.plastic) state.three.handle.material.color.set(f.slots.plastic.color);
    }
    syncCss3d(f);
  }

  function syncCss3d(f) {
    f = f || state.furniture[0];
    if (!f) return;
    if (f.slots.wool) $("#cssSeat").style.background = f.slots.wool.color;
    if (f.slots.wood) {
      $("#cssLegL").style.background = f.slots.wood.color;
      $("#cssLegR").style.background = f.slots.wood.color;
    }
    if (f.slots.plastic) $("#cssHandle").style.background = f.slots.plastic.color;
  }

  /* Events */
  $$(".role-card[data-role]").forEach((btn) => btn.addEventListener("click", () => setRole(btn.dataset.role)));
  $("#btnContinueAuth").addEventListener("click", () => {
    state.email = $("#email").value;
    showScreen("screen-project");
  });
  $("#btnSkipDemo").addEventListener("click", () => {
    // Keep the role the person picked. Only fall back to Interior designer when none was picked, and say so (stress test K3).
    const hadRole = !!state.role;
    if (!hadRole) setRole("designer");
    createProject(true);
    openEditor(true);
    if (!hadRole) toast(`No role picked, so the demo opens as ${ROLE_LABELS.designer}.`);
  });
  $("#btnBackAuth").addEventListener("click", () => showScreen("screen-auth"));
  $("#tplBlank").addEventListener("click", () => {
    $$("#screen-project .role-card").forEach((c) => c.classList.remove("selected"));
    $("#tplBlank").classList.add("selected");
    state._tpl = false;
  });
  $("#tplStarter").addEventListener("click", () => {
    $$("#screen-project .role-card").forEach((c) => c.classList.remove("selected"));
    $("#tplStarter").classList.add("selected");
    state._tpl = true;
  });
  $("#btnCreateProject").addEventListener("click", () => createProject(!!state._tpl));
  $("#btnBackProject").addEventListener("click", () => showScreen("screen-project"));

  $$(".file-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      $$(".file-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      state.fmt = chip.dataset.fmt;
      startAiDemo();
    });
  });
  $("#uploadZone").addEventListener("click", (e) => {
    // The type chips and the file input sit inside the zone. A chip only starts the demo; it must not also open the file picker.
    if (e.target.closest(".file-chip") || e.target === $("#fileInput")) return;
    $("#fileInput").click();
  });
  $("#uploadZone").addEventListener("keydown", (e) => {
    // The zone is role="button", so Enter and Space open the picker (stress test A1). Keys pressed on a chip are left alone.
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      $("#fileInput").click();
    }
  });
  $("#fileInput").addEventListener("change", () => {
    if (!$("#fileInput").files.length) return;
    const name = $("#fileInput").files[0].name.toUpperCase();
    state.fmt = name.endsWith(".DWG") ? "DWG" : name.endsWith(".PDF") ? "PDF" : name.match(/\.JPE?G$/) ? "JPG" : "PNG";
    $$(".file-chip").forEach((c) => c.classList.toggle("active", c.dataset.fmt === state.fmt));
    startAiDemo();
  });

  $("#confirmDims").addEventListener("change", (e) => {
    $("#btnConfirmPlan").disabled = !e.target.checked;
  });
  $("#btnConfirmPlan").addEventListener("click", () => openEditor(false));
  $("#btnManualDraw").addEventListener("click", () => openEditor(true));

  function toolHintText() {
    if (state.tool === "wall") return "Click the plan to draw walls. The demo always draws the same room shape.";
    if (state.tool === "place") return `Click the plan to place “${state.names[state.selectedSku]}”`;
    return "Select a product";
  }

  $$(".tool-btn[data-tool]").forEach((b) => b.addEventListener("click", () => {
    state.tool = b.dataset.tool;
    $$(".tool-btn[data-tool]").forEach((x) => x.classList.toggle("active", x === b));
    $("#toolHint").textContent = toolHintText();
  }));

  $$(".catalog-item[data-sku]").forEach((b) => b.addEventListener("click", () => {
    state.selectedSku = b.dataset.sku;
    $$(".catalog-item[data-sku]").forEach((x) => x.classList.toggle("active", x === b));
    state.tool = "place";
    $$(".tool-btn[data-tool]").forEach((x) => x.classList.toggle("active", x.dataset.tool === "place"));
    $("#toolHint").textContent = toolHintText();
  }));

  $("#planSvg").addEventListener("click", (e) => {
    const svg = $("#planSvg");
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM().inverse();
    const loc = pt.matrixTransform(ctm);
    if (state.tool === "wall") {
      $("#roomPoly").setAttribute("points", "160,100 640,110 630,410 150,390");
      toast("Walls updated (sample shape).");
    } else if (state.tool === "place") {
      addFurniture(state.selectedSku, loc.x, loc.y);
      toast("Placed " + state.names[state.selectedSku]);
    }
  });

  $$(".mat-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slot = btn.parentElement.dataset.slot;
      applyMaterial(slot, btn.dataset.mat, btn.dataset.color);
    });
  });

  $$(".mode-toggle button").forEach((b) => b.addEventListener("click", () => {
    state.mode = b.dataset.mode;
    $$(".mode-toggle button").forEach((x) => x.classList.toggle("active", x === b));
    $("#view2d").classList.toggle("active", state.mode === "2d");
    $("#view3d").classList.toggle("active", state.mode === "3d");
    if (state.mode === "3d") ensure3d();
  }));

  const lights = ["Soft day", "Gallery", "Evening warm"];
  const renders = ["Preview", "Contrast+", "Neutral commerce"];
  $("#btnLightPreset").addEventListener("click", () => {
    const i = (lights.indexOf(state.lightPreset) + 1) % lights.length;
    state.lightPreset = lights[i];
    $("#btnLightPreset").textContent = "Lighting: " + state.lightPreset;
    if (state.three.dir) {
      state.three.dir.intensity = 0.55 + i * 0.2;
      state.three.dir.color.set(i === 2 ? 0xffe0c0 : 0xffffff);
    }
    toast("Lighting: " + state.lightPreset + ".");
  });
  $("#btnRenderPreset").addEventListener("click", () => {
    const i = (renders.indexOf(state.renderPreset) + 1) % renders.length;
    state.renderPreset = renders[i];
    $("#btnRenderPreset").textContent = "Render style: " + state.renderPreset;
    toast(`Render style set to ${state.renderPreset}. It doesn't change the image yet.`);
  });

  $("#btnApplyTemplate").addEventListener("click", () => {
    // Once only: a second use must not add more products (stress test A9).
    if (state.starterApplied) return;
    state.starterApplied = true;
    if (!state.furniture.length) addFurniture("CHAIR-LOFT-01", 360, 240);
    addFurniture("TABLE-OAK-02", 460, 260);
    const btn = $("#btnApplyTemplate");
    btn.textContent = "Starter products added";
    btn.disabled = true;
    toast("Starter products added.");
  });

  $("#btnOpenBom").addEventListener("click", () => { updateBom(); showScreen("screen-bom"); });
  $("#btnSkuList").addEventListener("click", () => { updateBom(); showScreen("screen-bom"); });
  $("#btnBackEditor").addEventListener("click", () => showScreen("screen-editor"));
  $("#btnExportPdf").addEventListener("click", () => toast("PDF export isn't available yet."));
  $("#btnExportPng").addEventListener("click", () => toast("PNG export isn't available yet."));
  $("#btnExportGlb").addEventListener("click", () => toast("3D package export isn't available yet."));

  /* Dialogs: native <dialog> + showModal() gives the focus trap and Esc. */
  // A click that lands on the <dialog> element itself is a click on the backdrop (the content sits in .dialog-body).
  function closeOnBackdrop(dialog) {
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  }

  /* Start over: ask first, and say how much is cleared */
  const restartDialog = $("#restartDialog");
  $("#btnRestart").addEventListener("click", () => {
    const n = state.furniture.length;
    $("#restartBody").textContent = `This clears your project and ${n} ${plural(n, "placed item", "placed items")}.`;
    restartDialog.showModal();
  });
  $("#btnRestartConfirm").addEventListener("click", () => location.reload());
  $("#btnRestartCancel").addEventListener("click", () => restartDialog.close());
  restartDialog.addEventListener("close", () => $("#btnRestart").focus());
  closeOnBackdrop(restartDialog);

  /* The ? pop-up: four tabs, arrow keys move between them */
  const helpDialog = $("#helpDialog");
  const helpTabs = $$('[role="tab"]', helpDialog);
  function selectHelpTab(tab) {
    helpTabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      $("#" + t.getAttribute("aria-controls")).hidden = !on;
    });
  }
  helpTabs.forEach((tab, i) => {
    tab.addEventListener("click", () => selectHelpTab(tab));
    tab.addEventListener("keydown", (e) => {
      const last = helpTabs.length - 1;
      let next = null;
      if (e.key === "ArrowRight") next = helpTabs[i === last ? 0 : i + 1];
      else if (e.key === "ArrowLeft") next = helpTabs[i === 0 ? last : i - 1];
      else if (e.key === "Home") next = helpTabs[0];
      else if (e.key === "End") next = helpTabs[last];
      if (!next) return;
      e.preventDefault();
      selectHelpTab(next);
      next.focus();
    });
  });
  $("#btnHelp").addEventListener("click", () => { if (!helpDialog.open) helpDialog.showModal(); });
  $("#btnHelpClose").addEventListener("click", () => helpDialog.close());
  helpDialog.addEventListener("close", () => $("#btnHelp").focus());
  closeOnBackdrop(helpDialog);

  // reseller highlight
  const obs = new MutationObserver(() => {
    if (state.role === "reseller" && $("#screen-editor").classList.contains("active")) {
      /* no-op; BOM panel already visible */
    }
  });
  obs.observe($("#main"), { attributes: true, subtree: true, attributeFilter: ["class"] });
})();
