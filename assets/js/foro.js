/* ==========================================================================
   Foro UNELLEZ — interacciones del prototipo
   Vanilla JS. Sin dependencias. Cada bloque comprueba que su DOM exista para
   poder reutilizar el mismo archivo en todas las páginas.
   ========================================================================== */
(function () {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const VOTE_KEY = "foro:unellez:votos:v1";
  const DRAFT_KEY = "foro:unellez:borrador:v1";
  const isMobile = () => window.matchMedia("(max-width: 1024px)").matches;

  /* ------------------------------------------------------------------------
     Avisos breves
     ------------------------------------------------------------------------ */
  const toastEl = $("[data-toast]");
  let toastTimer;

  function toast(message) {
    if (!toastEl) return;
    toastEl.innerHTML =
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m3 8.5 3 3 7-7"/></svg><span></span>';
    toastEl.querySelector("span").textContent = message;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 4200);
  }

  /* ------------------------------------------------------------------------
     Menú de usuario
     ------------------------------------------------------------------------ */
  const userMenu = $("[data-user-menu]");
  if (userMenu) {
    const trigger = $("[data-user-trigger]", userMenu);
    const panel = $("#menu-usuario", userMenu);

    const close = () => {
      if (!panel || panel.hidden) return;
      panel.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    };

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = panel.hidden;
      panel.hidden = !open;
      trigger.setAttribute("aria-expanded", String(open));
      if (open) $("a, button", panel)?.focus();
    });

    document.addEventListener("click", (event) => {
      if (!userMenu.contains(event.target)) close();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || panel.hidden) return;
      close();
      trigger.focus();
    });
  }

  /* ------------------------------------------------------------------------
     Cajón lateral (comunidades y reglas) en móvil
     ------------------------------------------------------------------------ */
  const sidebar = $("#sidebar");
  const overlay = $("[data-sidebar-overlay]");
  const openSidebarBtn = $("[data-sidebar-open]");
  const closeSidebarBtns = $$("[data-sidebar-close]");
  let lastFocus = null;

  function focusableIn(el) {
    return $$(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      el
    ).filter((node) => node.offsetParent !== null);
  }

  function openSidebar() {
    if (!sidebar) return;
    lastFocus = document.activeElement;
    document.body.classList.add("sidebar-open");
    if (overlay) overlay.hidden = false;
    openSidebarBtn?.setAttribute("aria-expanded", "true");
    window.setTimeout(() => closeSidebarBtns[0]?.focus(), 40);
  }

  function closeSidebar() {
    document.body.classList.remove("sidebar-open");
    openSidebarBtn?.setAttribute("aria-expanded", "false");
    if (overlay) {
      overlay.hidden = true;
    }
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  openSidebarBtn?.addEventListener("click", openSidebar);
  closeSidebarBtns.forEach((btn) => btn.addEventListener("click", closeSidebar));
  overlay?.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", (event) => {
    if (!document.body.classList.contains("sidebar-open")) return;
    if (event.key === "Escape") {
      closeSidebar();
      return;
    }
    if (event.key !== "Tab" || !sidebar) return;
    const items = focusableIn(sidebar);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (!sidebar.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (!isMobile() && document.body.classList.contains("sidebar-open")) closeSidebar();
  });

  /* ------------------------------------------------------------------------
     Votos: estado optimista, sin recarga y persistente en el navegador
     ------------------------------------------------------------------------ */
  function readVotes() {
    try {
      return JSON.parse(localStorage.getItem(VOTE_KEY) || "{}");
    } catch (error) {
      return {};
    }
  }

  function writeVotes(votes) {
    try {
      localStorage.setItem(VOTE_KEY, JSON.stringify(votes));
    } catch (error) {
      /* almacenamiento no disponible: el voto sigue funcionando en memoria */
    }
  }

  const voteState = readVotes();

  function paintVoteGroup(group, state) {
    const count = group.querySelector("[data-vote-count]");
    const base = Number(group.dataset.voteBase || 0);
    if (count) count.textContent = base + state;
    group.classList.toggle("is-up", state === 1);
    group.classList.toggle("is-down", state === -1);
    group.querySelectorAll("[data-vote]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.vote === "up" ? state === 1 : state === -1));
    });
  }

  $$(".js-vote-group").forEach((group) => {
    const key = group.dataset.voteKey;
    const stored = key ? Number(voteState[key] || 0) : 0;
    paintVoteGroup(group, stored);

    group.querySelectorAll("[data-vote]").forEach((button) => {
      button.addEventListener("click", () => {
        const direction = button.dataset.vote === "up" ? 1 : -1;
        const current = key ? Number(voteState[key] || 0) : 0;
        const next = current === direction ? 0 : direction;
        if (key) {
          voteState[key] = next;
          writeVotes(voteState);
        }
        paintVoteGroup(group, next);
        group.classList.add("just-voted");
        setTimeout(() => group.classList.remove("just-voted"), 380);
      });
    });
  });

  /* ------------------------------------------------------------------------
     Feed: orden, filtro por comunidad y carga de más hilos
     ------------------------------------------------------------------------ */
  const threadList = $("#lista-hilos");
  const feedCount = $("[data-feed-count]");
  const feedStatus = $("[data-feed-status]");
  const loadMoreBtn = $("[data-load-more]");
  const filterState = $("[data-filter-state]");
  const filterName = $("[data-filter-name]");
  let extraLoaded = false;
  let activeCommunity = null;

  const rows = threadList ? $$("[data-thread]", threadList) : [];
  rows.forEach((row) => {
    row.dataset.initialHidden = row.hidden ? "1" : "0";
  });

  function visibleRows() {
    return rows.filter((row) => !row.hidden);
  }

  function updateFeedCount() {
    if (!feedCount) return;
    const count = visibleRows().length;
    feedCount.textContent = count + (count === 1 ? " hilo" : " hilos");
  }

  function sortThreads(mode) {
    if (!threadList) return;
    const pinned = rows.filter((row) => row.classList.contains("is-pinned"));
    const rest = rows.filter((row) => !row.classList.contains("is-pinned"));

    const value = (row, key) => {
      if (key === "votes") {
        const count = row.querySelector("[data-vote-count]");
        return count ? Number(count.textContent) : Number(row.dataset.votes || 0);
      }
      return Number(row.dataset[key] || 0);
    };

    rest.sort((a, b) => {
      if (mode === "active") {
        return value(b, "replies") - value(a, "replies") || value(b, "votes") - value(a, "votes");
      }
      if (mode === "top") {
        return value(b, "votes") - value(a, "votes") || value(b, "replies") - value(a, "replies");
      }
      return Date.parse(b.dataset.created) - Date.parse(a.dataset.created);
    });

    [...pinned, ...rest].forEach((row) => threadList.appendChild(row));
    if (feedStatus && !activeCommunity) {
      const labels = { recent: "orden cronológico", active: "más respuestas", top: "mejor valorados" };
      feedStatus.textContent = "Mostrando " + visibleRows().length + " de 1.284 hilos · " + labels[mode];
    }
  }

  $$("[data-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      $$("[data-sort]").forEach((other) => {
        other.classList.toggle("is-active", other === button);
        other.setAttribute("aria-pressed", String(other === button));
      });
      sortThreads(button.dataset.sort);
    });
  });

  function applyFilter(community) {
    if (!threadList) return;
    activeCommunity = community;
    rows.forEach((row) => {
      if (!community) {
        row.hidden = extraLoaded ? false : row.dataset.initialHidden === "1";
      } else {
        row.hidden = row.dataset.community !== community;
      }
    });
    const source = $('[data-community-filter="' + community + '"]');
    if (filterState) filterState.hidden = !community;
    if (filterName) {
      filterName.textContent = source ? source.querySelector("span:nth-child(2)")?.textContent || community : community;
    }
    if (loadMoreBtn) loadMoreBtn.hidden = Boolean(community) || extraLoaded;
    updateFeedCount();
    if (feedStatus) {
      feedStatus.textContent = community
        ? "Mostrando " + visibleRows().length + " hilos de esta comunidad"
        : "Mostrando " + visibleRows().length + " de 1.284 hilos · orden cronológico";
    }
  }

  $$("[data-community-filter]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      applyFilter(link.dataset.communityFilter);
      if (document.body.classList.contains("sidebar-open")) closeSidebar();
      threadList?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  $$("[data-clear-filter]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!activeCommunity) return;
      event.preventDefault();
      applyFilter(null);
    });
  });

  loadMoreBtn?.addEventListener("click", () => {
    $$("[data-extra]", threadList).forEach((row) => {
      row.hidden = false;
    });
    extraLoaded = true;
    loadMoreBtn.hidden = true;
    updateFeedCount();
    if (feedStatus) feedStatus.textContent = "Mostrando " + visibleRows().length + " de 1.284 hilos · orden cronológico";
    toast("Se cargaron los hilos del 21 y 22 de octubre.");
  });

  updateFeedCount();

  /* ------------------------------------------------------------------------
     Pestañas genéricas (perfil, editor)
     ------------------------------------------------------------------------ */
  $$("[data-tabs]").forEach((group) => {
    const tabs = $$('[role="tab"]', group);
    const panels = tabs
      .map((tab) => document.getElementById(tab.getAttribute("aria-controls")))
      .filter(Boolean);

    function activate(tab, pushHash = true) {
      tabs.forEach((item) => {
        const selected = item === tab;
        item.classList.toggle("is-active", selected);
        item.setAttribute("aria-selected", String(selected));
        item.tabIndex = selected ? 0 : -1;
      });
      panels.forEach((panel) => {
        const selected = panel.id === tab.getAttribute("aria-controls");
        panel.classList.toggle("is-active", selected);
        panel.hidden = !selected;
      });
      if (pushHash && tab.dataset.tab) {
        history.replaceState(null, "", "#" + tab.dataset.tab);
      }
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activate(tab));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        let next = index;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = tabs.length - 1;
        tabs[next].focus();
        activate(tabs[next]);
      });
    });

    const hash = location.hash.replace("#", "");
    const fromHash = tabs.find((tab) => tab.dataset.tab === hash);
    if (fromHash) activate(fromHash, false);

    window.addEventListener("hashchange", () => {
      const nextHash = location.hash.replace("#", "");
      const nextTab = tabs.find((tab) => tab.dataset.tab === nextHash);
      if (nextTab) activate(nextTab, false);
    });
  });

  $$("[data-tab-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = document.querySelector('[data-tab="' + button.dataset.tabTarget + '"]');
      if (tab) tab.click();
    });
  });

  /* ------------------------------------------------------------------------
     Comentarios: contraer, responder, citar, ordenar
     ------------------------------------------------------------------------ */
  $$("[data-collapse]").forEach((button) => {
    button.addEventListener("click", () => {
      const comment = button.closest("[data-comment]");
      if (!comment) return;
      const collapsed = comment.classList.toggle("is-collapsed");
      button.setAttribute("aria-expanded", String(!collapsed));
      button.textContent = collapsed ? "+" : "−";
      button.setAttribute("aria-label", collapsed ? "Expandir respuesta" : "Contraer respuesta");
    });
  });

  const collapseAll = $("[data-collapse-all]");
  collapseAll?.addEventListener("click", () => {
    const all = $$("[data-comment]", document).filter((comment) => comment.dataset.depth === "1");
    const shouldCollapse = all.some((comment) => !comment.classList.contains("is-collapsed"));
    all.forEach((comment) => {
      comment.classList.toggle("is-collapsed", shouldCollapse);
      const button = $("[data-collapse]", comment);
      if (button) {
        button.textContent = shouldCollapse ? "+" : "−";
        button.setAttribute("aria-expanded", String(!shouldCollapse));
      }
    });
    collapseAll.textContent = shouldCollapse ? "Expandir todo" : "Contraer todo";
  });

  const composer = $("[data-composer]");
  const replyToBar = $("[data-reply-to-bar]");
  const replyToName = $("[data-reply-to-name]");
  const parentInput = $('input[name="padre_id"]', composer || document);
  const composerText = composer ? $("textarea", composer) : null;

  $$("[data-reply-to]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!composer || !composerText) return;
      if (parentInput) parentInput.value = button.dataset.replyTo;
      if (replyToBar) replyToBar.classList.add("is-visible");
      if (replyToName) replyToName.textContent = button.dataset.replyName || "esta respuesta";
      composer.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => composerText.focus(), 260);
    });
  });

  $("[data-cancel-reply]")?.addEventListener("click", () => {
    if (parentInput) parentInput.value = "";
    if (replyToBar) replyToBar.classList.remove("is-visible");
    composerText?.focus();
  });

  $$("[data-quote]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!composer || !composerText) return;
      const comment = button.closest("[data-comment]");
      const text = $(".comment-text", comment)?.innerText.trim() || "";
      const excerpt = text.length > 240 ? text.slice(0, 240).trimEnd() + "…" : text;
      const quoted = excerpt
        .split("\n")
        .filter(Boolean)
        .map((line) => "> " + line)
        .join("\n");
      composerText.value = (composerText.value ? composerText.value.trimEnd() + "\n\n" : "") + quoted + "\n\n";
      composerText.dispatchEvent(new Event("input", { bubbles: true }));
      composer.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => {
        composerText.focus();
        composerText.setSelectionRange(composerText.value.length, composerText.value.length);
      }, 260);
    });
  });

  $$("[data-comment-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      $$("[data-comment-sort]").forEach((other) => {
        other.classList.toggle("is-active", other === button);
        other.setAttribute("aria-pressed", String(other === button));
      });
      const tree = $("[data-comment-tree]");
      if (!tree) return;
      const top = $$(":scope > [data-comment]", tree);
      top.sort((a, b) => {
        if (button.dataset.commentSort === "top") {
          return Number(b.dataset.votes || 0) - Number(a.dataset.votes || 0);
        }
        return Date.parse(b.dataset.created || 0) - Date.parse(a.dataset.created || 0);
      });
      top.forEach((comment) => tree.appendChild(comment));
    });
  });

  /* ------------------------------------------------------------------------
     Barra de formato del composer
     ------------------------------------------------------------------------ */
  function wrapSelection(textarea, before, after = "") {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end);
    textarea.setRangeText(before + selected + after, start, end, "end");
    textarea.focus();
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function prefixLines(textarea, prefix) {
    const start = textarea.value.lastIndexOf("\n", textarea.selectionStart - 1) + 1;
    const end = textarea.selectionEnd;
    const chunk = textarea.value.slice(start, end) || "texto";
    const next = chunk
      .split("\n")
      .map((line) => prefix + line)
      .join("\n");
    textarea.setRangeText(next, start, end, "end");
    textarea.focus();
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  $$("[data-md]").forEach((button) => {
    button.addEventListener("click", () => {
      const editor = button.closest("[data-editor]");
      const textarea = editor ? $("textarea", editor) : null;
      if (!textarea) return;
      switch (button.dataset.md) {
        case "bold":
          wrapSelection(textarea, "**", "**");
          break;
        case "italic":
          wrapSelection(textarea, "*", "*");
          break;
        case "code":
          wrapSelection(textarea, "`", "`");
          break;
        case "quote":
          prefixLines(textarea, "> ");
          break;
        case "list":
          prefixLines(textarea, "- ");
          break;
        case "link":
          wrapSelection(textarea, "[", "](https://)");
          break;
        default:
          break;
      }
    });
  });

  /* ------------------------------------------------------------------------
     Contadores de campo
     ------------------------------------------------------------------------ */
  function updateCounter(field) {
    const name = field.getAttribute("name");
    const counter = $('[data-counter-for="' + name + '"]');
    if (!counter) return;
    const mode = counter.dataset.countMode || "chars";
    const max = Number(field.getAttribute("maxlength") || counter.dataset.max || 0);
    let current;
    if (mode === "words") {
      const words = field.value.trim() ? field.value.trim().split(/\s+/).length : 0;
      current = words;
      counter.textContent = words + (words === 1 ? " palabra" : " palabras");
      counter.classList.remove("is-over");
      return;
    }
    current = field.value.length;
    counter.textContent = current + (max ? " / " + max : "");
    counter.classList.toggle("is-over", max > 0 && current > max);
  }

  $$("[data-counter-for]").forEach((counter) => {
    const field = document.querySelector('[name="' + counter.dataset.counterFor + '"]');
    if (!field) return;
    updateCounter(field);
    field.addEventListener("input", () => updateCounter(field));
  });

  $$("input[maxlength], textarea[maxlength]").forEach((field) => {
    field.addEventListener("input", () => updateCounter(field));
  });

  /* ------------------------------------------------------------------------
     Validación de formularios
     ------------------------------------------------------------------------ */
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const userRe = /^[a-z0-9._-]{3,24}$/i;

  function fieldError(form, name) {
    return $(`[data-error-for="${name}"]`, form);
  }

  function setError(form, name, message) {
    const input = form.querySelector(`[name="${name}"]`);
    const target = input || form.querySelector(`[name="${name}[]"]`);
    const holder = fieldError(form, name);
    if (holder) {
      holder.textContent = message || "";
      holder.classList.toggle("is-visible", Boolean(message));
    }
    if (target) {
      target.setAttribute("aria-invalid", String(Boolean(message)));
      if (message) {
        target.setAttribute("aria-describedby", holder?.id || target.getAttribute("aria-describedby") || "");
      }
    }
    return !message;
  }

  function validateField(form, name) {
    const type = form.dataset.validate;
    const field =
      form.querySelector(`[name="${name}"]`) ||
      form.querySelector(`[name="${name}[]"]`) ||
      form.querySelector(`input[name="${name}"]:checked`);

    if (!field && name !== "motivo") return true;

    const value = field?.type === "checkbox" ? field.checked : (field?.value || "").trim();

    if (name === "nombre") {
      if (!value) return setError(form, name, "Escribe tu nombre completo.");
      if (value.length < 3) return setError(form, name, "Necesitamos al menos 3 caracteres.");
    }

    if (name === "usuario") {
      if (!value) return setError(form, name, "Elige un nombre de usuario.");
      if (!userRe.test(value)) return setError(form, name, "Usa de 3 a 24 caracteres: letras, números, punto, guion o guion bajo.");
    }

    if (name === "email") {
      if (!value) return setError(form, name, "Escribe tu correo.");
      if (!emailRe.test(value)) return setError(form, name, "Ese correo no parece válido.");
    }

    if (name === "password") {
      if (!value) return setError(form, name, "Escribe una contraseña.");
      if (type === "registro" && value.length < 8) {
        return setError(form, name, "La contraseña necesita al menos 8 caracteres.");
      }
    }

    if (name === "password_confirm") {
      const password = form.querySelector('[name="password"]')?.value || "";
      if (!value) return setError(form, name, "Repite la contraseña.");
      if (value !== password) return setError(form, name, "Las contraseñas no coinciden.");
    }

    if (name === "carrera" && !value) return setError(form, name, "Elige tu carrera o área.");

    if (name === "comunidad" && !value) return setError(form, name, "Elige la comunidad donde va el hilo.");

    if (name === "titulo") {
      if (!value) return setError(form, name, "El título no puede estar vacío.");
      if (value.length < 8) return setError(form, name, "El título necesita al menos 8 caracteres.");
      if (value.length > 120) return setError(form, name, "Máximo 120 caracteres.");
    }

    if (name === "contenido") {
      const min = type === "respuesta" ? 20 : 40;
      if (!value) return setError(form, name, "Escribe el contenido.");
      if (value.length < min) return setError(form, name, `Aporta al menos ${min} caracteres de contexto.`);
    }

    if (name === "etiquetas") {
      const tags = value.split(",").map((tag) => tag.trim()).filter(Boolean);
      if (tags.length > 3) return setError(form, name, "Usa como máximo 3 etiquetas.");
      if (tags.some((tag) => tag.length > 24)) return setError(form, name, "Cada etiqueta debe tener máximo 24 caracteres.");
    }

    if (name === "acepta_normas" && !field?.checked) {
      return setError(form, name, "Debes aceptar las normas para continuar.");
    }

    if (name === "motivo") {
      const checked = form.querySelector('input[name="motivo"]:checked');
      if (!checked) return setError(form, name, "Selecciona un motivo.");
      const holder = fieldError(form, name);
      if (holder) {
        holder.textContent = "";
        holder.classList.remove("is-visible");
      }
      return true;
    }

    return setError(form, name, "");
  }

  const formRules = {
    login: ["email", "password"],
    registro: ["nombre", "usuario", "email", "carrera", "password", "password_confirm", "acepta_normas"],
    "nuevo-hilo": ["comunidad", "titulo", "contenido", "etiquetas", "acepta_normas"],
    respuesta: ["contenido"],
    reporte: ["motivo"]
  };

  function validateForm(form) {
    const rules = formRules[form.dataset.validate] || [];
    const errors = [];
    rules.forEach((name) => {
      if (!validateField(form, name)) {
        const message = fieldError(form, name)?.textContent || "Revisa este campo.";
        errors.push({ name, message });
      }
    });
    const summary = $("[data-error-summary]", form);
    if (summary) {
      summary.innerHTML = "";
      const list = document.createElement("ul");
      errors.forEach((error) => {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = "#";
        link.textContent = error.message;
        link.addEventListener("click", (event) => {
          event.preventDefault();
          form.querySelector(`[name="${error.name}"]`)?.focus();
        });
        item.appendChild(link);
        list.appendChild(item);
      });
      summary.classList.toggle("is-visible", errors.length > 0);
      if (errors.length) {
        summary.prepend(document.createTextNode("Revisa lo siguiente antes de continuar:"));
        summary.appendChild(list);
      }
    }
    if (errors.length) {
      form.querySelector(`[name="${errors[0].name}"]`)?.focus();
      return false;
    }
    return true;
  }

  $$("form[data-validate]").forEach((form) => {
    const rules = formRules[form.dataset.validate] || [];
    rules.forEach((name) => {
      const fields = $$(`[name="${name}"], [name="${name}[]"]`, form);
      fields.forEach((field) => {
        field.addEventListener("blur", () => validateField(form, name));
        field.addEventListener("input", () => {
          if (field.getAttribute("aria-invalid") === "true") validateField(form, name);
        });
        field.addEventListener("change", () => validateField(form, name));
      });
    });

    form.addEventListener("submit", (event) => {
      if (!validateForm(form)) {
        event.preventDefault();
        return;
      }
      if ("demo" in form.dataset) {
        event.preventDefault();
        toast("Formulario validado. El prototipo no envía datos: al conectar PHP irá a procesar.php.");
        form.classList.add("is-submitted");
        const dialog = form.closest("dialog");
        if (dialog) window.setTimeout(() => dialog.close(), 350);
      }
    });
  });

  /* ------------------------------------------------------------------------
     Mostrar / ocultar contraseña
     ------------------------------------------------------------------------ */
  $$("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.closest(".password-wrap")?.querySelector("input");
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.setAttribute("aria-pressed", String(show));
      button.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
      button.classList.toggle("is-on", show);
    });
  });

  /* ------------------------------------------------------------------------
     Checklist de contraseña
     ------------------------------------------------------------------------ */
  $$("[data-pw-checks]").forEach((list) => {
    const input = document.querySelector(list.dataset.pwChecks);
    if (!input) return;
    const check = () => {
      const value = input.value;
      const rules = {
        length: value.length >= 8,
        number: /\d/.test(value),
        letter: /[a-záéíóúñ]/i.test(value)
      };
      $$("[data-check]", list).forEach((item) => {
        item.classList.toggle("is-ok", Boolean(rules[item.dataset.check]));
      });
    };
    input.addEventListener("input", check);
    check();
  });

  /* ------------------------------------------------------------------------
     Editor: pestañas escribir / vista previa
     ------------------------------------------------------------------------ */
  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function inlineMarkdown(value) {
    return value
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '<a href="$2" rel="nofollow noopener">$1</a>');
  }

  function renderMarkdown(value) {
    const lines = value.split(/\r?\n/);
    const output = [];
    let paragraph = [];
    let list = [];
    let quote = [];

    const flushParagraph = () => {
      if (paragraph.length) {
        output.push("<p>" + inlineMarkdown(paragraph.join(" ")) + "</p>");
        paragraph = [];
      }
    };
    const flushList = () => {
      if (list.length) {
        output.push("<ul>" + list.map((item) => "<li>" + inlineMarkdown(escapeHtml(item)) + "</li>").join("") + "</ul>");
        list = [];
      }
    };
    const flushQuote = () => {
      if (quote.length) {
        output.push("<blockquote>" + quote.map((item) => inlineMarkdown(escapeHtml(item))).join("<br>") + "</blockquote>");
        quote = [];
      }
    };

    lines.forEach((line) => {
      if (/^>\s?/.test(line)) {
        flushParagraph();
        flushList();
        quote.push(line.replace(/^>\s?/, ""));
      } else if (/^[-*]\s+/.test(line)) {
        flushParagraph();
        flushQuote();
        list.push(line.replace(/^[-*]\s+/, ""));
      } else if (!line.trim()) {
        flushParagraph();
        flushList();
        flushQuote();
      } else {
        flushList();
        flushQuote();
        paragraph.push(escapeHtml(line.trim()));
      }
    });
    flushParagraph();
    flushList();
    flushQuote();
    return output.join("") || '<p class="muted">Todavía no hay nada que previsualizar.</p>';
  }

  $$("[data-editor]").forEach((editor) => {
    const textarea = $("textarea", editor);
    const preview = $(".composer-preview", editor);
    const tabs = $$("[data-editor-tab]", editor);
    if (!textarea || !preview) return;

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const previewMode = tab.dataset.editorTab === "preview";
        tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
        if (previewMode) {
          preview.innerHTML = renderMarkdown(textarea.value);
          preview.classList.add("is-visible");
          textarea.hidden = true;
        } else {
          preview.classList.remove("is-visible");
          textarea.hidden = false;
          textarea.focus();
        }
      });
    });
  });

  /* ------------------------------------------------------------------------
     Borrador local del formulario de nuevo hilo
     ------------------------------------------------------------------------ */
  const draftForm = $("[data-draft-form]");
  if (draftForm) {
    const title = draftForm.querySelector('[name="titulo"]');
    const content = draftForm.querySelector('[name="contenido"]');
    const community = draftForm.querySelector('[name="comunidad"]');
    const tags = draftForm.querySelector('[name="etiquetas"]');
    const status = $(".draft-status");
    let saveTimer;

    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (saved && (saved.titulo || saved.contenido)) {
        if (title) title.value = saved.titulo || "";
        if (content) content.value = saved.contenido || "";
        if (community) community.value = saved.comunidad || "";
        if (tags) tags.value = saved.etiquetas || "";
        if (status) {
          status.classList.add("is-saved");
          status.innerHTML = '<span class="online-dot" aria-hidden="true"></span> Borrador recuperado · <button type="button" class="linkish" data-discard-draft>Descartar</button>';
        }
        if (content) content.dispatchEvent(new Event("input", { bubbles: true }));
        if (title) title.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch (error) {
      /* sin borrador */
    }

    const saveDraft = () => {
      const data = {
        titulo: title?.value || "",
        contenido: content?.value || "",
        comunidad: community?.value || "",
        etiquetas: tags?.value || "",
        guardado: new Date().toISOString()
      };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
        if (status) {
          status.classList.add("is-saved");
          const time = new Date().toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });
          status.innerHTML = '<span class="online-dot" aria-hidden="true"></span> Borrador guardado a las ' + time + " · <button type=\"button\" class=\"linkish\" data-discard-draft>Descartar</button>";
        }
      } catch (error) {
        /* almacenamiento lleno o bloqueado */
      }
    };

    [title, content, community, tags].forEach((field) => {
      field?.addEventListener("input", () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveDraft, 800);
      });
    });

    draftForm.addEventListener("click", (event) => {
      if (!event.target.closest("[data-discard-draft]")) return;
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch (error) {
        /* nada */
      }
      draftForm.reset();
      if (status) {
        status.classList.remove("is-saved");
        status.innerHTML = '<span class="online-dot" aria-hidden="true"></span> Los cambios se guardan en este navegador';
      }
      toast("Borrador descartado.");
    });

    $("[data-draft-save]", draftForm)?.addEventListener("click", () => {
      saveDraft();
      toast("Borrador guardado en este navegador.");
    });

    draftForm.addEventListener("submit", () => {
      if (validateForm(draftForm)) {
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch (error) {
          /* nada */
        }
      }
    });
  }

  /* ------------------------------------------------------------------------
     Modal de reporte
     ------------------------------------------------------------------------ */
  const reportDialog = $("#report-dialog");
  if (reportDialog) {
    const typeInput = reportDialog.querySelector('[name="tipo"]');
    const idInput = reportDialog.querySelector('[name="objeto_id"]');

    const openDialog = (type, id) => {
      if (typeInput) typeInput.value = type;
      if (idInput) idInput.value = id;
      if (typeof reportDialog.showModal === "function") reportDialog.showModal();
      else reportDialog.setAttribute("open", "");
      reportDialog.querySelector('input[name="motivo"]')?.focus();
    };

    $$("[data-report]").forEach((button) => {
      button.addEventListener("click", () => openDialog(button.dataset.reportType || "hilo", button.dataset.reportId || ""));
    });

    $$("[data-report-close]", reportDialog).forEach((button) => {
      button.addEventListener("click", () => reportDialog.close());
    });

    reportDialog.addEventListener("click", (event) => {
      if (event.target === reportDialog) reportDialog.close();
    });
  }

  /* ------------------------------------------------------------------------
     Acciones del hilo: guardar, seguir, compartir
     ------------------------------------------------------------------------ */
  $$("[data-save]").forEach((button) => {
    button.addEventListener("click", () => {
      const saved = button.classList.toggle("is-active");
      button.setAttribute("aria-pressed", String(saved));
      const label = button.querySelector("[data-save-label]");
      if (label) label.textContent = saved ? "Guardado" : "Guardar";
      button.setAttribute("aria-label", saved ? "Quitar hilo de guardados" : "Guardar hilo");
      toast(saved ? "Hilo guardado en tu perfil." : "Hilo quitado de guardados.");
    });
  });

  $$("[data-follow]").forEach((button) => {
    button.addEventListener("click", () => {
      const following = button.classList.toggle("is-active");
      button.setAttribute("aria-pressed", String(following));
      const label = button.querySelector("[data-follow-label]");
      if (label) label.textContent = following ? "Siguiendo" : "Seguir";
      button.setAttribute("aria-label", following ? "Dejar de seguir el hilo" : "Seguir hilo");
      toast(following ? "Vas a recibir avisos de este hilo." : "Dejaste de seguir el hilo.");
    });
  });

  $$("[data-share]").forEach((button) => {
    button.addEventListener("click", async () => {
      const shareData = { title: document.title, url: location.href };
      try {
        if (navigator.share && isMobile()) {
          await navigator.share(shareData);
          return;
        }
        await navigator.clipboard.writeText(location.href);
        toast("Enlace copiado al portapapeles.");
      } catch (error) {
        toast("No se pudo copiar el enlace. Copia la dirección del navegador.");
      }
    });
  });

  /* ------------------------------------------------------------------------
     Acciones que dependen del backend
     ------------------------------------------------------------------------ */
  $$("[data-demo-action]").forEach((button) => {
    button.addEventListener("click", () => {
      toast(button.dataset.demoAction || "Esta acción se conectará al backend PHP.");
    });
  });

  /* ------------------------------------------------------------------------
     Atajo de teclado: "/" enfoca la búsqueda
     ------------------------------------------------------------------------ */
  const searchInput = $(".header-search input");
  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = document.activeElement?.tagName;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || document.activeElement?.isContentEditable) return;
    if (!searchInput) return;
    event.preventDefault();
    searchInput.focus();
    searchInput.select();
  });
})();
