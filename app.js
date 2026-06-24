const STORAGE_KEY = 'flowdesk-tasks';
const USER_NAME = 'BOND';

// --- DOM refs ---
const taskForm = document.getElementById('task-form');
const taskTextInput = document.getElementById('task-text');
const taskDateInput = document.getElementById('task-date');
const taskPriorityInput = document.getElementById('task-priority');
const todoListElement = document.getElementById('todo-list');
const doneListElement = document.getElementById('done-list');
const deleteAllButton = document.getElementById('delete-all-button');
const greetingElements = document.querySelectorAll('.js-greeting');
const topbarNameElement = document.querySelector('.topbar__name');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarCollapseToggle = document.getElementById('sidebar-collapse-toggle');
const sidebarLinks = document.querySelectorAll('.sidebar__link');
const filterDateButton = document.getElementById('task-filter-date');
const filterDateText = document.getElementById('task-filter-date-text');
const filterModal = document.getElementById('filter-modal');
const filterModalOverlay = document.getElementById('filter-modal-overlay');
const filterModalClose = document.getElementById('filter-modal-close');
const filterModalDate = document.getElementById('filter-modal-date');
const filterModalActions = document.querySelectorAll('.filter-modal__action');

// --- State ---
let tasks = loadTasks();
let activeFilterDate = null;

// Greeting based on current hour
function getGreetingByHour() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return 'Good Morning';
  }

  if (hour >= 12 && hour < 17) {
    return 'Good Afternoon';
  }

  if (hour >= 17 && hour < 21) {
    return 'Good Evening';
  }

  return 'Good Night';
}

// Render greeting + user name to all .js-greeting elements
function renderGreeting() {
  greetingElements.forEach(el => el.textContent = getGreetingByHour());
  topbarNameElement.textContent = USER_NAME;
}

// YYYY-MM-DD — avoid UTC offset from toisostring
function toLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Factory generate unique ID + default status for new task
function createTask(taskData) {
  return {
    id: `task-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    text: taskData.text,
    priority: taskData.priority,
    taskDate: taskData.taskDate,
    createdAt: new Date().toISOString(),
    completed: false,
    completedAt: null
  };
}

// Cek overdue task belum selesai & deadline sudah lewat
function isTaskOverdue(task) {
  if (task.completed) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(`${task.taskDate}T00:00:00`);
  taskDate.setHours(0, 0, 0, 0);
  return taskDate < today;
}

// Persist to localStorage
function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// Load from localStorage, fallback to [kosong] if corrupt/empty
function loadTasks() {
  const storedTasks = localStorage.getItem(STORAGE_KEY);

  if (!storedTasks) {
    return [];
  }

  try {
    const parsedTasks = JSON.parse(storedTasks);
    return Array.isArray(parsedTasks) ? parsedTasks : [];
  } catch {
    return [];
  }
}

// Display format "Wed, 24 Jun 2026"
function formatTaskDate(taskDate) {
  const date = new Date(`${taskDate}T00:00:00`);
  date.setHours(0, 0, 0, 0);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

// Filter tasks by activeFilterDate — supports single date or {start,end}
function filterTasksByDate(taskList) {
  if (!activeFilterDate) {
    return taskList;
  }
  if (typeof activeFilterDate === 'string') {
    return taskList.filter((task) => task.taskDate === activeFilterDate);
  }
  return taskList.filter(
    (task) => task.taskDate >= activeFilterDate.start && task.taskDate <= activeFilterDate.end
  );
}

// Render one <li> task item checkbox + content + delete button
function createTaskItem(task) {
  const item = document.createElement('li');
  const overdue = isTaskOverdue(task);
  const stateClasses = [
    'task-item',
    task.completed ? 'task-item--done' : '',
    overdue ? 'task-item--overdue' : ''
  ].filter(Boolean).join(' ');

  item.className = stateClasses;

  const checkbox = document.createElement('input');
  checkbox.className = 'task-item__checkbox';
  checkbox.type = 'checkbox';
  checkbox.checked = task.completed;
  checkbox.setAttribute('aria-label', `Mark task ${task.text} as done`);
  checkbox.addEventListener('change', () => toggleTask(task.id));

  const content = document.createElement('div');
  content.className = 'task-item__content';

  const text = document.createElement('p');
  text.className = 'task-item__text';
  text.textContent = task.text;

  const meta = document.createElement('div');
  meta.className = 'task-item__meta';

  const dateBadge = document.createElement('span');
  dateBadge.className = 'task-item__badge task-item__badge--date';
  dateBadge.textContent = formatTaskDate(task.taskDate);

  const priorityBadge = document.createElement('span');
  priorityBadge.className = `task-item__badge task-item__badge--${task.priority}`;
  priorityBadge.textContent = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);

  meta.append(dateBadge, priorityBadge);

  if (overdue) {
    const overdueBadge = document.createElement('span');
    overdueBadge.className = 'task-item__badge task-item__badge--overdue';
    overdueBadge.textContent = 'Overdue';
    meta.append(overdueBadge);
  }

  content.append(text, meta);

  const deleteButton = document.createElement('button');
  deleteButton.className = 'button button--danger task-item__delete';
  deleteButton.type = 'button';
  deleteButton.textContent = 'Delete';
  deleteButton.addEventListener('click', () => deleteTask(task.id));

  item.append(checkbox, content, deleteButton);
  return item;
}

// Empty state placeholder for empty lists
function renderEmptyState(message) {
  const item = document.createElement('li');
  item.className = 'task-list__empty';
  item.textContent = message;
  return item;
}

// Render both lists split active vs completed, sort, append
function renderTasks() {
  todoListElement.innerHTML = '';
  doneListElement.innerHTML = '';

  const filtered = filterTasksByDate(tasks);
  const activeTasks = filtered.filter((task) => !task.completed);
  const completedTasks = filtered.filter((task) => task.completed);

  if (activeTasks.length === 0) {
    todoListElement.append(renderEmptyState('No active tasks for the selected date.'));
  } else {
    activeTasks
      .sort((a, b) => new Date(a.taskDate + 'T00:00:00') - new Date(b.taskDate + 'T00:00:00'))
      .forEach((task) => todoListElement.append(createTaskItem(task)));
  }

  if (completedTasks.length === 0) {
    doneListElement.append(renderEmptyState('No completed tasks for the selected date.'));
  } else {
    completedTasks
      .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))
      .forEach((task) => doneListElement.append(createTaskItem(task)));
  }
}

// Submit: validate → create → save → render → scroll
function handleTaskSubmit(event) {
  event.preventDefault();

  const text = taskTextInput.value.trim();
  const taskDate = taskDateInput.value;
  const priority = taskPriorityInput.value;

  if (!text || !taskDate || !priority) {
    alert('Please complete task, date, and priority.');
    return;
  }

  const task = createTask({ text, taskDate, priority });
  tasks.push(task);
  saveTasks();
  renderTasks();
  taskForm.reset();
  taskPriorityInput.value = 'medium';
  document.getElementById('tasks').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Toggle completion, set completedAt timestamp
function toggleTask(taskId) {
  tasks = tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    const completed = !task.completed;
    return {
      ...task,
      completed,
      completedAt: completed ? new Date().toISOString() : null
    };
  });

  saveTasks();
  renderTasks();
}

// Delete one task by ID
function deleteTask(taskId) {
  tasks = tasks.filter((task) => task.id !== taskId);
  saveTasks();
  renderTasks();
}

// Delete all tasks with confirmation — prevent accidental wipe
function deleteAllTasks() {
  if (tasks.length === 0) {
    return;
  }

  const confirmed = window.confirm('Delete all tasks?');
  if (!confirmed) {
    return;
  }

  tasks = [];
  saveTasks();
  renderTasks();
}

// --- Sidebar / UI ---

function isMobile() {
  return window.innerWidth <= 1024;
}

function closeMobileSidebar() {
  sidebar.classList.remove('is-open');
  sidebarOverlay.classList.remove('is-open');
  sidebarToggle.setAttribute('aria-expanded', 'false');
}

function toggleSidebar() {
  if (isMobile()) {
    const isOpen = sidebar.classList.toggle('is-open');
    sidebarOverlay.classList.toggle('is-open', isOpen);
    sidebarToggle.setAttribute('aria-expanded', String(isOpen));
  } else {
    toggleDesktopCollapse();
  }
}

// Desktop: collapse/expand sidebar via body class
function toggleDesktopCollapse() {
  document.body.classList.toggle('sidebar-collapsed');
  const collapsed = document.body.classList.contains('sidebar-collapsed');
  sidebarCollapseToggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
}

// Highlight active sidebar link from URL hash
function handleSidebarLinkState() {
  const currentHash = window.location.hash || '#dashboard';

  sidebarLinks.forEach((link) => {
    const isActive = link.getAttribute('href') === currentHash;
    link.classList.toggle('sidebar__link--active', isActive);
  });
}

taskForm.addEventListener('submit', handleTaskSubmit);
deleteAllButton.addEventListener('click', deleteAllTasks);
sidebarToggle.addEventListener('click', toggleSidebar);
sidebarCollapseToggle.addEventListener('click', toggleDesktopCollapse);
sidebarOverlay.addEventListener('click', closeMobileSidebar);
sidebarLinks.forEach((link) => {
  link.addEventListener('click', () => {
    handleSidebarLinkState();
    if (isMobile()) {
      closeMobileSidebar();
    }
  });
});

// --- Date filter helpers ---

// Monday-Sunday range for "This Week" filter
function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: toLocalDateString(monday),
    end: toLocalDateString(sunday)
  };
}

// 1st–last day of current month for "This Month" filter
function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: toLocalDateString(start),
    end: toLocalDateString(end)
  };
}

// --- Filter modal ---

function openFilterModal() {
  filterModal.classList.add('is-open');
  filterModalDate.value = '';
  filterModalDate.focus();
  filterModalActions.forEach((btn) => {
    btn.classList.toggle('filter-modal__action--active', btn.dataset.filter === 'all');
  });
}

function closeFilterModal() {
  filterModal.classList.remove('is-open');
}

// Apply filter: update state + button UI, then re-render
function setFilterDate(filter) {
  activeFilterDate = filter;
  if (!filter) {
    filterDateText.textContent = 'All';
    filterDateButton.classList.remove('topbar__filter--active');
  } else if (typeof filter === 'string') {
    filterDateText.textContent = formatTaskDate(filter);
    filterDateButton.classList.add('topbar__filter--active');
  } else {
    filterDateText.textContent =
      formatTaskDate(filter.start) + ' - ' + formatTaskDate(filter.end);
    filterDateButton.classList.add('topbar__filter--active');
  }
  renderTasks();
}

// Route filter: "today"/"week"/"month"/custom date → setFilterDate
function applyDateFilter(filterValue) {
  switch (filterValue) {
    case 'today': {
      const today = toLocalDateString(new Date());
      setFilterDate(today);
      break;
    }
    case 'week': {
      const range = getWeekRange();
      setFilterDate(range);
      break;
    }
    case 'month': {
      const range = getMonthRange();
      setFilterDate(range);
      break;
    }
    default:
      if (filterValue && /^\d{4}-\d{2}-\d{2}$/.test(filterValue)) {
        setFilterDate(filterValue);
      } else {
        setFilterDate(null);
      }
  }
  closeFilterModal();
}

filterDateButton.addEventListener('click', openFilterModal);
filterModalOverlay.addEventListener('click', closeFilterModal);
filterModalClose.addEventListener('click', closeFilterModal);
filterModalDate.addEventListener('change', () => {
  if (filterModalDate.value) {
    applyDateFilter(filterModalDate.value);
  }
});
filterModalActions.forEach((btn) => {
  btn.addEventListener('click', () => {
    filterModalActions.forEach((b) => b.classList.remove('filter-modal__action--active'));
    btn.classList.add('filter-modal__action--active');
    applyDateFilter(btn.dataset.filter);
  });
});
window.addEventListener('hashchange', handleSidebarLinkState);
window.addEventListener('resize', () => {
  if (!isMobile()) {
    closeMobileSidebar();
  }
});

// --- Live clock ---

// Display date+time, format berbeda mobile vs desktop
function renderClock() {
  const now = new Date();
  const els = document.querySelectorAll('.js-clock');
  const text = isMobile()
    ? now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    : now.toLocaleDateString('en-US', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
      + ' ' +
      now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
  els.forEach(el => el.textContent = text);
}


// --- Initialization ---

renderGreeting();
renderClock();
setInterval(renderClock, 1000);

// Desktop: sidebar collapsed sebagai default
if (!isMobile()) {
  document.body.classList.add('sidebar-collapsed');
  sidebarCollapseToggle.setAttribute('aria-label', 'Expand sidebar');
}
renderTasks();
handleSidebarLinkState();
