; (function () {
    var STORAGE_PREFIX = 'sma:assistant:';
    var KEY_OPEN = STORAGE_PREFIX + 'open';
    var KEY_MESSAGES = STORAGE_PREFIX + 'messages';
    var KEY_MODEL = STORAGE_PREFIX + 'model';
    var KEY_MAX_TOKENS = STORAGE_PREFIX + 'max_tokens';
    var KEY_PROXY_BASE = STORAGE_PREFIX + 'proxy_base';

    var state = {
        isOpen: localStorage.getItem(KEY_OPEN) === '1',
        model: localStorage.getItem(KEY_MODEL) || 'gpt-4o-mini',
        maxTokens: Number(localStorage.getItem(KEY_MAX_TOKENS) || 600),
        proxyBase: normalizeProxyBase(localStorage.getItem(KEY_PROXY_BASE) || defaultProxyBase()),
        messages: readMessages(),
        isLoading: false,
        metrics: null,
        availableModels: ['gpt-5.3', 'gpt-5.2', 'gpt-4o-mini', 'gpt-4.1-mini']
    };

    var refs = {
        panel: null,
        body: null,
        textarea: null,
        status: null,
        modelSelect: null,
        tokensInput: null,
        proxyInput: null,
        metricsBox: null
    };

    function readMessages() {
        try {
            var raw = localStorage.getItem(KEY_MESSAGES);
            var parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed.slice(-40) : [];
        } catch (_err) {
            return [];
        }
    }

    function persistMessages() {
        localStorage.setItem(KEY_MESSAGES, JSON.stringify(state.messages.slice(-40)));
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
        else document.body.classList.remove('sma-assistant-open');
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
            state.proxyBase = String(proxyInput.value || '').trim() || 'http://localhost:8090';
            proxyInput.value = state.proxyBase;
            saveConfig();
            refreshMetrics();
        });
        proxyLabel.appendChild(proxyInput);

        grid.appendChild(modelLabel);
        grid.appendChild(tokensLabel);
        grid.appendChild(proxyLabel);
        config.appendChild(grid);

        var metricsBox = document.createElement('div');
        metricsBox.className = 'sma-assistant-metrics';
        metricsBox.textContent = 'Métricas: cargando…';
        config.appendChild(metricsBox);

        var body = document.createElement('div');
        body.className = 'sma-assistant-body';

        var footer = document.createElement('div');
        footer.className = 'sma-assistant-footer';
        var textarea = document.createElement('textarea');
        textarea.placeholder = 'Pregunta algo sobre el contenido seleccionado o sobre el tema actual.';
        textarea.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submitQuestion(textarea.value);
            }
        });
        var actions = document.createElement('div');
        actions.className = 'sma-assistant-footer-actions';
        var clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.textContent = 'Limpiar';
        clearBtn.addEventListener('click', function () {
            state.messages = [];
            persistMessages();
            renderMessages();
            setStatus('Conversación vacía.');
        });
        var sendBtn = document.createElement('button');
        sendBtn.type = 'button';
        sendBtn.textContent = 'Consultar';
        sendBtn.addEventListener('click', function () {
            submitQuestion(textarea.value);
        });
        actions.appendChild(clearBtn);
        actions.appendChild(sendBtn);
        var status = document.createElement('div');
        status.className = 'sma-assistant-status';
        footer.appendChild(textarea);
        footer.appendChild(actions);
        footer.appendChild(status);

        panel.appendChild(header);
        panel.appendChild(config);
        panel.appendChild(body);
        panel.appendChild(footer);
        document.body.appendChild(panel);

        refs.panel = panel;
        refs.body = body;
        refs.textarea = textarea;
        refs.status = status;
        refs.modelSelect = modelSelect;
        refs.tokensInput = tokensInput;
        refs.proxyInput = proxyInput;
        refs.metricsBox = metricsBox;

        setOpen(state.isOpen);
        renderMessages();
        setStatus('Listo. Selecciona texto o escribe una consulta.');
        fetchBridgeConfig();
        refreshMetrics();
    }

    function pushMessage(role, text) {
        state.messages.push({ role: role, text: String(text || ''), at: Date.now() });
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

            var text = document.createElement('div');
            text.className = 'sma-assistant-msg-text';
            text.textContent = msg.text;

            var actions = document.createElement('div');
            actions.className = 'sma-assistant-msg-actions';
            var copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'sma-assistant-copy-btn';
            copyBtn.textContent = '⧉ Copiar';
            copyBtn.addEventListener('click', function () {
                copyToClipboard(msg.text).then(function () {
                    copyBtn.textContent = 'Copiado';
                    setTimeout(function () {
                        copyBtn.textContent = '⧉ Copiar';
                    }, 1200);
                }).catch(function () {
                    copyBtn.textContent = 'Error';
                    setTimeout(function () {
                        copyBtn.textContent = '⧉ Copiar';
                    }, 1200);
                });
            });

            actions.appendChild(copyBtn);
            row.appendChild(actions);
            row.appendChild(text);
            refs.body.appendChild(row);
        });
        refs.body.scrollTop = refs.body.scrollHeight;
    }

    function copyToClipboard(value) {
        var text = String(value || '');
        if (!text) return Promise.resolve();

        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }

        return new Promise(function (resolve, reject) {
            try {
                var textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.select();
                var ok = document.execCommand('copy');
                document.body.removeChild(textarea);
                if (ok) resolve();
                else reject(new Error('copy_failed'));
            } catch (error) {
                reject(error);
            }
        });
    }

    function setStatus(text) {
        if (!refs.status) return;
        refs.status.textContent = text;
    }

    function defaultProxyBase() {
        var host = location && location.hostname ? location.hostname : '';
        if (host === 'localhost' || host === '127.0.0.1') {
            return 'http://localhost:8090';
        }
        return location.origin || 'http://localhost:8090';
    }

    function normalizeProxyBase(value) {
        var raw = String(value || '').trim();
        if (!raw) return defaultProxyBase();
        return raw.replace(/\/$/, '');
    }

    function renderMetrics(metrics) {
        state.metrics = metrics || null;
        if (!refs.metricsBox) return;
        if (!metrics) {
            refs.metricsBox.textContent = 'Métricas: no disponibles.';
            return;
        }

        var totalReq = Number(metrics.total_requests || 0);
        var totalTok = Number(metrics.total_tokens || 0);
        var totalCost = Number(metrics.total_estimated_cost_usd || 0);
        var dayCost = Number((metrics.daily || {}).estimated_cost_usd || 0);
        var budget = Number(metrics.soft_daily_budget_usd || 0);
        var budgetTxt = budget > 0 ? (dayCost.toFixed(4) + ' / ' + budget.toFixed(2) + ' USD') : (dayCost.toFixed(4) + ' USD');

        refs.metricsBox.innerHTML = [
            '<div><strong>Requests</strong>: ' + totalReq + '</div>',
            '<div><strong>Tokens</strong>: ' + totalTok + '</div>',
            '<div><strong>Coste total</strong>: ' + totalCost.toFixed(4) + ' USD</div>',
            '<div><strong>Coste diario</strong>: ' + budgetTxt + '</div>'
        ].join('');
    }

    function proxyUrl(path) {
        var base = normalizeProxyBase(state.proxyBase);
        return base + path;
    }

    function checkProxy(base) {
        return fetch(normalizeProxyBase(base) + '/health', { method: 'GET' })
            .then(function (res) { return res.ok; })
            .catch(function () { return false; });
    }

    function ensureProxyBaseReachable() {
        var current = normalizeProxyBase(state.proxyBase);
        return checkProxy(current).then(function (ok) {
            if (ok) return true;

            var host = location && location.hostname ? location.hostname : '';
            var isLocal = host === 'localhost' || host === '127.0.0.1';
            var fallback = 'http://localhost:8090';
            if (!isLocal || current === fallback) return false;

            return checkProxy(fallback).then(function (fallbackOk) {
                if (!fallbackOk) return false;
                state.proxyBase = fallback;
                if (refs.proxyInput) refs.proxyInput.value = fallback;
                saveConfig();
                setStatus('Proxy detectado automáticamente en ' + fallback);
                return true;
            });
        });
    }

    function fetchBridgeConfig() {
        return ensureProxyBaseReachable().then(function () {
            return fetch(proxyUrl('/config'));
        })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (cfg) {
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
            })
            .catch(function () {
                setStatus('No se pudo cargar /config. Inicia el proxy: node assistant-bridge/server.js');
            });
    }

    function refreshMetrics() {
        return ensureProxyBaseReachable().then(function () {
            return fetch(proxyUrl('/metrics'));
        })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (metrics) {
                renderMetrics(metrics);
            })
            .catch(function () {
                renderMetrics(null);
            });
    }

    function buildPrompt(question) {
        return [
            'Eres un asistente de apoyo para un curso técnico.',
            'Responde en español, con claridad, en formato breve.',
            'No escribas bloques de código largos.',
            'No sustituyas al instructor ni redefinas arquitectura.',
            'Solo explica, aclara, compara y da ejemplos cortos.',
            '',
            'Pregunta del usuario:',
            question
        ].join('\n');
    }

    function submitQuestion(rawQuestion, metadata) {
        if (state.isLoading) return;
        var question = String(rawQuestion || '').trim();
        if (!question) {
            setStatus('Escribe una pregunta antes de consultar.');
            return;
        }

        pushMessage('user', question);
        if (refs.textarea) refs.textarea.value = '';
        state.isLoading = true;
        setStatus('Consultando…');

        var payload = {
            question: question,
            model: state.model,
            maxTokens: state.maxTokens,
            courseId: metadata && metadata.courseId ? metadata.courseId : null,
            topicId: metadata && metadata.topicId ? metadata.topicId : null,
            selectedText: metadata && metadata.selectedText ? metadata.selectedText : null,
            surroundingContext: metadata && metadata.surroundingContext ? metadata.surroundingContext : null
        };

        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timeoutId = setTimeout(function () {
            if (controller) controller.abort();
        }, 45000);

        fetch(proxyUrl('/assistant/query'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: controller ? controller.signal : undefined
        })
            .then(function (res) {
                if (!res.ok) {
                    throw new Error('HTTP ' + res.status);
                }
                return res.json();
            })
            .then(function (json) {
                if (json && json.ok === false) {
                    throw new Error(String(json.error || 'Respuesta inválida del proxy'));
                }

                var content = '';
                if (json && typeof json.answer === 'string') content = json.answer;
                else if (json && typeof json.response === 'string') content = json.response;
                else if (json && typeof json.output_text === 'string') content = json.output_text;
                else if (json && json.data && typeof json.data.answer === 'string') content = json.data.answer;

                content = String(content || '').trim();
                if (!content) content = 'No se recibió contenido de respuesta.';

                if (json && json.model && refs.modelSelect && refs.modelSelect.value !== json.model) {
                    state.model = json.model;
                    refs.modelSelect.value = json.model;
                    saveConfig();
                }

                pushMessage('assistant', content);
                if (json && json.metrics) renderMetrics(json.metrics);

                if (json && json.warning) {
                    setStatus('Respuesta recibida con aviso: ' + json.warning);
                } else {
                    setStatus('Respuesta recibida.');
                }
            })
            .catch(function (err) {
                var message = err && err.name === 'AbortError'
                    ? 'Timeout de la consulta (45s).'
                    : (err && err.message ? err.message : 'desconocido');
                setStatus('Error al consultar: ' + message);
                pushMessage('assistant', 'No pude completar la consulta: ' + message);
                alert('No se pudo completar la consulta. Revisa que el proxy local esté activo en ' + state.proxyBase + '.');
            })
            .finally(function () {
                clearTimeout(timeoutId);
                state.isLoading = false;
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
        prefill: function (question) {
            setOpen(true);
            if (refs.textarea) refs.textarea.value = String(question || '');
            if (refs.textarea) refs.textarea.focus();
        }
    };

    createPanel();
})();
