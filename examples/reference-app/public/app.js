// Tasklane frontend — dependency-free SPA.
// Security: every piece of user data is rendered with textContent (never innerHTML), so stored XSS is inert.
// Accessibility: real labels, role=alert for errors, aria-live toasts, focus moved to page headings on navigation.

const root = document.getElementById("root");
const toasts = document.getElementById("toasts");

/** Hyperscript helper: h("button", { class: "btn", onclick }, "Text") */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === false || value === null || value === undefined) continue;
    if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2), value);
    else if (key === "class") el.className = value;
    else if (value === true) el.setAttribute(key, "");
    else el.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

function toast(message) {
  const el = h("div", { class: "toast" }, message);
  toasts.append(el);
  setTimeout(() => el.remove(), 3500);
}

// ---------------------------------------------------------------- API client
class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || "Something went wrong. Please try again.");
    this.status = status;
    this.code = body?.error?.code;
    this.details = body?.error?.details || [];
  }
}

async function api(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, { error: { message: "You appear to be offline. Check your connection and try again." } });
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/api/auth/")) {
      navigate("/login", { replace: true });
    }
    throw new ApiError(res.status, data);
  }
  return data;
}

const REASONS = {
  required: "This field is required.",
  invalid_email: "Enter a valid email address, like name@example.com.",
  min_length_10: "Use at least 10 characters.",
  already_registered: "An account with this email already exists.",
  already_exists: "You already have a project with that name.",
  incorrect_password: "That password is not correct.",
  invalid_date: "Enter a valid date.",
};
const reasonText = (reason) => REASONS[reason] || (reason.startsWith("max_length_") ? `Use at most ${reason.slice(11)} characters.` : "Check this value.");

// ---------------------------------------------------------------- forms
/** Wires a form: field-level errors, error summary, disabled+spinner submit, no double submit. */
function bindForm(form, onSubmit) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    if (button.disabled) return;
    form.querySelectorAll(".field-error").forEach((e) => e.remove());
    form.querySelectorAll("[aria-invalid]").forEach((e) => e.removeAttribute("aria-invalid"));
    form.querySelector(".alert")?.remove();
    const label = button.textContent;
    button.disabled = true;
    button.replaceChildren(h("span", { class: "spinner", "aria-hidden": "true" }), label);
    try {
      await onSubmit(Object.fromEntries(new FormData(form)));
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      let focused = false;
      for (const d of err.details) {
        const input = form.elements.namedItem(d.field);
        if (input instanceof HTMLElement) {
          const id = `${input.id}-error`;
          input.setAttribute("aria-invalid", "true");
          input.setAttribute("aria-describedby", id);
          input.closest(".field").append(h("p", { class: "field-error", id }, reasonText(d.reason)));
          if (!focused) { input.focus(); focused = true; }
        }
      }
      if (!focused) form.prepend(h("div", { class: "alert", role: "alert" }, err.message));
    } finally {
      if (button.isConnected) { button.disabled = false; button.replaceChildren(label); }
    }
  });
  return form;
}

const field = (id, label, attrs = {}, hint) =>
  h("div", { class: "field" }, h("label", { for: id }, label), h("input", { id, name: attrs.name || id, ...attrs }), hint ? h("p", { class: "hint" }, hint) : null);

// ---------------------------------------------------------------- layout
const logo = (href = "/") => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 32 32");
  svg.setAttribute("class", "brand-mark");
  svg.setAttribute("aria-hidden", "true");
  const rect = document.createElementNS(svg.namespaceURI, "rect");
  Object.entries({ width: 32, height: 32, rx: 8, fill: "#4f46e5" }).forEach(([k, v]) => rect.setAttribute(k, v));
  const path = document.createElementNS(svg.namespaceURI, "path");
  Object.entries({ d: "M9 16.5l4.5 4.5L23 11.5", fill: "none", stroke: "#fff", "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" }).forEach(([k, v]) => path.setAttribute(k, v));
  svg.append(rect, path);
  return h("a", { href, class: "brand", "data-link": true, "aria-label": "Tasklane home" }, svg, "Tasklane");
};

function publicHeader() {
  return h("header", { class: "topbar" }, logo(),
    h("nav", { "aria-label": "Main" },
      h("a", { href: "/login", class: "btn btn-ghost", "data-link": true }, "Sign in"),
      h("a", { href: "/signup", class: "btn btn-primary", "data-link": true }, "Get started")));
}

function appHeader(user) {
  return h("header", { class: "topbar" }, logo("/app"),
    h("nav", { "aria-label": "Account" },
      h("span", { class: "user-email", title: user.email }, user.email),
      h("a", { href: "/app", class: "btn btn-ghost nav-projects", "data-link": true }, "Projects"),
      h("a", { href: "/settings", class: "btn btn-ghost", "data-link": true }, "Settings"),
      h("button", { class: "btn btn-ghost", type: "button", onclick: signOut }, "Sign out")));
}

const footer = () => h("footer", { class: "footer" }, "© Tasklane",
  h("a", { href: "/terms", "data-link": true }, "Terms"), h("a", { href: "/privacy", "data-link": true }, "Privacy"));

function render(title, ...nodes) {
  document.title = title ? `${title} · Tasklane` : "Tasklane — projects and tasks, without the clutter";
  root.replaceChildren(...nodes);
  const heading = root.querySelector("h1");
  if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true }); }
}

async function signOut() {
  await api("POST", "/api/auth/signout").catch(() => {});
  navigate("/");
}

async function currentUser() {
  try { return (await api("GET", "/api/session")).user; } catch { return null; }
}

// ---------------------------------------------------------------- views
function landingView() {
  render(null, publicHeader(),
    h("main", { id: "main", class: "container" },
      h("section", { class: "hero" },
        h("h1", {}, "Plan projects. Finish tasks. Skip the clutter."),
        h("p", {}, "Tasklane gives every project a clear list of what's next, what's in progress, and what's done — fast on any device."),
        h("div", { class: "hero-actions" },
          h("a", { href: "/signup", class: "btn btn-primary", "data-link": true }, "Create your free account"),
          h("a", { href: "/login", class: "btn btn-ghost", "data-link": true }, "I already have an account"))),
      h("section", { class: "features", "aria-label": "Features" },
        h("div", { class: "card" }, h("h3", {}, "Projects that stay tidy"), h("p", {}, "Group work by project and see open tasks at a glance.")),
        h("div", { class: "card" }, h("h3", {}, "Three simple states"), h("p", {}, "To do, doing, done. Filter instantly; due dates flag what's late.")),
        h("div", { class: "card" }, h("h3", {}, "Your data, your call"), h("p", {}, "Export everything as JSON or delete your account in one step.")))),
    footer());
}

function authView(mode) {
  const isSignup = mode === "signup";
  const form = bindForm(
    h("form", { novalidate: true },
      field("email", "Email", { type: "email", autocomplete: "email", required: true }),
      field("password", "Password", { type: "password", autocomplete: isSignup ? "new-password" : "current-password", required: true, minlength: isSignup ? 10 : null },
        isSignup ? "At least 10 characters. A short phrase is easy to remember." : null),
      h("button", { type: "submit", class: "btn btn-primary btn-block" }, isSignup ? "Create account" : "Sign in")),
    async (values) => {
      await api("POST", isSignup ? "/api/auth/signup" : "/api/auth/signin", { email: values.email, password: values.password });
      navigate("/app");
      if (isSignup) toast("Welcome to Tasklane! Create your first project to get started.");
    });
  render(isSignup ? "Create account" : "Sign in", publicHeader(),
    h("main", { id: "main", class: "auth" },
      h("div", { class: "card" },
        h("h1", {}, isSignup ? "Create your account" : "Welcome back"),
        h("p", { class: "muted" }, isSignup ? "Start organizing your projects in under a minute." : "Sign in to pick up where you left off."),
        form),
      h("p", { class: "auth-switch" }, isSignup ? "Already have an account? " : "New to Tasklane? ",
        h("a", { href: isSignup ? "/login" : "/signup", "data-link": true }, isSignup ? "Sign in" : "Create an account"))));
}

const state = { projects: [], selectedId: null, filter: "all" };

async function appView(user) {
  const sidebar = h("aside", { class: "sidebar", "aria-label": "Projects" });
  const panel = h("section", { class: "panel", "aria-live": "polite" });
  render("Projects", appHeader(user),
    h("main", { id: "main", class: "container" },
      h("h1", { class: "visually-hidden" }, "Your projects"),
      h("div", { class: "workspace" }, sidebar, panel)));
  sidebar.append(h("h2", {}, "Projects"), h("div", { class: "skeleton" }));
  panel.append(h("div", { class: "skeleton" }), h("div", { class: "skeleton" }));
  await loadProjects(sidebar, panel);
}

async function loadProjects(sidebar, panel) {
  try {
    const page = await api("GET", "/api/projects?limit=100");
    state.projects = page.items;
    if (!state.projects.some((p) => p.id === state.selectedId)) state.selectedId = state.projects[0]?.id ?? null;
    renderSidebar(sidebar, panel);
    await renderPanel(sidebar, panel);
  } catch (err) {
    sidebar.replaceChildren(h("h2", {}, "Projects"));
    panel.replaceChildren(h("div", { class: "empty", role: "alert" },
      h("h2", {}, "We couldn't load your projects"), h("p", {}, err.message),
      h("button", { class: "btn btn-primary", type: "button", onclick: () => loadProjects(sidebar, panel) }, "Try again")));
  }
}

function renderSidebar(sidebar, panel) {
  const list = h("ul", { class: "project-list" }, state.projects.map((p) =>
    h("li", {}, h("button", {
      type: "button", class: "project-link", "aria-current": p.id === state.selectedId ? "true" : "false",
      onclick: () => { state.selectedId = p.id; state.filter = "all"; renderSidebar(sidebar, panel); renderPanel(sidebar, panel); },
    }, h("span", { class: "project-name" }, p.name), h("span", { class: "badge", "aria-label": `${p.openTaskCount} open tasks` }, String(p.openTaskCount))))));
  const form = bindForm(
    h("form", { class: "inline-form", "aria-label": "New project" },
      h("div", { class: "field" }, h("label", { for: "new-project", class: "visually-hidden" }, "New project name"),
        h("input", { id: "new-project", name: "name", placeholder: "New project name", maxlength: 80, required: true, autocomplete: "off" })),
      h("button", { type: "submit", class: "btn btn-primary" }, "Add")),
    async ({ name }) => {
      const { project } = await api("POST", "/api/projects", { name });
      state.selectedId = project.id;
      toast(`Project "${project.name}" created`);
      await loadProjects(sidebar, panel);
    });
  sidebar.replaceChildren(h("h2", {}, "Projects"), state.projects.length ? list : h("p", { class: "muted small" }, "No projects yet."), form);
}

async function renderPanel(sidebar, panel) {
  const project = state.projects.find((p) => p.id === state.selectedId);
  if (!project) {
    panel.replaceChildren(h("div", { class: "empty" },
      h("h2", {}, "Create your first project"),
      h("p", {}, "Projects keep related tasks together — try \"Website launch\" or \"Home renovation\"."),
      h("button", { class: "btn btn-primary", type: "button", onclick: () => document.getElementById("new-project")?.focus() }, "Name a project")));
    return;
  }
  panel.replaceChildren(h("div", { class: "skeleton" }));
  let tasks;
  try {
    const qs = state.filter === "all" ? "" : `&status=${state.filter}`;
    tasks = (await api("GET", `/api/projects/${encodeURIComponent(project.id)}/tasks?limit=200${qs}`)).items;
  } catch (err) {
    panel.replaceChildren(h("div", { class: "empty", role: "alert" }, h("h2", {}, "Couldn't load tasks"), h("p", {}, err.message),
      h("button", { class: "btn btn-primary", type: "button", onclick: () => renderPanel(sidebar, panel) }, "Try again")));
    return;
  }

  const refresh = () => loadProjects(sidebar, panel);
  const head = h("div", { class: "panel-head" },
    h("div", {}, h("h2", {}, project.name), h("p", { class: "muted small" }, `${project.openTaskCount} open · ${project.taskCount} total`)),
    h("div", {},
      h("button", { type: "button", class: "btn btn-ghost", onclick: async () => {
        const name = window.prompt("Rename project", project.name);
        if (!name || name.trim() === project.name) return;
        try { await api("PATCH", `/api/projects/${encodeURIComponent(project.id)}`, { name }); toast("Project renamed"); refresh(); } catch (e) { toast(e.message); }
      } }, "Rename"),
      h("button", { type: "button", class: "btn-link", onclick: async () => {
        if (!window.confirm(`Delete project "${project.name}" and its ${project.taskCount} task(s)? This can't be undone.`)) return;
        try { await api("DELETE", `/api/projects/${encodeURIComponent(project.id)}`); toast("Project deleted"); state.selectedId = null; refresh(); } catch (e) { toast(e.message); }
      } }, "Delete")));

  const taskForm = bindForm(
    h("form", { class: "task-form", "aria-label": "Add task" },
      field("task-title", "Task", { name: "title", maxlength: 200, required: true, autocomplete: "off", placeholder: "What needs doing?" }),
      field("task-due", "Due date (optional)", { name: "dueOn", type: "date" }),
      h("button", { type: "submit", class: "btn btn-primary" }, "Add task")),
    async ({ title, dueOn }) => {
      await api("POST", `/api/projects/${encodeURIComponent(project.id)}/tasks`, { title, ...(dueOn ? { dueOn } : {}) });
      toast("Task added");
      await refresh();
      document.getElementById("task-title")?.focus();
    });

  const filters = h("div", { class: "filters", role: "group", "aria-label": "Filter tasks" },
    [["all", "All"], ["todo", "To do"], ["doing", "Doing"], ["done", "Done"]].map(([value, label]) =>
      h("button", { type: "button", class: "chip", "aria-pressed": String(state.filter === value), onclick: () => { state.filter = value; renderPanel(sidebar, panel); } }, label)));

  const today = new Date().toISOString().slice(0, 10);
  const list = tasks.length
    ? h("ul", { class: "task-list" }, tasks.map((t) => {
      const select = h("select", { "aria-label": `Status for ${t.title}` },
        [["todo", "To do"], ["doing", "Doing"], ["done", "Done"]].map(([v, l]) => h("option", { value: v, selected: t.status === v }, l)));
      select.addEventListener("change", async () => {
        try { await api("PATCH", `/api/tasks/${encodeURIComponent(t.id)}`, { version: t.version, status: select.value }); toast("Task updated"); refresh(); }
        catch (e) { toast(e.message); refresh(); }
      });
      const overdue = t.dueOn && t.dueOn < today && t.status !== "done";
      return h("li", { class: `task ${t.status === "done" ? "done" : ""}` },
        h("div", {}, h("span", { class: "task-title" }, t.title),
          t.dueOn ? h("span", { class: `task-meta ${overdue ? "overdue" : ""}` }, `${overdue ? "Overdue · " : "Due "}${new Date(`${t.dueOn}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`) : null),
        select,
        h("button", { type: "button", class: "btn-link", "aria-label": `Delete task ${t.title}`, onclick: async () => {
          try { await api("DELETE", `/api/tasks/${encodeURIComponent(t.id)}`); toast("Task deleted"); refresh(); } catch (e) { toast(e.message); }
        } }, "Delete"));
    }))
    : h("div", { class: "empty" },
      h("h2", {}, state.filter === "all" ? "No tasks yet" : "Nothing here"),
      h("p", {}, state.filter === "all" ? "Add your first task above — small, concrete steps work best." : "No tasks match this filter."));

  panel.replaceChildren(head, taskForm, filters, list);
}

function settingsView(user) {
  const del = bindForm(
    h("form", { "aria-label": "Delete account" },
      field("delete-password", "Confirm with your password", { name: "password", type: "password", autocomplete: "current-password", required: true }),
      h("button", { type: "submit", class: "btn btn-danger" }, "Delete my account and data")),
    async ({ password }) => {
      if (!window.confirm("This permanently deletes your account, projects and tasks. Continue?")) return;
      await api("DELETE", "/api/me", { password });
      navigate("/");
      toast("Your account and data were deleted.");
    });
  render("Settings", appHeader(user),
    h("main", { id: "main", class: "container stack" },
      h("h1", {}, "Settings"),
      h("section", { class: "panel" }, h("h2", {}, "Account"), h("p", { class: "muted" }, "Signed in as ", h("strong", {}, user.email), ` · member since ${new Date(user.createdAt).toLocaleDateString()}`)),
      h("section", { class: "panel" }, h("h2", {}, "Export your data"),
        h("p", { class: "muted" }, "Download everything Tasklane stores about you as a JSON file."),
        h("a", { class: "btn btn-ghost", href: "/api/me/export", download: "tasklane-export.json" }, "Download export")),
      h("section", { class: "panel danger-zone" }, h("h2", {}, "Delete account"),
        h("p", { class: "muted" }, "Deletes your account, all projects and all tasks immediately. This cannot be undone."), del)));
}

function legalView(kind) {
  const title = kind === "terms" ? "Terms of Service" : "Privacy Policy";
  render(title, publicHeader(),
    h("main", { id: "main", class: "container" },
      h("h1", {}, title),
      h("div", { class: "notice", role: "note" }, "Placeholder — this text must be written or reviewed by a qualified professional before launch."),
      kind === "privacy"
        ? h("div", {}, h("p", {}, "Data stored: email address, a salted password hash, your projects and tasks, and session records (hashed tokens, expiry)."),
          h("p", {}, "Data is never sold or shared with third parties. You can export or delete your data at any time from Settings."))
        : h("p", {}, "Use Tasklane lawfully and don't attempt to access other people's data.")),
    footer());
}

function notFoundView() {
  render("Page not found", publicHeader(),
    h("main", { id: "main", class: "container" },
      h("div", { class: "empty" }, h("h1", {}, "We couldn't find that page"),
        h("p", {}, "The link may be broken or the page may have moved."),
        h("a", { href: "/", class: "btn btn-primary", "data-link": true }, "Go to the home page"))),
    footer());
}

// ---------------------------------------------------------------- router
async function route() {
  const path = location.pathname;
  if (path === "/") return landingView();
  if (path === "/login" || path === "/signup") {
    const user = await currentUser();
    return user ? navigate("/app", { replace: true }) : authView(path === "/signup" ? "signup" : "login");
  }
  if (path === "/terms" || path === "/privacy") return legalView(path.slice(1));
  if (path === "/app" || path === "/settings") {
    const user = await currentUser();
    if (!user) return navigate("/login", { replace: true });
    return path === "/app" ? appView(user) : settingsView(user);
  }
  return notFoundView();
}

function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState(null, "", path); else history.pushState(null, "", path);
  route();
}

document.addEventListener("click", (event) => {
  const link = event.target instanceof Element ? event.target.closest("a[data-link]") : null;
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  navigate(link.getAttribute("href"));
});
window.addEventListener("popstate", route);
route();
