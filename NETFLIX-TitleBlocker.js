// ==UserScript==
// @name         Netflix Title Blocker
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  サムネイルの下にタイトル表示を追加します。追加されたタイトルを右クリックすることで、そのタイトルをブロックリストに追加するか、既に追加したタイトルを編集することができます。
// @author       NinihuWD
// @match        https://www.netflix.com/*
// @grant        none
// @copyright    2024+
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    let blockedTitles = JSON.parse(localStorage.getItem('blockedTitles')) || [];

    const style = `
        .custom-title-container {
            text-align: center;
            margin-top: 20px;
        }
        .custom-title {
            font-size: 15px;
            color: white;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
            display: block;
        }
        .custom-context-menu {
            position: absolute;
            background: #333;
            border: 1px solid #444;
            z-index: 1000;
        }
        .context-menu-item {
            padding: 8px;
            cursor: pointer;
            color: #fff;
        }
        .context-menu-item:hover {
            background: #555;
        }
        .modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #444;
            border: 1px solid #ccc;
            padding: 20px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            z-index: 1001;
            //width: 300px;
        }
        .modal-header {
            font-size: 16px;
            margin-bottom: 10px;
        }
        .modal-content {
            max-height: 500px;
            overflow-y: auto;
        }
        .modal-footer {
            margin-top: 10px;
            text-align: right;
        }
        .modal-button {
            background: #007bff;
            color: #fff;
            border: none;
            padding: 5px 10px;
            cursor: pointer;
        }
        .modal-button.cancel {
            background: #6c757d;
        }
        .modal-button:hover {
            background: #0056b3;
        }
        .modal-button.cancel:hover {
            background: #5a6268;
        }
        .modal-edit-button {
            background: #28a745;
        }
        .modal-edit-button:hover {
            background: #218838;
        }
        .modal-edit-container {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }
        .modal-edit-title {
            flex: 1;
            margin-right: 10px;
            color: black;
            width: 400px;
            font-weight: bold;
        }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = style;
    document.head.appendChild(styleSheet);

    let observer;
    let isProcessing = false; // 処理中のフラグ

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function isBlockTitle(title) {
        return blockedTitles.some(blockedTitle => new RegExp(escapeRegExp(blockedTitle), 'i').test(title));
    }

    function getVisibleContainers() {
        const allContainers = Array.from(document.querySelectorAll('.slider-item, .ltr-1cjyscz'));
        return allContainers.filter(container => getComputedStyle(container).display !== 'none');
    }

    function addTitles() {
        if (isProcessing) return;
        isProcessing = true;

        const titleContainers = getVisibleContainers().filter(container => !container.querySelector('.custom-title-container'));
        //console.log(titleContainers.length); // デバッグ用

        titleContainers.forEach(container => {
            const title = container.querySelector('.fallback-text');
            if (title) {
                const titleText = title.textContent.trim();
                const titleContainer = document.createElement('div');
                titleContainer.className = 'custom-title-container';

                const titleElement = document.createElement('span');
                titleElement.className = 'custom-title';
                titleElement.textContent = titleText;

                titleContainer.appendChild(titleElement);
                container.appendChild(titleContainer);
            }
        });

        isProcessing = false;
    }

    function applyBlockedTitles() {
        if (isProcessing) return;
        isProcessing = true;

        const titleContainers = getVisibleContainers();
        titleContainers.forEach(container => {
            const titleElement = container.querySelector('.fallback-text');
            if (titleElement) {
                const titleText = titleElement.textContent.trim();
                if (isBlockTitle(titleText)) {
                    container.style.display = 'none';
                }
            }
        });

        isProcessing = false;
    }

    function showContextMenu(event) {
        event.preventDefault();

        const existingMenu = document.querySelector('.custom-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        const menu = document.createElement('div');
        menu.className = 'custom-context-menu';
        menu.style.left = `${event.pageX}px`;
        menu.style.top = `${event.pageY}px`;

        const blockItem = document.createElement('div');
        blockItem.className = 'context-menu-item';
        blockItem.dataset.title = event.target.closest('.custom-title').textContent.trim();
        blockItem.textContent = 'Block this: ' + blockItem.dataset.title;
        blockItem.addEventListener('click', function() {
            const title = this.dataset.title;
            if (!isBlockTitle(title)) {
                blockedTitles.push(title);
                localStorage.setItem('blockedTitles', JSON.stringify(blockedTitles));
                applyBlockedTitles();
                addTitles();
            }
            menu.remove();
        });

        const editItem = document.createElement('div');
        editItem.className = 'context-menu-item';
        editItem.textContent = 'Edit Blocked Titles';
        editItem.addEventListener('click', function() {
            showEditModal();
            menu.remove();
        });

        menu.appendChild(blockItem);
        menu.appendChild(editItem);
        document.body.appendChild(menu);

        function closeMenu(event) {
            if (!menu.contains(event.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        }
        document.addEventListener('click', closeMenu);
    }

    function showEditModal() {
        const existingModal = document.querySelector('.modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'modal';

        const header = document.createElement('div');
        header.className = 'modal-header';
        header.textContent = 'Edit Blocked Titles';
        modal.appendChild(header);

        const content = document.createElement('div');
        content.className = 'modal-content';
        blockedTitles.forEach((title, index) => {
            const editContainer = document.createElement('div');
            editContainer.className = 'modal-edit-container';

            const titleInput = document.createElement('input');
            titleInput.className = 'modal-edit-title';
            titleInput.value = title;
            titleInput.defaultValue = title;

            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.className = 'modal-button cancel';
            removeButton.addEventListener('click', () => {
                blockedTitles.splice(index, 1);
                localStorage.setItem('blockedTitles', JSON.stringify(blockedTitles));
                modal.remove();
                addTitles();
                applyBlockedTitles();
            });

            const editButton = document.createElement('button');
            editButton.textContent = 'Save';
            editButton.className = 'modal-button modal-edit-button';
            editButton.addEventListener('click', () => {
                const newTitle = titleInput.value.trim();
                if (newTitle && newTitle !== title) {
                    blockedTitles[index] = newTitle;
                    localStorage.setItem('blockedTitles', JSON.stringify(blockedTitles));
                    modal.remove();
                    addTitles();
                    applyBlockedTitles();
                }
            });

            editContainer.appendChild(titleInput);
            editContainer.appendChild(removeButton);
            editContainer.appendChild(editButton);
            content.appendChild(editContainer);
        });
        modal.appendChild(content);

        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        const closeButton = document.createElement('button');
        closeButton.className = 'modal-button cancel';
        closeButton.textContent = 'Close';
        closeButton.addEventListener('click', () => modal.remove());
        footer.appendChild(closeButton);
        modal.appendChild(footer);

        document.body.appendChild(modal);
    }

    function handleContextMenu(event) {
        const titleElement = event.target.closest('.custom-title');
        if (titleElement) {
            showContextMenu(event);
        }
    }

    document.addEventListener('contextmenu', handleContextMenu);

    window.addEventListener('load', () => {
        applyBlockedTitles();
        addTitles();

        observer = new MutationObserver((mutations) => {
            applyBlockedTitles();
            addTitles();
        });

        observer.observe(document.body, { childList: true, subtree: true });
    });
})();
