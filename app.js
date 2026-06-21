// ========== 数据层 ==========
const STORAGE_KEY = 'novel_tracker_books';
const VOTE_STORAGE_KEY = 'novel_tracker_votes';
const SPOILER_REVEAL_KEY = 'novel_tracker_spoiler_reveals';
const ANNOUNCEMENTS_KEY = 'novel_tracker_announcements';

function getBooks() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveBooks(books) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

function getUserVotes() {
    const data = localStorage.getItem(VOTE_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
}

function saveUserVote(bookId, voteType) {
    const votes = getUserVotes();
    votes[bookId] = voteType;
    localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(votes));
}

function getSpoilerReveals() {
    const data = localStorage.getItem(SPOILER_REVEAL_KEY);
    return data ? JSON.parse(data) : {};
}

function saveSpoilerReveal(bookId) {
    const reveals = getSpoilerReveals();
    reveals[bookId] = Date.now();
    localStorage.setItem(SPOILER_REVEAL_KEY, JSON.stringify(reveals));
}

function getAnnouncements() {
    const data = localStorage.getItem(ANNOUNCEMENTS_KEY);
    return data ? JSON.parse(data) : [];
}

function saveAnnouncement(announcement) {
    const announcements = getAnnouncements();
    announcements.unshift(announcement);
    if (announcements.length > 50) {
        announcements.length = 50;
    }
    localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(announcements));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ========== 排期计算 ==========
function getNextUpdateTime(book) {
    if (!book.scheduleType || book.scheduleType === 'none') {
        if (book.nextUpdate) {
            const date = new Date(book.nextUpdate);
            const [hours, minutes] = (book.scheduleTime || '14:00').split(':').map(Number);
            date.setHours(hours, minutes, 0, 0);
            if (date.getTime() > Date.now()) {
                return date;
            }
        }
        return null;
    }

    const now = new Date();
    const [hours, minutes] = (book.scheduleTime || '14:00').split(':').map(Number);

    if (book.scheduleType === 'daily') {
        const next = new Date(now);
        next.setHours(hours, minutes, 0, 0);
        if (next.getTime() <= now.getTime()) {
            next.setDate(next.getDate() + 1);
        }
        return next;
    }

    if (book.scheduleType === 'workday') {
        const next = new Date(now);
        next.setHours(hours, minutes, 0, 0);
        if (next.getTime() <= now.getTime()) {
            next.setDate(next.getDate() + 1);
        }
        while (next.getDay() === 0 || next.getDay() === 6) {
            next.setDate(next.getDate() + 1);
        }
        return next;
    }

    if (book.scheduleType === 'weekly') {
        const targetDay = parseInt(book.scheduleDay) || 0;
        const next = new Date(now);
        next.setHours(hours, minutes, 0, 0);
        const currentDay = next.getDay();
        let diff = targetDay - currentDay;
        if (diff < 0 || (diff === 0 && next.getTime() <= now.getTime())) {
            diff += 7;
        }
        next.setDate(next.getDate() + diff);
        return next;
    }

    if (book.scheduleType === 'custom') {
        if (book.nextUpdate) {
            const next = new Date(book.nextUpdate);
            next.setHours(hours, minutes, 0, 0);
            if (next.getTime() > now.getTime()) {
                return next;
            }
        }
        return null;
    }

    return null;
}

function isNextUpdateThisWeek(book) {
    const nextUpdate = getNextUpdateTime(book);
    if (!nextUpdate) return false;

    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + (6 - now.getDay()));
    weekEnd.setHours(23, 59, 59, 999);

    return nextUpdate.getTime() <= weekEnd.getTime();
}

function formatTimeUntilUpdate(book) {
    const nextUpdate = getNextUpdateTime(book);
    if (!nextUpdate) return '';

    const diff = nextUpdate.getTime() - Date.now();
    if (diff <= 0) return '即将更新';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
        return `${days}天${hours}小时后更新`;
    } else if (hours > 0) {
        return `${hours}小时${minutes}分钟后更新`;
    } else {
        return `${minutes}分钟后更新`;
    }
}

function getScheduleLabel(book) {
    const labels = {
        'none': '不定期',
        'daily': '日更',
        'workday': '工作日更',
        'weekly': '周更',
        'custom': '自定义'
    };
    return labels[book.scheduleType] || '不定期';
}

// ========== 日期工具 ==========
function isToday(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

function isThisWeek(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return date >= weekStart && date <= weekEnd;
}

function daysSinceUpdate(dateStr) {
    if (!dateStr) return 999;
    const date = new Date(dateStr);
    const today = new Date();
    const diffTime = Math.abs(today - date);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function isSpoilerWindowActive(book) {
    if (!book.lastUpdateTime || !book.spoilerHours || book.spoilerHours <= 0) {
        return false;
    }
    if (book.discussionStatus === 'open') {
        return false;
    }
    const updateTime = new Date(book.lastUpdateTime).getTime();
    const now = Date.now();
    const spoilerEnd = updateTime + book.spoilerHours * 60 * 60 * 1000;
    return now < spoilerEnd;
}

function getSpoilerRemainingTime(book) {
    if (!book.lastUpdateTime || !book.spoilerHours) return 0;
    const updateTime = new Date(book.lastUpdateTime).getTime();
    const now = Date.now();
    const spoilerEnd = updateTime + book.spoilerHours * 60 * 60 * 1000;
    return Math.max(0, spoilerEnd - now);
}

function formatSpoilerTime(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
        return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
}

function formatDate(dateStr) {
    if (!dateStr) return '未知';
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
}

function formatDateTime(dateStr) {
    if (!dateStr) return '未知';
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}月${day}日 ${hours}:${minutes}`;
}

function formatFullDateTime(dateStr) {
    if (!dateStr) return '未知';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// ========== 讨论状态 ==========
function getDiscussionStatusInfo(status) {
    const statusMap = {
        'spoiler-ban': { label: '🚫 禁剧透期', desc: '禁止讨论任何剧情', color: 'red' },
        'spoiler-limit': { label: '⚠️ 限剧透期', desc: '讨论需加剧透预警', color: 'yellow' },
        'open': { label: '✅ 已开放讨论', desc: '可自由讨论剧情', color: 'green' }
    };
    return statusMap[status] || statusMap['spoiler-ban'];
}

// ========== 分类逻辑 ==========
function categorizeBooks(books) {
    const today = [];
    const week = [];
    const watch = [];

    books.forEach(book => {
        if (book.status === 'hiatus') {
            watch.push(book);
            return;
        }

        if (isToday(book.lastUpdateTime) && book.updateConfirmed) {
            today.push(book);
            return;
        }

        if (isNextUpdateThisWeek(book) && book.status === 'ongoing' && !book.updateConfirmed) {
            week.push(book);
            return;
        }

        if (book.status === 'ongoing') {
            const days = daysSinceUpdate(book.lastUpdateTime);
            if (days >= 7 && days < 30) {
                watch.push(book);
            }
        }
    });

    const sortByUpdate = (a, b) => {
        const timeA = a.lastUpdateTime ? new Date(a.lastUpdateTime).getTime() : 0;
        const timeB = b.lastUpdateTime ? new Date(b.lastUpdateTime).getTime() : 0;
        return timeB - timeA;
    };

    const sortByNextUpdate = (a, b) => {
        const nextA = getNextUpdateTime(a);
        const nextB = getNextUpdateTime(b);
        const timeA = nextA ? nextA.getTime() : Infinity;
        const timeB = nextB ? nextB.getTime() : Infinity;
        return timeA - timeB;
    };

    today.sort(sortByUpdate);
    week.sort(sortByNextUpdate);
    watch.sort(sortByUpdate);

    return { today, week, watch };
}

// ========== 渲染层：看板 ==========
function renderBoard() {
    const books = getBooks();
    const { today, week, watch } = categorizeBooks(books);

    document.getElementById('stat-today-count').textContent = today.length;
    document.getElementById('stat-week-count').textContent = week.length;
    document.getElementById('stat-watch-count').textContent = watch.length;

    document.getElementById('today-count').textContent = `${today.length} 本`;
    document.getElementById('week-count').textContent = `${week.length} 本`;
    document.getElementById('watch-count').textContent = `${watch.length} 本`;

    renderBookList('today-list', today, 'today');
    renderBookList('week-list', week, 'week');
    renderBookList('watch-list', watch, 'watch');
}

function renderBookList(containerId, books, type) {
    const container = document.getElementById(containerId);

    if (books.length === 0) {
        let emptyText = '暂无书籍';
        if (containerId === 'today-list') emptyText = '今天还没有更新的书哦～';
        if (containerId === 'week-list') emptyText = '本周没有预计更新的书～';
        if (containerId === 'watch-list') emptyText = '没有在观察的断更书籍～';

        container.innerHTML = `<div class="empty-state"><p>${emptyText}</p></div>`;
        return;
    }

    container.innerHTML = books.map(book => createBookCardHTML(book, type)).join('');

    container.querySelectorAll('.book-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.spoiler-reveal-btn')) return;
            const bookId = card.dataset.bookId;
            openDetailModal(bookId);
        });
    });

    container.querySelectorAll('.spoiler-reveal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const bookId = btn.dataset.bookId;
            revealSpoiler(bookId);
        });
    });
}

function createBookCardHTML(book, type) {
    const userVotes = getUserVotes();
    const userVote = userVotes[book.id] || null;
    const spoilerActive = isSpoilerWindowActive(book);
    const reveals = getSpoilerReveals();
    const isRevealed = reveals[book.id] || false;
    const showSummary = !spoilerActive || isRevealed;

    const totalVotes = (book.votes?.read || 0) + (book.votes?.unread || 0) + (book.votes?.feeding || 0);

    const statusText = {
        'ongoing': '连载中',
        'completed': '已完结',
        'hiatus': '断更中'
    }[book.status] || '未知';

    const discussionInfo = getDiscussionStatusInfo(book.discussionStatus);

    let updateText = '';
    if (type === 'week') {
        updateText = formatTimeUntilUpdate(book);
    } else {
        const daysSince = daysSinceUpdate(book.lastUpdateTime);
        if (isToday(book.lastUpdateTime)) {
            updateText = '今天更新';
        } else if (daysSince === 1) {
            updateText = '昨天更新';
        } else if (daysSince < 7) {
            updateText = `${daysSince}天前更新`;
        } else {
            updateText = `最后更新: ${formatDate(book.lastUpdateTime)}`;
        }
    }

    let spoilerHTML = '';
    if (spoilerActive && !isRevealed) {
        const remaining = getSpoilerRemainingTime(book);
        spoilerHTML = `
            <div class="spoiler-warning">
                🔒 防剧透保护中 · 还有 ${formatSpoilerTime(remaining)} 解锁
                <button class="spoiler-reveal-btn" data-book-id="${book.id}">查看简介</button>
            </div>
        `;
    }

    const summaryClass = showSummary ? 'book-summary' : 'book-summary book-summary-hidden';

    const scheduleTag = (type === 'week' && book.scheduleType && book.scheduleType !== 'none')
        ? `<span class="book-tag schedule">📅 ${getScheduleLabel(book)}</span>`
        : '';

    const discussionTag = `<span class="book-tag discussion-${book.discussionStatus}">${discussionInfo.label}</span>`;

    const nextUpdateText = type === 'week' ? `<span class="next-update-time">⏰ ${updateText}</span>` : '';
    const lastUpdateText = type !== 'week' ? `<span class="update-time">🕒 ${updateText}</span>` : '';

    return `
        <div class="book-card" data-book-id="${book.id}">
            <div class="book-card-header">
                <div class="book-title-wrap">
                    <span class="book-title">${escapeHtml(book.title)}</span>
                    <span class="book-author">· ${escapeHtml(book.author)}</span>
                </div>
            </div>
            <div class="book-meta">
                ${book.platform ? `<span class="book-tag platform">${escapeHtml(book.platform)}</span>` : ''}
                <span class="book-tag status-${book.status}">${statusText}</span>
                ${scheduleTag}
                ${discussionTag}
            </div>
            <div class="book-chapter">📖 ${escapeHtml(book.latestChapter || '暂无章节信息')}</div>
            ${book.chapterSummary ? `<div class="${summaryClass}">${escapeHtml(book.chapterSummary)}</div>` : ''}
            ${spoilerHTML}
            <div class="book-footer">
                ${nextUpdateText}
                ${lastUpdateText}
                <div class="vote-stats-mini">
                    <span class="vote-stat-mini">📗 ${book.votes?.read || 0}</span>
                    <span class="vote-stat-mini">📕 ${book.votes?.unread || 0}</span>
                    <span class="vote-stat-mini">📚 ${book.votes?.feeding || 0}</span>
                </div>
            </div>
        </div>
    `;
}

// ========== 渲染层：管理后台 ==========
function renderAdminList() {
    const books = getBooks();
    const container = document.getElementById('admin-book-list');

    if (books.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>还没有添加任何书籍，点击上方按钮添加第一本吧～</p>
            </div>
        `;
        return;
    }

    const discussionInfo = (status) => getDiscussionStatusInfo(status);

    container.innerHTML = books.map(book => {
        const di = discussionInfo(book.discussionStatus);
        const nextUpdate = getNextUpdateTime(book);
        const nextUpdateText = nextUpdate ? formatDateTime(nextUpdate.toISOString()) : '无排期';

        return `
        <div class="admin-book-item">
            <div class="admin-book-info">
                <h3>
                    <span class="admin-discussion-badge ${book.discussionStatus}">${di.label}</span>
                    ${escapeHtml(book.title)}
                </h3>
                <p>${escapeHtml(book.author)} · ${escapeHtml(book.platform || '未知平台')} · ${{
                    'ongoing': '连载中',
                    'completed': '已完结',
                    'hiatus': '断更中'
                }[book.status] || '未知'}</p>
                <p style="margin-top:4px;">
                    最新: ${escapeHtml(book.latestChapter || '无')} 
                    · 更新: ${formatDate(book.lastUpdateTime)}
                    · 下次预计: ${nextUpdateText}
                </p>
                <p style="margin-top:4px;font-size:12px;color:#95a5a6;">
                    排期: ${getScheduleLabel(book)} · 防剧透: ${book.spoilerHours || 0}小时 · 投票: ${(book.votes?.read || 0) + (book.votes?.unread || 0) + (book.votes?.feeding || 0)}人
                </p>
            </div>
            <div class="admin-book-actions">
                <button class="btn btn-primary btn-small" onclick="openAnnouncementModal('${book.id}')">📢 群提醒</button>
                <button class="btn btn-warning btn-small" onclick="openDiscussionModal('${book.id}')">💬 讨论</button>
                <button class="btn btn-secondary btn-small" onclick="openEditBookModal('${book.id}')">✏️ 编辑</button>
                <button class="btn btn-danger btn-small" onclick="deleteBook('${book.id}')">🗑️ 删除</button>
            </div>
        </div>
    `}).join('');
}

// ========== 讨论管理 ==========
function openDiscussionModal(bookId) {
    const books = getBooks();
    const book = books.find(b => b.id === bookId);
    if (!book) return;

    const discussionInfo = getDiscussionStatusInfo(book.discussionStatus);
    const totalVotes = (book.votes?.read || 0) + (book.votes?.unread || 0) + (book.votes?.feeding || 0);
    const readPct = totalVotes > 0 ? Math.round((book.votes?.read || 0) / totalVotes * 100) : 0;

    const spoilerActive = isSpoilerWindowActive(book);
    const spoilerRemaining = spoilerActive ? formatSpoilerTime(getSpoilerRemainingTime(book)) : '已结束';

    const html = `
        <div class="detail-section">
            <h3 style="margin-bottom:12px;font-size:18px;">${escapeHtml(book.title)}</h3>
            <div class="discussion-status-bar ${book.discussionStatus}">
                <span class="status-label">当前状态：${discussionInfo.label}</span>
                <span style="font-size:12px;opacity:0.85;">${discussionInfo.desc}</span>
            </div>
        </div>

        <div class="detail-section">
            <div class="detail-section-title">📊 状态参考</div>
            <div style="background:#f8f9fa;padding:16px;border-radius:10px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                    <span style="font-size:13px;color:#5d6d7e;">已读完比例</span>
                    <span style="font-size:13px;font-weight:600;color:#27ae60;">${readPct}% (${book.votes?.read || 0}/${totalVotes}人)</span>
                </div>
                <div style="height:8px;background:#e8ecf0;border-radius:4px;overflow:hidden;">
                    <div style="height:100%;width:${readPct}%;background:linear-gradient(90deg, #27ae60, #2ecc71);border-radius:4px;transition:width 0.5s ease;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;margin-top:12px;">
                    <span style="font-size:13px;color:#5d6d7e;">防剧透倒计时</span>
                    <span style="font-size:13px;font-weight:600;color:${spoilerActive ? '#e67e22' : '#27ae60'};">${spoilerRemaining}</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <div class="detail-section-title">🎛️ 切换讨论状态</div>
            <div class="discussion-admin-controls">
                <button class="btn btn-danger btn-small" onclick="setDiscussionStatus('${book.id}', 'spoiler-ban')">
                    🚫 设为禁剧透
                </button>
                <button class="btn btn-warning btn-small" onclick="setDiscussionStatus('${book.id}', 'spoiler-limit')">
                    ⚠️ 设为限剧透
                </button>
                <button class="btn btn-success btn-small" onclick="setDiscussionStatus('${book.id}', 'open')">
                    ✅ 开放讨论
                </button>
            </div>
            <p style="font-size:12px;color:#95a5a6;margin-top:10px;">
                提示：可根据投票比例和防剧透时间，手动决定是否开放剧情讨论。
            </p>
        </div>
    `;

    document.getElementById('detail-title').textContent = '💬 讨论管理';
    document.getElementById('detail-body').innerHTML = html;
    document.getElementById('detail-modal').classList.add('active');
}

function setDiscussionStatus(bookId, status) {
    const books = getBooks();
    const book = books.find(b => b.id === bookId);
    if (!book) return;

    book.discussionStatus = status;
    saveBooks(books);

    openDiscussionModal(bookId);
    renderAll();
}

// ========== 书籍管理 ==========
function openAddBookModal() {
    document.getElementById('modal-title').textContent = '添加书籍';
    document.getElementById('book-form').reset();
    document.getElementById('book-id').value = '';
    document.getElementById('book-update-date').valueAsDate = new Date();
    document.getElementById('book-spoiler-hours').value = 24;
    document.getElementById('book-schedule-type').value = 'none';
    document.getElementById('book-schedule-day').value = '1';
    document.getElementById('book-schedule-time').value = '14:00';
    document.getElementById('book-discussion-status').value = 'spoiler-ban';
    document.getElementById('book-next-update').value = '';
    document.getElementById('book-modal').classList.add('active');
}

function openEditBookModal(bookId) {
    const books = getBooks();
    const book = books.find(b => b.id === bookId);
    if (!book) return;

    document.getElementById('modal-title').textContent = '编辑书籍';
    document.getElementById('book-id').value = book.id;
    document.getElementById('book-title').value = book.title;
    document.getElementById('book-author').value = book.author;
    document.getElementById('book-platform').value = book.platform || '';
    document.getElementById('book-status').value = book.status;
    document.getElementById('book-latest-chapter').value = book.latestChapter || '';
    document.getElementById('book-chapter-summary').value = book.chapterSummary || '';
    document.getElementById('book-spoiler-hours').value = book.spoilerHours || 24;
    document.getElementById('book-discussion-rule').value = book.discussionRule || '';
    document.getElementById('book-update-confirmed').checked = book.updateConfirmed || false;

    document.getElementById('book-schedule-type').value = book.scheduleType || 'none';
    document.getElementById('book-schedule-day').value = book.scheduleDay !== undefined ? book.scheduleDay : '1';
    document.getElementById('book-schedule-time').value = book.scheduleTime || '14:00';
    document.getElementById('book-discussion-status').value = book.discussionStatus || 'spoiler-ban';

    if (book.nextUpdate) {
        const date = new Date(book.nextUpdate);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        document.getElementById('book-next-update').value = `${year}-${month}-${day}`;
    } else {
        document.getElementById('book-next-update').value = '';
    }

    if (book.lastUpdateTime) {
        const date = new Date(book.lastUpdateTime);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        document.getElementById('book-update-date').value = `${year}-${month}-${day}`;
    } else {
        document.getElementById('book-update-date').valueAsDate = new Date();
    }

    document.getElementById('book-modal').classList.add('active');
}

function closeBookModal() {
    document.getElementById('book-modal').classList.remove('active');
}

function handleBookSubmit(e) {
    e.preventDefault();

    const bookId = document.getElementById('book-id').value;
    const updateDateStr = document.getElementById('book-update-date').value;
    const updateDate = updateDateStr ? new Date(updateDateStr) : new Date();
    updateDate.setHours(14, 0, 0, 0);

    const nextUpdateStr = document.getElementById('book-next-update').value;
    const nextUpdateDate = nextUpdateStr ? new Date(nextUpdateStr) : null;
    if (nextUpdateDate) {
        nextUpdateDate.setHours(0, 0, 0, 0);
    }

    const bookData = {
        title: document.getElementById('book-title').value.trim(),
        author: document.getElementById('book-author').value.trim(),
        platform: document.getElementById('book-platform').value.trim(),
        status: document.getElementById('book-status').value,
        latestChapter: document.getElementById('book-latest-chapter').value.trim(),
        chapterSummary: document.getElementById('book-chapter-summary').value.trim(),
        lastUpdateTime: updateDate.toISOString(),
        spoilerHours: parseInt(document.getElementById('book-spoiler-hours').value) || 24,
        discussionRule: document.getElementById('book-discussion-rule').value.trim(),
        updateConfirmed: document.getElementById('book-update-confirmed').checked,
        scheduleType: document.getElementById('book-schedule-type').value,
        scheduleDay: parseInt(document.getElementById('book-schedule-day').value),
        scheduleTime: document.getElementById('book-schedule-time').value,
        nextUpdate: nextUpdateDate ? nextUpdateDate.toISOString() : null,
        discussionStatus: document.getElementById('book-discussion-status').value
    };

    const books = getBooks();

    if (bookId) {
        const index = books.findIndex(b => b.id === bookId);
        if (index !== -1) {
            const oldVotes = books[index].votes || { read: 0, unread: 0, feeding: 0 };
            books[index] = { ...books[index], ...bookData, votes: oldVotes };
        }
    } else {
        books.push({
            id: generateId(),
            ...bookData,
            votes: { read: 0, unread: 0, feeding: 0 },
            createdAt: new Date().toISOString()
        });
    }

    saveBooks(books);
    closeBookModal();
    renderAll();
}

function deleteBook(bookId) {
    if (!confirm('确定要删除这本书吗？此操作不可撤销。')) return;

    let books = getBooks();
    books = books.filter(b => b.id !== bookId);
    saveBooks(books);
    renderAll();
}

// ========== 群提醒生成 ==========
function generateAnnouncement(book) {
    const updateDate = book.lastUpdateTime ? new Date(book.lastUpdateTime) : new Date();
    const month = updateDate.getMonth() + 1;
    const day = updateDate.getDate();
    const hours = updateDate.getHours().toString().padStart(2, '0');
    const minutes = updateDate.getMinutes().toString().padStart(2, '0');

    let announcement = '';

    announcement += '📢【更新通知】📢\n';
    announcement += '━━━━━━━━━━━━━━━\n';
    announcement += `📚 作品：《${book.title}》\n`;
    announcement += `✍️ 作者：${book.author}\n`;
    if (book.platform) {
        announcement += `🌐 平台：${book.platform}\n`;
    }
    announcement += `📖 最新章节：${book.latestChapter || '更新了'}\n`;
    announcement += `🕒 更新时间：${month}月${day}日 ${hours}:${minutes}\n`;

    if (book.discussionStatus === 'spoiler-ban') {
        announcement += `🚫 讨论状态：禁剧透期\n`;
    } else if (book.discussionStatus === 'spoiler-limit') {
        announcement += `⚠️ 讨论状态：限剧透期（需加剧透预警）\n`;
    } else {
        announcement += `✅ 讨论状态：已开放讨论\n`;
    }

    announcement += '━━━━━━━━━━━━━━━\n\n';

    if (book.spoilerHours && book.spoilerHours > 0) {
        announcement += `⚠️ 防剧透提醒：\n`;
        announcement += `   本章更新后 ${book.spoilerHours} 小时内为防剧透期\n`;
        announcement += `   讨论请使用剧透预警标签 或 开启折叠\n\n`;
    }

    if (book.chapterSummary) {
        if (book.spoilerHours && book.spoilerHours > 0) {
            announcement += '🔒 章节简介（含剧透，慎读）：\n';
            announcement += '【剧透预警】'.repeat(5) + '\n';
            announcement += book.chapterSummary + '\n';
            announcement += '【剧透结束】'.repeat(5) + '\n\n';
        } else {
            announcement += '📝 章节简介：\n';
            announcement += book.chapterSummary + '\n\n';
        }
    }

    if (book.discussionRule) {
        announcement += '📋 讨论规则：\n';
        announcement += book.discussionRule + '\n\n';
    }

    const discussTime = new Date(updateDate.getTime() + (book.spoilerHours || 24) * 60 * 60 * 1000);
    const discussMonth = discussTime.getMonth() + 1;
    const discussDay = discussTime.getDate();
    const discussHour = discussTime.getHours().toString().padStart(2, '0');

    announcement += `💬 预计开放全剧情讨论：${discussMonth}月${discussDay}日 ${discussHour}:00 后\n`;
    announcement += '\n';
    announcement += '祝大家阅读愉快！🎉';

    return announcement;
}

let currentAnnouncementBookId = null;

function openAnnouncementModal(bookId) {
    const books = getBooks();
    const book = books.find(b => b.id === bookId);
    if (!book) return;

    currentAnnouncementBookId = bookId;
    const announcement = generateAnnouncement(book);
    document.getElementById('announcement-preview').textContent = announcement;
    document.getElementById('copy-status').textContent = '';
    document.getElementById('announcement-modal').classList.add('active');
}

function closeAnnouncementModal() {
    document.getElementById('announcement-modal').classList.remove('active');
    currentAnnouncementBookId = null;
}

function copyAnnouncement() {
    const announcement = document.getElementById('announcement-preview').textContent;
    const statusEl = document.getElementById('copy-status');

    navigator.clipboard.writeText(announcement).then(() => {
        statusEl.textContent = '✅ 复制成功！';
        setTimeout(() => {
            statusEl.textContent = '';
        }, 2000);
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = announcement;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            statusEl.textContent = '✅ 复制成功！';
        } catch (e) {
            statusEl.textContent = '❌ 复制失败，请手动复制';
        }
        document.body.removeChild(textarea);
        setTimeout(() => {
            statusEl.textContent = '';
        }, 2000);
    });
}

function saveCurrentAnnouncement() {
    if (!currentAnnouncementBookId) return;

    const books = getBooks();
    const book = books.find(b => b.id === currentAnnouncementBookId);
    if (!book) return;

    const content = document.getElementById('announcement-preview').textContent;

    const announcement = {
        id: generateId(),
        bookId: book.id,
        bookTitle: book.title,
        chapter: book.latestChapter || '',
        content: content,
        discussionStatus: book.discussionStatus,
        createdAt: new Date().toISOString()
    };

    saveAnnouncement(announcement);

    const statusEl = document.getElementById('copy-status');
    statusEl.textContent = '💾 已保存到历史';
    setTimeout(() => {
        statusEl.textContent = '';
    }, 2000);
}

// ========== 公告历史 ==========
function openAnnouncementsHistoryModal() {
    const announcements = getAnnouncements();
    const container = document.getElementById('announcements-history-list');

    if (announcements.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>还没有保存的公告记录～</p>
            </div>
        `;
    } else {
        container.innerHTML = announcements.map(a => {
            const discussionInfo = getDiscussionStatusInfo(a.discussionStatus);
            return `
            <div class="announcement-history-item">
                <div class="announcement-history-header">
                    <span class="announcement-history-title">📚 《${escapeHtml(a.bookTitle)}》</span>
                    <span class="book-tag discussion-${a.discussionStatus}" style="font-size:11px;">${discussionInfo.label}</span>
                </div>
                <div class="announcement-history-meta">
                    <span>📖 ${escapeHtml(a.chapter || '未知章节')}</span>
                    <span>🕒 ${formatFullDateTime(a.createdAt)}</span>
                </div>
                <div class="announcement-history-preview">${escapeHtml(a.content)}</div>
                <div class="announcement-history-actions">
                    <button class="btn btn-secondary btn-small" onclick="copyAnnouncementContent('${a.id}')">📋 复制</button>
                    <button class="btn btn-danger btn-small" onclick="deleteAnnouncement('${a.id}')">🗑️ 删除</button>
                </div>
            </div>
        `}).join('');
    }

    document.getElementById('announcements-history-modal').classList.add('active');
}

function copyAnnouncementContent(announcementId) {
    const announcements = getAnnouncements();
    const announcement = announcements.find(a => a.id === announcementId);
    if (!announcement) return;

    navigator.clipboard.writeText(announcement.content).then(() => {
        alert('✅ 已复制到剪贴板！');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = announcement.content;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            alert('✅ 已复制到剪贴板！');
        } catch (e) {
            alert('❌ 复制失败，请手动复制');
        }
        document.body.removeChild(textarea);
    });
}

function deleteAnnouncement(announcementId) {
    if (!confirm('确定删除这条公告记录吗？')) return;

    let announcements = getAnnouncements();
    announcements = announcements.filter(a => a.id !== announcementId);
    localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(announcements));
    openAnnouncementsHistoryModal();
}

function closeAnnouncementsHistoryModal() {
    document.getElementById('announcements-history-modal').classList.remove('active');
}

// ========== 书籍详情与投票 ==========
function openDetailModal(bookId) {
    const books = getBooks();
    const book = books.find(b => b.id === bookId);
    if (!book) return;

    const userVotes = getUserVotes();
    const userVote = userVotes[bookId] || null;

    const totalVotes = (book.votes?.read || 0) + (book.votes?.unread || 0) + (book.votes?.feeding || 0);
    const readPct = totalVotes > 0 ? Math.round((book.votes?.read || 0) / totalVotes * 100) : 0;
    const unreadPct = totalVotes > 0 ? Math.round((book.votes?.unread || 0) / totalVotes * 100) : 0;
    const feedingPct = totalVotes > 0 ? Math.round((book.votes?.feeding || 0) / totalVotes * 100) : 0;

    const spoilerActive = isSpoilerWindowActive(book);
    const reveals = getSpoilerReveals();
    const isRevealed = reveals[bookId] || false;
    const showSummary = !spoilerActive || isRevealed;

    const statusText = {
        'ongoing': '连载中',
        'completed': '已完结',
        'hiatus': '断更中'
    }[book.status] || '未知';

    const discussionInfo = getDiscussionStatusInfo(book.discussionStatus);

    let spoilerTimerHTML = '';
    if (spoilerActive && !isRevealed) {
        const remaining = getSpoilerRemainingTime(book);
        spoilerTimerHTML = `
            <div class="spoiler-timer">
                🔒 防剧透保护中，还有 <strong>${formatSpoilerTime(remaining)}</strong> 自动解锁
                <button class="spoiler-reveal-btn" onclick="revealSpoiler('${bookId}')">我看完了，显示简介</button>
            </div>
        `;
    }

    const summaryClass = showSummary ? 'detail-summary' : 'detail-summary detail-summary-hidden';

    const voteReadClass = userVote === 'read' ? 'vote-option selected' : 'vote-option';
    const voteUnreadClass = userVote === 'unread' ? 'vote-option selected' : 'vote-option';
    const voteFeedingClass = userVote === 'feeding' ? 'vote-option selected' : 'vote-option';

    const nextUpdate = getNextUpdateTime(book);
    const nextUpdateText = nextUpdate ? `📅 下次更新：${formatDateTime(nextUpdate.toISOString())}（${formatTimeUntilUpdate(book)}）` : '📅 更新排期：不定期';

    const detailHTML = `
        <div class="detail-book-header">
            <div class="detail-book-title">${escapeHtml(book.title)}</div>
            <div class="detail-book-author">作者：${escapeHtml(book.author)}</div>
            <div class="detail-meta-row">
                ${book.platform ? `<span class="book-tag platform">${escapeHtml(book.platform)}</span>` : ''}
                <span class="book-tag status-${book.status}">${statusText}</span>
                <span class="book-tag discussion-${book.discussionStatus}">${discussionInfo.label}</span>
                ${book.scheduleType && book.scheduleType !== 'none' ? `<span class="book-tag schedule">📅 ${getScheduleLabel(book)}</span>` : ''}
            </div>
        </div>

        <div class="discussion-status-bar ${book.discussionStatus}">
            <span class="status-label">讨论状态：${discussionInfo.label}</span>
            <span style="font-size:12px;opacity:0.85;">${discussionInfo.desc}</span>
        </div>

        <div class="detail-section">
            <div class="detail-section-title">📖 最新章节</div>
            <div class="detail-chapter">${escapeHtml(book.latestChapter || '暂无章节信息')}</div>
            ${spoilerTimerHTML}
            ${book.chapterSummary ? `<div class="${summaryClass}">${escapeHtml(book.chapterSummary)}</div>` : '<p style="color:#95a5a6;font-size:13px;">暂无章节简介</p>'}
            <p style="font-size:12px;color:#95a5a6;margin-top:8px;">🕒 更新时间：${formatDateTime(book.lastUpdateTime)}</p>
            <p style="font-size:12px;color:#3498db;margin-top:4px;">${nextUpdateText}</p>
        </div>

        ${book.discussionRule ? `
        <div class="detail-section">
            <div class="detail-section-title">📋 讨论规则</div>
            <div class="detail-rule">${escapeHtml(book.discussionRule)}</div>
        </div>
        ` : ''}

        <div class="detail-section">
            <div class="detail-section-title">🗳️ 读者进度投票</div>
            <div class="vote-section">
                <p style="font-size:13px;color:#5d6d7e;margin-bottom:4px;">你目前的阅读状态是？</p>
                <div class="vote-options">
                    <div class="${voteReadClass}" onclick="castVote('${bookId}', 'read')">
                        <div class="vote-option-icon">📗</div>
                        <div class="vote-option-label">已读完</div>
                    </div>
                    <div class="${voteUnreadClass}" onclick="castVote('${bookId}', 'unread')">
                        <div class="vote-option-icon">📕</div>
                        <div class="vote-option-label">还没看</div>
                    </div>
                    <div class="${voteFeedingClass}" onclick="castVote('${bookId}', 'feeding')">
                        <div class="vote-option-icon">📚</div>
                        <div class="vote-option-label">养肥中</div>
                    </div>
                </div>
                <div class="vote-results">
                    <div class="vote-result-bar">
                        <span class="vote-result-label">已读完</span>
                        <div class="vote-result-track">
                            <div class="vote-result-fill read" style="width: ${readPct}%;">
                                ${readPct >= 15 ? `<span class="vote-result-count">${book.votes?.read || 0}人</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="vote-result-bar">
                        <span class="vote-result-label">还没看</span>
                        <div class="vote-result-track">
                            <div class="vote-result-fill unread" style="width: ${unreadPct}%;">
                                ${unreadPct >= 15 ? `<span class="vote-result-count">${book.votes?.unread || 0}人</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="vote-result-bar">
                        <span class="vote-result-label">养肥中</span>
                        <div class="vote-result-track">
                            <div class="vote-result-fill feeding" style="width: ${feedingPct}%;">
                                ${feedingPct >= 15 ? `<span class="vote-result-count">${book.votes?.feeding || 0}人</span>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="vote-total">共 ${totalVotes} 人参与投票</div>
            </div>
        </div>
    `;

    document.getElementById('detail-title').textContent = '书籍详情';
    document.getElementById('detail-body').innerHTML = detailHTML;
    document.getElementById('detail-modal').classList.add('active');
}

function closeDetailModal() {
    document.getElementById('detail-modal').classList.remove('active');
}

function castVote(bookId, voteType) {
    const books = getBooks();
    const book = books.find(b => b.id === bookId);
    if (!book) return;

    if (!book.votes) {
        book.votes = { read: 0, unread: 0, feeding: 0 };
    }

    const userVotes = getUserVotes();
    const previousVote = userVotes[bookId];

    if (previousVote === voteType) {
        return;
    }

    if (previousVote && book.votes[previousVote] > 0) {
        book.votes[previousVote]--;
    }

    book.votes[voteType]++;

    saveUserVote(bookId, voteType);
    saveBooks(books);

    openDetailModal(bookId);
    renderBoard();
}

function revealSpoiler(bookId) {
    saveSpoilerReveal(bookId);
    openDetailModal(bookId);
    renderBoard();
}

// ========== 工具函数 ==========
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== 视图切换 ==========
function switchView(viewName) {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === viewName);
    });

    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    document.getElementById(`${viewName}-view`).classList.add('active');

    if (viewName === 'board') {
        renderBoard();
    } else if (viewName === 'admin') {
        renderAdminList();
    }
}

// ========== 渲染所有 ==========
function renderAll() {
    renderBoard();
    renderAdminList();
}

// ========== 数据迁移 ==========
function migrateData() {
    const books = getBooks();
    if (books.length === 0) return;

    let migrated = false;
    books.forEach(book => {
        if (book.scheduleType === undefined) {
            book.scheduleType = 'none';
            book.scheduleDay = 1;
            book.scheduleTime = '14:00';
            book.nextUpdate = null;
            migrated = true;
        }
        if (book.discussionStatus === undefined) {
            if (book.spoilerHours && book.spoilerHours > 0 && isSpoilerWindowActive(book)) {
                book.discussionStatus = 'spoiler-ban';
            } else {
                book.discussionStatus = 'open';
            }
            migrated = true;
        }
        if (book.votes === undefined) {
            book.votes = { read: 0, unread: 0, feeding: 0 };
            migrated = true;
        }
    });

    if (migrated) {
        saveBooks(books);
    }
}

// ========== 示例数据 ==========
function initSampleData() {
    const existing = getBooks();
    if (existing.length > 0) return;

    const now = new Date();
    const today = new Date(now);
    today.setHours(10, 30, 0, 0);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(15, 0, 0, 0);

    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(20, 0, 0, 0);

    const tenDaysAgo = new Date(now);
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    tenDaysAgo.setHours(18, 0, 0, 0);

    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    twoWeeksAgo.setHours(12, 0, 0, 0);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);

    const dayAfterTomorrow = new Date(now);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    dayAfterTomorrow.setHours(10, 0, 0, 0);

    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 5);
    nextWeek.setHours(20, 0, 0, 0);

    const sampleBooks = [
        {
            id: generateId(),
            title: '道诡异仙',
            author: '狐尾的笔',
            platform: '起点中文网',
            status: 'ongoing',
            latestChapter: '第1245章 彼岸花开',
            chapterSummary: '李火旺终于到达了传说中的彼岸，却发现这里并非想象中的仙境。彼岸花盛开的深处，隐藏着一个惊天秘密，与他的身世息息相关...',
            lastUpdateTime: today.toISOString(),
            spoilerHours: 24,
            discussionRule: '更新后24小时内禁止剧透正文，讨论请加【剧透预警】开头，关键情节请使用折叠功能。',
            updateConfirmed: true,
            scheduleType: 'daily',
            scheduleDay: 1,
            scheduleTime: '14:00',
            nextUpdate: null,
            discussionStatus: 'spoiler-ban',
            votes: { read: 28, unread: 15, feeding: 7 },
            createdAt: twoWeeksAgo.toISOString()
        },
        {
            id: generateId(),
            title: '深空彼岸',
            author: '辰东',
            platform: '起点中文网',
            status: 'ongoing',
            latestChapter: '第892章 神话再现',
            chapterSummary: '王煊在旧土深处发现了一座上古神殿，壁画上记载着失落的神话时代。当他触碰神殿中央的石台时，沉睡的意志开始苏醒...',
            lastUpdateTime: yesterday.toISOString(),
            spoilerHours: 12,
            discussionRule: '更新后12小时内禁止在群内讨论关键剧情，可开专楼讨论。',
            updateConfirmed: true,
            scheduleType: 'daily',
            scheduleDay: 1,
            scheduleTime: '10:00',
            nextUpdate: null,
            discussionStatus: 'spoiler-limit',
            votes: { read: 42, unread: 23, feeding: 12 },
            createdAt: twoWeeksAgo.toISOString()
        },
        {
            id: generateId(),
            title: '我的26岁女房客',
            author: '超级大坦克科比',
            platform: '番茄小说',
            status: 'ongoing',
            latestChapter: '第567章 雨夜的告白',
            chapterSummary: '雨夜，昭阳和米彩在屋檐下避雨。两人之间的气氛变得微妙，米彩终于鼓起勇气问出了那个藏在心底很久的问题...',
            lastUpdateTime: threeDaysAgo.toISOString(),
            spoilerHours: 6,
            discussionRule: '都市情感文，大家文明讨论，不要站队互撕。',
            updateConfirmed: true,
            scheduleType: 'workday',
            scheduleDay: 1,
            scheduleTime: '20:00',
            nextUpdate: null,
            discussionStatus: 'open',
            votes: { read: 16, unread: 34, feeding: 8 },
            createdAt: tenDaysAgo.toISOString()
        },
        {
            id: generateId(),
            title: '雪中悍刀行',
            author: '烽火戏诸侯',
            platform: '纵横中文网',
            status: 'completed',
            latestChapter: '最终章 江湖再见',
            chapterSummary: '徐凤年终于完成了所有的使命，选择了自己真正想要的生活。江湖路远，后会有期。',
            lastUpdateTime: twoWeeksAgo.toISOString(),
            spoilerHours: 0,
            discussionRule: '已完结作品，可自由讨论，但请尊重不同观点。',
            updateConfirmed: true,
            scheduleType: 'none',
            scheduleDay: 1,
            scheduleTime: '14:00',
            nextUpdate: null,
            discussionStatus: 'open',
            votes: { read: 89, unread: 12, feeding: 5 },
            createdAt: twoWeeksAgo.toISOString()
        },
        {
            id: generateId(),
            title: '某美漫的超级英雄',
            author: '迷路的小鱼',
            platform: '起点中文网',
            status: 'hiatus',
            latestChapter: '第234章 纽约之战',
            chapterSummary: '',
            lastUpdateTime: tenDaysAgo.toISOString(),
            spoilerHours: 24,
            discussionRule: '',
            updateConfirmed: false,
            scheduleType: 'weekly',
            scheduleDay: 6,
            scheduleTime: '22:00',
            nextUpdate: null,
            discussionStatus: 'spoiler-ban',
            votes: { read: 8, unread: 25, feeding: 18 },
            createdAt: tenDaysAgo.toISOString()
        },
        {
            id: generateId(),
            title: '修仙界的理工男',
            author: '布衫',
            platform: '起点中文网',
            status: 'ongoing',
            latestChapter: '第312章 阵法的数学原理',
            chapterSummary: '陈默用现代数学重新解析了古代阵法，发现了其中的规律。他决定用这个原理，构建一个前所未有的超级大阵...',
            lastUpdateTime: today.toISOString(),
            spoilerHours: 24,
            discussionRule: '脑洞文，欢迎讨论技术细节，但请勿杠现实可行性。',
            updateConfirmed: true,
            scheduleType: 'weekly',
            scheduleDay: 3,
            scheduleTime: '14:00',
            nextUpdate: null,
            discussionStatus: 'spoiler-ban',
            votes: { read: 19, unread: 8, feeding: 22 },
            createdAt: threeDaysAgo.toISOString()
        },
        {
            id: generateId(),
            title: '大奉打更人',
            author: '卖报小郎君',
            platform: '起点中文网',
            status: 'ongoing',
            latestChapter: '第456章 案发现场',
            chapterSummary: '',
            lastUpdateTime: threeDaysAgo.toISOString(),
            spoilerHours: 24,
            discussionRule: '悬疑推理文，严禁剧透凶手身份。',
            updateConfirmed: false,
            scheduleType: 'daily',
            scheduleDay: 1,
            scheduleTime: '12:00',
            nextUpdate: tomorrow.toISOString(),
            discussionStatus: 'open',
            votes: { read: 35, unread: 20, feeding: 15 },
            createdAt: tenDaysAgo.toISOString()
        },
        {
            id: generateId(),
            title: '诡秘之主',
            author: '爱潜水的乌贼',
            platform: '起点中文网',
            status: 'ongoing',
            latestChapter: '第200章 占卜家',
            chapterSummary: '',
            lastUpdateTime: yesterday.toISOString(),
            spoilerHours: 48,
            discussionRule: '克苏鲁风格，讨论请适度，不要过度解读。',
            updateConfirmed: false,
            scheduleType: 'weekly',
            scheduleDay: 5,
            scheduleTime: '19:00',
            nextUpdate: dayAfterTomorrow.toISOString(),
            discussionStatus: 'spoiler-limit',
            votes: { read: 56, unread: 30, feeding: 25 },
            createdAt: twoWeeksAgo.toISOString()
        }
    ];

    saveBooks(sampleBooks);
}

// ========== 初始化 ==========
function init() {
    migrateData();
    initSampleData();

    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchView(tab.dataset.view);
        });
    });

    document.getElementById('add-book-btn').addEventListener('click', openAddBookModal);
    document.getElementById('modal-close').addEventListener('click', closeBookModal);
    document.getElementById('modal-cancel').addEventListener('click', closeBookModal);
    document.getElementById('book-form').addEventListener('submit', handleBookSubmit);

    document.getElementById('announcement-close').addEventListener('click', closeAnnouncementModal);
    document.getElementById('copy-announcement-btn').addEventListener('click', copyAnnouncement);
    document.getElementById('save-announcement-btn').addEventListener('click', saveCurrentAnnouncement);

    document.getElementById('detail-close').addEventListener('click', closeDetailModal);

    document.getElementById('view-announcements-history-btn').addEventListener('click', openAnnouncementsHistoryModal);
    document.getElementById('announcements-history-close').addEventListener('click', closeAnnouncementsHistoryModal);

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    renderAll();

    setInterval(() => {
        if (document.getElementById('board-view').classList.contains('active')) {
            renderBoard();
        }
    }, 60000);
}

document.addEventListener('DOMContentLoaded', init);
