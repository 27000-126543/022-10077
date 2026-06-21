// ========== 数据层 ==========
const STORAGE_KEY = 'novel_tracker_books';
const VOTE_STORAGE_KEY = 'novel_tracker_votes';
const SPOILER_REVEAL_KEY = 'novel_tracker_spoiler_reveals_v2';
const ANNOUNCEMENTS_KEY = 'novel_tracker_announcements_v2';
const MY_BOOKS_KEY = 'novel_tracker_my_books_v1';
const ANNOUNCEMENT_COPIED_FLAG = 'novel_tracker_copied_chapters_v1';

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

function getChapterKey(book) {
    return `${book.id}__${book.latestChapter || 'no_chapter'}`;
}

function isChapterRevealed(book) {
    const reveals = getSpoilerReveals();
    return reveals[getChapterKey(book)] === true;
}

function saveChapterReveal(book) {
    const reveals = getSpoilerReveals();
    reveals[getChapterKey(book)] = true;
    localStorage.setItem(SPOILER_REVEAL_KEY, JSON.stringify(reveals));
}

function getAnnouncements() {
    const data = localStorage.getItem(ANNOUNCEMENTS_KEY);
    return data ? JSON.parse(data) : [];
}

function saveAnnouncement(announcement) {
    const announcements = getAnnouncements();
    announcements.unshift(announcement);
    if (announcements.length > 100) {
        announcements.length = 100;
    }
    localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(announcements));
}

function updateAnnouncement(id, updates) {
    const announcements = getAnnouncements();
    const idx = announcements.findIndex(a => a.id === id);
    if (idx !== -1) {
        announcements[idx] = { ...announcements[idx], ...updates };
        localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(announcements));
    }
}

function deleteAnnouncementFromStorage(id) {
    let announcements = getAnnouncements();
    announcements = announcements.filter(a => a.id !== id);
    localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(announcements));
}

function getMyBooks() {
    const data = localStorage.getItem(MY_BOOKS_KEY);
    return data ? JSON.parse(data) : {};
}

function getMyBookStatus(bookId) {
    const myBooks = getMyBooks();
    return myBooks[bookId] || null;
}

function saveMyBookStatus(bookId, status) {
    const myBooks = getMyBooks();
    if (status) {
        const existing = myBooks[bookId] || {};
        myBooks[bookId] = { ...existing, status, updatedAt: new Date().toISOString() };
    } else {
        delete myBooks[bookId];
    }
    localStorage.setItem(MY_BOOKS_KEY, JSON.stringify(myBooks));
}

function saveMyBookNote(bookId, note) {
    const myBooks = getMyBooks();
    if (!myBooks[bookId]) {
        myBooks[bookId] = { status: null, updatedAt: new Date().toISOString() };
    }
    myBooks[bookId].note = note || '';
    localStorage.setItem(MY_BOOKS_KEY, JSON.stringify(myBooks));
}

function saveMyBookReminder(bookId, reminderTime) {
    const myBooks = getMyBooks();
    if (!myBooks[bookId]) {
        myBooks[bookId] = { status: null, updatedAt: new Date().toISOString() };
    }
    myBooks[bookId].reminderTime = reminderTime || '';
    localStorage.setItem(MY_BOOKS_KEY, JSON.stringify(myBooks));
}

function getMyStatusInfo(status) {
    const statusMap = {
        'reading': { label: '正在追', icon: '🔄', class: 'reading' },
        'waiting': { label: '攒着看', icon: '⏳', class: 'waiting' },
        'dropped': { label: '暂时弃坑', icon: '💤', class: 'dropped' }
    };
    return statusMap[status] || null;
}

function getCopiedChapters() {
    const data = localStorage.getItem(ANNOUNCEMENT_COPIED_FLAG);
    return data ? JSON.parse(data) : {};
}

function markChapterCopied(book, content) {
    const copied = getCopiedChapters();
    const chapterKey = getChapterKey(book);
    copied[chapterKey] = {
        bookId: book.id,
        bookName: book.title || book.name || '',
        chapter: book.latestChapter,
        discussionStatus: book.discussionStatus || 'spoiler-ban',
        copiedAt: new Date().toISOString(),
        content: content
    };
    localStorage.setItem(ANNOUNCEMENT_COPIED_FLAG, JSON.stringify(copied));

    const announcements = getAnnouncements();
    const existing = announcements.find(a =>
        a.bookId === book.id && a.chapter === book.latestChapter
    );
    if (!existing) {
        const autoAnnouncement = {
            id: generateId(),
            bookId: book.id,
            bookTitle: book.title || book.name || '',
            chapter: book.latestChapter,
            summary: book.chapterSummary || book.summary || '',
            content: content,
            discussionStatus: book.discussionStatus || 'spoiler-ban',
            copiedCount: 1,
            savedCount: 0,
            lastCopiedAt: new Date().toISOString(),
            lastSavedAt: null,
            createdAt: new Date().toISOString(),
            autoSaved: true
        };
        saveAnnouncement(autoAnnouncement);
    } else {
        updateAnnouncement(existing.id, {
            copiedCount: (existing.copiedCount || 0) + 1,
            lastCopiedAt: new Date().toISOString(),
            bookTitle: book.title || existing.bookTitle,
            discussionStatus: book.discussionStatus || existing.discussionStatus,
            content: content
        });
    }
}

function isChapterCopied(book) {
    const copied = getCopiedChapters();
    return !!copied[getChapterKey(book)];
}

function ensureChapterHistory(book) {
    if (!book.chapterHistory) {
        book.chapterHistory = [];
    }
    const hasCurrent = book.chapterHistory.some(h => h.chapter === book.latestChapter);
    if (!hasCurrent && book.latestChapter && book.updateConfirmed) {
        book.chapterHistory.unshift({
            chapter: book.latestChapter,
            summary: book.chapterSummary || book.summary || '',
            updateTime: book.confirmTime || new Date().toISOString(),
            discussionStatus: book.discussionStatus || 'spoiler-ban',
            hasAnnouncement: false,
            votesSnapshot: {
                read: book.votes?.read || 0,
                unread: book.votes?.unread || 0,
                feeding: book.votes?.feeding || 0,
                capturedAt: new Date().toISOString()
            },
            discussionOpenedAt: null
        });
    }
    if (book.chapterHistory.length > 50) {
        book.chapterHistory.length = 50;
    }
    return book;
}

function updateChapterHistoryAnnouncementStatus(book) {
    if (!book.chapterHistory) return book;
    const chapterKey = getChapterKey(book);
    const copied = getCopiedChapters();
    const announcements = getAnnouncements();

    book.chapterHistory.forEach(h => {
        const hKey = `${book.id}__${h.chapter}`;
        h.hasAnnouncement = !!copied[hKey] || announcements.some(a =>
            a.bookId === book.id && a.chapter === h.chapter
        );
        if (h.hasAnnouncement) {
            const ann = announcements.find(a =>
                a.bookId === book.id && a.chapter === h.chapter
            );
            if (ann) {
                h.announcementCopied = (ann.copiedCount || 0) > 0;
                h.announcementSaved = (ann.savedCount || 0) > 0;
            }
        }
    });
    return book;
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

function daysSinceUpdate(dateStr) {
    if (!dateStr) return 999;
    const date = new Date(dateStr);
    const today = new Date();
    const diffTime = today - date;
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
function getDiscussionStatusInfo(status, book) {
    const totalVotes = book ? (book.votes?.read || 0) + (book.votes?.unread || 0) + (book.votes?.feeding || 0) : 0;
    const readPct = totalVotes > 0 ? Math.round((book.votes?.read || 0) / totalVotes * 100) : 0;

    const statusMap = {
        'spoiler-ban': {
            label: '🚫 禁剧透期',
            shortLabel: '🚫 禁剧透',
            desc: '禁止讨论任何剧情内容',
            guide: `当前为<strong>禁剧透期</strong>，群内禁止讨论任何本章剧情。建议等待${book ? book.spoilerHours || 24 : 24}小时后，或已读完比例超过60%后再开放讨论。目前已读完 <strong>${readPct}%</strong>。`,
            color: 'red'
        },
        'spoiler-limit': {
            label: '⚠️ 限剧透期',
            shortLabel: '⚠️ 限剧透',
            desc: '讨论必须加剧透预警标签',
            guide: `当前为<strong>限剧透期</strong>，讨论剧情时必须在开头加上【剧透预警】字样，关键内容建议使用折叠功能。已读完 <strong>${readPct}%</strong>，快到阈值啦～`,
            color: 'yellow'
        },
        'open': {
            label: '✅ 已开放讨论',
            shortLabel: '✅ 已开放',
            desc: '可自由讨论全部剧情',
            guide: `当前已<strong>开放讨论</strong>，大家可以畅所欲言！记得文明讨论，尊重不同观点～ 已读完 <strong>${readPct}%</strong>。`,
            color: 'green'
        }
    };
    return statusMap[status] || statusMap['spoiler-ban'];
}

let currentMemberFilter = 'all';

// ========== 分类逻辑 ==========
function categorizeBooks(books, filter = 'all') {
    let filteredBooks = books;
    if (filter !== 'all') {
        const myBooks = getMyBooks();
        filteredBooks = books.filter(book => {
            const myStatus = myBooks[book.id];
            return myStatus && myStatus.status === filter;
        });
    }

    const today = [];
    const week = [];
    const watch = [];
    const history = [];

    filteredBooks.forEach(book => {
        if (book.status === 'hiatus') {
            watch.push(book);
            return;
        }

        if (isToday(book.lastUpdateTime) && book.updateConfirmed) {
            today.push(book);
            return;
        }

        if (book.updateConfirmed && !isToday(book.lastUpdateTime)) {
            history.push(book);
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
    history.sort(sortByUpdate);

    if (history.length > 20) {
        history.length = 20;
    }

    return { today, week, watch, history };
}

// ========== 渲染层：看板 ==========
function renderBoard() {
    const books = getBooks();
    const processedBooks = books.map(book => {
        book = ensureChapterHistory(book);
        book = updateChapterHistoryAnnouncementStatus(book);
        return book;
    });
    const { today, week, watch, history } = categorizeBooks(processedBooks, currentMemberFilter);

    document.getElementById('stat-today-count').textContent = today.length;
    document.getElementById('stat-week-count').textContent = week.length;
    document.getElementById('stat-history-count').textContent = history.length;
    document.getElementById('stat-watch-count').textContent = watch.length;

    document.getElementById('today-count').textContent = `${today.length} 本`;
    document.getElementById('week-count').textContent = `${week.length} 本`;
    document.getElementById('watch-count').textContent = `${watch.length} 本`;
    document.getElementById('history-count').textContent = `${history.length} 条`;

    const filterHint = document.getElementById('filter-hint');
    if (currentMemberFilter === 'all') {
        filterHint.textContent = '显示全部书单 · 点击书籍可修改我的追更状态';
    } else {
        const statusInfo = getMyStatusInfo(currentMemberFilter);
        const myBooks = getMyBooks();
        const count = Object.values(myBooks).filter(m => m.status === currentMemberFilter).length;
        filterHint.textContent = `${statusInfo.icon} ${statusInfo.label} · 共 ${count} 本 · 点击书籍可修改状态`;
    }

    renderBookList('today-list', today, 'today');
    renderBookList('week-list', week, 'week');
    renderBookList('watch-list', watch, 'watch');
    renderHistoryList(history);
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
            const books = getBooks();
            const book = books.find(b => b.id === bookId);
            if (book) {
                saveChapterReveal(book);
                renderBoard();
                if (document.getElementById('detail-modal').classList.contains('active')) {
                    openDetailModal(bookId);
                }
            }
        });
    });
}

function createBookCardHTML(book, type) {
    const userVotes = getUserVotes();
    const userVote = userVotes[book.id] || null;
    const spoilerActive = isSpoilerWindowActive(book);
    const isRevealed = isChapterRevealed(book);
    const showSummary = !spoilerActive || isRevealed;

    const totalVotes = (book.votes?.read || 0) + (book.votes?.unread || 0) + (book.votes?.feeding || 0);

    const statusText = {
        'ongoing': '连载中',
        'completed': '已完结',
        'hiatus': '断更中'
    }[book.status] || '未知';

    const discussionInfo = getDiscussionStatusInfo(book.discussionStatus, book);

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

    const discussionTag = `<span class="book-tag discussion-${book.discussionStatus}">${discussionInfo.shortLabel}</span>`;

    const myStatus = getMyBookStatus(book.id);
    let myStatusBadge = '';
    let myNoteHTML = '';
    let myReminderHTML = '';
    if (myStatus) {
        if (myStatus.status) {
            const statusInfo = getMyStatusInfo(myStatus.status);
            myStatusBadge = `<span class="my-status-badge ${statusInfo.class}">${statusInfo.icon} ${statusInfo.label}</span>`;
        }
        if (myStatus.note) {
            myNoteHTML = `<div class="book-my-note">📝 ${escapeHtml(myStatus.note)}</div>`;
        }
        if (myStatus.reminderTime) {
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const [rh, rm] = myStatus.reminderTime.split(':').map(Number);
            const reminderMinutes = rh * 60 + rm;
            const diff = Math.abs(currentMinutes - reminderMinutes);
            const isNear = diff <= 30;
            myReminderHTML = isNear
                ? `<div class="book-my-reminder active">⏰ ${myStatus.reminderTime} 提醒中</div>`
                : `<div class="book-my-reminder">⏰ ${myStatus.reminderTime}</div>`;
        }
    }

    const nextUpdateText = type === 'week' ? `<span class="next-update-time">⏰ ${updateText}</span>` : '';
    const lastUpdateText = type !== 'week' ? `<span class="update-time">🕒 ${updateText}</span>` : '';

    const showHistoryBtn = (type === 'today' || type === 'history') && book.chapterHistory && book.chapterHistory.length > 1;
    const historyBtn = showHistoryBtn
        ? `<button class="view-chapter-history-btn" data-book-id="${book.id}" data-action="view-chapter-history">📜 查看历史章节（${book.chapterHistory.length}章）</button>`
        : '';

    return `
        <div class="book-card" data-book-id="${book.id}">
            <div class="book-card-header">
                <div class="book-title-wrap">
                    <span class="book-title">${escapeHtml(book.title)}</span>
                    <span class="book-author">· ${escapeHtml(book.author)}</span>
                    ${myStatusBadge}
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
            ${myNoteHTML}
            ${myReminderHTML}
            ${historyBtn}
        </div>
    `;
}

// ========== 最近更新历史列表 ==========
function renderHistoryList(books) {
    const container = document.getElementById('history-list');

    if (books.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>还没有历史更新记录～</p></div>`;
        return;
    }

    const announcements = getAnnouncements();
    const copied = getCopiedChapters();

    container.innerHTML = books.map(book => {
        const chapterKey = getChapterKey(book);
        const hasAnnouncement = announcements.some(a =>
            a.bookId === book.id && a.chapter === book.latestChapter
        ) || !!copied[chapterKey];

        let announcementStatus;
        if (hasAnnouncement) {
            const ann = announcements.find(a =>
                a.bookId === book.id && a.chapter === book.latestChapter
            );
            const copiedCount = ann ? (ann.copiedCount || 0) : (copied[chapterKey] ? 1 : 0);
            if (copiedCount > 0) {
                announcementStatus = `<span class="history-tag has-announcement">📋 已复制 ${copiedCount}次</span>`;
            } else {
                announcementStatus = '<span class="history-tag has-announcement">📢 已发公告</span>';
            }
        } else {
            announcementStatus = '<span class="history-tag no-announcement">⚠️ 未发公告</span>';
        }

        const daysSince = daysSinceUpdate(book.lastUpdateTime);
        const historyCount = book.chapterHistory ? book.chapterHistory.length : 1;

        return `
        <div class="history-item" data-book-id="${book.id}" data-action="view-chapter-history">
            <div class="history-item-main">
                <div class="history-item-title">📚 ${escapeHtml(book.title)}</div>
                <div class="history-item-chapter">📖 ${escapeHtml(book.latestChapter || '无章节信息')}</div>
                <div class="history-item-time">🕒 ${formatDateTime(book.lastUpdateTime)} · ${daysSince}天前 · 共${historyCount}章历史</div>
            </div>
            <div class="history-item-tags">
                ${announcementStatus}
                <span class="history-tag">${escapeHtml(book.author)}</span>
            </div>
        </div>
        `;
    }).join('');

    container.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            const bookId = item.dataset.bookId;
            openChapterTimelineModal(bookId);
        });
    });
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

    container.innerHTML = books.map(book => {
        const di = getDiscussionStatusInfo(book.discussionStatus, book);
        const nextUpdate = getNextUpdateTime(book);
        const nextUpdateText = nextUpdate ? formatDateTime(nextUpdate.toISOString()) : '无排期';

        return `
        <div class="admin-book-item">
            <div class="admin-book-info">
                <h3>
                    <span class="admin-discussion-badge ${book.discussionStatus}">${di.shortLabel}</span>
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
                    · 已确认更新: ${book.updateConfirmed ? '✅' : '❌'}
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

    const discussionInfo = getDiscussionStatusInfo(book.discussionStatus, book);
    const totalVotes = (book.votes?.read || 0) + (book.votes?.unread || 0) + (book.votes?.feeding || 0);
    const readPct = totalVotes > 0 ? Math.round((book.votes?.read || 0) / totalVotes * 100) : 0;
    const unreadPct = totalVotes > 0 ? Math.round((book.votes?.unread || 0) / totalVotes * 100) : 0;
    const feedingPct = totalVotes > 0 ? Math.round((book.votes?.feeding || 0) / totalVotes * 100) : 0;

    const spoilerActive = isSpoilerWindowActive(book);
    const spoilerRemaining = spoilerActive ? formatSpoilerTime(getSpoilerRemainingTime(book)) : '已结束';

    const html = `
        <div class="detail-section">
            <h3 style="margin-bottom:12px;font-size:18px;">${escapeHtml(book.title)}</h3>
            <div class="discussion-status-bar ${book.discussionStatus}">
                <span class="status-label">当前状态：${discussionInfo.label}</span>
                <span style="font-size:12px;opacity:0.85;">${discussionInfo.desc}</span>
            </div>
            <div class="discussion-guide-text">${discussionInfo.guide}</div>
        </div>

        <div class="detail-section">
            <div class="detail-section-title">📊 读者进度统计</div>
            <div class="discussion-vote-stats">
                <div class="vote-stat-row">
                    <div class="vote-stat-label">
                        <span>📗 已读完</span>
                        <strong>${readPct}% (${book.votes?.read || 0}人)</strong>
                    </div>
                    <div class="vote-stat-bar">
                        <div class="vote-stat-bar-fill read" style="width:${readPct}%;"></div>
                    </div>
                </div>
                <div class="vote-stat-row">
                    <div class="vote-stat-label">
                        <span>📕 还没看</span>
                        <strong>${unreadPct}% (${book.votes?.unread || 0}人)</strong>
                    </div>
                    <div class="vote-stat-bar">
                        <div class="vote-stat-bar-fill unread" style="width:${unreadPct}%;"></div>
                    </div>
                </div>
                <div class="vote-stat-row">
                    <div class="vote-stat-label">
                        <span>📚 养肥中</span>
                        <strong>${feedingPct}% (${book.votes?.feeding || 0}人)</strong>
                    </div>
                    <div class="vote-stat-bar">
                        <div class="vote-stat-bar-fill feeding" style="width:${feedingPct}%;"></div>
                    </div>
                </div>
            </div>
            <div style="text-align:center;font-size:12px;color:#95a5a6;margin-top:8px;">
                共 ${totalVotes} 人参与投票 · 防剧透剩余：<span style="font-weight:600;color:${spoilerActive ? '#e67e22' : '#27ae60'};">${spoilerRemaining}</span>
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
                💡 建议策略：更新初期🚫禁剧透 → 过半读者读完后⚠️限剧透 → 大部分读者都看了✅全面开放
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

    const oldStatus = book.discussionStatus;
    book.discussionStatus = status;

    if (oldStatus !== 'open' && status === 'open') {
        book = ensureChapterHistory(book);
        if (book.chapterHistory && book.chapterHistory.length > 0) {
            const currentChapter = book.chapterHistory.find(h => h.chapter === book.latestChapter);
            if (currentChapter && !currentChapter.discussionOpenedAt) {
                currentChapter.discussionOpenedAt = new Date().toISOString();
            }
        }
    }

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
            const oldBook = books[index];
            const oldVotes = oldBook.votes || { read: 0, unread: 0, feeding: 0 };
            const oldHistory = oldBook.chapterHistory || [];

            if (oldBook.latestChapter !== bookData.latestChapter && bookData.updateConfirmed) {
                bookData.discussionStatus = 'spoiler-ban';
            }

            const newBook = { ...oldBook, ...bookData, votes: oldVotes };
            newBook.chapterHistory = [...oldHistory];

            if (bookData.updateConfirmed && bookData.latestChapter) {
                const hasChapter = newBook.chapterHistory.some(h => h.chapter === bookData.latestChapter);
                if (!hasChapter) {
                    const confirmTime = bookData.updateConfirmed
                        ? (bookData.lastUpdateTime || new Date().toISOString())
                        : new Date().toISOString();
                    newBook.chapterHistory.unshift({
                        chapter: bookData.latestChapter,
                        summary: bookData.chapterSummary || '',
                        updateTime: confirmTime,
                        discussionStatus: bookData.discussionStatus || 'spoiler-ban',
                        hasAnnouncement: false,
                        votesSnapshot: {
                            read: oldVotes.read || 0,
                            unread: oldVotes.unread || 0,
                            feeding: oldVotes.feeding || 0,
                            capturedAt: new Date().toISOString()
                        },
                        discussionOpenedAt: null
                    });
                    if (newBook.chapterHistory.length > 50) {
                        newBook.chapterHistory.length = 50;
                    }
                }
            }

            if (oldBook.discussionStatus !== 'open' && bookData.discussionStatus === 'open' && newBook.chapterHistory.length > 0) {
                const currentChapter = newBook.chapterHistory.find(h => h.chapter === bookData.latestChapter);
                if (currentChapter && !currentChapter.discussionOpenedAt) {
                    currentChapter.discussionOpenedAt = new Date().toISOString();
                }
            }

            books[index] = newBook;
        }
    } else {
        const newBook = {
            id: generateId(),
            ...bookData,
            votes: { read: 0, unread: 0, feeding: 0 },
            chapterHistory: [],
            createdAt: new Date().toISOString()
        };

        if (bookData.updateConfirmed && bookData.latestChapter) {
            const confirmTime = bookData.lastUpdateTime || new Date().toISOString();
            newBook.chapterHistory.push({
                chapter: bookData.latestChapter,
                summary: bookData.chapterSummary || '',
                updateTime: confirmTime,
                discussionStatus: bookData.discussionStatus || 'spoiler-ban',
                hasAnnouncement: false,
                votesSnapshot: { read: 0, unread: 0, feeding: 0, capturedAt: new Date().toISOString() },
                discussionOpenedAt: null
            });
        }

        books.push(newBook);
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

    const discussionInfo = getDiscussionStatusInfo(book.discussionStatus, book);

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
    announcement += `💬 讨论状态：${discussionInfo.label}\n`;
    announcement += '━━━━━━━━━━━━━━━\n\n';

    if (book.discussionStatus === 'spoiler-ban') {
        announcement += `🚫 【禁剧透提醒】\n`;
        announcement += `   当前处于禁剧透期，禁止讨论任何本章剧情！\n`;
        announcement += `   违者将被提醒，屡教不改请管理处理。\n\n`;
    } else if (book.discussionStatus === 'spoiler-limit') {
        announcement += `⚠️ 【限剧透提醒】\n`;
        announcement += `   讨论剧情时必须在开头加上【剧透预警】！\n`;
        announcement += `   关键情节建议使用折叠/多行空行隐藏。\n\n`;
    } else {
        announcement += `✅ 【讨论开放】\n`;
        announcement += `   可以自由讨论全部剧情了！\n`;
        announcement += `   请文明讨论，尊重不同观点～\n\n`;
    }

    if (book.spoilerHours && book.spoilerHours > 0 && book.discussionStatus !== 'open') {
        announcement += `⏰ 防剧透期：本章更新后 ${book.spoilerHours} 小时内\n\n`;
    }

    if (book.chapterSummary) {
        if (book.discussionStatus === 'spoiler-ban' || book.discussionStatus === 'spoiler-limit') {
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

    if (book.discussionStatus !== 'open') {
        announcement += `💡 预计开放全剧情讨论：${discussMonth}月${discussDay}日 ${discussHour}:00 后\n`;
        announcement += '   （管理员可能根据实际投票情况提前或延后）\n\n';
    }

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
        markCurrentAnnouncementCopied();
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
            markCurrentAnnouncementCopied();
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

function markCurrentAnnouncementCopied() {
    if (!currentAnnouncementBookId) return;
    const books = getBooks();
    const book = books.find(b => b.id === currentAnnouncementBookId);
    if (!book) return;

    const announcement = document.getElementById('announcement-preview').textContent;
    markChapterCopied(book, announcement);
}

function saveCurrentAnnouncement() {
    if (!currentAnnouncementBookId) return;

    const books = getBooks();
    const book = books.find(b => b.id === currentAnnouncementBookId);
    if (!book) return;

    const content = document.getElementById('announcement-preview').textContent;
    const announcements = getAnnouncements();

    const existing = announcements.find(a =>
        a.bookId === book.id && a.chapter === book.latestChapter
    );

    if (existing) {
        updateAnnouncement(existing.id, {
            content: content,
            discussionStatus: book.discussionStatus,
            savedCount: (existing.savedCount || 0) + 1,
            lastSavedAt: new Date().toISOString()
        });
    } else {
        const announcement = {
            id: generateId(),
            bookId: book.id,
            bookTitle: book.title,
            chapter: book.latestChapter || '',
            content: content,
            discussionStatus: book.discussionStatus,
            createdAt: new Date().toISOString(),
            copiedCount: 0,
            savedCount: 1,
            lastCopiedAt: null,
            lastSavedAt: new Date().toISOString()
        };
        saveAnnouncement(announcement);
    }

    const statusEl = document.getElementById('copy-status');
    statusEl.textContent = '💾 已保存到历史';
    setTimeout(() => {
        statusEl.textContent = '';
    }, 2000);
}

// ========== 公告历史 ==========
function openAnnouncementsHistoryModal() {
    populateBookFilter();
    renderAnnouncementsHistory();
    document.getElementById('announcements-history-modal').classList.add('active');
}

function populateBookFilter() {
    const books = getBooks();
    const select = document.getElementById('history-filter-book');
    const currentValue = select.value;

    select.innerHTML = '<option value="all">全部作品</option>' +
        books.map(b => `<option value="${b.id}">${escapeHtml(b.title)}</option>`).join('');

    if (currentValue) {
        select.value = currentValue;
    }
}

function renderAnnouncementsHistory() {
    const allAnnouncements = getAnnouncements();
    const bookFilter = document.getElementById('history-filter-book').value;
    const timeFilter = document.getElementById('history-filter-time').value;
    const statusFilter = document.getElementById('history-filter-status').value;

    let filtered = allAnnouncements;

    if (bookFilter !== 'all') {
        filtered = filtered.filter(a => a.bookId === bookFilter);
    }

    if (timeFilter !== 'all') {
        const days = parseInt(timeFilter);
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        filtered = filtered.filter(a => new Date(a.createdAt).getTime() >= cutoff);
    }

    if (statusFilter !== 'all') {
        if (statusFilter === 'saved') {
            filtered = filtered.filter(a => (a.savedCount || 0) > 0);
        } else if (statusFilter === 'copied') {
            filtered = filtered.filter(a => (a.copiedCount || 0) > 0);
        } else if (statusFilter === 'unsent') {
            filtered = filtered.filter(a => (a.copiedCount || 0) === 0);
        }
    }

    const container = document.getElementById('announcements-history-list');

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>没有符合筛选条件的公告记录～</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(a => {
        const di = getDiscussionStatusInfo(a.discussionStatus);

        let statusBadges = '';
        if ((a.copiedCount || 0) > 0) {
            statusBadges += `<span class="announcement-status-badge copied">📋 已复制${a.copiedCount}次</span>`;
        } else {
            statusBadges += `<span class="announcement-status-badge never-copied">❓ 未复制过</span>`;
        }
        if ((a.savedCount || 0) > 1) {
            statusBadges += ` <span class="announcement-status-badge copied">💾 重存${a.savedCount}次</span>`;
        }

        return `
        <div class="announcement-history-item">
            <div class="announcement-history-header">
                <span class="announcement-history-title">📚 《${escapeHtml(a.bookTitle)}》</span>
                <span class="book-tag discussion-${a.discussionStatus}" style="font-size:11px;">${di.shortLabel}</span>
            </div>
            <div class="announcement-history-meta">
                <span>📖 ${escapeHtml(a.chapter || '未知章节')}</span>
                <span>🕒 ${formatFullDateTime(a.createdAt)}</span>
                ${statusBadges}
            </div>
            <div class="announcement-history-preview">${escapeHtml(a.content)}</div>
            <div class="announcement-history-actions">
                <button class="btn btn-primary btn-small" onclick="copyAnnouncementFromHistory('${a.id}')">📋 复制补发</button>
                <button class="btn btn-secondary btn-small" onclick="resaveAnnouncement('${a.id}')">💾 重新生成</button>
                <button class="btn btn-danger btn-small" onclick="deleteAnnouncement('${a.id}')">🗑️ 删除</button>
            </div>
        </div>
    `}).join('');
}

function copyAnnouncementFromHistory(announcementId) {
    const announcements = getAnnouncements();
    const announcement = announcements.find(a => a.id === announcementId);
    if (!announcement) return;

    navigator.clipboard.writeText(announcement.content).then(() => {
        updateAnnouncement(announcementId, {
            copiedCount: (announcement.copiedCount || 0) + 1,
            lastCopiedAt: new Date().toISOString()
        });
        alert('✅ 已复制到剪贴板，可粘贴到群里补发！');
        renderAnnouncementsHistory();
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = announcement.content;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            updateAnnouncement(announcementId, {
                copiedCount: (announcement.copiedCount || 0) + 1,
                lastCopiedAt: new Date().toISOString()
            });
            alert('✅ 已复制到剪贴板！');
            renderAnnouncementsHistory();
        } catch (e) {
            alert('❌ 复制失败');
        }
        document.body.removeChild(textarea);
    });
}

function resaveAnnouncement(announcementId) {
    const announcements = getAnnouncements();
    const announcement = announcements.find(a => a.id === announcementId);
    if (!announcement) return;

    const books = getBooks();
    const book = books.find(b => b.id === announcement.bookId);
    if (!book) {
        alert('❌ 找不到对应书籍，可能已被删除');
        return;
    }

    const newContent = generateAnnouncement(book);

    updateAnnouncement(announcementId, {
        content: newContent,
        chapter: book.latestChapter || '',
        discussionStatus: book.discussionStatus,
        savedCount: (announcement.savedCount || 0) + 1,
        lastSavedAt: new Date().toISOString()
    });

    alert('✅ 已根据最新书籍信息重新生成公告！');
    renderAnnouncementsHistory();
}

function deleteAnnouncement(announcementId) {
    if (!confirm('确定删除这条公告记录吗？')) return;
    deleteAnnouncementFromStorage(announcementId);
    renderAnnouncementsHistory();
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
    const isRevealed = isChapterRevealed(book);
    const showSummary = !spoilerActive || isRevealed;

    const statusText = {
        'ongoing': '连载中',
        'completed': '已完结',
        'hiatus': '断更中'
    }[book.status] || '未知';

    const discussionInfo = getDiscussionStatusInfo(book.discussionStatus, book);

    let spoilerTimerHTML = '';
    if (spoilerActive && !isRevealed) {
        const remaining = getSpoilerRemainingTime(book);
        spoilerTimerHTML = `
            <div class="spoiler-timer">
                🔒 本章防剧透保护中，还有 <strong>${formatSpoilerTime(remaining)}</strong> 自动解锁
                <button class="spoiler-reveal-btn" onclick="revealChapterSpoiler('${book.id}')">我看完了，显示简介</button>
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
                <span class="book-tag discussion-${book.discussionStatus}">${discussionInfo.shortLabel}</span>
                ${book.scheduleType && book.scheduleType !== 'none' ? `<span class="book-tag schedule">📅 ${getScheduleLabel(book)}</span>` : ''}
            </div>
        </div>

        <div class="discussion-status-bar ${book.discussionStatus}">
            <span class="status-label">讨论状态：${discussionInfo.label}</span>
            <span style="font-size:12px;opacity:0.85;">${discussionInfo.desc}</span>
        </div>
        <div class="discussion-guide-text">${discussionInfo.guide}</div>

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

        <div class="detail-actions" style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;">
            <button class="btn btn-secondary" onclick="openMyStatusModal('${book.id}')">
                📋 我的追更状态
            </button>
            <button class="btn btn-secondary" onclick="openChapterTimelineModal('${book.id}')">
                📜 章节历史（${book.chapterHistory ? book.chapterHistory.length : 1}章）
            </button>
            <button class="btn btn-primary" onclick="openAnnouncementModal('${book.id}')" style="margin-left:auto;">
                📢 生成群提醒
            </button>
        </div>
    `;

    document.getElementById('detail-title').textContent = '书籍详情';
    document.getElementById('detail-body').innerHTML = detailHTML;
    document.getElementById('detail-modal').classList.add('active');
}

function revealChapterSpoiler(bookId) {
    const books = getBooks();
    const book = books.find(b => b.id === bookId);
    if (!book) return;
    saveChapterReveal(book);
    openDetailModal(bookId);
    renderBoard();
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

// ========== 我的追更状态 ==========
function openMyStatusModal(bookId) {
    const books = getBooks();
    const book = books.find(b => b.id === bookId);
    if (!book) return;

    const currentStatus = getMyBookStatus(bookId);
    const currentStatusValue = currentStatus ? currentStatus.status : null;
    const currentNote = currentStatus ? (currentStatus.note || '') : '';
    const currentReminder = currentStatus ? (currentStatus.reminderTime || '') : '';

    const statusOptions = [
        { value: 'reading', icon: '🔄', label: '正在追', desc: '实时追更，更新必看' },
        { value: 'waiting', icon: '⏳', label: '攒着看', desc: '先攒几章，养肥再杀' },
        { value: 'dropped', icon: '💤', label: '暂时弃坑', desc: '等段时间再说' },
        { value: null, icon: '❌', label: '清除状态', desc: '不标记任何状态' }
    ];

    const bodyHTML = `
        <div style="margin-bottom:12px;">
            <div style="font-size:16px;font-weight:600;color:#2c3e50;">${escapeHtml(book.title)}</div>
            <div style="font-size:12px;color:#95a5a6;margin-top:2px;">作者：${escapeHtml(book.author)}</div>
        </div>
        <div class="my-status-options">
            ${statusOptions.map(opt => {
                const selected = currentStatusValue === opt.value ? 'selected' : '';
                return `
                    <div class="my-status-option ${selected}" data-status="${opt.value || ''}">
                        <div class="my-status-option-icon">${opt.icon}</div>
                        <div class="my-status-option-label">${opt.label}</div>
                        <div class="my-status-option-desc">${opt.desc}</div>
                    </div>
                `;
            }).join('')}
        </div>
        <div style="margin-top:16px;padding-top:16px;border-top:1px dashed #e8ecf0;">
            <div class="form-group" style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:500;color:#2c3e50;display:block;margin-bottom:4px;">📝 私人备注</label>
                <input type="text" id="my-book-note" class="form-control" placeholder="比如：看到第120章了、这本弃了但以后可能回来..." value="${escapeHtml(currentNote)}" style="font-size:13px;">
                <div style="font-size:11px;color:#95a5a6;margin-top:2px;">仅自己可见，不影响公共书单</div>
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label style="font-size:13px;font-weight:500;color:#2c3e50;display:block;margin-bottom:4px;">⏰ 追更提醒时间</label>
                <input type="time" id="my-book-reminder" class="form-control" value="${currentReminder}" style="font-size:13px;">
                <div style="font-size:11px;color:#95a5a6;margin-top:2px;">设置后，到时间会在书单上显示提醒标记</div>
            </div>
        </div>
        <div style="margin-top:16px;text-align:right;">
            <button class="btn btn-primary" id="save-my-status-btn" style="width:100%;">💾 保存设置</button>
        </div>
    `;

    document.getElementById('my-status-body').innerHTML = bodyHTML;
    document.getElementById('my-status-modal').classList.add('active');

    document.querySelectorAll('.my-status-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.my-status-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
        });
    });

    document.getElementById('save-my-status-btn').addEventListener('click', () => {
        const selectedOption = document.querySelector('.my-status-option.selected');
        const status = selectedOption ? (selectedOption.dataset.status || null) : null;
        const note = document.getElementById('my-book-note').value.trim();
        const reminder = document.getElementById('my-book-reminder').value;

        if (status) {
            saveMyBookStatus(bookId, status);
        } else {
            const myBooks = getMyBooks();
            delete myBooks[bookId];
            localStorage.setItem(MY_BOOKS_KEY, JSON.stringify(myBooks));
        }
        if (note) saveMyBookNote(bookId, note);
        else {
            const myBooks = getMyBooks();
            if (myBooks[bookId]) { myBooks[bookId].note = ''; localStorage.setItem(MY_BOOKS_KEY, JSON.stringify(myBooks)); }
        }
        if (reminder) saveMyBookReminder(bookId, reminder);
        else {
            const myBooks = getMyBooks();
            if (myBooks[bookId]) { myBooks[bookId].reminderTime = ''; localStorage.setItem(MY_BOOKS_KEY, JSON.stringify(myBooks)); }
        }

        closeMyStatusModal();
        renderBoard();
    });
}

function closeMyStatusModal() {
    document.getElementById('my-status-modal').classList.remove('active');
}

// ========== 章节历史时间线 ==========
function openChapterTimelineModal(bookId) {
    const books = getBooks();
    const book = books.find(b => b.id === bookId);
    if (!book) return;

    book = ensureChapterHistory(book);
    book = updateChapterHistoryAnnouncementStatus(book);

    const history = book.chapterHistory || [];
    const announcements = getAnnouncements();
    const copied = getCopiedChapters();

    document.getElementById('timeline-title').textContent = `📜 ${escapeHtml(book.title)} · 章节更新历史`;

    if (history.length === 0) {
        document.getElementById('timeline-body').innerHTML = `
            <div class="empty-state"><p>还没有章节更新记录～</p></div>
        `;
    } else {
        const totalChapters = history.length;
        let timelyAnnCount = 0;
        let openedCount = 0;
        let totalOpenHours = 0;
        let totalVoteFollowUp = 0;
        let voteFollowUpCount = 0;

        history.forEach(h => {
            const hKey = `${book.id}__${h.chapter}`;
            const ann = announcements.find(a => a.bookId === book.id && a.chapter === h.chapter);
            const wasCopied = !!copied[hKey] || (ann && (ann.copiedCount || 0) > 0);

            if (h.updateTime && wasCopied) {
                const copiedTime = copied[hKey]?.copiedAt || ann?.lastCopiedAt || ann?.createdAt;
                if (copiedTime) {
                    const diffMs = new Date(copiedTime).getTime() - new Date(h.updateTime).getTime();
                    if (diffMs >= 0 && diffMs < 2 * 60 * 60 * 1000) timelyAnnCount++;
                }
            }

            if (h.discussionOpenedAt && h.updateTime) {
                openedCount++;
                const diffMs = new Date(h.discussionOpenedAt).getTime() - new Date(h.updateTime).getTime();
                totalOpenHours += diffMs / (1000 * 60 * 60);
            }

            if (h.votesSnapshot) {
                const snapTotal = (h.votesSnapshot.read || 0) + (h.votesSnapshot.unread || 0) + (h.votesSnapshot.feeding || 0);
                const snapReadPct = snapTotal > 0 ? (h.votesSnapshot.read || 0) / snapTotal : 0;
                if (snapReadPct > 0.3) {
                    totalVoteFollowUp += snapReadPct;
                    voteFollowUpCount++;
                }
            }
        });

        const avgOpenHours = openedCount > 0 ? Math.round(totalOpenHours / openedCount) : 0;
        const timelyPct = totalChapters > 0 ? Math.round(timelyAnnCount / totalChapters * 100) : 0;
        const avgVoteFollow = voteFollowUpCount > 0 ? Math.round(totalVoteFollowUp / voteFollowUpCount * 100) : 0;

        let trendHTML = '';
        if (history.length >= 2) {
            const snapshots = history.slice().reverse().filter(h => h.votesSnapshot);
            if (snapshots.length >= 2) {
                const latestSnap = snapshots[snapshots.length - 1].votesSnapshot;
                const earliestSnap = snapshots[0].votesSnapshot;
                const latestTotal = (latestSnap.read || 0) + (latestSnap.unread || 0) + (latestSnap.feeding || 0);
                const earliestTotal = (earliestSnap.read || 0) + (earliestSnap.unread || 0) + (earliestSnap.feeding || 0);
                const latestReadPct = latestTotal > 0 ? Math.round((latestSnap.read || 0) / latestTotal * 100) : 0;
                const earliestReadPct = earliestTotal > 0 ? Math.round((earliestSnap.read || 0) / earliestTotal * 100) : 0;

                let trendLabel = '';
                let trendClass = '';
                if (latestReadPct > earliestReadPct + 10) {
                    trendLabel = `📈 热度上升（已读完 ${earliestReadPct}% → ${latestReadPct}%）`;
                    trendClass = 'up';
                } else if (latestReadPct < earliestReadPct - 10) {
                    trendLabel = `📉 热度下降（已读完 ${earliestReadPct}% → ${latestReadPct}%）`;
                    trendClass = 'down';
                } else {
                    trendLabel = `➡️ 热度平稳（已读完 ${earliestReadPct}% → ${latestReadPct}%）`;
                    trendClass = '';
                }

                trendHTML = `
                    <div class="timeline-review-card">
                        <div class="timeline-review-title">📊 投票趋势</div>
                        <div class="timeline-review-stat ${trendClass}">${trendLabel}</div>
                        <div class="timeline-trend-bars">
                            ${snapshots.slice(-6).map(s => {
                                const st = (s.votesSnapshot.read || 0) + (s.votesSnapshot.unread || 0) + (s.votesSnapshot.feeding || 0);
                                const rp = st > 0 ? Math.round((s.votesSnapshot.read || 0) / st * 100) : 0;
                                const up = st > 0 ? Math.round((s.votesSnapshot.unread || 0) / st * 100) : 0;
                                const fp = st > 0 ? Math.round((s.votesSnapshot.feeding || 0) / st * 100) : 0;
                                const chName = s.chapter.length > 8 ? s.chapter.substring(0, 8) + '…' : s.chapter;
                                return `
                                    <div class="timeline-trend-item">
                                        <div class="timeline-trend-label">${escapeHtml(chName)}</div>
                                        <div class="timeline-trend-bar">
                                            <div class="trend-segment read" style="width:${rp}%" title="已读完 ${rp}%"></div>
                                            <div class="trend-segment feeding" style="width:${fp}%" title="养肥中 ${fp}%"></div>
                                            <div class="trend-segment unread" style="width:${up}%" title="还没看 ${up}%"></div>
                                        </div>
                                        <div class="timeline-trend-pct">${rp}%</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }
        }

        const reviewHTML = `
            <div class="timeline-review">
                <div class="timeline-review-title">🔍 运营复盘</div>
                <div class="timeline-review-grid">
                    <div class="timeline-review-item">
                        <div class="timeline-review-value ${timelyPct >= 60 ? 'good' : timelyPct >= 30 ? 'warn' : 'bad'}">${timelyPct}%</div>
                        <div class="timeline-review-label">公告及时率</div>
                        <div class="timeline-review-desc">${timelyPct >= 60 ? '公告发布很及时' : timelyPct >= 30 ? '部分公告偏晚' : '公告经常延迟'}</div>
                    </div>
                    <div class="timeline-review-item">
                        <div class="timeline-review-value">${avgOpenHours > 0 ? avgOpenHours + 'h' : '-'}</div>
                        <div class="timeline-review-label">平均开放耗时</div>
                        <div class="timeline-review-desc">${openedCount}/${totalChapters} 章已开放讨论</div>
                    </div>
                    <div class="timeline-review-item">
                        <div class="timeline-review-value ${avgVoteFollow >= 50 ? 'good' : avgVoteFollow >= 30 ? 'warn' : 'bad'}">${avgVoteFollow}%</div>
                        <div class="timeline-review-label">投票跟进率</div>
                        <div class="timeline-review-desc">读者平均已读完占比</div>
                    </div>
                    <div class="timeline-review-item">
                        <div class="timeline-review-value">${totalChapters}</div>
                        <div class="timeline-review-label">总更新章节</div>
                        <div class="timeline-review-desc">含历史归档</div>
                    </div>
                </div>
            </div>
            ${trendHTML}
        `;

        const bodyHTML = `
            ${reviewHTML}
            <div style="margin:16px 0 8px;font-size:15px;font-weight:600;color:#2c3e50;">📜 章节时间线</div>
            <div class="timeline">
                ${history.map((h, idx) => {
                    const isCurrent = idx === 0;
                    const discussionInfo = getDiscussionStatusInfo(h.discussionStatus || 'spoiler-ban');
                    const daysSince = h.updateTime ? daysSinceUpdate(h.updateTime) : 0;

                    let annBadge = '';
                    let annTimeliness = '';
                    if (h.hasAnnouncement) {
                        if (h.announcementCopied) {
                            annBadge = '<span class="book-tag platform">📋 已复制</span>';
                        } else if (h.announcementSaved) {
                            annBadge = '<span class="book-tag schedule">💾 已保存</span>';
                        } else {
                            annBadge = '<span class="book-tag schedule">📢 已发公告</span>';
                        }

                        const hKey = `${book.id}__${h.chapter}`;
                        const ann = announcements.find(a => a.bookId === book.id && a.chapter === h.chapter);
                        const copiedTime = copied[hKey]?.copiedAt || ann?.lastCopiedAt || ann?.createdAt;
                        if (copiedTime && h.updateTime) {
                            const diffMs = new Date(copiedTime).getTime() - new Date(h.updateTime).getTime();
                            const diffMins = Math.floor(diffMs / (1000 * 60));
                            if (diffMins >= 0 && diffMins < 30) annTimeliness = '<span class="review-tag good">⚡ 30分钟内</span>';
                            else if (diffMins < 120) annTimeliness = '<span class="review-tag warn">🕐 2小时内</span>';
                            else if (diffMins < 1440) annTimeliness = '<span class="review-tag warn">📅 1天内</span>';
                            else if (diffMins >= 0) annTimeliness = '<span class="review-tag bad">🐢 超过1天</span>';
                        }
                    } else {
                        annBadge = '<span class="book-tag discussion-spoiler-ban">⚠️ 未发公告</span>';
                        annTimeliness = '<span class="review-tag bad">❌ 缺失</span>';
                    }

                    let openInfo = '';
                    if (h.discussionOpenedAt && h.updateTime) {
                        const diffMs = new Date(h.discussionOpenedAt).getTime() - new Date(h.updateTime).getTime();
                        const diffHours = Math.round(diffMs / (1000 * 60 * 60));
                        if (diffHours < 24) openInfo = `<span class="review-tag good">🔓 ${diffHours}小时开放</span>`;
                        else openInfo = `<span class="review-tag warn">🔓 ${Math.round(diffHours / 24)}天开放</span>`;
                    } else if (h.discussionStatus === 'open') {
                        openInfo = '<span class="review-tag good">🔓 已开放</span>';
                    } else if (h.discussionStatus === 'spoiler-limit') {
                        openInfo = '<span class="review-tag warn">⚠️ 限剧透中</span>';
                    } else {
                        openInfo = '<span class="review-tag bad">🚫 未开放</span>';
                    }

                    let voteInfo = '';
                    if (h.votesSnapshot) {
                        const snapTotal = (h.votesSnapshot.read || 0) + (h.votesSnapshot.unread || 0) + (h.votesSnapshot.feeding || 0);
                        if (snapTotal > 0) {
                            const rp = Math.round((h.votesSnapshot.read || 0) / snapTotal * 100);
                            voteInfo = `<span class="review-tag ${rp >= 50 ? 'good' : rp >= 30 ? 'warn' : 'bad'}">🗳️ 已读${rp}%（${snapTotal}人）</span>`;
                        }
                    }

                    return `
                        <div class="timeline-item ${isCurrent ? 'current' : ''}">
                            <div class="timeline-item-header">
                                <div class="timeline-chapter">
                                    ${escapeHtml(h.chapter)}
                                    ${isCurrent ? '<span class="timeline-current-badge">当前章节</span>' : ''}
                                </div>
                                <div class="timeline-time">${formatDateTime(h.updateTime)} · ${daysSince}天前</div>
                            </div>
                            <div class="timeline-item-meta">
                                <span class="book-tag discussion-${h.discussionStatus || 'spoiler-ban'}">${discussionInfo.shortLabel}</span>
                                ${annBadge}
                            </div>
                            ${h.summary ? `<div class="timeline-summary">${escapeHtml(h.summary)}</div>` : ''}
                            <div class="timeline-item-review">
                                ${annTimeliness}
                                ${openInfo}
                                ${voteInfo}
                            </div>
                            <div class="timeline-item-actions">
                                <button class="btn btn-secondary btn-sm" onclick="generateAndCopyChapterAnnouncement('${book.id}', ${idx})">
                                    📋 补发公告
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        document.getElementById('timeline-body').innerHTML = bodyHTML;
    }

    document.getElementById('chapter-timeline-modal').classList.add('active');
}

function closeChapterTimelineModal() {
    document.getElementById('chapter-timeline-modal').classList.remove('active');
}

function generateAndCopyChapterAnnouncement(bookId, historyIndex) {
    const books = getBooks();
    const book = books.find(b => b.id === bookId);
    if (!book || !book.chapterHistory) return;

    const history = book.chapterHistory[historyIndex];
    if (!history) return;

    const tempBook = {
        ...book,
        latestChapter: history.chapter,
        chapterSummary: history.summary,
        lastUpdateTime: history.updateTime,
        discussionStatus: history.discussionStatus || 'spoiler-ban'
    };

    const content = generateAnnouncement(tempBook);
    markChapterCopied(tempBook, content);

    navigator.clipboard.writeText(content).then(() => {
        alert('✅ 公告已生成并复制到剪贴板！已记录到公告历史。');
        openChapterTimelineModal(bookId);
        renderBoard();
    }).catch(() => {
        alert('❌ 复制失败，但公告已保存到历史');
        openChapterTimelineModal(bookId);
        renderBoard();
    });
}

// ========== 运营概览 ==========
function renderOverviewPage() {
    const books = getBooks();
    const announcements = getAnnouncements();
    const copied = getCopiedChapters();
    const myBooks = getMyBooks();

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

    let totalUpdates7d = 0;
    let totalVotes = 0;
    const alerts = [];
    const processedBooks = [];

    books.forEach(book => {
        book = ensureChapterHistory(book);
        book = updateChapterHistoryAnnouncementStatus(book);

        const updates7d = (book.chapterHistory || []).filter(h =>
            h.updateTime && new Date(h.updateTime).getTime() >= sevenDaysAgo
        ).length;
        totalUpdates7d += updates7d;

        const bookVotes = (book.votes?.read || 0) + (book.votes?.unread || 0) + (book.votes?.feeding || 0);
        totalVotes += bookVotes;

        const totalV = bookVotes;
        const readPct = totalV > 0 ? Math.round((book.votes?.read || 0) / totalV * 100) : 0;
        const lastUpdate = book.lastUpdateTime ? new Date(book.lastUpdateTime).getTime() : 0;
        const daysSince = lastUpdate > 0 ? Math.floor((now - lastUpdate) / (24 * 60 * 60 * 1000)) : 999;

        const hasCurrentAnn = announcements.some(a =>
            a.bookId === book.id && a.chapter === book.latestChapter
        ) || !!copied[getChapterKey(book)];

        let bookAlert = null;
        if (book.status === 'ongoing' && daysSince >= 7 && book.updateConfirmed) {
            bookAlert = { type: 'warning', text: `《${book.title}》已 ${daysSince} 天未更新，可能需要催更` };
        }
        if (book.updateConfirmed && book.latestChapter && !hasCurrentAnn) {
            bookAlert = { type: 'danger', text: `《${book.title}》已更新但未发公告，请补发` };
        }
        if (book.discussionStatus === 'spoiler-ban' && readPct >= 60 && totalV >= 10) {
            bookAlert = { type: 'info', text: `《${book.title}》已读完${readPct}%，可以考虑开放讨论` };
        }
        if (bookAlert) alerts.push(bookAlert);

        processedBooks.push({
            ...book,
            updates7d,
            readPct,
            totalVotes: bookVotes,
            daysSince,
            hasCurrentAnn,
            bookAlert
        });
    });

    document.getElementById('overview-total-books').textContent = books.length;
    document.getElementById('overview-updates-7d').textContent = totalUpdates7d;
    document.getElementById('overview-announcements').textContent = announcements.length;
    document.getElementById('overview-total-votes').textContent = totalVotes;

    const alertsContainer = document.getElementById('overview-alerts');
    if (alerts.length === 0) {
        alertsContainer.innerHTML = `
            <div class="overview-alert success">
                <span>✅</span>
                <span>运营状态良好，所有书籍更新和公告都已同步～</span>
            </div>
        `;
    } else {
        alertsContainer.innerHTML = alerts.map(alert => `
            <div class="overview-alert ${alert.type}">
                <span>${alert.type === 'danger' ? '⚠️' : alert.type === 'warning' ? '⏰' : '💡'}</span>
                <span>${escapeHtml(alert.text)}</span>
            </div>
        `).join('');
    }

    const statusLabel = {
        'ongoing': '连载中',
        'completed': '已完结',
        'hiatus': '断更中'
    };

    processedBooks.sort((a, b) => b.updates7d - a.updates7d);

    const listContainer = document.getElementById('overview-list');
    listContainer.innerHTML = processedBooks.map(book => {
        const discInfo = getDiscussionStatusInfo(book.discussionStatus);
        const statusText = statusLabel[book.status] || '未知';
        const myStatus = getMyBookStatus(book.id);

        let myStatusBadge = '';
        if (myStatus) {
            const si = getMyStatusInfo(myStatus.status);
            myStatusBadge = `<span class="my-status-badge ${si.class}">${si.icon} ${si.label}</span>`;
        }

        let annBadge = '';
        if (book.hasCurrentAnn) {
            const ann = announcements.find(a =>
                a.bookId === book.id && a.chapter === book.latestChapter
            );
            const copiedCount = ann ? (ann.copiedCount || 0) : (copied[getChapterKey(book)] ? 1 : 0);
            if (copiedCount > 0) {
                annBadge = `<span class="book-tag platform">📋 已复制${copiedCount}次</span>`;
            } else {
                annBadge = `<span class="book-tag schedule">💾 已保存</span>`;
            }
        } else {
            annBadge = `<span class="book-tag discussion-spoiler-ban">⚠️ 未发公告</span>`;
        }

        const updateCount = book.chapterHistory ? book.chapterHistory.length : 0;

        let trendIndicator = '';
        if (book.chapterHistory && book.chapterHistory.length >= 2) {
            const snaps = book.chapterHistory.filter(h => h.votesSnapshot);
            if (snaps.length >= 2) {
                const latest = snaps[0].votesSnapshot;
                const earliest = snaps[snaps.length - 1].votesSnapshot;
                const lt = (latest.read || 0) + (latest.unread || 0) + (latest.feeding || 0);
                const et = (earliest.read || 0) + (earliest.unread || 0) + (earliest.feeding || 0);
                const lr = lt > 0 ? Math.round((latest.read || 0) / lt * 100) : 0;
                const er = et > 0 ? Math.round((earliest.read || 0) / et * 100) : 0;
                if (lr > er + 10) trendIndicator = '<span class="overview-trend up">📈 升</span>';
                else if (lr < er - 10) trendIndicator = '<span class="overview-trend down">📉 降</span>';
                else trendIndicator = '<span class="overview-trend">➡️ 稳</span>';
            }
        }

        let miniTrendHTML = '';
        if (book.chapterHistory) {
            const recentSnaps = book.chapterHistory.filter(h => h.votesSnapshot).slice(0, 5).reverse();
            if (recentSnaps.length >= 2) {
                miniTrendHTML = `<div class="overview-mini-trend">${recentSnaps.map(s => {
                    const st = (s.votesSnapshot.read || 0) + (s.votesSnapshot.unread || 0) + (s.votesSnapshot.feeding || 0);
                    const rp = st > 0 ? Math.round((s.votesSnapshot.read || 0) / st * 100) : 0;
                    return `<div class="mini-trend-dot" style="height:${Math.max(rp, 5)}%;" title="已读完 ${rp}%"></div>`;
                }).join('')}</div>`;
            }
        }

        return `
            <div class="overview-item" data-book-id="${book.id}">
                <div class="overview-item-header">
                    <div>
                        <span class="overview-item-title">${escapeHtml(book.title)}</span>
                        ${myStatusBadge}
                        ${trendIndicator}
                    </div>
                    <div class="overview-item-badges">
                        <span class="book-tag status-${book.status}">${statusText}</span>
                        <span class="book-tag discussion-${book.discussionStatus}">${discInfo.shortLabel}</span>
                        ${annBadge}
                    </div>
                </div>
                ${book.bookAlert ? `
                    <div style="padding:8px 12px;background:${book.bookAlert.type === 'danger' ? '#fdecea' : book.bookAlert.type === 'warning' ? '#fef9e7' : '#ebf5fb'};border-radius:6px;font-size:13px;color:${book.bookAlert.type === 'danger' ? '#c0392b' : book.bookAlert.type === 'warning' ? '#d68910' : '#2874a6'};margin-bottom:12px;">
                        ${book.bookAlert.type === 'danger' ? '⚠️' : book.bookAlert.type === 'warning' ? '⏰' : '💡'} ${escapeHtml(book.bookAlert.text)}
                    </div>
                ` : ''}
                <div class="overview-item-stats">
                    <div class="overview-item-stat">
                        <div class="overview-item-stat-value ${book.updates7d > 0 ? 'up' : ''}">${book.updates7d}</div>
                        <div class="overview-item-stat-label">近7天更新</div>
                    </div>
                    <div class="overview-item-stat">
                        <div class="overview-item-stat-value">${updateCount}</div>
                        <div class="overview-item-stat-label">总章节数</div>
                    </div>
                    <div class="overview-item-stat">
                        <div class="overview-item-stat-value">${book.readPct}%</div>
                        <div class="overview-item-stat-label">已读完</div>
                    </div>
                    <div class="overview-item-stat">
                        <div class="overview-item-stat-value">${book.totalVotes}</div>
                        <div class="overview-item-stat-label">投票人数</div>
                    </div>
                </div>
                ${miniTrendHTML}
                <div class="overview-item-actions">
                    <button class="btn btn-secondary btn-sm" onclick="openDetailModal('${book.id}')">📖 查看详情</button>
                    <button class="btn btn-secondary btn-sm" onclick="openChapterTimelineModal('${book.id}')">📜 章节历史</button>
                    <button class="btn btn-secondary btn-sm" onclick="openDiscussionModal('${book.id}')">🗳️ 讨论管理</button>
                    <button class="btn btn-primary btn-sm" onclick="openAnnouncementModal('${book.id}')">📢 生成公告</button>
                </div>
            </div>
        `;
    }).join('');
}

function switchAdminView(viewName) {
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.adminView === viewName);
    });

    document.querySelectorAll('.admin-subview').forEach(view => {
        view.classList.remove('active');
    });

    document.getElementById(`admin-${viewName}-view`).classList.add('active');

    if (viewName === 'books') {
        renderAdminList();
    } else if (viewName === 'overview') {
        renderOverviewPage();
    }
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
        if (book.updateConfirmed === undefined) {
            book.updateConfirmed = !!book.lastUpdateTime;
            migrated = true;
        }
        if (book.chapterHistory === undefined) {
            book.chapterHistory = [];
            if (book.latestChapter && book.updateConfirmed) {
                book.chapterHistory.push({
                    chapter: book.latestChapter,
                    summary: book.chapterSummary || '',
                    updateTime: book.confirmTime || book.lastUpdateTime || new Date().toISOString(),
                    discussionStatus: book.discussionStatus || 'spoiler-ban',
                    hasAnnouncement: false
                });
            }
            migrated = true;
        }
        if (book.confirmTime === undefined && book.updateConfirmed && book.lastUpdateTime) {
            book.confirmTime = book.lastUpdateTime;
            migrated = true;
        }
        if (book.chapterHistory && book.chapterHistory.length > 0) {
            book.chapterHistory.forEach(h => {
                if (h.votesSnapshot === undefined) {
                    h.votesSnapshot = {
                        read: book.votes?.read || 0,
                        unread: book.votes?.unread || 0,
                        feeding: book.votes?.feeding || 0,
                        capturedAt: h.updateTime || new Date().toISOString()
                    };
                    migrated = true;
                }
                if (h.discussionOpenedAt === undefined) {
                    h.discussionOpenedAt = h.discussionStatus === 'open' ? (h.updateTime || null) : null;
                    migrated = true;
                }
            });
        }
    });

    if (migrated) {
        saveBooks(books);
    }

    const oldAnnouncements = localStorage.getItem('novel_tracker_announcements');
    if (oldAnnouncements && !localStorage.getItem(ANNOUNCEMENTS_KEY)) {
        try {
            const parsed = JSON.parse(oldAnnouncements);
            const migrated = parsed.map(a => ({
                ...a,
                copiedCount: 0,
                savedCount: 1,
                lastCopiedAt: null,
                lastSavedAt: a.createdAt
            }));
            localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(migrated));
        } catch (e) {}
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

    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(9, 0, 0, 0);

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

    const inThreeDays = new Date(now);
    inThreeDays.setDate(inThreeDays.getDate() + 3);
    inThreeDays.setHours(19, 0, 0, 0);

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
            votes: { read: 12, unread: 28, feeding: 10 },
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
            lastUpdateTime: twoDaysAgo.toISOString(),
            spoilerHours: 6,
            discussionRule: '都市情感文，大家文明讨论，不要站队互撕。',
            updateConfirmed: true,
            scheduleType: 'workday',
            scheduleDay: 1,
            scheduleTime: '20:00',
            nextUpdate: null,
            discussionStatus: 'open',
            votes: { read: 38, unread: 12, feeding: 8 },
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
            lastUpdateTime: threeDaysAgo.toISOString(),
            spoilerHours: 24,
            discussionRule: '脑洞文，欢迎讨论技术细节，但请勿杠现实可行性。',
            updateConfirmed: true,
            scheduleType: 'weekly',
            scheduleDay: 3,
            scheduleTime: '14:00',
            nextUpdate: null,
            discussionStatus: 'open',
            votes: { read: 35, unread: 8, feeding: 22 },
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
            lastUpdateTime: yesterday.toISOString(),
            spoilerHours: 24,
            discussionRule: '悬疑推理文，严禁剧透凶手身份，违者踢群处理。',
            updateConfirmed: false,
            scheduleType: 'daily',
            scheduleDay: 1,
            scheduleTime: '12:00',
            nextUpdate: tomorrow.toISOString(),
            discussionStatus: 'spoiler-ban',
            votes: { read: 15, unread: 35, feeding: 20 },
            createdAt: tenDaysAgo.toISOString()
        },
        {
            id: generateId(),
            title: '诡秘之主2',
            author: '爱潜水的乌贼',
            platform: '起点中文网',
            status: 'ongoing',
            latestChapter: '第78章 占卜师的预言',
            chapterSummary: '',
            lastUpdateTime: twoDaysAgo.toISOString(),
            spoilerHours: 48,
            discussionRule: '克苏鲁风格，讨论请适度，不要过度解读和剧透。',
            updateConfirmed: false,
            scheduleType: 'weekly',
            scheduleDay: 5,
            scheduleTime: '19:00',
            nextUpdate: inThreeDays.toISOString(),
            discussionStatus: 'spoiler-limit',
            votes: { read: 22, unread: 40, feeding: 45 },
            createdAt: twoWeeksAgo.toISOString()
        },
        {
            id: generateId(),
            title: '择日飞升',
            author: '宅猪',
            platform: '起点中文网',
            status: 'ongoing',
            latestChapter: '第198章 飞升之门',
            chapterSummary: '',
            lastUpdateTime: yesterday.toISOString(),
            spoilerHours: 24,
            discussionRule: '玄幻修仙文，讨论可以大胆猜测剧情走向。',
            updateConfirmed: false,
            scheduleType: 'daily',
            scheduleDay: 1,
            scheduleTime: '18:00',
            nextUpdate: dayAfterTomorrow.toISOString(),
            discussionStatus: 'spoiler-ban',
            votes: { read: 10, unread: 28, feeding: 30 },
            createdAt: threeDaysAgo.toISOString()
        }
    ];

    saveBooks(sampleBooks);

    const books = getBooks();
    books.forEach((book, idx) => {
        if (!book.chapterHistory) book.chapterHistory = [];
        if (book.updateConfirmed && book.latestChapter) {
            book.chapterHistory.unshift({
                chapter: book.latestChapter,
                summary: book.chapterSummary || '',
                updateTime: book.lastUpdateTime,
                discussionStatus: book.discussionStatus,
                hasAnnouncement: idx < 2
            });
            const prevDate = new Date(book.lastUpdateTime);
            prevDate.setDate(prevDate.getDate() - 3);
            book.chapterHistory.push({
                chapter: `第${Math.floor(Math.random() * 100) + 100}章 上一章`,
                summary: '上一章的精彩内容...',
                updateTime: prevDate.toISOString(),
                discussionStatus: 'open',
                hasAnnouncement: true
            });
            const prevDate2 = new Date(prevDate);
            prevDate2.setDate(prevDate2.getDate() - 3);
            book.chapterHistory.push({
                chapter: `第${Math.floor(Math.random() * 100) + 90}章 再上一章`,
                summary: '再上一章的内容...',
                updateTime: prevDate2.toISOString(),
                discussionStatus: 'open',
                hasAnnouncement: true
            });
        }
    });
    saveBooks(books);

    const sampleAnnouncements = [
        {
            id: generateId(),
            bookId: sampleBooks[0].id,
            bookTitle: '道诡异仙',
            chapter: '第1244章 归途',
            content: '📢【更新通知】📢\n━━━━━━━━━━━━━━━\n📚 作品：《道诡异仙》\n✍️ 作者：狐尾的笔\n📖 最新章节：第1244章 归途\n━━━━━━━━━━━━━━━\n\n祝大家阅读愉快！',
            discussionStatus: 'open',
            createdAt: yesterday.toISOString(),
            copiedCount: 3,
            savedCount: 1,
            lastCopiedAt: yesterday.toISOString(),
            lastSavedAt: yesterday.toISOString()
        },
        {
            id: generateId(),
            bookId: sampleBooks[1].id,
            bookTitle: '深空彼岸',
            chapter: '第891章 旧神苏醒',
            content: '📢【更新通知】📢\n━━━━━━━━━━━━━━━\n📚 作品：《深空彼岸》\n✍️ 作者：辰东\n📖 最新章节：第891章 旧神苏醒\n━━━━━━━━━━━━━━━\n\n⚠️ 讨论需加剧透预警！\n\n祝大家阅读愉快！',
            discussionStatus: 'spoiler-limit',
            createdAt: twoDaysAgo.toISOString(),
            copiedCount: 0,
            savedCount: 1,
            lastCopiedAt: null,
            lastSavedAt: twoDaysAgo.toISOString()
        }
    ];

    localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(sampleAnnouncements));

    const sampleMyBooks = {};
    if (books.length >= 5) {
        sampleMyBooks[books[0].id] = { status: 'reading', note: '看到1240章了，太刺激', reminderTime: '20:00', updatedAt: new Date().toISOString() };
        sampleMyBooks[books[2].id] = { status: 'reading', note: '', reminderTime: '22:00', updatedAt: new Date().toISOString() };
        sampleMyBooks[books[4].id] = { status: 'waiting', note: '攒10章再看', reminderTime: '', updatedAt: new Date().toISOString() };
        sampleMyBooks[books[6].id] = { status: 'waiting', note: '', reminderTime: '14:00', updatedAt: new Date().toISOString() };
        sampleMyBooks[books[8].id] = { status: 'dropped', note: '等作者回来再追', reminderTime: '', updatedAt: new Date().toISOString() };
    }
    localStorage.setItem(MY_BOOKS_KEY, JSON.stringify(sampleMyBooks));
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

    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchAdminView(tab.dataset.adminView);
        });
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMemberFilter = btn.dataset.filter;
            renderBoard();
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

    document.getElementById('my-status-close').addEventListener('click', closeMyStatusModal);
    document.getElementById('timeline-close').addEventListener('click', closeChapterTimelineModal);

    document.getElementById('view-announcements-history-btn').addEventListener('click', openAnnouncementsHistoryModal);
    document.getElementById('announcements-history-close').addEventListener('click', closeAnnouncementsHistoryModal);

    document.getElementById('refresh-overview-btn').addEventListener('click', renderOverviewPage);

    document.getElementById('history-filter-book').addEventListener('change', renderAnnouncementsHistory);
    document.getElementById('history-filter-time').addEventListener('change', renderAnnouncementsHistory);
    document.getElementById('history-filter-status').addEventListener('change', renderAnnouncementsHistory);

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    document.addEventListener('click', (e) => {
        const viewHistoryBtn = e.target.closest('[data-action="view-chapter-history"]');
        if (viewHistoryBtn) {
            const bookId = viewHistoryBtn.dataset.bookId;
            e.stopPropagation();
            openChapterTimelineModal(bookId);
        }
    });

    renderAll();

    setInterval(() => {
        if (document.getElementById('board-view').classList.contains('active')) {
            renderBoard();
        }
    }, 60000);
}

document.addEventListener('DOMContentLoaded', init);
