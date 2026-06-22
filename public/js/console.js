(function () {
    const out = document.getElementById('consoleOutput');
    if (!out) return; // not on the console page

    const form = document.getElementById('consoleForm');
    const input = document.getElementById('consoleInput');
    const statusEl = document.getElementById('roomStatus');
    let since = 0;
    let atBottom = true;

    out.addEventListener('scroll', () => {
        atBottom = out.scrollHeight - out.scrollTop - out.clientHeight < 30;
    });

    function esc(s) {
        return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    }

    function append(level, msg) {
        // tag kill-feed lines specially
        if (level === 'log' && /💀|killed/i.test(msg)) level = 'kill';
        const span = document.createElement('span');
        span.className = 'ln lvl-' + level;
        span.textContent = msg;
        out.appendChild(span);
        // cap DOM size
        while (out.childNodes.length > 800) out.removeChild(out.firstChild);
        if (atBottom) out.scrollTop = out.scrollHeight;
    }

    function setStatus(active) {
        if (!statusEl) return;
        statusEl.className = 'room-status ' + (active ? 'on' : 'off');
        statusEl.textContent = active ? '● Room active' : '○ No active room';
    }

    async function poll() {
        try {
            const r = await fetch('/api/console/logs?since=' + since);
            if (r.ok) {
                const data = await r.json();
                if (Array.isArray(data.lines)) {
                    for (const l of data.lines) append(l.level, l.msg);
                    since = data.lastSeq || since;
                }
                setStatus(data.active);
            }
        } catch (e) { /* network blip — keep polling */ }
    }

    async function exec(command) {
        if (!command) return;
        try {
            const r = await fetch('/api/console/exec', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command })
            });
            const data = await r.json();
            if (!data.success && data.error) append('error', '⚠️ ' + data.error);
        } catch (e) {
            append('error', '⚠️ Request failed: ' + e.message);
        }
        poll(); // pull fresh output quickly
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const cmd = input.value.trim();
        if (!cmd) return;
        input.value = '';
        exec(cmd);
    });

    // Quick-command buttons → prompt for args → build call → exec
    function buildCommand(name, args) {
        const parts = [];
        for (const a of args) {
            const v = prompt(name + ' — ' + a.k + (a.opt ? '  (optional — leave blank to skip)' : ''));
            if (v === null) return null;                 // cancelled
            if (v.trim() === '') {
                if (a.opt) break;                        // trailing optionals: stop here
                alert('"' + a.k + '" is required.');
                return null;
            }
            parts.push(a.t === 'num' ? v.trim() : JSON.stringify(v));
        }
        return name + '(' + parts.join(',') + ')';
    }

    document.querySelectorAll('.cmd-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.dataset.name;
            let args = [];
            try { args = JSON.parse(btn.dataset.args || '[]'); } catch (e) {}
            const cmd = args.length ? buildCommand(name, args) : name + '()';
            if (cmd) exec(cmd);
        });
    });

    poll();
    setInterval(poll, 1500);
})();
