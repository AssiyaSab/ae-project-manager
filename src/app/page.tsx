'use client';

import React, { useState, useEffect, useRef } from 'react';

interface User {
  id: number;
  name: string;
  phone: string;
  telegramId: string | null;
  role: string;
  title: string | null;
  isActive: boolean;
}

interface Alert {
  id: number;
  taskId: number;
  text: string;
  status: string;
  createdAt: string;
  task: {
    name: string;
    project: {
      name: string;
    };
  };
}

interface Task {
  id: number;
  name: string;
  description: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'OTK' | 'BLOCKED' | 'DONE';
  cost: number | null;
  assignees: User[];
  alerts: { id: number; status: string }[];
}

interface Project {
  id: number;
  name: string;
  description: string | null;
  status: 'DESIGN' | 'PURCHASE' | 'ASSEMBLY' | 'COMMISSIONING' | 'DONE';
  budget: number | null;
  createdAt: string;
  tasks: Task[];
  managerId: number | null;
  manager: User | null;
}

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  keyboard?: {
    inline_keyboard: { text: string; callback_data: string }[][];
  };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'forms' | 'alerts' | 'admin'>('dashboard');
  
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [showLoginModal, setShowLoginModal] = useState<boolean>(true);
  const [loginUserId, setLoginUserId] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  
  // Simulator State
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [phoneMessages, setPhoneMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  
  // Forms State
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectStatus, setProjectStatus] = useState('DESIGN');
  const [projectBudget, setProjectBudget] = useState('');
  const [projectManagerId, setProjectManagerId] = useState('');
  
  const [taskName, setTaskName] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskProjectId, setTaskProjectId] = useState('');
  const [taskAssignedIds, setTaskAssignedIds] = useState<string[]>([]);
  const [taskCost, setTaskCost] = useState('');

  // Editing Project State
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDesc, setEditProjectDesc] = useState('');
  const [editProjectStatus, setEditProjectStatus] = useState('');
  const [editProjectBudget, setEditProjectBudget] = useState('');
  const [editProjectManagerId, setEditProjectManagerId] = useState('');

  // Editing Task State
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editTaskName, setEditTaskName] = useState('');
  const [editTaskDesc, setEditTaskDesc] = useState('');
  const [editTaskStatus, setEditTaskStatus] = useState('');
  const [editTaskCost, setEditTaskCost] = useState('');
  const [editTaskAssignedIds, setEditTaskAssignedIds] = useState<string[]>([]);

  // Admin / User Management State
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [editUserRole, setEditUserRole] = useState('');
  const [editUserTitle, setEditUserTitle] = useState('');
  const [editUserIsActive, setEditUserIsActive] = useState<boolean>(true);
  const [showUserModal, setShowUserModal] = useState<boolean>(false);

  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState('ENGINEER');
  const [newUserTitle, setNewUserTitle] = useState('');

  // Telegram Webhook Management State
  const [webhookLog, setWebhookLog] = useState<{ success?: boolean; message?: string; configuredUrl?: string; currentWebhookInfo?: any; error?: string } | null>(null);
  const [isConnectingWebhook, setIsConnectingWebhook] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const handleConnectWebhook = async () => {
    setIsConnectingWebhook(true);
    try {
      const res = await fetch('/api/telegram/setup');
      const data = await res.json();
      setWebhookLog(data);
    } catch (err: any) {
      setWebhookLog({ success: false, message: 'Ошибка сети при подключении Webhook: ' + err.message });
    } finally {
      setIsConnectingWebhook(false);
    }
  };

  const handleCopyInvite = () => {
    const text = `👋 Коллеги, мы запустили Telegram-бота для фиксации статусов и задач!\n\n1️⃣ Откройте бота: https://t.me/your_bot_username\n2️⃣ Нажмите /start и кнопку «📱 Поделиться контактом» (или отправьте свой номер телефона)\n3️⃣ Нажмите /tasks, чтобы увидеть текущие задачи\n\n💡 Если у вас возник блокер или задержка от смежников (АР, КР, ОВ, ВК, ЭОМ) — просто напишите текстом в бот (например: «Ждем подоснову от ОВ»), ИИ сам зафиксирует проблему и уведомит ГИПа!`;
    navigator.clipboard.writeText(text);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 3000);
  };

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch initial data
  const refreshData = async () => {
    const pass = adminPassword || localStorage.getItem('ae_admin_password') || '';
    if (!pass) return;
    try {
      const headers = { 'x-auth-password': pass };
      const [pRes, uRes, aRes] = await Promise.all([
        fetch('/api/projects', { headers }).then(r => r.json()),
        fetch('/api/users', { headers }).then(r => r.json()),
        fetch('/api/alerts', { headers }).then(r => r.json())
      ]);
      if (Array.isArray(pRes)) setProjects(pRes);
      if (Array.isArray(uRes)) setUsers(uRes);
      if (Array.isArray(aRes)) setAlerts(aRes);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  // Fetch data whenever password changes
  useEffect(() => {
    if (adminPassword) {
      refreshData();
    }
  }, [adminPassword]);

  // Load session from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('ae_current_user');
    const savedPassword = localStorage.getItem('ae_admin_password');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setCurrentUser(u);
        if (savedPassword) {
          setAdminPassword(savedPassword);
        }
        setShowLoginModal(false);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('ae_current_user');
    localStorage.removeItem('ae_admin_password');
    setCurrentUser(null);
    setAdminPassword('');
    setShowLoginModal(true);
    setLoginUserId('');
    setLoginPassword('');
    setLoginError('');
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPassword) {
      setLoginError('Пожалуйста, введите пароль.');
      return;
    }
    
    const expectedAdmin = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'AE_ADMIN_2026';
    const expectedMember = process.env.NEXT_PUBLIC_MEMBER_PASSWORD || 'AE_EMPLOYEE_2026';
    
    if (loginPassword === expectedAdmin) {
      const adminUser = { id: 0, name: 'ГИП (Админ)', role: 'ADMIN', isActive: true };
      setCurrentUser(adminUser as any);
      setAdminPassword(loginPassword);
      localStorage.setItem('ae_current_user', JSON.stringify(adminUser));
      localStorage.setItem('ae_admin_password', loginPassword);
      setShowLoginModal(false);
      setLoginError('');
    } else if (loginPassword === expectedMember) {
      const memberUser = { id: 999, name: 'Сотрудник', role: 'ENGINEER', isActive: true };
      setCurrentUser(memberUser as any);
      setAdminPassword(loginPassword);
      localStorage.setItem('ae_current_user', JSON.stringify(memberUser));
      localStorage.setItem('ae_admin_password', loginPassword);
      setShowLoginModal(false);
      setLoginError('');
    } else {
      setLoginError('Неверный пароль доступа!');
    }
  };

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [phoneMessages]);

  // Handle phone select and simulate /start
  const handlePhoneChange = async (phoneVal: string) => {
    setSelectedPhone(phoneVal);
    setPhoneMessages([]);
    if (!phoneVal) return;

    // Local echo
    setPhoneMessages([{ sender: 'user', text: '/start' }]);

    try {
      const res = await fetch('/api/simulate-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneVal, text: '/start' }),
      });
      const data = await res.json();
      setPhoneMessages(prev => [
        ...prev,
        { sender: 'bot', text: data.replyText, keyboard: data.keyboard }
      ]);
    } catch (err) {
      console.error(err);
    }
  };

  // Simulate sending a text command (/tasks or custom text)
  const sendSimMessage = async (textToSend: string) => {
    if (!selectedPhone) return;
    const cleanText = textToSend.trim();
    if (!cleanText) return;

    setInputText('');
    setPhoneMessages(prev => [...prev, { sender: 'user', text: cleanText }]);

    const isCustomText = !cleanText.startsWith('/');
    if (isCustomText) {
      setIsAiLoading(true);
    }

    try {
      const res = await fetch('/api/simulate-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selectedPhone, text: cleanText }),
      });
      const data = await res.json();
      
      setPhoneMessages(prev => [
        ...prev,
        { sender: 'bot', text: data.replyText, keyboard: data.keyboard }
      ]);
      
      // Update UI data instantly
      refreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Handle clicking inline button inside mock chat
  const handleInlineClick = async (callbackData: string, buttonText: string) => {
    if (!selectedPhone) return;
    
    setPhoneMessages(prev => [...prev, { sender: 'user', text: buttonText }]);

    try {
      const res = await fetch('/api/simulate-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selectedPhone, text: callbackData }),
      });
      const data = await res.json();
      
      setPhoneMessages(prev => [
        ...prev,
        { sender: 'bot', text: data.replyText, keyboard: data.keyboard }
      ]);
      
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  // Resolve Alert from GIP panel
  const handleResolveAlert = async (alertId: number) => {
    try {
      await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword || '' },
        body: JSON.stringify({ alertId, status: 'RESOLVED' }),
      });
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  // Create Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName) return;
    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword || '' },
        body: JSON.stringify({
          name: projectName,
          description: projectDesc,
          status: projectStatus,
          budget: projectBudget ? parseFloat(projectBudget) : null,
          managerId: projectManagerId || null
        }),
      });
      setProjectName('');
      setProjectDesc('');
      setProjectStatus('DESIGN');
      setProjectBudget('');
      setProjectManagerId('');
      refreshData();
      setActiveTab('dashboard');
    } catch (err) {
      console.error(err);
    }
  };

  // Start Editing Project
  const startEditingProject = (project: Project) => {
    setEditingProjectId(project.id);
    setEditProjectName(project.name);
    setEditProjectDesc(project.description || '');
    setEditProjectStatus(project.status);
    setEditProjectBudget(project.budget ? project.budget.toString() : '');
    setEditProjectManagerId(project.managerId ? project.managerId.toString() : '');
  };

  // Save Project Edit
  const handleSaveProjectEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProjectId || !editProjectName) return;
    try {
      await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword || '' },
        body: JSON.stringify({
          projectId: editingProjectId,
          name: editProjectName,
          description: editProjectDesc,
          status: editProjectStatus,
          budget: editProjectBudget ? parseFloat(editProjectBudget) : null,
          managerId: editProjectManagerId || null
        }),
      });
      setEditingProjectId(null);
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  // Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName || !taskProjectId) return;
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword || '' },
        body: JSON.stringify({
          projectId: taskProjectId,
          name: taskName,
          description: taskDesc,
          assigneeIds: taskAssignedIds.map(Number),
          cost: taskCost ? parseFloat(taskCost) : null
        }),
      });
      setTaskName('');
      setTaskDesc('');
      setTaskProjectId('');
      setTaskAssignedIds([]);
      setTaskCost('');
      refreshData();
      setActiveTab('dashboard');
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Project
  const handleDeleteProject = async (projectId: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот проект и все его задачи?')) return;
    try {
      await fetch(`/api/projects?projectId=${projectId}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword || '' }
      });
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  // Start Editing Task
  const startEditingTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTaskName(task.name);
    setEditTaskDesc(task.description || '');
    setEditTaskStatus(task.status);
    setEditTaskCost(task.cost ? task.cost.toString() : '');
    setEditTaskAssignedIds(task.assignees.map(a => a.id.toString()));
  };

  // Save Task Edit
  const handleSaveTaskEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTaskId || !editTaskName) return;
    try {
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword || '' },
        body: JSON.stringify({
          taskId: editingTaskId,
          name: editTaskName,
          description: editTaskDesc,
          status: editTaskStatus,
          cost: editTaskCost ? parseFloat(editTaskCost) : null,
          assigneeIds: editTaskAssignedIds.map(Number)
        }),
      });
      setEditingTaskId(null);
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту задачу?')) return;
    try {
      await fetch(`/api/tasks?taskId=${taskId}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword || '' }
      });
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  // Start Editing User
  const startEditingUser = (user: User) => {
    setEditingUserId(user.id);
    setEditUserName(user.name);
    setEditUserPhone(user.phone || '');
    setEditUserRole(user.role);
    setEditUserTitle(user.title || '');
    setEditUserIsActive(user.isActive);
    setShowUserModal(true);
  };

  // Save User Edit
  const handleSaveUserEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingUserId || !editUserName) return;
    try {
      await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword || '' },
        body: JSON.stringify({
          userId: editingUserId,
          name: editUserName,
          phone: editUserPhone || null,
          role: editUserRole,
          title: editUserTitle || null,
          isActive: editUserIsActive
        }),
      });
      setEditingUserId(null);
      setShowUserModal(false);
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle User Active (Archive/Restore)
  const handleToggleUserActive = async (user: User) => {
    const actionText = user.isActive ? 'архивировать' : 'восстановить';
    if (!window.confirm(`Вы уверены, что хотите ${actionText} сотрудника ${user.name}?`)) return;
    try {
      await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword || '' },
        body: JSON.stringify({
          userId: user.id,
          isActive: !user.isActive
        }),
      });
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  // Delete User
  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого сотрудника?')) return;
    try {
      await fetch(`/api/users?userId=${userId}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword || '' }
      });
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  // Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserRole) return;
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword || '' },
        body: JSON.stringify({
          name: newUserName,
          phone: newUserPhone || null,
          role: newUserRole,
          title: newUserTitle || null
        }),
      });
      setNewUserName('');
      setNewUserPhone('');
      setNewUserRole('ENGINEER');
      setNewUserTitle('');
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  // CSV Export utility
  const exportToCSV = (filename: string, headers: string[], rows: any[][]) => {
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => 
        row.map(val => {
          if (val === null || val === undefined) return '';
          const str = String(val).replace(/"/g, '""');
          return str.includes(';') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
        }).join(';')
      )
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Projects CSV
  const handleExportProjects = () => {
    const headers = ['ID', 'Название проекта', 'Описание', 'Статус', 'Бюджет (₸)', 'Израсходовано (₸)', 'Остаток (₸)', 'Руководитель', 'Создан'];
    const rows = projects.map(p => {
      const totalSpent = p.tasks.reduce((sum, t) => sum + (t.cost || 0), 0);
      const remaining = p.budget ? p.budget - totalSpent : 0;
      return [
        p.id,
        p.name,
        p.description || '',
        p.status === 'DESIGN' ? 'Проектирование' : p.status === 'PURCHASE' ? 'Закупка' : p.status === 'ASSEMBLY' ? 'Сборка' : p.status === 'COMMISSIONING' ? 'Пусконаладка' : p.status === 'DONE' ? 'Завершен' : p.status,
        p.budget || 0,
        totalSpent,
        p.budget ? remaining : '—',
        p.manager ? p.manager.name : 'Не назначен',
        new Date(p.createdAt).toLocaleDateString('ru-RU')
      ];
    });
    exportToCSV('projects_report.csv', headers, rows);
  };

  // Export Users CSV
  const handleExportUsers = () => {
    const headers = ['ID', 'ФИО', 'Телефон', 'Должность', 'Роль', 'Статус'];
    const rows = users.map(u => [
      u.id,
      u.name,
      u.phone || '',
      u.title || '',
      u.role === 'ADMIN' ? 'ГИП' : u.role === 'ENGINEER' ? 'Инженер' : 'Сборщик',
      u.isActive ? 'Активен' : 'В архиве'
    ]);
    exportToCSV('employees_report.csv', headers, rows);
  };

  // Export Tasks CSV
  const handleExportTasks = () => {
    const headers = ['ID', 'Название задачи', 'Описание', 'Проект', 'Исполнители', 'Должности исполнителей', 'Стоимость (₸)', 'Статус'];
    const allTasks: any[] = [];
    projects.forEach(p => {
      p.tasks.forEach(t => {
        allTasks.push({
          ...t,
          projectName: p.name
        });
      });
    });
    const rows = allTasks.map(t => [
      t.id,
      t.name,
      t.description || '',
      t.projectName,
      t.assignees && t.assignees.length > 0 ? t.assignees.map((a: any) => a.name).join(', ') : 'Не назначен',
      t.assignees && t.assignees.length > 0 ? t.assignees.map((a: any) => a.title || '').filter(Boolean).join(', ') : '',
      t.cost || 0,
      t.status === 'PENDING' ? 'Ожидает' : t.status === 'IN_PROGRESS' ? 'В работе' : t.status === 'OTK' ? 'В ОТК' : t.status === 'BLOCKED' ? 'Блок' : t.status === 'DONE' ? 'Готово' : t.status
    ]);
    exportToCSV('tasks_report.csv', headers, rows);
  };

  // CSV Import parser helper
  const parseCSVRow = (text: string, separator: string): string[] => {
    const result: string[] = [];
    let startIdx = 0;
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '"') {
        inQuotes = !inQuotes;
      } else if (text[i] === separator && !inQuotes) {
        let field = text.substring(startIdx, i).trim();
        if (field.startsWith('"') && field.endsWith('"')) {
          field = field.substring(1, field.length - 1).replace(/""/g, '"');
        }
        result.push(field);
        startIdx = i + 1;
      }
    }
    let lastField = text.substring(startIdx).trim();
    if (lastField.startsWith('"') && lastField.endsWith('"')) {
      lastField = lastField.substring(1, lastField.length - 1).replace(/""/g, '"');
    }
    result.push(lastField);
    return result;
  };

  // Handle CSV Import
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length < 2) {
        alert('Файл CSV пуст или содержит только одну строку.');
        return;
      }

      const separator = lines[0].includes(';') ? ';' : ',';
      
      let startIndex = 0;
      if (lines[0].toLowerCase().includes('фио') || lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('роль')) {
        startIndex = 1;
      }

      let successCount = 0;
      let errorCount = 0;

      for (let i = startIndex; i < lines.length; i++) {
        const row = parseCSVRow(lines[i], separator);
        if (row.length < 2) continue;

        const name = row[0]?.trim();
        const phone = row[1]?.trim();
        const title = row[2]?.trim();
        const roleInput = row[3]?.trim()?.toUpperCase();

        if (!name) continue;

        let role = 'ENGINEER';
        if (roleInput) {
          if (roleInput.includes('ADMIN') || roleInput.includes('ГИП') || roleInput.includes('РУКОВОД')) {
            role = 'ADMIN';
          } else if (roleInput.includes('ASSEMBLER') || roleInput.includes('СБОР') || roleInput.includes('МОНТАЖ')) {
            role = 'ASSEMBLER';
          }
        }

        try {
          const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword || '' },
            body: JSON.stringify({
              name,
              phone: phone || null,
              role,
              title: title || null
            })
          });
          if (res.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          console.error(err);
          errorCount++;
        }
      }

      alert(`Импорт завершен!\nУспешно добавлено сотрудников: ${successCount}\nОшибок (например, дубликаты номеров): ${errorCount}`);
      refreshData();
      e.target.value = '';
    };

    reader.readAsText(file, 'utf-8');
  };

  // Helper stats count
  const stats = {
    projectsCount: projects.length,
    activeTasks: projects.reduce((acc, p) => acc + p.tasks.filter(t => t.status !== 'DONE').length, 0),
    blockedTasks: projects.reduce((acc, p) => acc + p.tasks.filter(t => t.status === 'BLOCKED').length, 0),
    completedTasks: projects.reduce((acc, p) => acc + p.tasks.filter(t => t.status === 'DONE').length, 0),
  };

  return (
    <div className="app-container">
      {/* 1. GIP Dashboard Panel */}
      <div className="dashboard-panel">
        <header className="dashboard-header">
          <div style={{ display: 'flex', alignItems: 'center', height: '45px' }}>
            <img 
              src="/logo.png" 
              alt="АзияЭнергоАвтоматика" 
              style={{ 
                maxHeight: '100%', 
                width: 'auto', 
                objectFit: 'contain'
              }} 
            />
          </div>
          <nav className="dashboard-nav">
            <button 
              className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              📊 Дашборд
            </button>
            {currentUser?.role === 'ADMIN' && (
              <button 
                className={`nav-btn ${activeTab === 'forms' ? 'active' : ''}`}
                onClick={() => setActiveTab('forms')}
              >
                ➕ Добавить
              </button>
            )}
            <button 
              className={`nav-btn ${activeTab === 'alerts' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('alerts');
                refreshData();
              }}
            >
              ⚠️ Алерты ({alerts.filter(a => a.status === 'ACTIVE').length})
            </button>
            {currentUser?.role === 'ADMIN' && (
              <button 
                className={`nav-btn ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('admin');
                  refreshData();
                }}
              >
                ⚙️ Админка
              </button>
            )}
          </nav>
          
          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: '#94a3b8', fontSize: '13px', marginLeft: 'auto' }}>
              <span style={{ fontWeight: 500 }}>👤 {currentUser.name} ({currentUser.role === 'ADMIN' ? 'ГИП' : currentUser.role === 'ENGINEER' ? 'Инженер' : 'Сборщик'})</span>
              <button 
                onClick={handleLogout}
                style={{
                  background: '#f43f5e15',
                  color: '#f43f5e',
                  border: '1px solid #f43f5e30',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontWeight: 600
                }}
              >
                Выйти 🚪
              </button>
            </div>
          )}
        </header>

        <main className="dashboard-content">
          {activeTab === 'dashboard' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                <button 
                  onClick={handleExportProjects} 
                  className="inline-btn" 
                  style={{ background: 'var(--accent-orange)', color: '#000', borderColor: 'var(--accent-orange)', padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  📥 Экспорт проектов (CSV)
                </button>
              </div>

              {/* Stats row */}
              <section className="stats-grid">
                <div className="stat-card">
                  <span className="stat-value orange">{stats.projectsCount}</span>
                  <span className="stat-label">Всего проектов</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value cyan">{stats.activeTasks}</span>
                  <span className="stat-label">Активных задач</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value red">{stats.blockedTasks}</span>
                  <span className="stat-label">Блокировок (Проблем)</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value green">{stats.completedTasks}</span>
                  <span className="stat-label">Выполненных задач</span>
                </div>
              </section>

              {/* Projects Grid */}
              <section className="projects-grid">
                {projects.map((project) => {
                  const isProjectBlocked = project.tasks.some(t => t.status === 'BLOCKED');
                  const totalSpent = project.tasks.reduce((sum, t) => sum + (t.cost || 0), 0);
                  const remaining = project.budget ? project.budget - totalSpent : 0;
                  
                  return (
                    <article 
                      key={project.id} 
                      className={`project-card ${isProjectBlocked ? 'alert-pulse' : ''}`}
                    >
                      {editingProjectId === project.id ? (
                        <form onSubmit={handleSaveProjectEdit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                          <h4 style={{ color: 'var(--accent-orange)', fontWeight: 600, fontSize: '0.95rem' }}>Редактирование проекта</h4>
                          <div className="form-group" style={{ marginBottom: '0px' }}>
                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Название</label>
                            <input 
                              type="text" 
                              className="form-input" 
                              style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                              value={editProjectName}
                              onChange={(e) => setEditProjectName(e.target.value)}
                              required 
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: '0px' }}>
                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Описание</label>
                            <textarea 
                              className="form-textarea" 
                              style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                              rows={2} 
                              value={editProjectDesc}
                              onChange={(e) => setEditProjectDesc(e.target.value)}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: '0px' }}>
                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Руководитель проекта</label>
                            <select
                              className="form-select"
                              style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                              value={editProjectManagerId}
                              onChange={(e) => setEditProjectManagerId(e.target.value)}
                            >
                              <option value="">-- Не назначен --</option>
                              {users.filter(u => u.isActive && (u.role === 'ADMIN' || u.role === 'ENGINEER')).map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.title || 'Руководитель'})</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <div className="form-group" style={{ flex: 1, marginBottom: '0px' }}>
                              <label className="form-label" style={{ fontSize: '0.78rem' }}>Бюджет (₸)</label>
                              <input 
                                type="number" 
                                className="form-input" 
                                style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                                value={editProjectBudget}
                                onChange={(e) => setEditProjectBudget(e.target.value)}
                              />
                            </div>
                            <div className="form-group" style={{ flex: 1, marginBottom: '0px' }}>
                              <label className="form-label" style={{ fontSize: '0.78rem' }}>Этап</label>
                              <select 
                                className="form-select" 
                                style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                                value={editProjectStatus}
                                onChange={(e) => setEditProjectStatus(e.target.value)}
                              >
                                <option value="DESIGN">Проектирование</option>
                                <option value="PURCHASE">Закупка</option>
                                <option value="ASSEMBLY">Сборка</option>
                                <option value="COMMISSIONING">Пусконаладка</option>
                                <option value="DONE">Завершен</option>
                              </select>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                            <button type="submit" className="inline-btn" style={{ flex: 1, background: 'var(--accent-orange)', color: '#000', borderColor: 'var(--accent-orange)', padding: '6px' }}>Сохранить</button>
                            <button type="button" className="inline-btn" style={{ flex: 1, padding: '6px' }} onClick={() => setEditingProjectId(null)}>Отмена</button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="project-title-row">
                            <h3 className="project-name" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              {project.name}
                              {currentUser?.role === 'ADMIN' && (
                                <>
                                  <button 
                                    onClick={() => startEditingProject(project)}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.95rem', opacity: 0.6, padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center' }}
                                    title="Редактировать проект"
                                  >
                                    ✏️
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteProject(project.id)}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.95rem', opacity: 0.6, padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center' }}
                                    title="Удалить проект"
                                  >
                                    🗑️
                                  </button>
                                </>
                              )}
                            </h3>
                            <span className={`badge ${project.status.toLowerCase()}`}>
                              {project.status === 'DESIGN' && 'Проектирование'}
                              {project.status === 'PURCHASE' && 'Закупка'}
                              {project.status === 'ASSEMBLY' && 'Сборка'}
                              {project.status === 'COMMISSIONING' && 'Пусконаладка'}
                              {project.status === 'DONE' && 'Завершен'}
                            </span>
                          </div>
                          
                          {project.description && (
                            <p className="project-desc">{project.description}</p>
                          )}

                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span>💼 Руководитель:</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                              {project.manager ? project.manager.name : 'Не назначен'}
                            </span>
                          </div>

                          {/* Financial info */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Бюджет проекта:</span>
                              <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{project.budget ? `${project.budget.toLocaleString('ru-RU')} ₸` : 'Не указан'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Всего израсходовано:</span>
                              <span style={{ color: totalSpent > (project.budget || Infinity) ? '#ff3344' : 'var(--accent-orange)', fontWeight: 600 }}>
                                {totalSpent.toLocaleString('ru-RU')} ₸
                              </span>
                            </div>
                            {project.budget !== null && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '4px', marginTop: '2px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Остаток:</span>
                                <span style={{ color: remaining < 0 ? '#ff3344' : '#00ff66', fontWeight: 600 }}>
                                  {remaining.toLocaleString('ru-RU')} ₸
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="tasks-list">
                            {project.tasks.map((task) => {
                              const isTaskEditing = editingTaskId === task.id;
                              return (
                                <div key={task.id} className="task-item">
                                  {isTaskEditing ? (
                                    <form onSubmit={handleSaveTaskEdit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                      <div className="form-group" style={{ marginBottom: '0px' }}>
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Название задачи</label>
                                        <input 
                                          type="text" 
                                          className="form-input" 
                                          style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                                          value={editTaskName}
                                          onChange={(e) => setEditTaskName(e.target.value)}
                                          required 
                                        />
                                      </div>
                                      <div className="form-group" style={{ marginBottom: '0px' }}>
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Описание</label>
                                        <textarea 
                                          className="form-textarea" 
                                          style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                                          rows={2}
                                          value={editTaskDesc}
                                          onChange={(e) => setEditTaskDesc(e.target.value)}
                                        />
                                      </div>
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        <div className="form-group" style={{ flex: 1, marginBottom: '0px' }}>
                                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Стоимость (₸)</label>
                                          <input 
                                            type="number" 
                                            className="form-input" 
                                            style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                                            value={editTaskCost}
                                            onChange={(e) => setEditTaskCost(e.target.value)}
                                          />
                                        </div>
                                        <div className="form-group" style={{ flex: 1, marginBottom: '0px' }}>
                                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Статус</label>
                                          <select 
                                            className="form-select" 
                                            style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                                            value={editTaskStatus}
                                            onChange={(e) => setEditTaskStatus(e.target.value)}
                                          >
                                            <option value="PENDING">Ожидает</option>
                                            <option value="IN_PROGRESS">В работе</option>
                                            <option value="OTK">В ОТК</option>
                                            <option value="BLOCKED">Блок</option>
                                            <option value="DONE">Готово</option>
                                          </select>
                                        </div>
                                      </div>
                                      <div className="form-group" style={{ marginBottom: '0px' }}>
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Исполнители</label>
                                        <div style={{
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '6px',
                                          maxHeight: '120px',
                                          overflowY: 'auto',
                                          padding: '8px',
                                          background: 'rgba(255,255,255,0.03)',
                                          border: '1px solid var(--border-color)',
                                          borderRadius: '6px'
                                        }}>
                                          {users.filter(u => u.isActive && u.role !== 'ADMIN').map(u => {
                                            const isChecked = editTaskAssignedIds.includes(u.id.toString());
                                            return (
                                              <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>
                                                <input 
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                                                  onChange={(e) => {
                                                    if (e.target.checked) {
                                                      setEditTaskAssignedIds([...editTaskAssignedIds, u.id.toString()]);
                                                    } else {
                                                      setEditTaskAssignedIds(editTaskAssignedIds.filter(id => id !== u.id.toString()));
                                                    }
                                                  }}
                                                />
                                                <span>{u.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({u.title || (u.role === 'ENGINEER' ? 'Инженер' : 'Сборщик')})</span></span>
                                              </label>
                                            );
                                          })}
                                          {users.filter(u => u.isActive && u.role !== 'ADMIN').length === 0 && (
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Нет сотрудников.</div>
                                          )}
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                        <button type="submit" className="inline-btn" style={{ flex: 1, background: 'var(--accent-cyan)', color: '#000', borderColor: 'var(--accent-cyan)', padding: '4px' }}>Сохранить</button>
                                        <button type="button" className="inline-btn" style={{ flex: 1, padding: '4px' }} onClick={() => setEditingTaskId(null)}>Отмена</button>
                                      </div>
                                    </form>
                                  ) : (
                                    <>
                                      <div className="task-header">
                                        <span className="task-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          {task.name}
                                          {currentUser?.role === 'ADMIN' && (
                                            <>
                                              <button 
                                                onClick={() => startEditingTask(task)}
                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.6 }}
                                                title="Редактировать задачу"
                                              >
                                                ✏️
                                              </button>
                                              <button 
                                                onClick={() => handleDeleteTask(task.id)}
                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.6 }}
                                                title="Удалить задачу"
                                              >
                                                🗑️
                                              </button>
                                            </>
                                          )}
                                        </span>
                                        <span className={`badge ${task.status.toLowerCase()}`}>
                                          {task.status === 'PENDING' && 'Ожидает'}
                                          {task.status === 'IN_PROGRESS' && 'В работе'}
                                          {task.status === 'OTK' && 'В ОТК'}
                                          {task.status === 'BLOCKED' && 'Блок'}
                                          {task.status === 'DONE' && 'Готово'}
                                        </span>
                                      </div>
                                      {task.description && (
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 6px 0' }}>{task.description}</p>
                                      )}
                                      <div className="task-meta">
                                        <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                                          Исполнители: 
                                          {task.assignees && task.assignees.length > 0 ? (
                                            task.assignees.map(a => (
                                              <span 
                                                key={a.id} 
                                                className="badge done" 
                                                style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '2px 6px' }}
                                                title={a.title || a.role}
                                              >
                                                👤 {a.name}
                                              </span>
                                            ))
                                          ) : (
                                            <span style={{ color: 'var(--text-muted)' }}>Не назначен</span>
                                          )}
                                        </span>
                                      </div>
                                      {task.cost !== null && (
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                                          <span>Затраты на задачу:</span>
                                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{task.cost.toLocaleString('ru-RU')} ₸</span>
                                        </div>
                                      )}
                                      
                                      {/* Alert text inside task card */}
                                      {task.status === 'BLOCKED' && task.alerts.some(a => a.status === 'ACTIVE') && (
                                        <div style={{ color: '#ff3344', fontSize: '0.8rem', marginTop: '6px', fontWeight: 600 }}>
                                          ⚠️ Заблокировано: {alerts.find(a => a.taskId === task.id && a.status === 'ACTIVE')?.text || 'Не указано'}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              );
                            })}
                            {project.tasks.length === 0 && (
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                Задач пока нет.
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </article>
                  );
                })}
              </section>
            </>
          )}

          {activeTab === 'forms' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
              {/* Create Project Form */}
              <section className="form-card">
                <h2 className="form-title">📁 Создать Новый Проект</h2>
                <form onSubmit={handleCreateProject}>
                  <div className="form-group">
                    <label className="form-label">Название проекта</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Например: Модернизация шкафа управления" 
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Описание</label>
                    <textarea 
                      className="form-textarea" 
                      rows={3} 
                      placeholder="Подробное описание этапов, используемого оборудования..." 
                      value={projectDesc}
                      onChange={(e) => setProjectDesc(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Бюджет проекта (₸)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="Например: 5000000" 
                      value={projectBudget}
                      onChange={(e) => setProjectBudget(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Текущий этап</label>
                    <select 
                      className="form-select" 
                      value={projectStatus}
                      onChange={(e) => setProjectStatus(e.target.value)}
                    >
                      <option value="DESIGN">Проектирование (Схемы/Спецификации)</option>
                      <option value="PURCHASE">Закупка (Ожидание комплектующих)</option>
                      <option value="ASSEMBLY">Сборка щитового оборудования</option>
                      <option value="COMMISSIONING">Пусконаладка (ПНР)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Руководитель проекта (ГИП / Инженер)</label>
                    <select 
                      className="form-select" 
                      value={projectManagerId}
                      onChange={(e) => setProjectManagerId(e.target.value)}
                    >
                      <option value="">-- Выберите руководителя --</option>
                      {users.filter(u => u.isActive && (u.role === 'ADMIN' || u.role === 'ENGINEER')).map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.title || 'Руководитель'})</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="btn-submit">Создать проект</button>
                </form>
              </section>

              {/* Create Task Form */}
              <section className="form-card">
                <h2 className="form-title">🔧 Добавить Задачу в Проект</h2>
                <form onSubmit={handleCreateTask}>
                  <div className="form-group">
                    <label className="form-label">Выберите проект</label>
                    <select 
                      className="form-select" 
                      value={taskProjectId}
                      onChange={(e) => setTaskProjectId(e.target.value)}
                      required
                    >
                      <option value="">-- Выберите проект --</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Название задачи</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Например: Заливка ПО в Siemens S7-1200" 
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Описание задачи</label>
                    <textarea 
                      className="form-textarea" 
                      rows={2} 
                      placeholder="Что конкретно нужно сделать..." 
                      value={taskDesc}
                      onChange={(e) => setTaskDesc(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Стоимость/затраты на задачу (₸)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="Например: 150000" 
                      value={taskCost}
                      onChange={(e) => setTaskCost(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Назначить исполнителей (выберите одного или нескольких)</label>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      maxHeight: '180px',
                      overflowY: 'auto',
                      padding: '10px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px'
                    }}>
                      {users.filter(u => u.isActive && u.role !== 'ADMIN').map(u => {
                        const isChecked = taskAssignedIds.includes(u.id.toString());
                        return (
                          <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTaskAssignedIds([...taskAssignedIds, u.id.toString()]);
                                } else {
                                  setTaskAssignedIds(taskAssignedIds.filter(id => id !== u.id.toString()));
                                }
                              }}
                            />
                            <span>{u.name} <span style={{ color: 'var(--text-muted)' }}>({u.title || (u.role === 'ENGINEER' ? 'Инженер' : 'Сборщик')})</span></span>
                          </label>
                        );
                      })}
                      {users.filter(u => u.isActive && u.role !== 'ADMIN').length === 0 && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Нет доступных активных сотрудников.</div>
                      )}
                    </div>
                  </div>
                  <button type="submit" className="btn-submit">Добавить задачу</button>
                </form>
              </section>
            </div>
          )}

          {activeTab === 'alerts' && (
            <section className="alerts-list">
              <h2 style={{ marginBottom: '20px', fontWeight: 700 }}>⚠️ Активные предупреждения от ИИ и сотрудников</h2>
              {alerts.filter(a => a.status === 'ACTIVE').map((alert) => (
                <div key={alert.id} className="alert-card alert-pulse">
                  <div className="alert-info">
                    <div className="alert-title-row">
                      <span className="badge blocked">Проблема</span>
                      <span className="alert-task-name">{alert.task.name}</span>
                    </div>
                    <span className="alert-project-name">Проект: {alert.task.project.name}</span>
                    <p className="alert-text-content">{alert.text}</p>
                  </div>
                  <button 
                    className="alert-btn-resolve"
                    onClick={() => handleResolveAlert(alert.id)}
                  >
                    ✅ Решить проблему
                  </button>
                </div>
              ))}
              {alerts.filter(a => a.status === 'ACTIVE').length === 0 && (
                <div className="no-alerts">
                  🎉 Нет активных алертов. Все инженеры работают в штатном режиме!
                </div>
              )}
            </section>
          )}

          {activeTab === 'admin' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {/* Telegram Webhook & Onboarding Section */}
              <section className="form-card" style={{ border: '1px solid rgba(14, 165, 233, 0.3)', background: 'linear-gradient(180deg, rgba(14, 165, 233, 0.05) 0%, rgba(15, 23, 42, 0.6) 100%)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '15px' }}>
                  <div>
                    <h2 className="form-title" style={{ color: 'var(--accent-cyan)', marginBottom: '4px' }}>
                      🤖 Telegram Webhook & Внедрение для инженеров
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Серверный режим 24/7 на Vercel (0 серверов, мгновенные уведомления ГИПу о блокерах).
                    </p>
                  </div>
                  <button
                    onClick={handleConnectWebhook}
                    disabled={isConnectingWebhook}
                    className="inline-btn"
                    style={{
                      background: 'var(--accent-cyan)',
                      color: '#000',
                      borderColor: 'var(--accent-cyan)',
                      fontWeight: 700,
                      padding: '8px 16px',
                      fontSize: '0.9rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {isConnectingWebhook ? '⏳ Подключение...' : '🚀 Привязать Webhook к Vercel'}
                  </button>
                </div>

                {webhookLog && (
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      marginBottom: '15px',
                      fontSize: '0.85rem',
                      background: webhookLog.success ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      border: `1px solid ${webhookLog.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      color: webhookLog.success ? '#4ade80' : '#f87171',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                      {webhookLog.message || (webhookLog.success ? '✅ Webhook успешно настроен!' : '❌ Ошибка настройки')}
                    </div>
                    {webhookLog.configuredUrl && (
                      <div style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>
                        🔗 Webhook URL: <code>{webhookLog.configuredUrl}</code>
                      </div>
                    )}
                  </div>
                )}

                {/* Onboarding instructions template for engineers */}
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-orange)' }}>
                      📋 Текст-приглашение для чата проектировщиков / инженеров:
                    </span>
                    <button
                      onClick={handleCopyInvite}
                      className="inline-btn"
                      style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    >
                      {copiedInvite ? '✅ Скопировано!' : '📋 Скопировать текст'}
                    </button>
                  </div>
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: '#94a3b8',
                      fontSize: '0.82rem',
                      lineHeight: '1.45',
                      margin: 0,
                      fontFamily: 'inherit',
                    }}
                  >
                    {`👋 Коллеги, мы запустили систему управления задачами и фиксации блокеров в Telegram!\n\n1️⃣ Откройте бота: https://t.me/your_bot_username\n2️⃣ Нажмите /start и кнопку «📱 Поделиться контактом» (или отправьте свой номер телефона)\n3️⃣ Нажмите /tasks, чтобы увидеть текущие задачи и разделы\n\n💡 Если у вас возник блокер или задержка от смежников (АР, КР, ОВ, ВК, ЭОМ) — просто напишите текстом в бот (например: «Ждем подоснову от ОВ»), ИИ сам зафиксирует проблему и уведомит ГИПа!`}
                  </pre>
                </div>
              </section>

              {/* Add Employee Form */}
              <section className="form-card">
                <h2 className="form-title">👤 Добавить Сотрудника</h2>
                <form onSubmit={handleCreateUser} style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                  <div className="form-group" style={{ flex: '1 1 200px', marginBottom: '0px' }}>
                    <label className="form-label">ФИО сотрудника</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Например: Иванов Иван" 
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 200px', marginBottom: '0px' }}>
                    <label className="form-label">Номер телефона (для Telegram)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Например: +77071234567" 
                      value={newUserPhone}
                      onChange={(e) => setNewUserPhone(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 150px', marginBottom: '0px' }}>
                    <label className="form-label">Роль</label>
                    <select 
                      className="form-select" 
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      required
                    >
                      <option value="ADMIN">ГИП / Администратор</option>
                      <option value="ENGINEER">Инженер</option>
                      <option value="ASSEMBLER">Сборщик</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: '1 1 200px', marginBottom: '0px' }}>
                    <label className="form-label">Должность</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Например: Слесарь КИПиА" 
                      value={newUserTitle}
                      onChange={(e) => setNewUserTitle(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn-submit" style={{ alignSelf: 'flex-end', height: '42px', marginTop: '10px' }}>
                    Добавить сотрудника
                  </button>
                </form>
              </section>

              {/* Manage Employees Table */}
              <section className="form-card">
                <h2 className="form-title">⚙️ Список Сотрудников и Роли</h2>
                
                {/* CSV Import/Export Toolbar */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '15px' }}>
                  <button onClick={handleExportUsers} className="inline-btn" style={{ background: 'var(--accent-cyan)', color: '#000', borderColor: 'var(--accent-cyan)', padding: '6px 12px', fontSize: '0.82rem', fontWeight: 600 }}>
                    📥 Экспорт сотрудников (CSV)
                  </button>
                  <button onClick={handleExportTasks} className="inline-btn" style={{ background: 'var(--accent-cyan)', color: '#000', borderColor: 'var(--accent-cyan)', padding: '6px 12px', fontSize: '0.82rem', fontWeight: 600 }}>
                    📥 Экспорт всех задач (CSV)
                  </button>
                  <label className="inline-btn" style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.08)', padding: '6px 12px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', borderColor: 'rgba(255,255,255,0.2)' }}>
                    📤 Импорт из CSV (массовый)
                    <input 
                      type="file" 
                      accept=".csv" 
                      onChange={handleImportCSV} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '10px' }}>ФИО</th>
                        <th style={{ padding: '10px' }}>Телефон</th>
                        <th style={{ padding: '10px' }}>Должность</th>
                        <th style={{ padding: '10px' }}>Роль</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => {
                        const rowOpacity = u.isActive ? 1 : 0.55;
                        return (
                          <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: rowOpacity }}>
                            <td style={{ padding: '10px', fontWeight: 600 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {u.name}
                                {!u.isActive && <span className="badge blocked" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>Архив</span>}
                              </span>
                            </td>
                            <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{u.phone || '—'}</td>
                            <td style={{ padding: '10px' }}>{u.title || '—'}</td>
                            <td style={{ padding: '10px' }}>
                              <span className={`badge ${u.role.toLowerCase() === 'admin' ? 'design' : u.role.toLowerCase() === 'engineer' ? 'commissioning' : 'assembly'}`}>
                                {u.role === 'ADMIN' ? 'ГИП' : u.role === 'ENGINEER' ? 'Инженер' : 'Сборщик'}
                              </span>
                            </td>
                            <td style={{ padding: '10px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                              <button 
                                onClick={() => startEditingUser(u)} 
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '4px' }} 
                                title="Редактировать сотрудника"
                              >
                                ✏️
                              </button>
                              <button 
                                onClick={() => handleToggleUserActive(u)} 
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '4px' }} 
                                title={u.isActive ? "Архивировать сотрудника" : "Восстановить из архива"}
                              >
                                {u.isActive ? "📦" : "🔄"}
                              </button>
                              <button 
                                onClick={() => handleDeleteUser(u.id)} 
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '4px' }} 
                                title="Удалить сотрудника из системы"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* History Alerts Log */}
              <section className="form-card">
                <h2 className="form-title">📋 История алертов и задержек</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {alerts.map(a => (
                    <div key={a.id} className="alert-card" style={{ animation: 'none', borderColor: a.status === 'ACTIVE' ? '#ff3344' : 'var(--border-color)', opacity: a.status === 'ACTIVE' ? 1 : 0.65 }}>
                      <div className="alert-info">
                        <div className="alert-title-row">
                          <span className={`badge ${a.status === 'ACTIVE' ? 'blocked' : 'done'}`}>
                            {a.status === 'ACTIVE' ? 'Проблема' : 'Решена'}
                          </span>
                          <span className="alert-task-name">{a.task.name}</span>
                        </div>
                        <span className="alert-project-name">Проект: {a.task.project.name}</span>
                        <p className="alert-text-content">{a.text}</p>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Создано: {new Date(a.createdAt).toLocaleString('ru-RU')}
                        </span>
                      </div>
                      {a.status === 'ACTIVE' && (
                        <button className="alert-btn-resolve" onClick={() => handleResolveAlert(a.id)}>
                          ✅ Решить проблему
                        </button>
                      )}
                    </div>
                  ))}
                  {alerts.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                      История алертов пуста. Проблем на производстве не зафиксировано.
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* 2. Interactive Telegram Simulator Panel */}
      <aside className="simulator-panel">
        <div className="simulator-header">
          <h2 className="simulator-title">📱 Симулятор Telegram-Бота</h2>
          <p className="simulator-desc">Для тестирования логики инженеров в реальном времени</p>
        </div>

        {/* Dropdown controls */}
        <div className="sim-controls">
          <label className="sim-label">Выберите инженера:</label>
          <select 
            className="sim-select" 
            value={selectedPhone}
            onChange={(e) => handlePhoneChange(e.target.value)}
          >
            <option value="">-- Выберите сотрудника --</option>
            {users.filter(u => u.isActive).map(u => (
              <option key={u.id} value={u.phone}>
                {u.name} ({u.title || (u.role === 'ADMIN' ? 'ГИП' : u.role === 'ENGINEER' ? 'Инженер' : 'Сборщик')})
              </option>
            ))}
          </select>
          {selectedPhone && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
              <button 
                className="inline-btn" 
                style={{ flex: 1, padding: '4px', fontSize: '0.75rem' }}
                onClick={() => sendSimMessage('/tasks')}
              >
                📋 Задачи (/tasks)
              </button>
              <button 
                className="inline-btn" 
                style={{ flex: 1, padding: '4px', fontSize: '0.75rem' }}
                onClick={() => sendSimMessage('/start')}
              >
                🔄 Сброс бота (/start)
              </button>
            </div>
          )}
        </div>

        {/* Mock Phone Bezel */}
        <div className="phone-mockup">
          <div className="phone-notch"></div>
          <div className="phone-screen">
            {selectedPhone ? (
              <>
                {/* Chat window */}
                <div className="chat-messages">
                  {phoneMessages.map((msg, idx) => (
                    <div 
                      key={idx} 
                      className={`message-bubble ${msg.sender === 'user' ? 'sent' : 'received'}`}
                    >
                      {msg.text}

                      {/* Render bot keyboards */}
                      {msg.sender === 'bot' && msg.keyboard && msg.keyboard.inline_keyboard && (
                        <div className="inline-buttons-container">
                          {msg.keyboard.inline_keyboard.map((row, rIdx) => (
                            <div key={rIdx} style={{ display: 'flex', gap: '5px' }}>
                              {row.map((btn, bIdx) => (
                                <button
                                  key={bIdx}
                                  className="inline-btn"
                                  style={{ flex: 1 }}
                                  onClick={() => handleInlineClick(btn.callback_data, btn.text)}
                                >
                                  {btn.text}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {isAiLoading && (
                    <div className="message-bubble received" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontStyle: 'italic', color: 'var(--accent-cyan)' }}>
                      <span style={{ animation: 'blink 1.5s infinite' }}>🤖 Gemini AI анализирует отчет...</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input area */}
                <div className="chat-input-area">
                  <input
                    type="text"
                    className="chat-input"
                    placeholder="Наберите текст или отчет..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendSimMessage(inputText)}
                    disabled={isAiLoading}
                  />
                  <button 
                    className="send-btn"
                    onClick={() => sendSimMessage(inputText)}
                    disabled={isAiLoading}
                  >
                    ✈️
                  </button>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '3rem', marginBottom: '15px' }}>📱</span>
                <p>Выберите инженера в меню выше, чтобы активировать симулятор телефона.</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 3. Edit Employee Modal */}
      {showUserModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <div className="form-card" style={{
            width: '100%',
            maxWidth: '500px',
            margin: '20px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            border: '1px solid var(--border-color)',
            background: '#151b26'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h2 className="form-title" style={{ margin: 0, fontSize: '1.25rem' }}>👤 Редактировать Сотрудника</h2>
              <button 
                onClick={() => setShowUserModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveUserEdit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="form-group">
                <label className="form-label">ФИО сотрудника</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Номер телефона (для Telegram)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editUserPhone}
                  onChange={(e) => setEditUserPhone(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Должность</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editUserTitle}
                  onChange={(e) => setEditUserTitle(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Роль</label>
                <select 
                  className="form-select" 
                  value={editUserRole}
                  onChange={(e) => setEditUserRole(e.target.value)}
                  required
                >
                  <option value="ADMIN">ГИП / Администратор</option>
                  <option value="ENGINEER">Инженер</option>
                  <option value="ASSEMBLER">Сборщик</option>
                </select>
              </div>
              
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                <input 
                  type="checkbox" 
                  id="editUserIsActive"
                  checked={editUserIsActive}
                  onChange={(e) => setEditUserIsActive(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="editUserIsActive" style={{ cursor: 'pointer', userSelect: 'none', fontWeight: 500, fontSize: '0.9rem' }}>
                  Сотрудник активен (не в архиве)
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '15px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="inline-btn" 
                  style={{ padding: '8px 16px' }}
                  onClick={() => setShowUserModal(false)}
                >
                  Отмена
                </button>
                <button 
                  type="submit" 
                  className="btn-submit" 
                  style={{ width: 'auto', padding: '8px 20px', marginTop: 0 }}
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 4. Login Overlay Modal */}
      {showLoginModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 8, 16, 0.95)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
        }}>
          <div className="form-card" style={{
            width: '100%',
            maxWidth: '420px',
            margin: '20px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'linear-gradient(135deg, #111827 0%, #0b0f19 100%)',
            padding: '40px 30px',
            borderRadius: '16px',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', height: '60px', marginBottom: '20px' }}>
                <img 
                  src="/logo.png" 
                  alt="АзияЭнергоАвтоматика" 
                  style={{ 
                    maxHeight: '100%', 
                    width: 'auto', 
                    objectFit: 'contain'
                  }} 
                />
              </div>
              <h2 style={{ fontSize: '1.4rem', color: '#fff', fontWeight: 600, margin: '0 0 8px 0' }}>AE Project Manager</h2>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>Управление и мониторинг шкафов автоматики</p>
            </div>
            
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: '#94a3b8' }}>Введите пароль доступа</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Введите пароль..."
                  style={{ background: '#1f2937', color: '#fff', border: '1px solid #374151', height: '42px' }}
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    setLoginError('');
                  }}
                  required
                />
              </div>

              {loginError && (
                <div style={{ color: '#ff3344', fontSize: '0.82rem', fontWeight: 500, padding: '8px 12px', background: 'rgba(255, 51, 68, 0.1)', border: '1px solid rgba(255, 51, 68, 0.2)', borderRadius: '8px' }}>
                  ❌ {loginError}
                </div>
              )}

              <button 
                type="submit" 
                className="btn-submit" 
                style={{ 
                  width: '100%', 
                  background: 'linear-gradient(135deg, var(--accent-orange) 0%, #e06000 100%)', 
                  color: '#000', 
                  fontWeight: 700, 
                  height: '42px', 
                  fontSize: '0.95rem',
                  borderRadius: '8px',
                  boxShadow: '0 4px 14px rgba(224, 96, 0, 0.3)'
                }}
              >
                Войти в систему
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
