// static/js/terminal.js

let ws;
const frames = ["/", "-", "\\", "|"];
let frameIdx = 0;
let loaderInterval;
let term;
let fitAddon;

function updateConnectionStatus(status) {
    const dot = document.getElementById('connection-dot');
    const text = document.getElementById('connection-text');
    if (!dot || !text) return;

    if (status === 'connected') {
        dot.style.background = 'var(--success-color)';
        dot.style.boxShadow = '0 0 8px var(--success-color)';
        text.innerText = 'Connected';
        text.style.color = 'var(--success-color)';
    } else if (status === 'disconnected') {
        dot.style.background = 'var(--error-color)';
        dot.style.boxShadow = '0 0 8px var(--error-color)';
        text.innerText = 'Disconnected';
        text.style.color = 'var(--error-color)';
    } else if (status === 'connecting') {
        dot.style.background = 'var(--accent-main)';
        dot.style.boxShadow = '0 0 8px var(--accent-main)';
        text.innerText = 'Connecting...';
        text.style.color = 'var(--accent-main)';
    }
}

window.initTerminal = function() {
    if (!currentToken) return;

    // Initialize xterm.js
    const terminalContainer = document.getElementById('terminal-output');
    if (terminalContainer && !window.term) {
        term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#000000',
                foreground: '#ffffff'
            },
            fontFamily: 'Consolas, "Courier New", monospace',
            fontSize: 14
        });
        fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalContainer);
        fitAddon.fit();
        window.term = term;

        // Resize event
        window.addEventListener('resize', () => {
            if (fitAddon) {
                fitAddon.fit();
            }
        });
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    updateConnectionStatus('connecting');

    ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/${currentToken}`);

    ws.onopen = () => {
        updateConnectionStatus('connected');
        showToast("Terminal connected successfully", "success");
        if (term) {
            term.write('\r\n*** Connected to backend ***\r\n');
        }
    };

    ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        const aiChat = document.getElementById('ai-mini-chat');
        
        if (data.type === 'clear') {
            if (term) term.clear();
        } else if (data.type === 'ai_status') {
            if (data.status === 'idle') window.stopLoader();
            else window.startLoader(data.status);
        } else {
            // Write to xterm instead of DOM elements
            if (term && data.content) {
                // If it's a regular message, handle formatting for xterm
                // Ensure newlines are \r\n
                const text = data.content.replace(/\r?\n/g, '\r\n');
                term.write(text + '\r\n');
            }

            if (data.type === 'ai' && aiChat) {
                const aiDiv = document.createElement('div');
                aiDiv.style.marginBottom = '10px';
                aiDiv.style.padding = '10px';
                aiDiv.style.background = 'rgba(0, 230, 118, 0.1)';
                aiDiv.style.borderLeft = '3px solid var(--success-color)';
                aiDiv.style.borderRadius = '4px';
                aiDiv.style.color = 'var(--text-primary)';
                aiDiv.textContent = data.content;
                aiChat.appendChild(aiDiv);
                aiChat.scrollTop = aiChat.scrollHeight;
            }
        }
    };

    ws.onclose = () => {
        updateConnectionStatus('disconnected');
        showToast("Terminal connection lost", "error");
        if (term) {
            term.write('\r\n*** Connection Lost. Please refresh the page. ***\r\n');
        }
    };

    ws.onerror = () => {
        updateConnectionStatus('disconnected');
    };

    // Terminal data handling (sending keystrokes to server)
    if (term) {
        let currentCommand = '';
        term.onData(e => {
            if (!ws || ws.readyState !== WebSocket.OPEN) return;

            // For now, since the backend expects full commands rather than raw pty streams:
            // We'll accumulate simple input and send on Enter.
            // A true pty integration would send `e` directly.

            const ev = e;
            switch (ev) {
                case '\r': // Enter
                    term.write('\r\n');
                    ws.send(JSON.stringify({ command: currentCommand }));
                    currentCommand = '';
                    break;
                case '\u007F': // Backspace (DEL)
                    if (currentCommand.length > 0) {
                        currentCommand = currentCommand.substring(0, currentCommand.length - 1);
                        term.write('\b \b');
                    }
                    break;
                case '\u0003': // Ctrl+C
                    ws.send(JSON.stringify({ command: '\x03' }));
                    term.write('^C\r\n');
                    currentCommand = '';
                    break;
                default:
                    if (window.ctrlActive && ev.length === 1 && ev.match(/[a-zA-Z]/)) {
                        const char = ev.toLowerCase();
                        const ctrlCode = String.fromCharCode(char.charCodeAt(0) - 96);
                        ws.send(JSON.stringify({ command: ctrlCode }));
                        term.write("^" + char.toUpperCase() + "\r\n");
                        window.toggleTermuxCtrl();
                    } else if (ev >= String.fromCharCode(0x20) && ev <= String.fromCharCode(0x7E)) {
                        currentCommand += ev;
                        term.write(ev);
                    }
            }
        });
    }
};

window.sendTerminalCommand = function() {
    // Kept for backward compatibility if needed, but xterm handles input now
};

window.startLoader = function(statusText) {
    const loader = document.getElementById('ai-loader');
    if(loader) {
        loader.style.display = 'block';
        loaderInterval = setInterval(() => {
            document.getElementById('spinner').innerText = frames[frameIdx];
            frameIdx = (frameIdx + 1) % frames.length;
        }, 100);
    }
};

window.stopLoader = function() {
    const loader = document.getElementById('ai-loader');
    if(loader) {
        loader.style.display = 'none';
        clearInterval(loaderInterval);
    }
};

window.insertCmd = function(cmd) {
    if (term) {
        term.write(cmd);
        // We'd need a more robust input buffer mechanism to seamlessly inject this into the current line
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ command: cmd }));
            term.write('\r\n');
        }
    }
};

window.ctrlActive = false;

window.toggleTermuxCtrl = function() {
    ctrlActive = !ctrlActive;
    const btn = document.getElementById('termux-ctrl-btn');
    if (ctrlActive) {
        btn.style.background = 'var(--accent-main)';
        btn.style.color = '#000';
    } else {
        btn.style.background = 'rgba(59, 130, 246, 0.1)';
        btn.style.color = 'var(--text-primary)';
    }
    if(term) term.focus();
};

// Map virtual keys to xterm
window.sendTerminalKey = function(key) {
    if (!term) return;

    if (key === 'ESC') {
        term.write('\x1b');
    } else if (key === 'TAB') {
        term.write('\t');
    } else if (key === 'UP') {
        term.write('\x1b[A');
    } else if (key === 'DOWN') {
        term.write('\x1b[B');
    }
    term.focus();
};
