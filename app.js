// ========== 数据层 ==========
const STORAGE_KEY = 'novel_tracker_books';
const VOTE_STORAGE_KEY = 'novel_tracker_votes';
const SPOILER_REVEAL_KEY = 'novel_tracker_spoiler_reveals';

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

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
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
        } else if (isThisWeek(book.lastUpdateTime) && book.updateConfirmed) {
            if (!isToday(book.lastUpdateTime)) {
                week.push(book);
            }
        } else if (book.status === 'ongoing') {
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

    today.sort(sortByUpdate);
    week.sort(sortByUpdate);
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

    renderBookList('today-list', today);
    renderBookList('week-list', week);
    renderBookList('watch-list', watch);
}

function renderBookList(containerId, books) {
    const container = document.getElementById(containerId);

    if (books.length === 0) {
        let emptyText = '暂无书籍';
        if (containerId === 'today-list') emptyText = '今天还没有更新的书哦～';
        if (containerId === 'week-list') emptyText = '本周没有预计更新的书～';
        if (containerId === 'watch-list') emptyText = '没有在观察的断更书籍～';

        container.innerHTML = `<div class="empty-state"><p>${emptyText}</p></div>`;
        return;
    }

    container.innerHTML = books.map(book => createBookCardHTML(book)).join('');

    container.querySelectorAll('.book-card').forEach(card => {
        card.addEventListener('click', () => {
            const bookId = card.dataset.bookId;
            openDetailModal(bookId);
        });
    });
}

function createBookCardHTML(book) {
    const userVotes = getUserVotes();
    const userVote = userVotes[book.id] || null;
    const spoilerActive = isSpoilerWindowActive(book);
    const reveals = getSpoilerReveals();
    const isRevealed = reveals[book.id] || false;
    const showSpoiler = !spoilerActive || isRevealed;

    const totalVotes = (book.votes?.read || 0) + (book.votes?.unread || 0) + (book.votes?.feeding || 0);

    const statusText = {
        'ongoing': '连载中',
        'completed': '已完结',
        'hiatus': '断更中'
    }[book.status] || '未知';

    const daysSince = daysSinceUpdate(book.lastUpdateTime);
    let updateText = '';
    if (isToday(book.lastUpdateTime)) {
        updateText = '今天更新';
    } else if (daysSince === 1) {
        updateText = '昨天更新';
    } else if (daysSince < 7) {
        updateText = `${daysSince}天前更新`;
    } else {
        updateText = `最后更新: ${formatDate(book.lastUpdateTime)}`;
    }

    let spoilerHTML = '';
    if (spoilerActive && !isRevealed) {
        const remaining = getSpoilerRemainingTime(book);
        spoilerHTML = `
            <div class="spoiler-warning">
                ⏰ 防剧透保护中，还有 ${formatSpoilerTime(remaining)} 解锁
            </div>
        `;
    }

    const summaryClass = spoilerActive && !isRevealed ? 'book-summary spoiler-blur' : 'book-summary';

    return `
        <div class="book-card" data-book-id="${book.id}">
            <div class="book-card-header">
                <div>
                    <span class="book-title">${escapeHtml(book.title)}</span>
                    <span class="book-author">· ${escapeHtml(book.author)}</span>
                </div>
            </div>
            <div class="book-meta">
                ${book.platform ? `<span class="book-tag platform">${escapeHtml(book.platform)}</span>` : ''}
                <span class="book-tag status-${book.status}">${statusText}</span>
            </div>
            <div class="book-chapter">📖 ${escapeHtml(book.latestChapter || '暂无章节信息')}</div>
            ${book.chapterSummary ? `<div class="${summaryClass}">${escapeHtml(book.chapterSummary)}</div>` : ''}
            ${spoilerHTML}
            <div class="book-footer">
                <span class="update-time">🕒 ${updateText}</span>
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

    container.innerHTML = books.map(book => `
        <div class="admin-book-item">
            <div class="admin-book-info">
                <h3>${escapeHtml(book.title)}</h3>
                <p>${escapeHtml(book.author)} · ${escapeHtml(book.platform || '未知平台')} · ${{
                    'ongoing': '连载中',
                    'completed': '已完结',
                    'hiatus': '断更中'
                }[book.status] || '未知'}</p>
                <p style="margin-top:4px;">最新: ${escapeHtml(book.latestChapter || '无')} · 更新: ${formatDate(book.lastUpdateTime)}</p>
            </div>
            <div class="admin-book-actions">
                <button class="btn btn-primary btn-small" onclick="openAnnouncementModal('${book.id}')">📢 群提醒</button>
                <button class="btn btn-secondary btn-small" onclick="openEditBookModal('${book.id}')">✏️ 编辑</button>
                <button class="btn btn-danger btn-small" onclick="deleteBook('${book.id}')">🗑️ 删除</button>
            </div>
        </div>
    `).join('');
}

// ========== 书籍管理 ==========
function openAddBookModal() {
    document.getElementById('modal-title').textContent = '添加书籍';
    document.getElementById('book-form').reset();
    document.getElementById('book-id').value = '';
    document.getElementById('book-update-date').valueAsDate = new Date();
    document.getElementById('book-spoiler-hours').value = 24;
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
        updateConfirmed: document.getElementById('book-update-confirmed').checked
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

    announcement += `💬 开放全剧情讨论时间：${discussMonth}月${discussDay}日 ${discussHour}:00 后\n`;
    announcement += '\n';
    announcement += '祝大家阅读愉快！🎉';

    return announcement;
}

function openAnnouncementModal(bookId) {
    const books = getBooks();
    const book = books.find(b => b.id === bookId);
    if (!book) return;

    const announcement = generateAnnouncement(book);
    document.getElementById('announcement-preview').textContent = announcement;
    document.getElementById('announcement-modal').classList.add('active');
}

function closeAnnouncementModal() {
    document.getElementById('announcement-modal').classList.remove('active');
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
    const showSpoiler = !spoilerActive || isRevealed;

    const statusText = {
        'ongoing': '连载中',
        'completed': '已完结',
        'hiatus': '断更中'
    }[book.status] || '未知';

    let spoilerTimerHTML = '';
    if (spoilerActive && !isRevealed) {
        const remaining = getSpoilerRemainingTime(book);
        spoilerTimerHTML = `
            <div class="spoiler-timer">
                ⏰ 防剧透保护中，还有 <strong>${formatSpoilerTime(remaining)}</strong> 自动解锁
                <button class="spoiler-reveal-btn" onclick="revealSpoiler('${bookId}')">我看完了，显示简介</button>
            </div>
        `;
    }

    const summaryClass = showSpoiler ? 'detail-summary' : 'detail-summary spoiler-blur';

    const voteReadClass = userVote === 'read' ? 'vote-option selected' : 'vote-option';
    const voteUnreadClass = userVote === 'unread' ? 'vote-option selected' : 'vote-option';
    const voteFeedingClass = userVote === 'feeding' ? 'vote-option selected' : 'vote-option';

    const detailHTML = `
        <div class="detail-book-header">
            <div class="detail-book-title">${escapeHtml(book.title)}</div>
            <div class="detail-book-author">作者：${escapeHtml(book.author)}</div>
            <div class="detail-meta-row">
                ${book.platform ? `<span class="book-tag platform">${escapeHtml(book.platform)}</span>` : ''}
                <span class="book-tag status-${book.status}">${statusText}</span>
            </div>
        </div>

        <div class="detail-section">
            <div class="detail-section-title">📖 最新章节</div>
            <div class="detail-chapter">${escapeHtml(book.latestChapter || '暂无章节信息')}</div>
            ${spoilerTimerHTML}
            ${book.chapterSummary ? `<div class="${summaryClass}" onclick="if(document.querySelector('.spoiler-blur')) revealSpoiler('${bookId}')">${escapeHtml(book.chapterSummary)}</div>` : '<p style="color:#95a5a6;font-size:13px;">暂无章节简介</p>'}
            <p style="font-size:12px;color:#95a5a6;margin-top:8px;">🕒 更新时间：${formatDateTime(book.lastUpdateTime)}</p>
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
            votes: { read: 19, unread: 8, feeding: 22 },
            createdAt: threeDaysAgo.toISOString()
        }
    ];

    saveBooks(sampleBooks);
}

// ========== 初始化 ==========
function init() {
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

    document.getElementById('detail-close').addEventListener('click', closeDetailModal);

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
