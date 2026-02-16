; (function () {
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
        if (text.length > 1200) text = text.slice(0, 1200);
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
        if (surrounding.length > 900) surrounding = surrounding.slice(0, 900);

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
        btn.textContent = 'Consultar al asistente';

        var lastMouseX = 0;
        var lastMouseY = 0;
        var visible = false;

        document.addEventListener('mousemove', function (e) {
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        });

        btn.addEventListener('mousedown', function (e) {
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
            var bw = 180;
            var left = Math.min(Math.max(8, x - bw / 2), window.innerWidth - bw - 8);
            var top = Math.min(Math.max(8, y + 12), window.innerHeight - 40);
            btn.style.left = left + 'px';
            btn.style.top = top + 'px';
            btn.style.display = 'inline-block';
            visible = true;
        }

        function hide() {
            btn.style.display = 'none';
            visible = false;
        }

        function checkAndShow(useMousePos) {
            var text = selectionText();
            if (!text) { hide(); return; }
            if (useMousePos) {
                show(lastMouseX, lastMouseY);
            } else if (!visible) {
                var sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                    var rect = sel.getRangeAt(0).getBoundingClientRect();
                    if (rect && (rect.width || rect.height)) {
                        show(rect.left + rect.width / 2, rect.bottom);
                    }
                }
            }
        }

        document.addEventListener('mouseup', function (e) {
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            setTimeout(function () { checkAndShow(true); }, 30);
        });

        document.addEventListener('keyup', function (e) {
            if (e.key === 'Escape') { hide(); return; }
            setTimeout(function () { checkAndShow(false); }, 30);
        });

        document.addEventListener('mousedown', function (e) {
            if (e.target === btn) return;
            var panel = document.querySelector('.sma-assistant-panel');
            if (panel && panel.contains(e.target)) return;
            hide();
        });
    }

    ensureAiButtonInControls();
    ensureSelectionButton();
})();
