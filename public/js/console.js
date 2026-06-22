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

    function append(level, msg) {
        if (level === 'log' && /💀|☠️|killed/i.test(msg)) level = 'kill';
        const span = document.createElement('span');
        span.className = 'ln lvl-' + level;
        span.textContent = msg;
        out.appendChild(span);
        while (out.childNodes.length > 800) out.removeChild(out.firstChild);
        if (atBottom) out.scrollTop = out.scrollHeight;
    }

    function setStatus(active) {
        if (!statusEl) return;
        statusEl.className = 'room-status ' + (active ? 'on' : 'off');
        statusEl.textContent = active ? '● Room active' : '○ No active room';
    }

    // ── Output polling ──
    async function poll() {
        try {
            const r = await fetch('/api/console/logs?since=' + since);
            if (r.ok) {
                const data = await r.json();
                if (Array.isArray(data.lines)) { for (const l of data.lines) append(l.level, l.msg); since = data.lastSeq || since; }
                setStatus(data.active);
            }
        } catch (e) {}
    }

    async function exec(command) {
        if (!command) return;
        try {
            const r = await fetch('/api/console/exec', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command })
            });
            const data = await r.json();
            if (!data.success && data.error) append('error', '⚠️ ' + data.error);
        } catch (e) { append('error', '⚠️ Request failed: ' + e.message); }
        poll();
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const cmd = input.value.trim();
        if (!cmd) return;
        input.value = '';
        exec(cmd);
    });

    // ── Ship dropdowns (static catalog) ──
    function populateShips() {
        const ships = window.__MOD_SHIPS || [];
        const opts = ships.map(s => `<option value="${s.code}">${s.label} (${s.code})</option>`).join('');
        document.querySelectorAll('.ship-select').forEach(sel => { sel.innerHTML = opts; });
    }

    function escAttr(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }

    // ── Player dropdowns (live, refreshed) ──
    async function refreshPlayers() {
        let players = [];
        try {
            const r = await fetch('/api/console/players');
            if (r.ok) { const d = await r.json(); players = d.players || []; setStatus(d.active); }
        } catch (e) {}
        document.querySelectorAll('.player-select').forEach(sel => {
            const prev = sel.value;
            if (!players.length) {
                sel.innerHTML = '<option value="">— no players —</option>';
            } else {
                sel.innerHTML = players.map(p => `<option value="${p.id}">${p.id} — ${escAttr(p.name)}</option>`).join('');
                if (players.some(p => String(p.id) === prev)) sel.value = prev;
            }
        });
    }

    function pv(id) { const el = document.getElementById(id); return el ? el.value : ''; }

    // ── Quick action handlers ──
    // single-player simple calls: fn(id)
    const PLAYER_FN = { kick: 'kick', ban: 'ban', forcespec: 'forceSpec', ghost: 'ghostMode', giveadmin: 'giveAdmin', removeadmin: 'removeAdmin', crash: 'crashGame', bfban: 'bruteforceBan' };
    // single-player raw expressions: fn(id) -> code
    const PLAYER_RAW = {
        heal:     p => `shipByID(${p})&&shipByID(${p}).set({shield:99999,crystals:720})`,
        freeze:   p => `shipByID(${p})&&(shipByID(${p}).custom._frozen=true)`,
        unfreeze: p => `shipByID(${p})&&(shipByID(${p}).custom._frozen=false)`,
        godon:    p => `shipByID(${p})&&(shipByID(${p}).custom._godMode=true)`,
        godoff:   p => `shipByID(${p})&&(shipByID(${p}).custom._godMode=false)`,
    };
    // no-input raw commands
    const RAW = {
        cleararena:  'game.ships.forEach(function(s){if(!s.spectating.value)turnToSpectator(s);s.custom.forcedToSpectate=true;});say("🧹 Arena cleared",4)',
        releaseall:  'game.ships.forEach(function(s){s.custom.forcedToSpectate=false;_hideDuelSpecBanner(s);});say("🔓 Spectate released",3)',
        randomduel:  '(function(){var a=game.ships.filter(function(s){return !s.spectating.value;});if(a.length<2){return say("Need 2 active players",4);}var i=Math.floor(Math.random()*a.length),j;do{j=Math.floor(Math.random()*a.length);}while(j===i);rankedDuel(a[i].id,a[j].id);})()',
        listplayers: '(function(){echo("👥 "+game.ships.length+" players:");game.ships.forEach(function(s){echo("  "+s.id+" — "+s.name+(s.spectating.value?" (spec)":""));});})()',
        roominfo:    '(function(){echo("🔗 https://starblast.io/#"+game.modding.address);echo("👥 "+game.ships.length+" players online");})()',
        publish:     'PublishToServerList()',
        say_duel:    'say("⚔️ Duel starting soon!",6,"#FFD700")',
        say_gl:      'say("🌙 Good luck everyone!",6,"#A0B8E8")',
        say_gg:      'say("🏆 GG!",5,"#FFD700")',
        say_quiet:   'say("🔇 Spectators, please stay quiet",6,"#A0B8E8")',
    };

    function handleAct(act, btn) {
        if (RAW[act]) return exec(RAW[act]);
        if (PLAYER_FN[act]) {
            const p = pv(btn.dataset.p);
            if (!p) return append('error', '⚠️ Pick a player first');
            return exec(`${PLAYER_FN[act]}(${p})`);
        }
        if (PLAYER_RAW[act]) {
            const p = pv(btn.dataset.p);
            if (!p) return append('error', '⚠️ Pick a player first');
            return exec(PLAYER_RAW[act](p));
        }
        switch (act) {
            case 'tpto': {
                const a = pv('tp_a'), b = pv('tp_b');
                if (!a || !b) return append('error', '⚠️ Pick both players');
                if (a === b) return append('error', '⚠️ Pick two different players');
                return exec(`(function(){var x=shipByID(${a}),y=shipByID(${b});if(x&&y)x.set({x:y.x,y:y.y});})()`);
            }
            case 'giveship': {
                const p = pv('gs_p'), s = pv('gs_s');
                if (!p) return append('error', '⚠️ Pick a player');
                if (!s) return append('error', '⚠️ Pick a ship');
                return exec(`giveAdminShip(${p},${s})`);
            }
            case 'startduel': {
                const a = pv('duel_p1'), b = pv('duel_p2'), s = pv('duel_s');
                if (!a || !b) return append('error', '⚠️ Pick both duel players');
                if (a === b) return append('error', '⚠️ Pick two different players');
                return exec(`rankedDuel(${a},${b}${s ? ',' + s : ''})`);
            }
            case 'stopduel': return exec('stopRankedDuel()');
            case 'msg': {
                const p = pv('msg_p'), t = pv('msg_t').trim();
                if (!p) return append('error', '⚠️ Pick a player');
                if (!t) return append('error', '⚠️ Type a message');
                return exec(`msg(${p},${JSON.stringify(t)})`);
            }
            case 'require': {
                const s = pv('req_s');
                if (!s) return append('error', '⚠️ Pick a ship');
                return exec(`requireShip(${s})`);
            }
            case 'unrequire': return exec('unrequireShip()');
            case 'say': {
                const t = pv('say_t').trim(), sec = pv('say_s').trim();
                if (!t) return append('error', '⚠️ Type a message');
                return exec(`say(${JSON.stringify(t)}${sec ? ',' + sec : ''})`);
            }
        }
    }

    document.querySelectorAll('[data-act]').forEach(btn => {
        btn.addEventListener('click', () => handleAct(btn.dataset.act, btn));
    });
    const refreshBtn = document.getElementById('refreshPlayers');
    if (refreshBtn) refreshBtn.addEventListener('click', refreshPlayers);

    // ── Boot ──
    populateShips();
    refreshPlayers();
    poll();
    setInterval(poll, 1500);
    setInterval(refreshPlayers, 4000);
})();
