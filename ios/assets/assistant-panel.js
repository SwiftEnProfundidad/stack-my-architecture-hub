; (function () {
    var STORAGE_PREFIX = 'sma:assistant:';
    var KEY_OPEN = STORAGE_PREFIX + 'open';
    var KEY_MESSAGES = STORAGE_PREFIX + 'messages';
    var KEY_MODEL = STORAGE_PREFIX + 'model';
    var KEY_MAX_TOKENS = STORAGE_PREFIX + 'max_tokens';
    var KEY_PROXY_BASE = STORAGE_PREFIX + 'proxy_base';

    var VISION_FALLBACK_MODEL = 'gpt-4o-mini';
    var MEMORY_RECENT_LIMIT = 8;
    var MEMORY_SUMMARY_LIMIT = 1800;
    var IMAGE_MAX_ATTACHMENTS = 3;
    var IMAGE_MAX_BYTES = 3 * 1024 * 1024;
    var IMAGE_MAX_DIMENSION = 1280;
    var SMALL_PNG_MAX_BYTES = 350 * 1024;
    var JPEG_QUALITY = 0.85;
    var DAILY_WARNING_DEFAULT = 0.25;
    var CACHE_ENTRY_LIMIT = 30;
    var CACHE_MAX_IMAGES_BYTES = 1536 * 1024;

    var courseId = detectCourseId() || 'unknown';
    var KEY_MEMORY = 'sma:' + courseId + ':assistant:memory';
    var KEY_THREAD_ID = 'sma:' + courseId + ':assistant:thread_id';
    var KEY_HISTORY = 'sma:' + courseId + ':assistant:history';
    var KEY_CONVERSATION_SUMMARY = 'sma:' + courseId + ':assistant:conversation_summary';
    var KEY_CACHE = 'sma:' + courseId + ':assistant:cache';
    var KEY_CACHE_ENABLED = 'sma:' + courseId + ':assistant:cache_enabled';

    var state = {
        isOpen: localStorage.getItem(KEY_OPEN) === '1',
        model: localStorage.getItem(KEY_MODEL) || 'gpt-4o-mini',
        maxTokens: Number(localStorage.getItem(KEY_MAX_TOKENS) || 600),
        proxyBase: normalizeProxyBase(localStorage.getItem(KEY_PROXY_BASE) || defaultProxyBase()),
        threadId: readThreadId(),
        queryPath: '/assistant/query',
        messages: readMessages(),
        pendingAttachments: [],
        isLoading: false,
        metrics: null,
        lastRequest: null,
        currentSummary: readConversationSummary(),
        dailyWarningUsd: DAILY_WARNING_DEFAULT,
        schemaVersion: 1,
        memoryMaxTurns: MEMORY_RECENT_LIMIT,
        cacheEnabled: readCacheEnabled(),
        cacheEntries: readCacheEntries(),
        cacheHits: 0,
        cacheMisses: 0,
        availableModels: ['gpt-5.3', 'gpt-5.2', 'gpt-5.2-codex', 'gpt-4o-mini', 'gpt-4.1-mini'],
        maxAttachments: IMAGE_MAX_ATTACHMENTS,
        maxImageBytes: IMAGE_MAX_BYTES,
        maxImageDimension: IMAGE_MAX_DIMENSION,
        jpegQuality: JPEG_QUALITY,
        allowedImageTypes: ['image/png', 'image/jpeg'],
        visionModels: ['gpt-5.3*', 'gpt-5.2*', 'gpt-4.1-mini', VISION_FALLBACK_MODEL]
    };

    var refs = {
        panel: null,
        footer: null,
        body: null,
        textarea: null,
        status: null,
        modelSelect: null,
        tokensInput: null,
        proxyInput: null,
        cacheToggle: null,
        metricsBox: null,
        sendBtn: null,
        attachBtn: null,
        fileInput: null,
        attachmentsBox: null,
        attachmentsCounter: null,
        clearContextBtn: null,
        clearHistoryBtn: null,
        clearCacheBtn: null
    };

    function detectCourseId() {
        var meta = document.querySelector('meta[name="course-id"]');
        if (!meta || !meta.content) return null;
        var value = String(meta.content || '').trim();
        return value || null;
    }

    function readMessages() {
        try {
            var hasCourseHistory = localStorage.getItem(KEY_HISTORY) !== null;
            var raw = hasCourseHistory ? localStorage.getItem(KEY_HISTORY) : localStorage.getItem(KEY_MESSAGES);
            var parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed.slice(-40) : [];
        } catch (_err) {
            return [];
        }
    }

    function persistMessages() {
        var compact = state.messages.slice(-40).map(function (msg) {
            return {
                role: msg.role,
                text: msg.text,
                at: msg.at,
                cached: Boolean(msg.cached)
            };
        });
        localStorage.setItem(KEY_HISTORY, JSON.stringify(compact));
    }

    function readConversationSummary() {
        return String(localStorage.getItem(KEY_CONVERSATION_SUMMARY) || '').trim();
    }

    function persistConversationSummary(summary) {
        var normalized = String(summary || '').trim();
        if (!normalized) {
            localStorage.removeItem(KEY_CONVERSATION_SUMMARY);
            return;
        }
        localStorage.setItem(KEY_CONVERSATION_SUMMARY, normalized);
    }

    function readCacheEnabled() {
        var raw = localStorage.getItem(KEY_CACHE_ENABLED);
        if (raw === null) return true;
        return raw === '1';
    }

    function persistCacheEnabled() {
        localStorage.setItem(KEY_CACHE_ENABLED, state.cacheEnabled ? '1' : '0');
    }

    function readCacheEntries() {
        try {
            var raw = localStorage.getItem(KEY_CACHE);
            var parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) return [];
            return parsed
                .map(function (entry) {
                    if (!entry || typeof entry !== 'object') return null;
                    var key = String(entry.key || '').trim();
                    var answer = String(entry.answer || '').trim();
                    if (!key || !answer) return null;
                    return {
                        key: key,
                        answer: answer,
                        model: String(entry.model || '').trim(),
                        summary: String(entry.summary || '').trim(),
                        warning: String(entry.warning || '').trim(),
                        hasImages: Boolean(entry.hasImages),
                        imagesCount: Number(entry.imagesCount || 0),
                        usage: {
                            inputTokens: Number(entry.usage && entry.usage.inputTokens || 0),
                            outputTokens: Number(entry.usage && entry.usage.outputTokens || 0),
                            totalTokens: Number(entry.usage && entry.usage.totalTokens || 0),
                            estimatedCostUsd: Number(entry.usage && entry.usage.estimatedCostUsd || 0)
                        },
                        createdAt: Number(entry.createdAt || Date.now())
                    };
                })
                .filter(Boolean)
                .slice(-CACHE_ENTRY_LIMIT);
        } catch (_err) {
            return [];
        }
    }

    function persistCacheEntries() {
        try {
            localStorage.setItem(KEY_CACHE, JSON.stringify(state.cacheEntries.slice(-CACHE_ENTRY_LIMIT)));
        } catch (_err) {
        }
    }

    function clearCacheEntries() {
        state.cacheEntries = [];
        persistCacheEntries();
        setStatus('Caché del asistente limpiada.', 'success');
        renderMetrics(state.metrics);
    }

    function hashString(value) {
        var text = String(value || '');
        var hash = 2166136261;
        for (var i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);
            hash = (hash * 16777619) >>> 0;
        }
        return hash.toString(16);
    }

    function normalizePromptForCache(value) {
        return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function buildImagesSignature(images) {
        if (!Array.isArray(images) || !images.length) return 'no-images';
        return images.map(function (att) {
            var prefix = String(att && att.data || '').slice(0, 2048);
            var bytes = Number(att && att.size || 0);
            var type = String(att && att.type || '');
            return hashString(prefix + '|' + bytes + '|' + type);
        }).join(':');
    }

    function buildCacheContextVersion() {
        return hashString(String(state.threadId || '') + '|' + String(state.currentSummary || ''));
    }

    function shouldUseCacheForRequest(images) {
        if (!state.cacheEnabled) return false;
        if (Array.isArray(images) && images.length) return false;
        if (!Array.isArray(images) || !images.length) return true;
        var totalBytes = images.reduce(function (acc, item) {
            return acc + Number(item && item.size || 0);
        }, 0);
        return totalBytes <= CACHE_MAX_IMAGES_BYTES;
    }

    function buildCacheKey(params) {
        var model = String(params && params.model || '').trim();
        var prompt = normalizePromptForCache(params && params.prompt || '');
        var selection = String(params && params.selection || '').trim();
        var contextVersion = String(params && params.contextVersion || '');
        var imagesSignature = buildImagesSignature(params && params.images || []);

        return [
            'v1',
            model,
            hashString(prompt),
            hashString(selection),
            contextVersion,
            imagesSignature
        ].join('|');
    }

    function readCacheHit(cacheKey) {
        for (var i = 0; i < state.cacheEntries.length; i += 1) {
            var entry = state.cacheEntries[i];
            if (entry.key !== cacheKey) continue;
            state.cacheEntries.splice(i, 1);
            state.cacheEntries.push(entry);
            persistCacheEntries();
            return entry;
        }
        return null;
    }

    function writeCacheEntry(entry) {
        if (!entry || !entry.key || !entry.answer) return;
        state.cacheEntries = state.cacheEntries.filter(function (item) {
            return item.key !== entry.key;
        });
        state.cacheEntries.push(entry);
        if (state.cacheEntries.length > CACHE_ENTRY_LIMIT) {
            state.cacheEntries = state.cacheEntries.slice(-CACHE_ENTRY_LIMIT);
        }
        persistCacheEntries();
    }

    function readMemory() {
        try {
            var raw = localStorage.getItem(KEY_MEMORY);
            var parsed = raw ? JSON.parse(raw) : {};
            return normalizeMemory(parsed);
        } catch (_err) {
            return normalizeMemory({});
        }
    }

    function normalizeMemory(memory) {
        var parsed = memory && typeof memory === 'object' ? memory : {};
        var summary = truncateText(String(parsed.conversation_summary || ''), MEMORY_SUMMARY_LIMIT);
        var recent = Array.isArray(parsed.recent_messages) ? parsed.recent_messages : [];
        var normalizedRecent = recent
            .map(function (item) {
                if (!item || typeof item !== 'object') return null;
                var role = item.role === 'assistant' ? 'assistant' : 'user';
                var text = truncateText(String(item.text || ''), 900);
                if (!text) return null;
                return {
                    role: role,
                    text: text,
                    at: Number(item.at || Date.now())
                };
            })
            .filter(Boolean)
            .slice(-MEMORY_RECENT_LIMIT);

        return {
            conversation_summary: summary,
            recent_messages: normalizedRecent
        };
    }

    function saveMemory(memory) {
        var normalized = normalizeMemory(memory);
        localStorage.setItem(KEY_MEMORY, JSON.stringify(normalized));
    }

    function clearMemory() {
        localStorage.removeItem(KEY_MEMORY);
        localStorage.removeItem(KEY_CONVERSATION_SUMMARY);
        state.currentSummary = '';
        saveThreadId(generateThreadId());
        renderMetrics(state.metrics);
        setStatus('Contexto del asistente limpiado.', 'success');
    }

    function clearAssistantHistory() {
        localStorage.setItem(KEY_HISTORY, '[]');
        localStorage.removeItem(KEY_MEMORY);
        localStorage.removeItem(KEY_CONVERSATION_SUMMARY);
        state.messages = [];
        state.pendingAttachments = [];
        state.currentSummary = '';
        state.lastRequest = null;
        saveThreadId(generateThreadId());
        persistMessages();
        renderMessages();
        renderPendingAttachments();
        renderMetrics(state.metrics);
        setStatus('Historial del asistente borrado para este curso.', 'success');
    }

    function updateMemoryWithTurn(userText, assistantText) {
        var memory = readMemory();
        var now = Date.now();

        memory.recent_messages.push({
            role: 'user',
            text: truncateText(String(userText || ''), 900),
            at: now
        });
        memory.recent_messages.push({
            role: 'assistant',
            text: truncateText(String(assistantText || ''), 900),
            at: now + 1
        });

        if (memory.recent_messages.length > MEMORY_RECENT_LIMIT) {
            var overflow = memory.recent_messages.slice(0, memory.recent_messages.length - MEMORY_RECENT_LIMIT);
            memory.recent_messages = memory.recent_messages.slice(-MEMORY_RECENT_LIMIT);

            var digest = overflow.map(function (item) {
                return (item.role === 'assistant' ? 'A: ' : 'U: ') + truncateText(item.text, 160);
            }).join(' ');

            var mergedSummary = [memory.conversation_summary, digest]
                .filter(Boolean)
                .join(' ')
                .trim();

            memory.conversation_summary = truncateText(mergedSummary, MEMORY_SUMMARY_LIMIT);
        }

        saveMemory(memory);
    }

    function buildMemoryPayload() {
        var memory = readMemory();
        return {
            conversation_summary: memory.conversation_summary,
            recent_messages: memory.recent_messages.map(function (item) {
                return {
                    role: item.role,
                    text: item.text
                };
            })
        };
    }

    function truncateText(value, maxLen) {
        var text = String(value || '').replace(/\s+/g, ' ').trim();
        if (!text) return '';
        if (!maxLen || text.length <= maxLen) return text;
        return text.slice(0, Math.max(1, maxLen - 1)).trim() + '…';
    }

    function sanitizeThreadId(value) {
        var raw = String(value || '').trim();
        if (!raw) return '';
        var cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
        return cleaned.length >= 8 ? cleaned : '';
    }

    function generateThreadId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return 'thr-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }

    function saveThreadId(threadId) {
        var normalized = sanitizeThreadId(threadId) || generateThreadId();
        state.threadId = normalized;
        localStorage.setItem(KEY_THREAD_ID, normalized);
        return normalized;
    }

    function readThreadId() {
        var fromStorage = sanitizeThreadId(localStorage.getItem(KEY_THREAD_ID));
        if (fromStorage) return fromStorage;
        var created = generateThreadId();
        localStorage.setItem(KEY_THREAD_ID, created);
        return created;
    }

    function saveConfig() {
        localStorage.setItem(KEY_MODEL, state.model);
        localStorage.setItem(KEY_MAX_TOKENS, String(state.maxTokens));
        localStorage.setItem(KEY_PROXY_BASE, state.proxyBase);
    }

    function setOpen(isOpen) {
        state.isOpen = !!isOpen;
        localStorage.setItem(KEY_OPEN, state.isOpen ? '1' : '0');
        if (state.isOpen) document.body.classList.add('sma-assistant-open');
        else {
            document.body.classList.remove('sma-assistant-open');
            setDropzoneActive(false);
        }
    }

    function createPanel() {
        var panel = document.createElement('aside');
        panel.className = 'sma-assistant-panel';
        panel.setAttribute('aria-label', 'Panel de asistente IA');

        var header = document.createElement('div');
        header.className = 'sma-assistant-header';
        var title = document.createElement('div');
        title.className = 'sma-assistant-header-title';
        title.textContent = '💬 Asistente';
        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = 'Cerrar';
        closeBtn.addEventListener('click', function () {
            setOpen(false);
        });
        header.appendChild(title);
        header.appendChild(closeBtn);

        var config = document.createElement('details');
        config.className = 'sma-assistant-config';
        var summary = document.createElement('summary');
        summary.textContent = 'Configuración IA';
        config.appendChild(summary);

        var grid = document.createElement('div');
        grid.className = 'sma-assistant-config-grid';

        var modelLabel = document.createElement('label');
        modelLabel.textContent = 'Modelo';
        var modelSelect = document.createElement('select');
        state.availableModels.forEach(function (m) {
            var option = document.createElement('option');
            option.value = m;
            option.textContent = m;
            modelSelect.appendChild(option);
        });
        modelSelect.value = state.model;
        modelSelect.addEventListener('change', function () {
            state.model = modelSelect.value;
            saveConfig();
        });
        modelLabel.appendChild(modelSelect);

        var tokensLabel = document.createElement('label');
        tokensLabel.textContent = 'Máx tokens (recomendado 600)';
        var tokensInput = document.createElement('input');
        tokensInput.type = 'number';
        tokensInput.min = '100';
        tokensInput.max = '1200';
        tokensInput.step = '50';
        tokensInput.value = String(state.maxTokens);
        tokensInput.addEventListener('change', function () {
            var value = Number(tokensInput.value || 600);
            if (!value || value < 100) value = 600;
            if (value > 1200) value = 1200;
            state.maxTokens = value;
            tokensInput.value = String(value);
            saveConfig();
        });
        tokensLabel.appendChild(tokensInput);

        var proxyLabel = document.createElement('label');
        proxyLabel.textContent = 'Proxy local';
        var proxyInput = document.createElement('input');
        proxyInput.type = 'text';
        proxyInput.autocomplete = 'off';
        proxyInput.placeholder = 'http://localhost:8090';
        proxyInput.value = state.proxyBase;
        proxyInput.addEventListener('change', function () {
            state.proxyBase = normalizeProxyBase(proxyInput.value);
            proxyInput.value = state.proxyBase;
            saveConfig();
            refreshMetrics();
        });
        proxyLabel.appendChild(proxyInput);

        var cacheToggleLabel = document.createElement('label');
        cacheToggleLabel.className = 'assistant-cache-toggle';
        cacheToggleLabel.textContent = 'Usar caché';
        var cacheToggle = document.createElement('input');
        cacheToggle.type = 'checkbox';
        cacheToggle.checked = state.cacheEnabled;
        cacheToggle.addEventListener('change', function () {
            state.cacheEnabled = Boolean(cacheToggle.checked);
            persistCacheEnabled();
            renderMetrics(state.metrics);
            setStatus(state.cacheEnabled ? 'Caché activada.' : 'Caché desactivada.', 'success');
        });
        cacheToggleLabel.appendChild(cacheToggle);

        grid.appendChild(modelLabel);
        grid.appendChild(tokensLabel);
        grid.appendChild(proxyLabel);
        grid.appendChild(cacheToggleLabel);
        config.appendChild(grid);

        var metricsBox = document.createElement('div');
        metricsBox.className = 'sma-assistant-metrics';
        metricsBox.textContent = 'Métricas: cargando…';
        config.appendChild(metricsBox);

        var body = document.createElement('div');
        body.className = 'sma-assistant-body';

        var footer = document.createElement('div');
        footer.className = 'sma-assistant-footer';

        var attachmentsCounter = document.createElement('div');
        attachmentsCounter.className = 'assistant-attachments-summary';

        var attachmentsBox = document.createElement('div');
        attachmentsBox.className = 'assistant-attachments is-empty';

        var textarea = document.createElement('textarea');
        textarea.placeholder = 'Pregunta algo sobre el contenido seleccionado o sobre el tema actual.';

        var fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.className = 'assistant-file-input';
        fileInput.accept = 'image/png,image/jpeg';
        fileInput.multiple = true;
        fileInput.addEventListener('change', function () {
            handleSelectedFiles(fileInput.files);
            fileInput.value = '';
        });

        var actions = document.createElement('div');
        actions.className = 'sma-assistant-footer-actions';

        var attachmentsTip = document.createElement('div');
        attachmentsTip.className = 'assistant-attachments-tip';
        attachmentsTip.textContent = 'Tip: puedes pegar capturas con ⌘V / Ctrl+V';

        var attachBtn = document.createElement('button');
        attachBtn.type = 'button';
        attachBtn.textContent = '📎 Adjuntar imagen';
        attachBtn.addEventListener('click', function () {
            if (state.isLoading || !refs.fileInput) return;
            refs.fileInput.click();
        });

        var clearContextBtn = document.createElement('button');
        clearContextBtn.type = 'button';
        clearContextBtn.textContent = '🧹 Limpiar contexto';
        clearContextBtn.addEventListener('click', function () {
            clearMemory();
        });

        var clearHistoryBtn = document.createElement('button');
        clearHistoryBtn.type = 'button';
        clearHistoryBtn.textContent = '🗑 Borrar historial IA';
        clearHistoryBtn.addEventListener('click', function () {
            clearAssistantHistory();
        });

        var clearCacheBtn = document.createElement('button');
        clearCacheBtn.type = 'button';
        clearCacheBtn.textContent = '🧽 Limpiar caché';
        clearCacheBtn.addEventListener('click', function () {
            clearCacheEntries();
        });

        var clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.textContent = 'Limpiar panel';
        clearBtn.addEventListener('click', function () {
            state.messages = [];
            persistMessages();
            renderMessages();
            setStatus('Panel limpio. El contexto del hilo se mantiene.', 'success');
        });

        var sendBtn = document.createElement('button');
        sendBtn.type = 'button';
        sendBtn.textContent = 'Consultar';
        sendBtn.addEventListener('click', function () {
            submitQuestion(textarea.value);
        });

        actions.appendChild(attachBtn);
        actions.appendChild(clearCacheBtn);
        actions.appendChild(clearContextBtn);
        actions.appendChild(clearHistoryBtn);
        actions.appendChild(clearBtn);
        actions.appendChild(sendBtn);

        var status = document.createElement('div');
        status.className = 'sma-assistant-status';

        footer.appendChild(attachmentsCounter);
        footer.appendChild(attachmentsBox);
        footer.appendChild(attachmentsTip);
        footer.appendChild(textarea);
        footer.appendChild(fileInput);
        footer.appendChild(actions);
        footer.appendChild(status);

        panel.appendChild(header);
        panel.appendChild(config);
        panel.appendChild(body);
        panel.appendChild(footer);
        document.body.appendChild(panel);

        refs.panel = panel;
        refs.footer = footer;
        refs.body = body;
        refs.textarea = textarea;
        refs.status = status;
        refs.modelSelect = modelSelect;
        refs.tokensInput = tokensInput;
        refs.proxyInput = proxyInput;
        refs.cacheToggle = cacheToggle;
        refs.metricsBox = metricsBox;
        refs.sendBtn = sendBtn;
        refs.attachBtn = attachBtn;
        refs.fileInput = fileInput;
        refs.attachmentsBox = attachmentsBox;
        refs.attachmentsCounter = attachmentsCounter;
        refs.clearContextBtn = clearContextBtn;
        refs.clearHistoryBtn = clearHistoryBtn;
        refs.clearCacheBtn = clearCacheBtn;

        registerClipboardHandler();
        registerDropHandlers();

        setOpen(state.isOpen);
        renderMessages();
        renderPendingAttachments();
        setStatus('Listo. Selecciona texto o escribe una consulta.');
        fetchBridgeConfig();
        refreshMetrics();
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function pushMessage(role, text, attachments, meta) {
        var details = meta && typeof meta === 'object' ? meta : {};
        state.messages.push({
            role: role,
            text: String(text || ''),
            at: Date.now(),
            attachments: Array.isArray(attachments) ? attachments.slice(0, state.maxAttachments) : [],
            cached: Boolean(details.cached)
        });
        if (state.messages.length > 40) state.messages = state.messages.slice(-40);
        persistMessages();
        renderMessages();
    }

    function renderMessages() {
        if (!refs.body) return;
        refs.body.innerHTML = '';
        if (!state.messages.length) {
            var empty = document.createElement('div');
            empty.className = 'sma-assistant-msg assistant';
            empty.textContent = 'Sin mensajes todavía.';
            refs.body.appendChild(empty);
            return;
        }

        state.messages.forEach(function (msg) {
            var row = document.createElement('div');
            row.className = 'sma-assistant-msg ' + (msg.role === 'user' ? 'user' : 'assistant');

            var textBlock = document.createElement('div');
            textBlock.className = 'assistant-msg-text';
            textBlock.textContent = msg.text;
            row.appendChild(textBlock);

            if (msg.role === 'assistant' && msg.cached) {
                var badge = document.createElement('span');
                badge.className = 'assistant-msg-badge';
                badge.textContent = '(cache)';
                row.appendChild(badge);
            }

            if (Array.isArray(msg.attachments) && msg.attachments.length) {
                var images = document.createElement('div');
                images.className = 'assistant-msg-images';
                msg.attachments.forEach(function (att) {
                    var item = document.createElement('div');
                    item.className = 'assistant-msg-image-item';
                    var img = document.createElement('img');
                    img.src = att.dataUrl;
                    img.alt = att.name || 'Imagen adjunta';
                    var cap = document.createElement('div');
                    cap.className = 'assistant-msg-image-caption';
                    cap.textContent = att.name || 'imagen';
                    item.appendChild(img);
                    item.appendChild(cap);
                    images.appendChild(item);
                });
                row.appendChild(images);
            }

            refs.body.appendChild(row);
        });

        refs.body.scrollTop = refs.body.scrollHeight;
    }

    function startNewConversation() {
        saveThreadId(generateThreadId());
        state.messages = [];
        persistMessages();
        state.pendingAttachments = [];
        state.lastRequest = null;
        state.currentSummary = '';
        persistConversationSummary('');
        renderMessages();
        renderPendingAttachments();
        renderMetrics(state.metrics);
        setStatus('Nueva conversación iniciada.', 'success');
    }

    function isAssistantInteractionTarget(target) {
        return Boolean(state.isOpen && refs.panel && target && refs.panel.contains(target));
    }

    function shouldHandleClipboardImage(event) {
        if (!state.isOpen || !refs.panel || state.isLoading) return false;
        var target = event && event.target;
        if (isAssistantInteractionTarget(target)) return true;
        var active = document.activeElement;
        return Boolean(active && refs.panel.contains(active));
    }

    function extractClipboardImageFiles(event) {
        var clipboard = event && event.clipboardData;
        var items = clipboard && clipboard.items ? Array.prototype.slice.call(clipboard.items) : [];
        if (!items.length) return [];

        return items
            .filter(function (item) {
                return item && item.kind === 'file' && /^image\/(png|jpeg|jpg)$/i.test(String(item.type || ''));
            })
            .map(function (item, index) {
                var blob = item.getAsFile();
                if (!blob) return null;
                var type = normalizeImageType(blob.type);
                var ext = type === 'image/png' ? 'png' : 'jpg';
                return new File([blob], 'paste-' + Date.now() + '-' + index + '.' + ext, {
                    type: type,
                    lastModified: Date.now()
                });
            })
            .filter(Boolean);
    }

    function registerClipboardHandler() {
        document.addEventListener('paste', function (event) {
            if (!shouldHandleClipboardImage(event)) return;
            var files = extractClipboardImageFiles(event);
            if (!files.length) return;
            processIncomingFiles(files, 'pegado');
        });
    }

    function extractDropImageFiles(event) {
        var transfer = event && event.dataTransfer;
        if (!transfer) return [];
        var files = transfer.files ? Array.prototype.slice.call(transfer.files) : [];
        return files.filter(function (file) {
            var type = normalizeImageType(file && file.type);
            return type === 'image/png' || type === 'image/jpeg';
        });
    }

    function setDropzoneActive(active) {
        if (!refs.footer) return;
        if (active) refs.footer.classList.add('is-drop-active');
        else refs.footer.classList.remove('is-drop-active');
    }

    function registerDropHandlers() {
        if (!refs.footer || !refs.attachmentsBox || !refs.textarea) return;

        [refs.footer, refs.attachmentsBox, refs.textarea].forEach(function (target) {
            target.addEventListener('dragover', function (event) {
                var files = extractDropImageFiles(event);
                if (!files.length) return;
                event.preventDefault();
                setDropzoneActive(true);
            });

            target.addEventListener('dragleave', function (event) {
                if (refs.footer && refs.footer.contains(event.relatedTarget)) return;
                setDropzoneActive(false);
            });

            target.addEventListener('drop', function (event) {
                var files = extractDropImageFiles(event);
                if (!files.length) return;
                event.preventDefault();
                setDropzoneActive(false);
                processIncomingFiles(files, 'arrastre');
            });
        });
    }

    function setLoadingState(isLoading) {
        state.isLoading = !!isLoading;
        if (refs.sendBtn) {
            refs.sendBtn.disabled = state.isLoading;
            refs.sendBtn.textContent = state.isLoading ? 'Enviando…' : 'Consultar';
        }
        if (refs.attachBtn) refs.attachBtn.disabled = state.isLoading;
        if (refs.clearContextBtn) refs.clearContextBtn.disabled = state.isLoading;
        if (refs.clearHistoryBtn) refs.clearHistoryBtn.disabled = state.isLoading;
        if (refs.clearCacheBtn) refs.clearCacheBtn.disabled = state.isLoading;
        if (refs.cacheToggle) refs.cacheToggle.disabled = state.isLoading;
    }

    function setStatus(text, tone) {
        if (!refs.status) return;
        refs.status.textContent = text;
        refs.status.className = 'sma-assistant-status';
        if (tone === 'warning') refs.status.classList.add('is-warning');
        if (tone === 'error') refs.status.classList.add('is-error');
        if (tone === 'success') refs.status.classList.add('is-success');
    }

    function formatBytes(size) {
        var n = Number(size || 0);
        if (n < 1024) return n + ' B';
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
        return (n / (1024 * 1024)).toFixed(2) + ' MB';
    }

    function normalizeProxyBase(value) {
        var raw = String(value || '').trim();
        if (!raw) return defaultProxyBase();
        return raw.replace(/\/$/, '');
    }

    function defaultProxyBase() {
        if (location.protocol === 'file:') return 'http://localhost:8090';
        var host = location && location.hostname ? location.hostname : '';
        if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8090';
        var origin = String(location.origin || '').trim();
        if (!origin || origin === 'null') return 'http://localhost:8090';
        return origin;
    }

    function proxyCandidates() {
        var list = [
            normalizeProxyBase(state.proxyBase),
            defaultProxyBase(),
            'http://localhost:8090',
            'http://localhost:8787'
        ];

        if (location.protocol === 'http:' || location.protocol === 'https:') {
            var origin = normalizeProxyBase(location.origin);
            if (origin) list.push(origin);
        }

        return uniqueList(list.filter(Boolean));
    }

    function uniqueList(list) {
        var seen = {};
        var out = [];
        (list || []).forEach(function (item) {
            var key = String(item || '').trim();
            if (!key || seen[key]) return;
            seen[key] = true;
            out.push(key);
        });
        return out;
    }

    function modelMatchesPattern(model, pattern) {
        var normalizedModel = String(model || '').trim();
        var normalizedPattern = String(pattern || '').trim();
        if (!normalizedModel || !normalizedPattern) return false;
        if (normalizedPattern.slice(-1) === '*') {
            return normalizedModel.indexOf(normalizedPattern.slice(0, -1)) === 0;
        }
        return normalizedModel === normalizedPattern;
    }

    function supportsVisionModel(model) {
        var normalizedModel = String(model || '').trim();
        if (!normalizedModel) return false;
        return state.visionModels.some(function (pattern) {
            return modelMatchesPattern(normalizedModel, pattern);
        });
    }

    function updateAttachmentCounter(note, tone) {
        if (!refs.attachmentsCounter) return;
        refs.attachmentsCounter.className = 'assistant-attachments-summary';
        if (tone === 'warning') refs.attachmentsCounter.classList.add('is-warning');
        if (tone === 'error') refs.attachmentsCounter.classList.add('is-error');

        var base = 'Imágenes: ' + state.pendingAttachments.length + ' / ' + state.maxAttachments;
        refs.attachmentsCounter.textContent = note ? base + ' · ' + note : base;
    }

    function renderPendingAttachments(note, tone) {
        if (!refs.attachmentsBox) return;

        refs.attachmentsBox.innerHTML = '';
        if (!state.pendingAttachments.length) {
            refs.attachmentsBox.classList.add('is-empty');
        } else {
            refs.attachmentsBox.classList.remove('is-empty');

            state.pendingAttachments.forEach(function (att) {
                var row = document.createElement('div');
                row.className = 'assistant-image-preview';

                var thumb = document.createElement('img');
                thumb.className = 'assistant-image-thumb';
                thumb.src = att.dataUrl;
                thumb.alt = att.name || 'Imagen';

                var info = document.createElement('div');
                info.className = 'assistant-image-meta';

                var name = document.createElement('div');
                name.className = 'assistant-image-name';
                name.textContent = att.name;

                var size = document.createElement('div');
                size.className = 'assistant-image-size';
                size.textContent = formatBytes(att.size) + ' · ' + (att.type === 'image/png' ? 'PNG' : 'JPEG');

                info.appendChild(name);
                info.appendChild(size);

                var remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'assistant-image-remove';
                remove.textContent = '❌';
                remove.title = 'Quitar imagen';
                remove.setAttribute('data-attachment-id', att.id);
                remove.addEventListener('click', function () {
                    state.pendingAttachments = state.pendingAttachments.filter(function (item) {
                        return item.id !== att.id;
                    });
                    renderPendingAttachments();
                    setStatus('Imagen eliminada.', 'success');
                });

                row.appendChild(thumb);
                row.appendChild(info);
                row.appendChild(remove);
                refs.attachmentsBox.appendChild(row);
            });
        }

        updateAttachmentCounter(note, tone);
    }

    function readFileAsDataUrl(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(String(reader.result || '')); };
            reader.onerror = function () { reject(new Error('No se pudo leer la imagen.')); };
            reader.readAsDataURL(file);
        });
    }

    function readBlobAsDataUrl(blob) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(String(reader.result || '')); };
            reader.onerror = function () { reject(new Error('No se pudo convertir la imagen procesada.')); };
            reader.readAsDataURL(blob);
        });
    }

    function loadImageFromDataUrl(dataUrl) {
        return new Promise(function (resolve, reject) {
            var image = new Image();
            image.onload = function () { resolve(image); };
            image.onerror = function () { reject(new Error('No se pudo procesar la imagen seleccionada.')); };
            image.src = dataUrl;
        });
    }

    function canvasToBlob(canvas, type, quality) {
        return new Promise(function (resolve) {
            canvas.toBlob(function (blob) {
                resolve(blob || null);
            }, type, quality);
        });
    }

    function base64ByteLength(base64) {
        var normalized = String(base64 || '').replace(/\s+/g, '');
        if (!normalized) return 0;
        var padding = 0;
        if (normalized.endsWith('==')) padding = 2;
        else if (normalized.endsWith('=')) padding = 1;
        return Math.floor((normalized.length * 3) / 4) - padding;
    }

    function normalizeImageType(type) {
        var normalized = String(type || '').toLowerCase();
        if (normalized === 'image/jpg') normalized = 'image/jpeg';
        return normalized;
    }

    function compressImage(file) {
        var inputType = normalizeImageType(file.type);

        if (state.allowedImageTypes.indexOf(inputType) < 0) {
            return Promise.reject(new Error((file.name || 'archivo') + ': formato no permitido (solo PNG o JPEG).'));
        }

        return readFileAsDataUrl(file)
            .then(function (dataUrl) {
                return loadImageFromDataUrl(dataUrl).then(function (image) {
                    var width = image.width;
                    var height = image.height;
                    var maxSide = Math.max(width, height);
                    var scale = maxSide > state.maxImageDimension ? (state.maxImageDimension / maxSide) : 1;
                    var targetWidth = Math.max(1, Math.round(width * scale));
                    var targetHeight = Math.max(1, Math.round(height * scale));

                    var canvas = document.createElement('canvas');
                    canvas.width = targetWidth;
                    canvas.height = targetHeight;

                    var context = canvas.getContext('2d');
                    if (!context) {
                        throw new Error((file.name || 'archivo') + ': no se pudo inicializar canvas para compresión.');
                    }

                    context.drawImage(image, 0, 0, targetWidth, targetHeight);

                    var keepPng = inputType === 'image/png' && file.size <= SMALL_PNG_MAX_BYTES && scale >= 0.999;
                    var outputType = keepPng ? 'image/png' : 'image/jpeg';
                    var quality = keepPng ? 0.92 : state.jpegQuality;

                    return canvasToBlob(canvas, outputType, quality)
                        .then(function (blob) {
                            if (!blob) {
                                throw new Error((file.name || 'archivo') + ': no se pudo generar imagen comprimida.');
                            }

                            if (blob.size > state.maxImageBytes) {
                                throw new Error((file.name || 'archivo') + ': supera 3MB tras compresión.');
                            }

                            return readBlobAsDataUrl(blob).then(function (processedDataUrl) {
                                var base64 = String(processedDataUrl.split(',')[1] || '').trim();
                                var sizeBytes = base64ByteLength(base64);

                                if (!base64 || !sizeBytes) {
                                    throw new Error((file.name || 'archivo') + ': no se pudo serializar imagen en base64.');
                                }

                                if (sizeBytes > state.maxImageBytes) {
                                    throw new Error((file.name || 'archivo') + ': supera 3MB tras compresión.');
                                }

                                return {
                                    id: 'att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
                                    name: truncateText(file.name || 'imagen', 90),
                                    type: outputType,
                                    size: sizeBytes,
                                    data: base64,
                                    dataUrl: processedDataUrl
                                };
                            });
                        });
                });
            });
    }

    function processIncomingFiles(fileList, sourceLabel) {
        var files = Array.prototype.slice.call(fileList || [])
            .filter(function (file) {
                var type = normalizeImageType(file && file.type);
                return type === 'image/png' || type === 'image/jpeg';
            });

        if (!files.length) return;

        var remainingSlots = state.maxAttachments - state.pendingAttachments.length;
        if (remainingSlots <= 0) {
            setStatus('Límite: ' + state.maxAttachments + ' imágenes', 'warning');
            updateAttachmentCounter('Límite alcanzado', 'warning');
            return;
        }

        var accepted = files.slice(0, remainingSlots);
        var ignoredCount = files.length - accepted.length;

        Promise.allSettled(accepted.map(compressImage))
            .then(function (results) {
                var processed = [];
                var failed = [];

                results.forEach(function (result) {
                    if (result.status === 'fulfilled') {
                        processed.push(result.value);
                        return;
                    }
                    failed.push(result.reason && result.reason.message ? result.reason.message : 'imagen inválida');
                });

                if (processed.length) {
                    state.pendingAttachments = state.pendingAttachments.concat(processed).slice(0, state.maxAttachments);
                }

                if (failed.length) {
                    setStatus(failed[0], 'warning');
                    renderPendingAttachments('Revisa formato y tamaño', 'warning');
                    return;
                }

                if (ignoredCount > 0) {
                    setStatus('Se ignoraron ' + ignoredCount + ' imagen(es) por límite.', 'warning');
                    renderPendingAttachments('Se ignoraron ' + ignoredCount + ' imagen(es)', 'warning');
                    return;
                }

                var origin = sourceLabel ? ' (' + sourceLabel + ')' : '';
                setStatus('Imágenes listas para enviar' + origin + '.', 'success');
                renderPendingAttachments();
            });
    }

    function handleSelectedFiles(fileList) {
        processIncomingFiles(fileList, 'selector');
    }

    function normalizeUsage(responseJson) {
        var usage = responseJson && responseJson.usage ? responseJson.usage : {};

        var inputTokens = Number(
            usage.inputTokens ||
            usage.input_tokens ||
            usage.prompt_tokens ||
            responseJson.inputTokens ||
            responseJson.input_tokens ||
            responseJson.prompt_tokens ||
            0
        );

        var outputTokens = Number(
            usage.outputTokens ||
            usage.output_tokens ||
            usage.completion_tokens ||
            responseJson.outputTokens ||
            responseJson.output_tokens ||
            responseJson.completion_tokens ||
            0
        );

        var totalTokens = Number(
            usage.totalTokens ||
            usage.total_tokens ||
            responseJson.totalTokens ||
            responseJson.total_tokens ||
            inputTokens + outputTokens
        );

        var estimatedCostUsd = Number(
            usage.estimatedCostUsd ||
            usage.estimated_cost_usd ||
            responseJson.estimatedCostUsd ||
            responseJson.estimated_cost_usd ||
            0
        );

        return {
            inputTokens: inputTokens,
            outputTokens: outputTokens,
            totalTokens: totalTokens,
            estimatedCostUsd: estimatedCostUsd
        };
    }

    function normalizeMetrics(metrics) {
        var input = metrics && typeof metrics === 'object' ? metrics : {};
        var daily = input.daily && typeof input.daily === 'object' ? input.daily : {};

        return {
            totalRequests: Number(input.total_requests || input.totalRequests || input.requests || 0),
            totalTokens: Number(input.total_tokens || input.totalTokens || 0),
            totalEstimatedCostUsd: Number(
                input.total_estimated_cost_usd ||
                input.totalEstimatedCostUsd ||
                input.session_total_cost_usd ||
                input.estimatedCostUsd ||
                0
            ),
            dailyCostUsd: Number(daily.estimated_cost_usd || daily.estimatedCostUsd || input.dailyCostUsd || 0),
            dailyImagesCount: Number(daily.images_count || daily.imagesCount || 0),
            softDailyBudgetUsd: Number(input.soft_daily_budget_usd || input.softDailyBudgetUsd || 0)
        };
    }

    function renderMetrics(metrics) {
        state.metrics = metrics || state.metrics;

        if (!refs.metricsBox) return;

        var normalized = normalizeMetrics(state.metrics || {});
        var last = state.lastRequest;
        var lines = [];

        if (last) {
            var modelLine = '<div><strong>Modelo activo</strong>: ' + escapeHtml(last.model || state.model) + '</div>';
            lines.push(modelLine);
            lines.push('<div><strong>Thread</strong>: <code>' + escapeHtml(last.threadId || state.threadId || '-') + '</code></div>');
            if (last.cached) {
                lines.push('<div><strong>Fuente</strong>: caché local</div>');
            }
            lines.push('<div><strong>Última consulta</strong>: ' + last.inputTokens + ' / ' + last.outputTokens + ' / ' + last.totalTokens + ' tokens</div>');
            lines.push('<div><strong>Coste última consulta</strong>: ' + Number(last.estimatedCostUsd || 0).toFixed(6) + ' USD</div>');
            lines.push('<div><strong>Consulta con imágenes</strong>: ' + (last.hasImages ? 'Sí (' + last.imagesCount + ')' : 'No') + '</div>');
            if (last.warning) {
                lines.push('<div class="assistant-metric-warning"><strong>Aviso</strong>: ' + escapeHtml(last.warning) + '</div>');
            }
        } else {
            lines.push('<div><strong>Modelo activo</strong>: ' + escapeHtml(state.model) + '</div>');
            lines.push('<div><strong>Thread</strong>: <code>' + escapeHtml(state.threadId || '-') + '</code></div>');
            lines.push('<div>Sin consultas recientes en esta sesión.</div>');
        }

        if (state.currentSummary) {
            lines.push('<div><strong>Resumen memoria</strong>: ' + escapeHtml(state.currentSummary) + '</div>');
        }

        lines.push('<div><strong>Coste acumulado del día</strong>: ' + normalized.dailyCostUsd.toFixed(6) + ' USD</div>');
        lines.push('<div><strong>Coste total de sesión</strong>: ' + normalized.totalEstimatedCostUsd.toFixed(6) + ' USD</div>');
        lines.push('<div><strong>Requests totales</strong>: ' + normalized.totalRequests + '</div>');
        lines.push('<div><strong>Caché (sesión)</strong>: hits ' + state.cacheHits + ' · misses ' + state.cacheMisses + '</div>');

        if (normalized.softDailyBudgetUsd > 0) {
            lines.push('<div><strong>Presupuesto diario</strong>: ' + normalized.dailyCostUsd.toFixed(6) + ' / ' + normalized.softDailyBudgetUsd.toFixed(2) + ' USD</div>');
        }

        if (normalized.dailyCostUsd >= state.dailyWarningUsd) {
            lines.push('<div class="assistant-metric-warning"><strong>Umbral diario</strong>: coste diario superior a ' + state.dailyWarningUsd.toFixed(2) + ' USD.</div>');
        }

        refs.metricsBox.innerHTML = lines.join('');
    }

    function proxyUrl(path) {
        var base = normalizeProxyBase(state.proxyBase);
        var normalizedPath = String(path || '').trim();
        if (!normalizedPath.startsWith('/')) normalizedPath = '/' + normalizedPath;
        return base + normalizedPath;
    }

    function checkProxy(base) {
        return fetch(normalizeProxyBase(base) + '/health', { method: 'GET' })
            .then(function (res) { return res.ok; })
            .catch(function () { return false; });
    }

    function ensureProxyBaseReachable() {
        var candidates = proxyCandidates();

        function probe(index) {
            if (index >= candidates.length) return Promise.resolve(false);
            var candidate = candidates[index];
            return checkProxy(candidate).then(function (ok) {
                if (!ok) return probe(index + 1);
                if (state.proxyBase !== candidate) {
                    state.proxyBase = candidate;
                    if (refs.proxyInput) refs.proxyInput.value = candidate;
                    saveConfig();
                }
                return true;
            });
        }

        return probe(0);
    }

    function queryPathCandidates() {
        return uniqueList([
            state.queryPath,
            '/assistant/query',
            '/ask'
        ]);
    }

    function parseJsonSafe(text) {
        try {
            return JSON.parse(text);
        } catch (_err) {
            return null;
        }
    }

    function postQueryWithFallback(payload, signal) {
        var paths = queryPathCandidates();

        function tryPath(index) {
            if (index >= paths.length) {
                return Promise.reject(new Error('No se encontró endpoint de consulta válido en el proxy.'));
            }

            var path = paths[index];
            return fetch(proxyUrl(path), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: signal
            }).then(function (res) {
                return res.text().then(function (text) {
                    var json = parseJsonSafe(text) || {};

                    if ((res.status === 404 || res.status === 405) && index + 1 < paths.length) {
                        return tryPath(index + 1);
                    }

                    if (!res.ok) {
                        var errorText = json.error || json.detail || ('HTTP ' + res.status);
                        throw new Error(String(errorText));
                    }

                    if (state.queryPath !== path) {
                        state.queryPath = path;
                    }

                    return json;
                });
            });
        }

        return tryPath(0);
    }

    function fetchBridgeConfig() {
        return ensureProxyBaseReachable()
            .then(function (ok) {
                if (!ok) {
                    setStatus('Asistente no disponible. Inicia open-proxy.command', 'warning');
                    return null;
                }
                return fetch(proxyUrl('/config'));
            })
            .then(function (res) {
                if (!res) return null;
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (cfg) {
                if (!cfg) return;

                var schemaVersion = Number(cfg.schemaVersion || cfg.schema_version || 1);
                state.schemaVersion = Number.isFinite(schemaVersion) && schemaVersion > 0 ? Math.round(schemaVersion) : 1;

                var models = Array.isArray(cfg.models) && cfg.models.length ? cfg.models : state.availableModels;
                state.availableModels = models;

                if (!models.includes(state.model)) {
                    state.model = cfg.default_model || models[0];
                    saveConfig();
                }

                if (refs.modelSelect) {
                    refs.modelSelect.innerHTML = '';
                    models.forEach(function (m) {
                        var option = document.createElement('option');
                        option.value = m;
                        option.textContent = m;
                        refs.modelSelect.appendChild(option);
                    });
                    refs.modelSelect.value = state.model;
                }

                if (cfg.max_tokens_default && !localStorage.getItem(KEY_MAX_TOKENS)) {
                    state.maxTokens = Number(cfg.max_tokens_default);
                    if (refs.tokensInput) refs.tokensInput.value = String(state.maxTokens);
                }

                if (cfg.query_path || cfg.queryPath) {
                    state.queryPath = String(cfg.query_path || cfg.queryPath);
                }

                var imagesCfg = cfg.images && typeof cfg.images === 'object' ? cfg.images : {};
                var memoryCfg = cfg.memory && typeof cfg.memory === 'object' ? cfg.memory : {};

                if (imagesCfg.maxCount || cfg.max_images || cfg.maxImages) {
                    var maxCount = Number(imagesCfg.maxCount || cfg.max_images || cfg.maxImages) || IMAGE_MAX_ATTACHMENTS;
                    state.maxAttachments = Math.max(1, Math.min(3, maxCount));
                }

                if (imagesCfg.maxBytes || cfg.max_image_bytes || cfg.maxImageBytes) {
                    var maxBytesCfg = Number(imagesCfg.maxBytes || cfg.max_image_bytes || cfg.maxImageBytes);
                    if (Number.isFinite(maxBytesCfg) && maxBytesCfg > 0) {
                        state.maxImageBytes = maxBytesCfg;
                    }
                }

                if (imagesCfg.maxWidth) {
                    var maxWidthCfg = Number(imagesCfg.maxWidth);
                    if (Number.isFinite(maxWidthCfg) && maxWidthCfg > 0) {
                        state.maxImageDimension = Math.round(maxWidthCfg);
                    }
                }

                if (imagesCfg.jpegQuality) {
                    var jpegCfg = Number(imagesCfg.jpegQuality);
                    if (Number.isFinite(jpegCfg) && jpegCfg > 0 && jpegCfg <= 1) {
                        state.jpegQuality = jpegCfg;
                    }
                }

                if (memoryCfg.maxTurns) {
                    var maxTurnsCfg = Number(memoryCfg.maxTurns);
                    if (Number.isFinite(maxTurnsCfg) && maxTurnsCfg > 0) {
                        state.memoryMaxTurns = Math.round(maxTurnsCfg);
                    }
                }

                if (Array.isArray(cfg.vision_models) && cfg.vision_models.length) {
                    state.visionModels = cfg.vision_models.map(function (value) {
                        return String(value || '').trim();
                    }).filter(Boolean);
                }

                if (cfg.daily_warning_usd || cfg.dailyWarningUsd) {
                    var dailyWarn = Number(cfg.daily_warning_usd || cfg.dailyWarningUsd);
                    if (Number.isFinite(dailyWarn) && dailyWarn > 0) {
                        state.dailyWarningUsd = dailyWarn;
                    }
                }

                renderPendingAttachments();
            })
            .catch(function () {
                setStatus('Asistente no disponible. Inicia open-proxy.command', 'warning');
            });
    }

    function refreshMetrics() {
        return ensureProxyBaseReachable()
            .then(function (ok) {
                if (!ok) {
                    renderMetrics(null);
                    return null;
                }
                return fetch(proxyUrl('/metrics'));
            })
            .then(function (res) {
                if (!res) return null;
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (metrics) {
                if (!metrics) return;
                renderMetrics(metrics);
            })
            .catch(function () {
                renderMetrics(null);
            });
    }

    function extractAnswer(responseJson) {
        if (responseJson && typeof responseJson.answer === 'string' && responseJson.answer.trim()) {
            return responseJson.answer.trim();
        }

        if (responseJson && typeof responseJson.output_text === 'string' && responseJson.output_text.trim()) {
            return responseJson.output_text.trim();
        }

        if (responseJson && responseJson.data && typeof responseJson.data.answer === 'string') {
            var answer = String(responseJson.data.answer || '').trim();
            if (answer) return answer;
        }

        return 'No se recibió contenido de respuesta.';
    }

    function collectContext(metadata) {
        var selection = metadata && metadata.selection ? metadata.selection : (metadata && metadata.selectedText ? metadata.selectedText : null);
        return {
            courseId: metadata && metadata.courseId ? metadata.courseId : courseId,
            topicId: metadata && metadata.topicId ? metadata.topicId : null,
            pageTitle: metadata && metadata.pageTitle ? metadata.pageTitle : document.title,
            selection: selection,
            selectedText: selection,
            surroundingContext: metadata && metadata.surroundingContext ? metadata.surroundingContext : null
        };
    }

    function submitQuestion(rawQuestion, metadata) {
        if (state.isLoading) return;

        var question = String(rawQuestion || '').trim();
        if (!question) {
            setStatus('Escribe una pregunta antes de consultar.', 'warning');
            return;
        }

        var attachmentsSnapshot = state.pendingAttachments.slice(0, state.maxAttachments).map(function (att) {
            return {
                id: att.id,
                name: att.name,
                type: att.type,
                size: att.size,
                data: att.data,
                dataUrl: att.dataUrl
            };
        });

        var hasImages = attachmentsSnapshot.length > 0;
        var selectedModel = String(state.model || '').trim() || VISION_FALLBACK_MODEL;
        var effectiveModel = selectedModel;
        var localWarning = null;

        if (hasImages && !supportsVisionModel(selectedModel)) {
            effectiveModel = VISION_FALLBACK_MODEL;
            localWarning = 'El modelo seleccionado no soporta imágenes. Se usará ' + VISION_FALLBACK_MODEL + '.';
        }

        var context = collectContext(metadata);
        var threadId = state.threadId || readThreadId();
        threadId = saveThreadId(threadId);
        var cacheContextVersion = buildCacheContextVersion();
        var cacheKey = buildCacheKey({
            model: effectiveModel,
            prompt: question,
            selection: context.selection || context.selectedText || '',
            contextVersion: cacheContextVersion,
            images: attachmentsSnapshot
        });
        var cacheEligible = shouldUseCacheForRequest(attachmentsSnapshot);

        if (cacheEligible) {
            var cachedEntry = readCacheHit(cacheKey);
            if (cachedEntry) {
                state.cacheHits += 1;
                pushMessage('user', question, attachmentsSnapshot);
                if (refs.textarea) refs.textarea.value = '';
                state.pendingAttachments = [];
                renderPendingAttachments();

                state.currentSummary = truncateText(String(cachedEntry.summary || state.currentSummary || ''), 700);
                persistConversationSummary(state.currentSummary);

                state.lastRequest = {
                    model: cachedEntry.model || effectiveModel,
                    requestedModel: selectedModel,
                    threadId: state.threadId,
                    warning: cachedEntry.warning || '',
                    inputTokens: Number(cachedEntry.usage && cachedEntry.usage.inputTokens || 0),
                    outputTokens: Number(cachedEntry.usage && cachedEntry.usage.outputTokens || 0),
                    totalTokens: Number(cachedEntry.usage && cachedEntry.usage.totalTokens || 0),
                    estimatedCostUsd: Number(cachedEntry.usage && cachedEntry.usage.estimatedCostUsd || 0),
                    hasImages: Boolean(cachedEntry.hasImages),
                    imagesCount: Number(cachedEntry.imagesCount || 0),
                    cached: true
                };

                pushMessage('assistant', cachedEntry.answer, null, { cached: true });
                renderMetrics(state.metrics);
                setStatus('Respuesta desde caché local.', 'success');
                return;
            }

            state.cacheMisses += 1;
        }

        var payload = {
            threadId: threadId,
            message: question,
            prompt: question,
            question: question,
            model: effectiveModel,
            selectedModel: selectedModel,
            maxTokens: state.maxTokens,
            context: context,
            courseId: context.courseId,
            topicId: context.topicId,
            pageTitle: context.pageTitle,
            selection: context.selection,
            selectedText: context.selectedText,
            surroundingContext: context.surroundingContext,
            images: attachmentsSnapshot.map(function (att) {
                return {
                    name: att.name,
                    type: att.type,
                    data: att.data
                };
            })
        };

        pushMessage('user', question, attachmentsSnapshot);
        if (refs.textarea) refs.textarea.value = '';
        setLoadingState(true);
        setStatus(localWarning ? localWarning + ' Enviando…' : 'Enviando…', localWarning ? 'warning' : null);

        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timeoutId = setTimeout(function () {
            if (controller) controller.abort();
        }, 60000);

        postQueryWithFallback(payload, controller ? controller.signal : undefined)
            .then(function (json) {
                var answer = extractAnswer(json);
                var usage = normalizeUsage(json);

                var responseWarning = String((json && json.warning) || '').trim();
                var warningText = [localWarning, responseWarning].filter(Boolean).join(' ');

                var responseModel = String((json && json.model) || effectiveModel || selectedModel).trim() || selectedModel;
                var responseHasImages = Boolean(json && (json.hasImages || json.has_images || hasImages));
                var responseImagesCount = Number(
                    (json && (json.imagesCount || json.images_count)) ||
                    (json && json.usage && (json.usage.imagesCount || json.usage.images_count)) ||
                    attachmentsSnapshot.length
                );
                var responseThreadId = sanitizeThreadId(json && json.threadId);
                if (responseThreadId) {
                    saveThreadId(responseThreadId);
                }
                state.currentSummary = truncateText(String((json && json.summary) || ''), 700);
                persistConversationSummary(state.currentSummary);

                state.lastRequest = {
                    model: responseModel,
                    requestedModel: selectedModel,
                    threadId: state.threadId,
                    warning: warningText,
                    inputTokens: usage.inputTokens,
                    outputTokens: usage.outputTokens,
                    totalTokens: usage.totalTokens,
                    estimatedCostUsd: usage.estimatedCostUsd,
                    hasImages: responseHasImages,
                    imagesCount: responseImagesCount,
                    cached: false
                };

                pushMessage('assistant', answer);

                if (cacheEligible && state.cacheEnabled) {
                    writeCacheEntry({
                        key: cacheKey,
                        answer: answer,
                        model: responseModel,
                        summary: state.currentSummary,
                        warning: warningText,
                        hasImages: responseHasImages,
                        imagesCount: responseImagesCount,
                        usage: usage,
                        createdAt: Date.now()
                    });
                }

                state.pendingAttachments = [];
                renderPendingAttachments();

                if (json && json.metrics) {
                    renderMetrics(json.metrics);
                } else {
                    renderMetrics(state.metrics);
                }

                if (warningText) {
                    setStatus('Respuesta recibida con aviso: ' + warningText, 'warning');
                } else {
                    setStatus('Respuesta recibida.', 'success');
                }
            })
            .catch(function (err) {
                var message = err && err.name === 'AbortError'
                    ? 'Tiempo de espera agotado al consultar el asistente.'
                    : (err && err.message ? err.message : 'error desconocido');
                setStatus(message + ' Inicia open-proxy.command si el proxy no está activo.', 'error');
            })
            .finally(function () {
                clearTimeout(timeoutId);
                setLoadingState(false);
                refreshMetrics();
            });
    }

    window.SMAAssistantPanel = {
        open: function () { setOpen(true); },
        close: function () { setOpen(false); },
        toggle: function () { setOpen(!state.isOpen); },
        ask: function (question) {
            setOpen(true);
            submitQuestion(question);
        },
        askSelection: function (payload) {
            var question = 'Explícame este fragmento de forma simple y práctica.';
            setOpen(true);
            submitQuestion(question, payload || {});
        },
        newConversation: function () {
            setOpen(true);
            startNewConversation();
        },
        clearHistory: function () {
            setOpen(true);
            clearAssistantHistory();
        },
        clearCache: function () {
            clearCacheEntries();
        },
        prefill: function (question) {
            setOpen(true);
            if (refs.textarea) refs.textarea.value = String(question || '');
            if (refs.textarea) refs.textarea.focus();
        }
    };

    createPanel();
})();
