const state = {
  userId: localStorage.getItem("todos:userId") || null,
  userEmail: localStorage.getItem("todos:userEmail") || "",
  todos: [],
  filter: "all",
};

const el = (id) => document.getElementById(id);

const authScreen = el("auth-screen");
const todosScreen = el("todos-screen");
const userBadge = el("user-badge");
const userEmailEl = el("user-email");
const authError = el("auth-error");
const todoList = el("todo-list");
const emptyState = el("empty-state");
const todoCount = el("todo-count");
const toast = el("toast");

let toastTimer;
function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3000);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });

  let data = null;
  if (res.status !== 204) {
    data = await res.json().catch(() => null);
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }

  return data;
}

function setUser(id, email) {
  state.userId = id;
  state.userEmail = email || "";
  localStorage.setItem("todos:userId", id);
  localStorage.setItem("todos:userEmail", state.userEmail);
}

function clearUser() {
  state.userId = null;
  state.userEmail = "";
  localStorage.removeItem("todos:userId");
  localStorage.removeItem("todos:userEmail");
}

function showAuthScreen() {
  authScreen.classList.remove("hidden");
  todosScreen.classList.add("hidden");
  userBadge.classList.add("hidden");
}

function showTodosScreen() {
  authScreen.classList.add("hidden");
  todosScreen.classList.remove("hidden");
  userBadge.classList.remove("hidden");
  userEmailEl.textContent = state.userEmail || state.userId;
}

// --- Tabs ---
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    el(`${btn.dataset.tab}-form`).classList.add("active");
    authError.classList.add("hidden");
  });
});

// --- Auth ---
el("signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.classList.add("hidden");

  const email = el("signup-email").value.trim();
  const password = el("signup-password").value;
  const ageValue = el("signup-age").value;

  try {
    const { user } = await api("/users", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        ...(ageValue ? { age: Number(ageValue) } : {}),
      }),
    });

    setUser(user.id, user.email);
    showTodosScreen();
    await loadTodos();
  } catch (err) {
    authError.textContent = err.message;
    authError.classList.remove("hidden");
  }
});

el("signin-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.classList.add("hidden");

  const id = el("signin-id").value.trim();

  try {
    const { user } = await api(`/users/${id}`);
    setUser(user.id, user.email);
    showTodosScreen();
    await loadTodos();
  } catch (err) {
    authError.textContent = err.message;
    authError.classList.remove("hidden");
  }
});

el("logout-btn").addEventListener("click", () => {
  clearUser();
  state.todos = [];
  showAuthScreen();
});

// --- Todos ---
async function loadTodos() {
  try {
    const { todos } = await api(`/users/${state.userId}/todos`);
    state.todos = todos;
    renderTodos();
  } catch (err) {
    showToast(err.message, true);
  }
}

el("todo-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const titleInput = el("todo-title");
  const descInput = el("todo-description");
  const title = titleInput.value.trim();
  const description = descInput.value.trim();

  if (!title) return;

  try {
    const { todo } = await api(`/users/${state.userId}/todos`, {
      method: "POST",
      body: JSON.stringify({ title, ...(description ? { description } : {}) }),
    });

    state.todos.unshift(todo);
    titleInput.value = "";
    descInput.value = "";
    renderTodos();
  } catch (err) {
    showToast(err.message, true);
  }
});

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.filter = btn.dataset.filter;
    renderTodos();
  });
});

async function toggleTodo(id, completed) {
  try {
    const { todo } = await api(`/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ completed }),
    });
    const idx = state.todos.findIndex((t) => t.id === id);
    if (idx !== -1) state.todos[idx] = todo;
    renderTodos();
  } catch (err) {
    showToast(err.message, true);
    renderTodos();
  }
}

async function deleteTodo(id) {
  try {
    await api(`/todos/${id}`, { method: "DELETE" });
    state.todos = state.todos.filter((t) => t.id !== id);
    renderTodos();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function saveTodoEdit(id, title, description) {
  try {
    const { todo } = await api(`/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title, description: description || null }),
    });
    const idx = state.todos.findIndex((t) => t.id === id);
    if (idx !== -1) state.todos[idx] = todo;
    renderTodos();
  } catch (err) {
    showToast(err.message, true);
  }
}

function filteredTodos() {
  if (state.filter === "active") return state.todos.filter((t) => !t.completed);
  if (state.filter === "completed") return state.todos.filter((t) => t.completed);
  return state.todos;
}

function renderTodos() {
  const todos = filteredTodos();
  todoList.innerHTML = "";

  const activeCount = state.todos.filter((t) => !t.completed).length;
  todoCount.textContent = state.todos.length
    ? `${activeCount} of ${state.todos.length} left`
    : "";

  emptyState.classList.toggle("hidden", state.todos.length > 0);

  todos.forEach((todo) => {
    const li = document.createElement("li");
    li.className = `todo-item${todo.completed ? " completed" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "todo-checkbox";
    checkbox.checked = todo.completed;
    checkbox.addEventListener("change", () => toggleTodo(todo.id, checkbox.checked));

    const body = document.createElement("div");
    body.className = "todo-body";

    const title = document.createElement("div");
    title.className = "todo-title";
    title.textContent = todo.title;
    body.appendChild(title);

    if (todo.description) {
      const desc = document.createElement("div");
      desc.className = "todo-description";
      desc.textContent = todo.description;
      body.appendChild(desc);
    }

    const actions = document.createElement("div");
    actions.className = "todo-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn edit";
    editBtn.textContent = "✎";
    editBtn.title = "Edit";
    editBtn.addEventListener("click", () => startEdit(li, todo));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn delete";
    deleteBtn.textContent = "🗑";
    deleteBtn.title = "Delete";
    deleteBtn.addEventListener("click", () => deleteTodo(todo.id));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(checkbox);
    li.appendChild(body);
    li.appendChild(actions);
    todoList.appendChild(li);
  });
}

function startEdit(li, todo) {
  li.innerHTML = "";

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.value = todo.title;
  titleInput.maxLength = 500;

  const descInput = document.createElement("input");
  descInput.type = "text";
  descInput.value = todo.description || "";
  descInput.placeholder = "Description (optional)";
  descInput.maxLength = 1000;

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-primary";
  saveBtn.textContent = "Save";
  saveBtn.type = "button";
  saveBtn.addEventListener("click", () => {
    const title = titleInput.value.trim();
    if (!title) return;
    saveTodoEdit(todo.id, title, descInput.value.trim());
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn-ghost";
  cancelBtn.textContent = "Cancel";
  cancelBtn.type = "button";
  cancelBtn.addEventListener("click", renderTodos);

  const body = document.createElement("div");
  body.className = "todo-body";
  body.style.display = "flex";
  body.style.flexDirection = "column";
  body.style.gap = "6px";
  body.appendChild(titleInput);
  body.appendChild(descInput);

  const actions = document.createElement("div");
  actions.className = "todo-actions";
  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);

  li.appendChild(body);
  li.appendChild(actions);
}

// --- Init ---
(async function init() {
  if (!state.userId) {
    showAuthScreen();
    return;
  }

  try {
    const { user } = await api(`/users/${state.userId}`);
    setUser(user.id, user.email);
    showTodosScreen();
    await loadTodos();
  } catch {
    clearUser();
    showAuthScreen();
  }
})();
