// Application State
let tasks = [];
let isProcessing = false;

// Sample tasks
const SAMPLE_TASKS = [
    "Fix the login bug that users reported yesterday urgent",
    "Meeting with client about new homepage design next week", 
    "Update database schema for user profiles",
    "Review pull requests from frontend team before deployment",
    "Call Sarah about budget approval for Q4 marketing campaign",
    "Test mobile responsiveness on new product pages",
    "Documentation needs updating for API endpoints",
    "Backup server maintenance scheduled for weekend"
];

// DOM Elements
const taskInput = document.getElementById('task-input');
const taskCount = document.getElementById('task-count');
const loadSampleBtn = document.getElementById('load-sample-btn');
const processBtn = document.getElementById('process-btn');
const processBtnMain = document.getElementById('process-btn-main');
const exportBtn = document.getElementById('export-btn');
const exportBtnMain = document.getElementById('export-btn-main');
const clearBtn = document.getElementById('clear-btn');
const priorityScale = document.getElementById('priority-scale');
const maxTags = document.getElementById('max-tags');
const includeTimeEstimates = document.getElementById('include-time-estimates');
const tasksContainer = document.getElementById('tasks-container');
const statsContainer = document.getElementById('stats-container');
const lastUpdated = document.getElementById('last-updated');
const loadingOverlay = document.getElementById('loading-overlay');
const toastContainer = document.getElementById('toast-container');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Load sample tasks initially
    taskInput.value = SAMPLE_TASKS.join('\n');
    updateTaskCount();
    
    // Load existing tasks
    loadTasks();
    loadStats();
    
    // Event listeners
    taskInput.addEventListener('input', updateTaskCount);
    loadSampleBtn.addEventListener('click', loadSampleTasks);
    processBtn.addEventListener('click', processTasks);
    processBtnMain.addEventListener('click', processTasks);
    exportBtn.addEventListener('click', exportTasks);
    exportBtnMain.addEventListener('click', exportTasks);
    clearBtn.addEventListener('click', clearTasks);
});

// Utility Functions
function updateTaskCount() {
    const taskLines = taskInput.value.split('\n').filter(task => task.trim() !== '');
    taskCount.textContent = `${taskLines.length} tasks detected`;
}

function loadSampleTasks() {
    taskInput.value = SAMPLE_TASKS.join('\n');
    updateTaskCount();
}

function showToast(title, message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function showLoading() {
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

function updateButtonStates() {
    const hasTasks = tasks.length > 0;
    exportBtn.disabled = !hasTasks;
    exportBtnMain.disabled = !hasTasks;
    clearBtn.disabled = !hasTasks;
}

// API Functions
async function apiRequest(method, endpoint, data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    const response = await fetch(endpoint, options);
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
    }
    
    return response;
}

async function processTasks() {
    if (isProcessing) return;
    
    const taskLines = taskInput.value.split('\n').filter(task => task.trim() !== '');
    
    if (taskLines.length === 0) {
        showToast('No tasks to process', 'Please add some task descriptions first.', 'error');
        return;
    }
    
    if (taskLines.length > 20) {
        showToast('Too many tasks', 'Please limit to 20 tasks or fewer.', 'error');
        return;
    }
    
    isProcessing = true;
    showLoading();
    
    try {
        const response = await apiRequest('POST', '/api/tasks/process', {
            rawTasks: taskLines,
            priorityScale: priorityScale.value,
            maxTags: parseInt(maxTags.value),
            includeTimeEstimates: includeTimeEstimates.checked
        });
        
        const result = await response.json();
        tasks = result.tasks;
        
        renderTasks();
        loadStats();
        updateButtonStates();
        
        lastUpdated.textContent = `Last updated: ${new Date().toLocaleString()}`;
        showToast('Tasks processed successfully', 'Your tasks have been analyzed and organized by AI.');
        
    } catch (error) {
        showToast('Processing failed', error.message, 'error');
    } finally {
        isProcessing = false;
        hideLoading();
    }
}

async function loadTasks() {
    try {
        const response = await apiRequest('GET', '/api/tasks');
        const result = await response.json();
        tasks = result.tasks;
        renderTasks();
        updateButtonStates();
    } catch (error) {
        console.error('Failed to load tasks:', error);
    }
}

async function loadStats() {
    try {
        const response = await apiRequest('GET', '/api/tasks/stats');
        const stats = await response.json();
        renderStats(stats);
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

async function exportTasks() {
    try {
        const response = await fetch('/api/tasks/export');
        if (!response.ok) throw new Error('Export failed');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'processed-tasks.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        showToast('Export successful', 'Tasks have been exported to CSV.');
    } catch (error) {
        showToast('Export failed', 'Failed to export tasks to CSV.', 'error');
    }
}

async function clearTasks() {
    if (!confirm('Are you sure you want to clear all tasks?')) return;
    
    try {
        await apiRequest('DELETE', '/api/tasks');
        tasks = [];
        renderTasks();
        loadStats();
        updateButtonStates();
        lastUpdated.textContent = '';
        showToast('Tasks cleared', 'All tasks have been removed.');
    } catch (error) {
        showToast('Clear failed', error.message, 'error');
    }
}

// Rendering Functions
function renderTasks() {
    if (tasks.length === 0) {
        tasksContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-magic"></i>
                </div>
                <h3>No processed tasks yet</h3>
                <p>Add some tasks above and click "Process Tasks" to get started.</p>
            </div>
        `;
        return;
    }
    
    tasksContainer.innerHTML = tasks.map(task => {
        const priorityBadge = getPriorityBadge(task.priority);
        const tagBadges = task.tags.map(tag => `<span class="badge tag">#${tag}</span>`).join('');
        const timeEstimate = task.timeEstimate ? `<div class="task-time">Estimated time: ${task.timeEstimate}</div>` : '';
        
        return `
            <div class="task-item">
                <div class="task-header">
                    <div class="task-badges">
                        ${priorityBadge}
                        ${tagBadges}
                    </div>
                </div>
                <div class="task-title">${task.summary}</div>
                <div class="task-original">Original: "${task.rawText}"</div>
                ${timeEstimate}
            </div>
        `;
    }).join('');
}

function renderStats(stats) {
    const statsGrid = statsContainer.querySelector('.stats-grid');
    if (!statsGrid) return;
    
    const statItems = statsGrid.querySelectorAll('.stat-item');
    
    statItems[0].querySelector('.stat-value').textContent = stats.highPriority;
    statItems[1].querySelector('.stat-value').textContent = stats.mediumPriority;
    statItems[2].querySelector('.stat-value').textContent = stats.lowPriority;
    statItems[3].querySelector('.stat-value').textContent = stats.totalEstimatedTime;
}

function getPriorityBadge(priority) {
    let className, label;
    
    if (priority >= 4) {
        className = 'priority-high';
        label = `Priority ${priority}`;
    } else if (priority === 3) {
        className = 'priority-medium';
        label = `Priority ${priority}`;
    } else {
        className = 'priority-low';
        label = `Priority ${priority}`;
    }
    
    return `<span class="badge ${className}">${label}</span>`;
}

function renderLoadingTasks() {
    tasksContainer.innerHTML = `
        ${[1, 2, 3].map(() => `
            <div class="loading-skeleton">
                <div class="skeleton-badges">
                    <div class="skeleton-badge" style="width: 4rem;"></div>
                    <div class="skeleton-badge" style="width: 3rem;"></div>
                </div>
                <div class="skeleton-title"></div>
                <div class="skeleton-text"></div>
            </div>
        `).join('')}
    `;
}