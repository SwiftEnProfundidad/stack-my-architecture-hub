; (function () {
    // Constantes de configuración
    var CONFIG = {
        BUTTON_WIDTH: 180,
        BUTTON_HEIGHT: 36,
        OFFSET_Y: 8,
        VIEWPORT_MARGIN: 8,
        DEBOUNCE_DELAY: 50,
        MAX_SELECTION_LENGTH: 1200,
        MAX_CONTEXT_LENGTH: 900
    };

    function ensureAiButtonInControls() {
        var controls = document.getElementById('study-ux-controls');
        if (!controls) return;
        if (document.getElementById('study-ai-open-btn')) return;

        var btn = document.createElement('button');
        btn.id = 'study-ai-open-btn';
        btn.type = 'button';
        btn.textContent = '💬 Asistente IA';
        btn.title = 'Abrir panel de asistente IA';
        btn.addEventListener('click', function () {
            if (window.SMAAssistantPanel) {
                window.SMAAssistantPanel.toggle();
            }
        });

        controls.appendChild(btn);
    }

    function selectionText() {
        var sel = window.getSelection ? window.getSelection() : null;
        if (!sel) return '';
        var text = String(sel.toString() || '').trim();
        if (!text) return '';
        if (text.length > CONFIG.MAX_SELECTION_LENGTH) {
            text = text.slice(0, CONFIG.MAX_SELECTION_LENGTH);
        }
        return text;
    }

    function currentCourseId() {
        var meta = document.querySelector('meta[name="course-id"]');
        return meta && meta.content ? String(meta.content).trim() : null;
    }

    function currentTopicId() {
        var hashId = String(location.hash || '').replace(/^#/, '').trim();
        if (hashId) return hashId;

        var targetLesson = document.querySelector('.lesson:target');
        if (targetLesson && targetLesson.id) return targetLesson.id;

        var selected = document.querySelector('.doc-nav-link.selected');
        if (selected) {
            var href = String(selected.getAttribute('href') || '').replace(/^#/, '').trim();
            if (href) return href;
        }

        return null;
    }

    function selectionPayload() {
        var text = selectionText();
        if (!text) return null;

        var sel = window.getSelection ? window.getSelection() : null;
        if (!sel || sel.rangeCount === 0) return null;

        var node = sel.anchorNode;
        var element = node && node.nodeType === 1 ? node : (node ? node.parentElement : null);
        var contextHost = element && element.closest ? element.closest('pre, code, p, li, blockquote, h1, h2, h3, h4') : null;
        var surrounding = contextHost ? String(contextHost.textContent || '').trim() : '';
        if (surrounding.length > CONFIG.MAX_CONTEXT_LENGTH) {
            surrounding = surrounding.slice(0, CONFIG.MAX_CONTEXT_LENGTH);
        }

        return {
            selectedText: text,
            surroundingContext: surrounding,
            courseId: currentCourseId(),
            topicId: currentTopicId()
        };
    }

    function ensureSelectionButton() {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sma-assistant-selection-btn';
        btn.style.position = 'fixed';
        btn.style.zIndex = '99999';
        btn.style.display = 'none';
        btn.style.pointerEvents = 'auto';
        btn.textContent = 'Consultar al asistente';

        var state = {
            lastMouseX: 0,
            lastMouseY: 0,
            visible: false,
            isMouseDown: false,
            mouseDownTimeout: null,
            selectionTimeout: null
        };

        // Track mouse position continuously
        document.addEventListener('mousemove', function (e) {
            state.lastMouseX = e.clientX;
            state.lastMouseY = e.clientY;
        });

        // Track when user starts selecting (mouse down on content)
        document.addEventListener('mousedown', function (e) {
            // Only consider left mouse button
            if (e.button !== 0) return;
            
            // Don't hide if clicking on the button itself
            if (e.target === btn) return;
            
            // Don't hide if clicking inside the assistant panel
            var panel = document.querySelector('.sma-assistant-panel');
            if (panel && panel.contains(e.target)) return;
            
            // Cancel any pending selection timeout
            if (state.selectionTimeout) {
                clearTimeout(state.selectionTimeout);
                state.selectionTimeout = null;
            }
            
            // Mark that mouse is down
            state.isMouseDown = true;
            hide();
        });

        // When mouse up, check if we have a selection
        document.addEventListener('mouseup', function (e) {
            // Only handle left mouse button
            if (e.button !== 0) return;
            
            // Update mouse position
            state.lastMouseX = e.clientX;
            state.lastMouseY = e.clientY;
            
            // Mark mouse as up
            state.isMouseDown = false;
            
            // Debounced check for selection
            state.selectionTimeout = setTimeout(function () {
                state.selectionTimeout = null;
                var text = selectionText();
                if (text) {
                    show(state.lastMouseX, state.lastMouseY);
                }
            }, CONFIG.DEBOUNCE_DELAY);
        });

        // Handle selection via keyboard (Shift+arrows, etc)
        document.addEventListener('selectionchange', function () {
            // Don't process during mouse selection (mouse is still down)
            if (state.isMouseDown) return;
            
            // Cancel any pending timeout
            if (state.selectionTimeout) {
                clearTimeout(state.selectionTimeout);
            }
            
            state.selectionTimeout = setTimeout(function () {
                state.selectionTimeout = null;
                var text = selectionText();
                if (text && !state.visible) {
                    // Use current selection position if available
                    var sel = window.getSelection();
                    if (sel && sel.rangeCount > 0) {
                        var rect = sel.getRangeAt(0).getBoundingClientRect();
                        if (rect && (rect.width || rect.height)) {
                            show(rect.left + rect.width / 2, rect.bottom + CONFIG.OFFSET_Y);
                        }
                    }
                }
            }, CONFIG.DEBOUNCE_DELAY);
        });

        // Hide on Escape key
        document.addEventListener('keyup', function (e) {
            if (e.key === 'Escape') { 
                hide(); 
                return; 
            }
        });

        // Button click handler
        btn.addEventListener('mousedown', function (e) {
            e.preventDefault();
            e.stopPropagation();
        });

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var payload = selectionPayload();
            hide();
            if (!payload) return;
            if (window.SMAAssistantPanel) {
                window.SMAAssistantPanel.askSelection(payload);
            }
        });

        document.body.appendChild(btn);

        function show(x, y) {
            // Position centered horizontally on cursor, slightly below
            var left = x - CONFIG.BUTTON_WIDTH / 2;
            var top = y + CONFIG.OFFSET_Y;
            
            // Keep within viewport bounds
            left = Math.max(CONFIG.VIEWPORT_MARGIN, Math.min(left, 
                window.innerWidth - CONFIG.BUTTON_WIDTH - CONFIG.VIEWPORT_MARGIN));
            top = Math.max(CONFIG.VIEWPORT_MARGIN, Math.min(top, 
                window.innerHeight - CONFIG.BUTTON_HEIGHT - CONFIG.VIEWPORT_MARGIN));
            
            btn.style.left = left + 'px';
            btn.style.top = top + 'px';
            btn.style.display = 'inline-block';
            state.visible = true;
        }

        function hide() {
            btn.style.display = 'none';
            state.visible = false;
        }
    }

    ensureAiButtonInControls();
    ensureSelectionButton();
})();
