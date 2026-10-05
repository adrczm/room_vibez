/* Room Vibez planner-flows prototype — simulated UI, not official Planner 5D */
(function () {
  "use strict";

  const state = {
    role: null,
    email: "alex@example.com",
    project: null,
    fmt: null,
    tool: "select",
    mode: "2d",
    selectedSku: "CHAIR-LOFT-01",
    selectedId: null,
    lightPreset: "Soft day",
    renderPreset: "Preview",
    furniture: [],
    materials: { wood: { id: "oak", color: "#8b5a2b" }, plastic: { id: "slate", color: "#6a7c8a" }, wool: { id: "sand", color: "#c4b59a" } },
    prices: { "CHAIR-LOFT-01": 249, "TABLE-OAK-02": 179 },
    names: { "CHAIR-LOFT-01": "Loft Chair", "TABLE-OAK-02": "Oak Side Table" },
    three: { ready: false, renderer: null, scene: null, camera: null, mesh: null, anim: 0 },
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

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
    const labels = { consumer: "Consumer", designer: "Interior designer", architect: "Architect", reseller: "Reseller / ops" };
    $("#rolePill").textContent = labels[role] || "Not signed in";
    $("#architectNote").hidden = role !== "architect";
  }

  function createProject(fromTemplate) {
    state.project = {
      name: $("#projectName").value.trim() || "Untitled",
      template: fromTemplate ? "Warm loft (owned CMS)" : null,
    };
    $("#projectPill").textContent = state.project.name;
    if (fromTemplate) {
      // seed a chair for designers
      state.furniture = [];
      addFurniture("CHAIR-LOFT-01", 360, 240);
      toast("Owned CMS template applied (stub)");
    }
    showScreen("screen-upload");
  }

  function startAiDemo() {
    $("#aiCard").hidden = false;
    $("#confirmCard").hidden = true;
    const bar = $("#aiBar");
    const status = $("#aiStatus");
    let p = 0;
    status.textContent = `Recognizing ${state.fmt || "file"}… (illustrative delay)`;
    bar.style.width = "0%";
    clearInterval(startAiDemo._i);
    startAiDemo._i = setInterval(() => {
      p += 12;
      bar.style.width = Math.min(p, 100) + "%";
      if (p >= 40 && p < 70) status.textContent = "Detecting walls… (demo)";
      if (p >= 70 && p < 100) status.textContent = "Building editable room… (demo)";
      if (p >= 100) {
        clearInterval(startAiDemo._i);
        status.textContent = "Draft ready — confirm dimensions";
        $("#confirmCard").hidden = false;
      }
    }, 280);
  }

  function openEditor(manual) {
    if (manual) toast("Manual draw path — AI skipped");
    else toast("Plan confirmed — opening editor");
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
      $("#selMeta").textContent = "Place the Loft Chair to edit material slots.";
      return;
    }
    $("#selTitle").textContent = state.names[f.sku];
    const slotTxt = Object.entries(f.slots).map(([k, v]) => `${k}:${v.id}`).join(" · ");
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
        : `<p class="muted">No lines yet — place catalog items.</p>`;
    };
    render($("#bomList"));
    render($("#bomListFull"));
    $("#bomTotal").textContent = `Total: €${total}`;
    $("#bomTotalFull").textContent = `Total: €${total}`;
    $("#skuListFull").innerHTML = Object.keys(state.prices)
      .map((sku) => `<div class="sku-item"><div><strong>${state.names[sku]}</strong><br /><span class="muted">${sku}</span></div><div>€${state.prices[sku]}</div></div>`)
      .join("");
  }

  function applyMaterial(slot, matId, color) {
    const f = state.furniture.find((x) => x.id === state.selectedId);
    if (!f || !f.slots[slot]) {
      toast("Select a multi-slot chair first");
      return;
    }
    f.slots[slot] = { id: matId, color };
    state.materials[slot] = { id: matId, color };
    renderFurniture();
    updateSelectionUi();
    sync3dMaterials();
    toast(`${slot} → ${matId}`);
  }

  /* Three.js optional CDN */
  function ensure3d() {
    const host = $("#three-host");
    const fallback = $("#css3d");
    if (typeof THREE === "undefined") {
      host.hidden = true;
      fallback.hidden = false;
      syncCss3d();
      toast("Three.js CDN unavailable — CSS 3D fallback (network needed for CDN)");
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
      toast("WebGL unavailable — CSS 3D fallback");
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
      toast("WebGL context missing — CSS 3D fallback");
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
    const note = document.createElement("p");
    note.className = "muted";
    note.style.cssText = "position:absolute;left:0.75rem;bottom:0.75rem;margin:0;";
    note.textContent = "Three.js CDN preview — network required for script load";
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
    setRole("designer");
    createProject(true);
    openEditor(true);
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
  $("#uploadZone").addEventListener("click", () => $("#fileInput").click());
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
  $("#btnManualOnly").addEventListener("click", () => openEditor(true));

  $$(".tool-btn[data-tool]").forEach((b) => b.addEventListener("click", () => {
    state.tool = b.dataset.tool;
    $$(".tool-btn[data-tool]").forEach((x) => x.classList.toggle("active", x === b));
    $("#toolHint").textContent = state.tool === "wall" ? "Click canvas to place sample walls" : state.tool === "place" ? "Click canvas to place selected SKU" : "Select furniture";
  }));

  $$(".catalog-item[data-sku]").forEach((b) => b.addEventListener("click", () => {
    state.selectedSku = b.dataset.sku;
    $$(".catalog-item[data-sku]").forEach((x) => x.classList.toggle("active", x === b));
    state.tool = "place";
    $$(".tool-btn[data-tool]").forEach((x) => x.classList.toggle("active", x.dataset.tool === "place"));
    $("#toolHint").textContent = "Click canvas to place " + state.names[state.selectedSku];
  }));

  $("#planSvg").addEventListener("click", (e) => {
    const svg = $("#planSvg");
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM().inverse();
    const loc = pt.matrixTransform(ctm);
    if (state.tool === "wall") {
      $("#roomPoly").setAttribute("points", "160,100 640,110 630,410 150,390");
      toast("Walls updated (demo polygon)");
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
    $("#btnLightPreset").textContent = "Light preset: " + state.lightPreset;
    if (state.three.dir) {
      state.three.dir.intensity = 0.55 + i * 0.2;
      state.three.dir.color.set(i === 2 ? 0xffe0c0 : 0xffffff);
    }
    toast("Light preset → " + state.lightPreset);
  });
  $("#btnRenderPreset").addEventListener("click", () => {
    const i = (renders.indexOf(state.renderPreset) + 1) % renders.length;
    state.renderPreset = renders[i];
    $("#btnRenderPreset").textContent = "Render preset: " + state.renderPreset;
    toast("Render preset → " + state.renderPreset + " (preview only)");
  });

  $("#btnApplyTemplate").addEventListener("click", () => {
    if (!state.furniture.length) addFurniture("CHAIR-LOFT-01", 360, 240);
    addFurniture("TABLE-OAK-02", 460, 260);
    toast("Owned CMS starter contents applied");
  });

  $("#btnOpenBom").addEventListener("click", () => { updateBom(); showScreen("screen-bom"); });
  $("#btnSkuList").addEventListener("click", () => { updateBom(); showScreen("screen-bom"); });
  $("#btnBackEditor").addEventListener("click", () => showScreen("screen-editor"));
  $("#btnRestart").addEventListener("click", () => location.reload());
  $("#btnExportPdf").addEventListener("click", () => toast("PDF export stub — consumer share path"));
  $("#btnExportPng").addEventListener("click", () => toast("PNG export stub"));
  $("#btnExportGlb").addEventListener("click", () => toast("Optional GLB package stub (runtime target)"));

  // reseller highlight
  const obs = new MutationObserver(() => {
    if (state.role === "reseller" && $("#screen-editor").classList.contains("active")) {
      /* no-op; BOM panel already visible */
    }
  });
  obs.observe($("#main"), { attributes: true, subtree: true, attributeFilter: ["class"] });
})();
