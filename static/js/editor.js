let editor;

function initEditor() {
    if (!document.getElementById("ace-editor")) return;
    
    // Initialize Ace
    editor = ace.edit("ace-editor");
    editor.setTheme("ace/theme/tomorrow_night_eighties"); // Deep dark theme matching mockups
    editor.session.setMode("ace/mode/python");
    editor.setOptions({
        fontSize: "14px",
        fontFamily: "var(--font-mono)",
        showPrintMargin: false,
        enableBasicAutocompletion: true
    });

    // Detect file type changes based on filename input
    document.getElementById('current-filename').addEventListener('input', checkRunVisibility);

    // Load files immediately after init
    loadFiles();
}

function getIconForFile(filename) {
    if (filename.endsWith('.py')) return '<i class="fa-brands fa-python" style="color: #4B8BBE;"></i>';
    if (filename.endsWith('.js')) return '<i class="fa-brands fa-js" style="color: #F7DF1E;"></i>';
    if (filename.endsWith('.html')) return '<i class="fa-brands fa-html5" style="color: #E34F26;"></i>';
    if (filename.endsWith('.css')) return '<i class="fa-brands fa-css3-alt" style="color: #1572B6;"></i>';
    if (filename.endsWith('.json')) return '<i class="fa-solid fa-code" style="color: #8BC34A;"></i>';
    return '<i class="fa-solid fa-file-lines" style="color: var(--text-muted);"></i>';
}

function newFile() {
    document.getElementById('current-filename').value = "untitled.html";
    checkRunVisibility();
    if(editor) {
        editor.setValue("<!DOCTYPE html>\n<html>\n<head>\n  <title>New Page</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>", -1);
        editor.session.setMode("ace/mode/html");
        editor.focus();
    }
}

async function aiEdit() {
    const promptStr = prompt("✨ AI Edit: What should the AI do to this code? (e.g., 'Fix the loop bug', 'Add comments')");
    if(!promptStr || !editor) return;

    const originalCode = editor.getValue();
    editor.setValue("✨ AI is analyzing and rewriting your code... please wait.", -1);
    
    try {
        const res = await fetch('/api/ai_edit', {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({prompt: promptStr, content: originalCode})
        });
        const data = await res.json();
        
        if(data.code && !data.code.includes("NETWORK_ERROR")) {
            editor.setValue(data.code, -1);
            showToast("AI Edit applied successfully", "success");
        } else {
            editor.setValue(originalCode, -1);
            showToast("AI Edit failed: \n" + (data.code || "Unknown error"), "error");
        }
    } catch(e) {
        editor.setValue(originalCode, -1);
        showToast("Network error during AI edit.", "error");
    }
}

async function runCode() {
    const filename = document.getElementById('current-filename').value;
    const previewContainer = document.getElementById('preview-container');
    const iframe = document.getElementById('live-preview-frame');

    // Make sure we save the latest changes before running so the backend API serves the fresh file
    await saveFile();

    previewContainer.style.display = 'block';

    if (filename.endsWith('.html')) {
        // Serve through our new endpoint so relative css/js imports work correctly
        iframe.src = `/preview/${currentToken}/${filename}`;
    } else if (filename.endsWith('.js') || filename.endsWith('.css')) {
        // If it's pure JS or CSS, wrap it in a dummy HTML to preview
        const content = editor.getValue();
        let htmlContent = '';
        if (filename.endsWith('.js')) {
            htmlContent = `<!DOCTYPE html><html><body><script>${content}<\/script></body></html>`;
        } else if (filename.endsWith('.css')) {
            htmlContent = `<!DOCTYPE html><html><head><style>${content}</style></head><body><h1>CSS Preview</h1><p>This is a sample text to preview your CSS styles.</p></body></html>`;
        }

        iframe.removeAttribute('src');
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(htmlContent);
        doc.close();
    }
}

function closePreview() {
    document.getElementById('preview-container').style.display = 'none';
}

function toggleFullScreenPreview() {
    const container = document.getElementById('preview-container');
    const icon = document.getElementById('fullscreen-icon');

    if (container.classList.contains('fullscreen-preview')) {
        container.classList.remove('fullscreen-preview');
        icon.classList.remove('fa-compress');
        icon.classList.add('fa-expand');
    } else {
        container.classList.add('fullscreen-preview');
        icon.classList.remove('fa-expand');
        icon.classList.add('fa-compress');
    }
}

async function deleteFile(e, filename) {
    e.stopPropagation(); // Don't trigger the row click
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;

    try {
        const res = await fetch('/api/file/delete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken, filename: filename})
        });
        const data = await res.json();

        if (data.success) {
            showToast(`Deleted ${filename}`, "success");
            if (document.getElementById('current-filename').value === filename) {
                document.getElementById('current-filename').value = '';
                editor.setValue('', -1);
                checkRunVisibility();
            }
            loadFiles();
        } else {
            showToast(`Failed to delete: ${data.error}`, "error");
        }
    } catch(err) {
        showToast("Network error while deleting.", "error");
    }
}

async function createFolder() {
    const folderName = prompt("Enter new folder name (e.g. 'src' or 'src/components'):");
    if (!folderName) return;

    try {
        const res = await fetch('/api/folder/create', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken, filename: folderName})
        });
        const data = await res.json();

        if (data.success) {
            showToast(`Created folder ${folderName}`, "success");
            loadFiles();
        } else {
            showToast(`Failed to create folder: ${data.error}`, "error");
        }
    } catch(err) {
        showToast("Network error while creating folder.", "error");
    }
}


async function deleteFolder() {
    const folderName = prompt("Enter folder path to delete (e.g. 'src/components'):");
    if (!folderName) return;

    if (!confirm(`Are you absolutely sure you want to delete the folder '${folderName}' AND all of its contents?`)) return;

    try {
        const res = await fetch('/api/folder/delete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken, filename: folderName})
        });
        const data = await res.json();

        if (data.success) {
            showToast(`Deleted folder ${folderName}`, "success");
            loadFiles();
        } else {
            showToast(`Failed to delete folder: ${data.error}`, "error");
        }
    } catch(err) {
        showToast("Network error while deleting folder.", "error");
    }
}



// Tab Management
let openTabs = [];
let activeTab = null;

function renderTabs() {
    const tabsContainer = document.getElementById('editor-tabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';

    if (openTabs.length === 0) {
        document.getElementById('current-file-path').innerText = 'No file selected';
        if(editor) editor.setValue('', -1);
        return;
    }

    openTabs.forEach(tab => {
        const tabEl = document.createElement('div');
        tabEl.className = `editor-tab ${tab === activeTab ? 'active' : ''}`;

        // Icon logic based on extension
        let iconHtml = '<i class="fa-solid fa-file-code"></i>';
        if (tab.endsWith('.js')) iconHtml = '<i class="fa-brands fa-js" style="color: #f7df1e;"></i>';
        else if (tab.endsWith('.html')) iconHtml = '<i class="fa-brands fa-html5" style="color: #e34f26;"></i>';
        else if (tab.endsWith('.css')) iconHtml = '<i class="fa-brands fa-css3-alt" style="color: #1572b6;"></i>';
        else if (tab.endsWith('.py')) iconHtml = '<i class="fa-brands fa-python" style="color: #3776ab;"></i>';
        else if (tab.endsWith('.json')) iconHtml = '<i class="fa-solid fa-code" style="color: #cb3837;"></i>';

        const nameSpan = document.createElement('span');
        nameSpan.innerHTML = `${iconHtml} ${tab.split('/').pop()}`;
        nameSpan.onclick = () => switchToTab(tab);

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            closeTab(tab);
        };

        tabEl.appendChild(nameSpan);
        tabEl.appendChild(closeBtn);
        tabsContainer.appendChild(tabEl);
    });
}

function switchToTab(filename) {
    if (!openTabs.includes(filename)) return;
    activeTab = filename;
    document.getElementById('current-file-path').innerText = filename;
    renderTabs();

    // We already have openFile to fetch content, we just call it
    // Wait, openFile overrides the value and fetches from network.
    // For a simple implementation, re-fetching is fine.

    // Replace the old input value setting:
    if (document.getElementById('current-filename')) {
        document.getElementById('current-filename').value = filename;
    }
    checkRunVisibility();

    // Highlight active file in explorer
    document.querySelectorAll('.file-item').forEach(el => {
        el.classList.remove('active');
        // Need to match exact filename. The UI might just show basename
        const rawName = el.getAttribute('data-filename') || el.innerText.trim();
        if (rawName === filename || el.innerText.trim() === filename) {
            el.classList.add('active');
        }
    });

    // Fetch content
    fetch('/api/file/read', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({token: currentToken, filename: filename})
    }).then(res => res.json()).then(data => {
        if(!data.error && editor) {
            editor.setValue(data.content, -1);
            if(filename.endsWith('.py')) editor.session.setMode("ace/mode/python");
            else if(filename.endsWith('.js')) editor.session.setMode("ace/mode/javascript");
            else if(filename.endsWith('.html')) editor.session.setMode("ace/mode/html");
            else if(filename.endsWith('.css')) editor.session.setMode("ace/mode/css");
            else if(filename.endsWith('.json')) editor.session.setMode("ace/mode/json");
            else editor.session.setMode("ace/mode/text");
        }
    }).catch(e => console.error(e));
}

function closeTab(filename) {
    openTabs = openTabs.filter(t => t !== filename);
    if (activeTab === filename) {
        if (openTabs.length > 0) {
            switchToTab(openTabs[openTabs.length - 1]);
        } else {
            activeTab = null;
            renderTabs();
            document.getElementById('current-file-path').innerText = 'No file selected';
            if(editor) editor.setValue('', -1);
        }
    } else {
        renderTabs();
    }
}

// Override openFile to use tabs
async function openFile(filename) {
    if (!openTabs.includes(filename)) {
        openTabs.push(filename);
    }
    switchToTab(filename);
}

// Override newFile to ask for path and then open
async function newFile() {
    const filename = prompt("Enter new filename (with extension):\n(You can include paths like 'src/app.js')");
    if(!filename) return;

    // Check if it already exists in the backend list roughly
    // We'll just try to save empty content to create it
    try {
        const res = await fetch('/api/file/save', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken, filename: filename, content: ""})
        });
        const data = await res.json();

        if(data.success) {
            showToast(`Created ${filename}`, "success");
            loadFiles();
            openFile(filename);
        } else {
            showToast("Error creating: " + data.error, "error");
        }
    } catch(e) {
        showToast("Network error while creating file.", "error");
    }
}

// Override renameFile to handle tabs
async function renameFile() {
    if (!activeTab) return;
    const oldName = activeTab;
    const newName = prompt("Enter new filename:", oldName);
    if(!newName || newName === oldName) return;

    try {
        const res = await fetch('/api/file/rename', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken, filename: oldName, new_name: newName})
        });
        const data = await res.json();
        if (data.success) {
            // Update tabs
            const tabIdx = openTabs.indexOf(oldName);
            if (tabIdx > -1) openTabs[tabIdx] = newName;
            activeTab = newName;

            checkRunVisibility();
            loadFiles();
            renderTabs();
            document.getElementById('current-file-path').innerText = newName;

            showToast("File renamed successfully", "success");
        } else {
            showToast(data.error || "Failed to rename", "error");
        }
    } catch (e) {
        showToast("Error renaming file.", "error");
    }
}

// Save needs to use activeTab
async function saveFile() {
    const filename = activeTab;
    const content = editor ? editor.getValue() : "";

    if(!filename) {
        showToast("No active file to save", "warning");
        return;
    }

    const saveBtn = document.querySelector('.editor-btn.primary');
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        const res = await fetch('/api/file/save', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken, filename: filename, content: content})
        });
        const data = await res.json();

        if(data.success) {
            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            showToast(`Saved ${filename}`, "success");
            setTimeout(() => saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>', 2000);
            loadFiles();

            // Auto-refresh preview if open
            if (document.getElementById('preview-container').style.display !== 'none') {
                runCode();
            }
        } else {
            showToast("Error saving: " + data.error, "error");
            saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';
        }
    } catch(e) {
        showToast("Network error while saving.", "error");
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';
    }
}

function checkRunVisibility() {
    const filename = activeTab;
    const runBtn = document.getElementById('run-btn');
    if (!filename) {
        runBtn.style.display = 'none';
        closePreview();
        return;
    }
    if (filename.endsWith('.html') || filename.endsWith('.js') || filename.endsWith('.css')) {
        runBtn.style.display = 'inline-block';
    } else {
        runBtn.style.display = 'none';
        closePreview();
    }
}

// Tree view renderer override
async function loadFiles() {
    try {
        const res = await fetch('/api/files', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: currentToken})
        });
        const data = await res.json();
        const list = document.getElementById('file-list');
        list.innerHTML = '';

        if(!data.files || data.files.length === 0) {
            list.innerHTML = '<div style="color:var(--text-muted); font-size:12px; padding:10px;">No files found.</div>';
            return;
        }

        // Create a tree structure
        const tree = {};
        data.files.forEach(f => {
            const parts = f.split('/');
            let current = tree;
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (!current[part]) {
                    current[part] = (i === parts.length - 1) ? f : {}; // if leaf, store full path, else object
                }
                current = current[part];
            }
        });

        function renderTree(node, container, depth = 0) {
            const keys = Object.keys(node).sort((a, b) => {
                // Folders first
                const aIsObj = typeof node[a] === 'object';
                const bIsObj = typeof node[b] === 'object';
                if (aIsObj && !bIsObj) return -1;
                if (!aIsObj && bIsObj) return 1;
                return a.localeCompare(b);
            });

            keys.forEach(key => {
                const isObj = typeof node[key] === 'object';

                const itemDiv = document.createElement('div');
                itemDiv.className = 'file-item';
                itemDiv.style.paddingLeft = `${10 + depth * 15}px`;

                if (isObj) {
                    // Folder
                    itemDiv.innerHTML = `<span><i class="fa-solid fa-chevron-down" style="font-size:10px; margin-right:5px; color:var(--text-muted);"></i><i class="fa-solid fa-folder" style="color:var(--accent-main);"></i> ${key}</span>`;
                    const childrenContainer = document.createElement('div');

                    itemDiv.onclick = (e) => {
                        const icon = itemDiv.querySelector('.fa-chevron-down, .fa-chevron-right');
                        if (childrenContainer.style.display === 'none') {
                            childrenContainer.style.display = 'block';
                            icon.className = 'fa-solid fa-chevron-down';
                        } else {
                            childrenContainer.style.display = 'none';
                            icon.className = 'fa-solid fa-chevron-right';
                        }
                    };

                    container.appendChild(itemDiv);
                    container.appendChild(childrenContainer);
                    renderTree(node[key], childrenContainer, depth + 1);
                } else {
                    // File
                    const fullPath = node[key];
                    itemDiv.setAttribute('data-filename', fullPath);
                    if (fullPath === activeTab) itemDiv.classList.add('active');

                    // Basic file icon logic
                    let iconHtml = '<i class="fa-solid fa-file-code" style="color:var(--text-secondary);"></i>';
                    if (key.endsWith('.js')) iconHtml = '<i class="fa-brands fa-js" style="color: #f7df1e;"></i>';
                    else if (key.endsWith('.html')) iconHtml = '<i class="fa-brands fa-html5" style="color: #e34f26;"></i>';
                    else if (key.endsWith('.css')) iconHtml = '<i class="fa-brands fa-css3-alt" style="color: #1572b6;"></i>';
                    else if (key.endsWith('.py')) iconHtml = '<i class="fa-brands fa-python" style="color: #3776ab;"></i>';
                    else if (key.endsWith('.json')) iconHtml = '<i class="fa-solid fa-code" style="color: #cb3837;"></i>';
                    else if (key.endsWith('.md')) iconHtml = '<i class="fa-brands fa-markdown" style="color: #000;"></i>';

                    itemDiv.innerHTML = `<span>${iconHtml} ${key}</span>
                                       <button class="editor-btn error" style="display:none; padding:2px 5px;" onclick="deleteFile(event, '${fullPath}')" title="Delete"><i class="fa-solid fa-trash"></i></button>`;

                    itemDiv.onclick = () => openFile(fullPath);

                    // Show delete on hover
                    itemDiv.addEventListener('mouseenter', () => itemDiv.querySelector('button').style.display = 'inline-block');
                    itemDiv.addEventListener('mouseleave', () => itemDiv.querySelector('button').style.display = 'none');

                    container.appendChild(itemDiv);
                }
            });
        }

        renderTree(tree, list);

    } catch (e) {
        console.error(e);
        document.getElementById('file-list').innerHTML = '<div style="color:red; padding:10px;">Error loading files</div>';
    }
}
