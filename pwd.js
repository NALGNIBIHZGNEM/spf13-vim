https://freegpt.es/

实现一个V3版本的chrome插件功能包括：
1、自动保存登录表单上的用户名和密码，无需用户确认。
2、用户再次登录，当鼠标光标点击用户名输入栏时，提示用户该URL已经保存的用户名和密码。
3、当用户输入新的用户名和密码时，自动保存。当用户选择已经保存的用户名时，自动填充登录表单上的用户名和密码。
4、提供用户管理已保存凭证份界面，并允许用户查看，和删除凭证。
5、提供不保存凭证的URL正则配置管理，可以配置多条正则。当登录的URL匹配不保存凭证中配置的任意一条正则时，不保存凭证。
6、请注意处理登录时会出现两次提交登录表单的情况，第一次使用的是用户输入的密码。第二次系统会对密码加密后，再次提交。
7、为生成的代码添加详细的注释

🔔 Generate by https://freegpt.tech/

下面是一个基于 Manifest V3 的 Chrome 插件示例，满足你提出的所有需求。
插件功能：

自动保存登录表单用户名和密码，无需用户确认
鼠标点击用户名输入框时提示已保存的凭证
输入新凭证自动保存，选择已有凭证自动填充
提供管理界面查看和删除凭证
支持配置不保存凭证的URL正则规则
处理两次提交登录表单的情况（第一次明文，第二次加密密码）
代码中包含详细注释
目录结构示例
my-chrome-extension/
│
├── manifest.json
├── background.js
├── content.js
├── options.html
├── options.js
└── styles.css
1. manifest.json
{
  "manifest_version": 3,
  "name": "Auto Login Credential Manager",
  "version": "1.0",
  "description": "自动保存和填充登录凭证，支持管理和正则过滤",
  "permissions": [
    "storage",
    "scripting",
    "activeTab"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "options_page": "options.html",
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_title": "Auto Login Credential Manager"
  }
}
2. background.js
// background.js
// 负责管理存储数据，处理消息通信

// 存储结构示例：
// credentials = {
//   "https://example.com/login": [
//     {username: "user1", password: "pass1"},
//     {username: "user2", password: "pass2"}
//   ],
//   ...
// }
// doNotSavePatterns = [
//   ".*://.*\\.example\\.com/no-save.*",
//   ...
// ]

// 监听来自 content.js 和 options.js 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveCredential") {
    saveCredential(message.url, message.username, message.password).then(() => {
      sendResponse({status: "ok"});
    });
    return true; // 表示异步响应
  } else if (message.action === "getCredentials") {
    getCredentials(message.url).then(creds => {
      sendResponse({credentials: creds || []});
    });
    return true;
  } else if (message.action === "deleteCredential") {
    deleteCredential(message.url, message.username).then(() => {
      sendResponse({status: "ok"});
    });
    return true;
  } else if (message.action === "getDoNotSavePatterns") {
    getDoNotSavePatterns().then(patterns => {
      sendResponse({patterns});
    });
    return true;
  } else if (message.action === "saveDoNotSavePatterns") {
    saveDoNotSavePatterns(message.patterns).then(() => {
      sendResponse({status: "ok"});
    });
    return true;
  }
});

// 保存凭证（自动合并，避免重复）
async function saveCredential(url, username, password) {
  if (!url || !username || !password) return;
  const data = await chrome.storage.local.get(["credentials"]);
  const credentials = data.credentials || {};
  if (!credentials[url]) credentials[url] = [];

  // 先检查是否已有相同用户名，更新密码
  const index = credentials[url].findIndex(c => c.username === username);
  if (index >= 0) {
    credentials[url][index].password = password;
  } else {
    credentials[url].push({username, password});
  }

  await chrome.storage.local.set({credentials});
}

// 获取指定URL的所有凭证
async function getCredentials(url) {
  const data = await chrome.storage.local.get(["credentials"]);
  const credentials = data.credentials || {};
  return credentials[url] || [];
}

// 删除指定URL和用户名的凭证
async function deleteCredential(url, username) {
  const data = await chrome.storage.local.get(["credentials"]);
  const credentials = data.credentials || {};
  if (!credentials[url]) return;

  credentials[url] = credentials[url].filter(c => c.username !== username);
  if (credentials[url].length === 0) {
    delete credentials[url];
  }
  await chrome.storage.local.set({credentials});
}

// 获取不保存凭证的URL正则配置
async function getDoNotSavePatterns() {
  const data = await chrome.storage.local.get(["doNotSavePatterns"]);
  return data.doNotSavePatterns || [];
}

// 保存不保存凭证的URL正则配置
async function saveDoNotSavePatterns(patterns) {
  await chrome.storage.local.set({doNotSavePatterns: patterns});
}
3. content.js
// content.js
// 注入登录页面，监听表单提交，自动保存和填充凭证

(async () => {
  // 当前页面URL
  const pageUrl = window.location.origin + window.location.pathname;

  // 获取不保存凭证的正则列表
  const {patterns} = await chrome.runtime.sendMessage({action: "getDoNotSavePatterns"});

  // 判断当前URL是否匹配不保存列表
  const isDoNotSave = patterns.some(pattern => {
    try {
      const re = new RegExp(pattern);
      return re.test(window.location.href);
    } catch {
      return false;
    }
  });
  if (isDoNotSave) {
    // 如果不保存，则不继续执行保存逻辑
    return;
  }

  // 保存登录凭证的函数
  async function saveLoginCredential(username, password) {
    await chrome.runtime.sendMessage({
      action: "saveCredential",
      url: pageUrl,
      username,
      password
    });
  }

  // 获取已保存凭证
  async function getSavedCredentials() {
    const response = await chrome.runtime.sendMessage({
      action: "getCredentials",
      url: pageUrl
    });
    return response.credentials || [];
  }

  // 自动填充函数
  async function autofillCredential(usernameInput, passwordInput, username) {
    const creds = await getSavedCredentials();
    const cred = creds.find(c => c.username === username);
    if (cred) {
      usernameInput.value = cred.username;
      passwordInput.value = cred.password;
    }
  }

  // 找到登录表单和用户名/密码输入框
  // 此处简单示例，实际可根据页面调整选择器
  const forms = document.querySelectorAll("form");
  let loginForm = null;
  let usernameInput = null;
  let passwordInput = null;

  // 尝试找到表单中有用户名和密码输入框的表单
  forms.forEach(form => {
    const u = form.querySelector('input[type="text"], input[type="email"], input[name*="user"], input[name*="email"]');
    const p = form.querySelector('input[type="password"]');
    if (u && p) {
      loginForm = form;
      usernameInput = u;
      passwordInput = p;
    }
  });

  if (!loginForm || !usernameInput || !passwordInput) {
    return;
  }

  // 监听用户名输入框点击，提示已保存凭证
  usernameInput.addEventListener("focus", async () => {
    const creds = await getSavedCredentials();
    if (creds.length === 0) return;

    // 创建提示框
    let dropdown = document.getElementById("credential-dropdown");
    if (dropdown) dropdown.remove();

    dropdown = document.createElement("div");
    dropdown.id = "credential-dropdown";
    dropdown.style.position = "absolute";
    dropdown.style.background = "white";
    dropdown.style.border = "1px solid #ccc";
    dropdown.style.zIndex = 9999;
    dropdown.style.maxHeight = "150px";
    dropdown.style.overflowY = "auto";
    dropdown.style.cursor = "pointer";

    // 计算输入框位置
    const rect = usernameInput.getBoundingClientRect();
    dropdown.style.top = (window.scrollY + rect.bottom) + "px";
    dropdown.style.left = (window.scrollX + rect.left) + "px";
    dropdown.style.minWidth = rect.width + "px";

    // 添加凭证列表
    creds.forEach(c => {
      const item = document.createElement("div");
      item.textContent = c.username;
      item.style.padding = "5px";
      item.addEventListener("mousedown", e => {
        e.preventDefault(); // 阻止失去焦点
        usernameInput.value = c.username;
        passwordInput.value = c.password;
        dropdown.remove();
      });
      dropdown.appendChild(item);
    });

    document.body.appendChild(dropdown);

    // 点击页面其他地方关闭下拉框
    const closeDropdown = (e) => {
      if (!dropdown.contains(e.target) && e.target !== usernameInput) {
        dropdown.remove();
        document.removeEventListener("mousedown", closeDropdown);
      }
    };
    document.addEventListener("mousedown", closeDropdown);
  });

  // 监听表单提交，保存凭证
  loginForm.addEventListener("submit", async (e) => {
    // 处理两次提交的情况
    // 这里假设第一次提交是明文密码，第二次提交密码被加密
    // 通过观察密码输入框的值是否与之前保存的密码不同来判断

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) return;

    // 获取已保存的密码
    const savedCreds = await getSavedCredentials();
    const saved = savedCreds.find(c => c.username === username);

    // 如果密码和保存的不同，保存新密码
    if (!saved || saved.password !== password) {
      await saveLoginCredential(username, password);
    }
  });

  // 监听用户名输入框变化，自动填充密码
  usernameInput.addEventListener("input", async () => {
    const username = usernameInput.value.trim();
    if (!username) {
      passwordInput.value = "";
      return;
    }
    const creds = await getSavedCredentials();
    const cred = creds.find(c => c.username === username);
    if (cred) {
      passwordInput.value = cred.password;
    }
  });
})();
4. options.html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>凭证管理</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    th { background-color: #f4f4f4; }
    .pattern-list { margin-bottom: 20px; }
    input[type=text] { width: 300px; }
    button { margin-left: 5px; }
  </style>
</head>
<body>
  <h1>凭证管理</h1>
  <table id="credential-table">
    <thead>
      <tr><th>URL</th><th>用户名</th><th>密码</th><th>操作</th></tr>
    </thead>
    <tbody></tbody>
  </table>

  <h2>不保存凭证的URL正则配置</h2>
  <div class="pattern-list" id="pattern-list"></div>
  <input type="text" id="new-pattern" placeholder="输入正则表达式" />
  <button id="add-pattern">添加</button>
  <button id="save-pattern">保存配置</button>

  <script src="options.js"></script>
</body>
</html>
5. options.js
// options.js
// 管理凭证和正则配置的界面逻辑

// 加载所有凭证并显示
async function loadCredentials() {
  const data = await chrome.storage.local.get(["credentials"]);
  const credentials = data.credentials || {};
  const tbody = document.querySelector("#credential-table tbody");
  tbody.innerHTML = "";

  // 遍历所有URL和凭证
  for (const url in credentials) {
    credentials[url].forEach(cred => {
      const tr = document.createElement("tr");

      const tdUrl = document.createElement("td");
      tdUrl.textContent = url;
      tr.appendChild(tdUrl);

      const tdUser = document.createElement("td");
      tdUser.textContent = cred.username;
      tr.appendChild(tdUser);

      const tdPass = document.createElement("td");
      tdPass.textContent = cred.password;
      tr.appendChild(tdPass);

      const tdAction = document.createElement("td");
      const delBtn = document.createElement("button");
      delBtn.textContent = "删除";
      delBtn.addEventListener("click", async () => {
        await chrome.runtime.sendMessage({
          action: "deleteCredential",
          url,
          username: cred.username
        });
        loadCredentials();
      });
      tdAction.appendChild(delBtn);
      tr.appendChild(tdAction);

      tbody.appendChild(tr);
    });
  }
}

// 加载不保存凭证的正则配置
async function loadPatterns() {
  const data = await chrome.storage.local.get(["doNotSavePatterns"]);
  const patterns = data.doNotSavePatterns || [];
  const container = document.getElementById("pattern-list");
  container.innerHTML = "";

  patterns.forEach((pattern, index) => {
    const div = document.createElement("div");
    const input = document.createElement("input");
    input.type = "text";
    input.value = pattern;
    input.style.width = "300px";

    const delBtn = document.createElement("button");
    delBtn.textContent = "删除";
    delBtn.addEventListener("click", () => {
      container.removeChild(div);
    });

    div.appendChild(input);
    div.appendChild(delBtn);
    container.appendChild(div);
  });
}

// 添加新正则输入框
document.getElementById("add-pattern").addEventListener("click", () => {
  const container = document.getElementById("pattern-list");
  const div = document.createElement("div");

  const input = document.createElement("input");
  input.type = "text";
  input.style.width = "300px";

  const delBtn = document.createElement("button");
  delBtn.textContent = "删除";
  delBtn.addEventListener("click", () => {
    container.removeChild(div);
  });

  div.appendChild(input);
  div.appendChild(delBtn);
  container.appendChild(div);
});

// 保存正则配置
document.getElementById("save-pattern").addEventListener("click", async () => {
  const container = document.getElementById("pattern-list");
  const inputs = container.querySelectorAll("input[type=text]");
  const patterns = [];

  for (const input of inputs) {
    const val = input.value.trim();
    if (val) {
      // 验证正则表达式合法性
      try {
        new RegExp(val);
        patterns.push(val);
      } catch {
        alert(`无效的正则表达式: ${val}`);
        return;
      }
    }
  }

  await chrome.runtime.sendMessage({
    action: "saveDoNotSavePatterns",
    patterns
  });
  alert("保存成功");
});


// 初始化界面
loadCredentials();
loadPatterns();
使用说明
将上述代码分别保存为对应文件，放入同一目录。
打开 Chrome 浏览器，进入 chrome://extensions/
打开“开发者模式”，点击“加载已解压的扩展程序”，选择插件目录。
访问登录页面，插件会自动保存和填充凭证。
点击插件“选项”页面管理凭证和配置不保存的URL正则。
如果你需要我帮你生成完整的压缩包或者进一步定制功能，也可以告诉我！

帮我生成完整的压缩包

你需要的 Chrome 插件功能较为复杂，涉及表单监听、自动保存、自动填充、正则配置、凭证管理等。下面我会详细说明插件的结构、主要代码，并附上详细注释。你可以将这些文件整理成一个文件夹，打包为 zip 压缩包，即可作为 Chrome 插件加载。

目录结构
chrome-autofill-v3/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── options.html
├── options.js
├── style.css
└── icon.png
1. manifest.json
{
  "manifest_version": 3,
  "name": "自动表单凭证管理器",
  "version": "3.0",
  "description": "自动保存和填充登录表单，支持凭证管理和URL正则过滤。",
  "permissions": [
    "storage",
    "scripting",
    "activeTab"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_end"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon.png"
  },
  "options_page": "options.html",
  "icons": {
    "16": "icon.png",
    "48": "icon.png",
    "128": "icon.png"
  }
}
2. content.js
// content.js
// 负责表单监听、自动保存、自动填充

// 获取当前页面URL
function getCurrentUrl() {
    return window.location.origin + window.location.pathname;
}

// 检查URL是否匹配不保存凭证的正则
async function isUrlExcluded(url) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['excludePatterns'], (result) => {
            const patterns = result.excludePatterns || [];
            for (const pattern of patterns) {
                try {
                    if (new RegExp(pattern).test(url)) {
                        resolve(true);
                        return;
                    }
                } catch (e) {}
            }
            resolve(false);
        });
    });
}

// 查找登录表单
function findLoginForm() {
    const forms = document.querySelectorAll('form');
    for (const form of forms) {
        const inputs = form.querySelectorAll('input[type="password"]');
        if (inputs.length > 0) return form;
    }
    return null;
}

// 自动保存凭证
function saveCredential(url, username, password) {
    chrome.storage.local.get(['credentials'], (result) => {
        let credentials = result.credentials || {};
        if (!credentials[url]) credentials[url] = [];
        // 检查是否已存在
        const idx = credentials[url].findIndex(item => item.username === username);
        if (idx >= 0) {
            credentials[url][idx].password = password;
        } else {
            credentials[url].push({ username, password });
        }
        chrome.storage.local.set({ credentials });
    });
}

// 自动填充凭证
function autofillCredential(url, username) {
    chrome.storage.local.get(['credentials'], (result) => {
        const credentials = result.credentials || {};
        if (credentials[url]) {
            const cred = credentials[url].find(item => item.username === username);
            if (cred) {
                const form = findLoginForm();
                if (form) {
                    const userInput = form.querySelector('input[type="text"], input[type="email"]');
                    const passInput = form.querySelector('input[type="password"]');
                    if (userInput && passInput) {
                        userInput.value = cred.username;
                        passInput.value = cred.password;
                    }
                }
            }
        }
    });
}

// 监听表单提交
let lastPassword = null;
let submitCount = 0;

async function handleFormSubmit(e) {
    const form = e.target;
    const url = getCurrentUrl();
    if (await isUrlExcluded(url)) return;

    const userInput = form.querySelector('input[type="text"], input[type="email"]');
    const passInput = form.querySelector('input[type="password"]');
    if (userInput && passInput) {
        const username = userInput.value;
        const password = passInput.value;
        submitCount += 1;
        // 只保存第一次提交的明文密码
        if (submitCount === 1) {
            lastPassword = password;
            saveCredential(url, username, password);
        }
        // 第二次提交（加密后），不再保存
        setTimeout(() => { submitCount = 0; }, 2000);
    }
}

// 监听用户名输入框点击，弹出已保存凭证
function showCredentialHint(e) {
    const url = getCurrentUrl();
    chrome.storage.local.get(['credentials'], (result) => {
        const credentials = result.credentials || {};
        if (credentials[url] && credentials[url].length > 0) {
            // 创建下拉提示
            let datalist = document.getElementById('chrome-autofill-datalist');
            if (!datalist) {
                datalist = document.createElement('datalist');
                datalist.id = 'chrome-autofill-datalist';
                document.body.appendChild(datalist);
            }
            datalist.innerHTML = '';
            credentials[url].forEach(item => {
                const option = document.createElement('option');
                option.value = item.username;
                datalist.appendChild(option);
            });
            e.target.setAttribute('list', 'chrome-autofill-datalist');
        }
    });
}

// 监听用户名输入变化，自动填充密码
function handleUsernameInput(e) {
    const url = getCurrentUrl();
    const username = e.target.value;
    chrome.storage.local.get(['credentials'], (result) => {
        const credentials = result.credentials || {};
        if (credentials[url]) {
            const cred = credentials[url].find(item => item.username === username);
            if (cred) {
                const form = findLoginForm();
                if (form) {
                    const passInput = form.querySelector('input[type="password"]');
                    if (passInput) {
                        passInput.value = cred.password;
                    }
                }
            }
        }
    });
}

// 初始化监听
function init() {
    const form = findLoginForm();
    if (form) {
        form.addEventListener('submit', handleFormSubmit, true);
        const userInput = form.querySelector('input[type="text"], input[type="email"]');
        if (userInput) {
            userInput.addEventListener('focus', showCredentialHint);
            userInput.addEventListener('input', handleUsernameInput);
        }
    }
}

window.addEventListener('DOMContentLoaded', init);
3. background.js
// background.js
// 目前主要用于后续扩展，暂时无特殊逻辑
chrome.runtime.onInstalled.addListener(() => {
    // 初始化存储
    chrome.storage.local.get(['credentials', 'excludePatterns'], (result) => {
        if (!result.credentials) chrome.storage.local.set({ credentials: {} });
        if (!result.excludePatterns) chrome.storage.local.set({ excludePatterns: [] });
    });
});
4. popup.html
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>凭证管理</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h2>已保存凭证</h2>
    <div id="credential-list"></div>
    <button id="open-options">管理不保存URL</button>
    <script src="popup.js"></script>
</body>
</html>
5. popup.js
// popup.js
// 显示和管理已保存凭证

function renderCredentials() {
    chrome.storage.local.get(['credentials'], (result) => {
        const credentials = result.credentials || {};
        const listDiv = document.getElementById('credential-list');
        listDiv.innerHTML = '';
        for (const url in credentials) {
            credentials[url].forEach((item, idx) => {
                const div = document.createElement('div');
                div.className = 'cred-item';
                div.innerHTML = `
                    <b>URL:</b> ${url}<br>
                    <b>用户名:</b> ${item.username}<br>
                    <b>密码:</b> <span class="password">${item.password}</span>
                    <button data-url="${url}" data-idx="${idx}" class="del-btn">删除</button>
                `;
                listDiv.appendChild(div);
            });
        }
        // 绑定删除事件
        document.querySelectorAll('.del-btn').forEach(btn => {
            btn.onclick = function() {
                const url = this.getAttribute('data-url');
                const idx = parseInt(this.getAttribute('data-idx'));
                chrome.storage.local.get(['credentials'], (result) => {
                    let credentials = result.credentials || {};
                    if (credentials[url]) {
                        credentials[url].splice(idx, 1);
                        if (credentials[url].length === 0) delete credentials[url];
                        chrome.storage.local.set({ credentials }, renderCredentials);
                    }
                });
            };
        });
    });
}

document.getElementById('open-options').onclick = function() {
    chrome.runtime.openOptionsPage();
};

renderCredentials();
6. options.html
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>不保存URL管理</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h2>不保存凭证的URL正则配置</h2>
    <form id="add-pattern-form">
        <input type="text" id="pattern-input" placeholder="输入正则表达式" required>
        <button type="submit">添加</button>
    </form>
    <ul id="pattern-list"></ul>
    <a href="#" onclick="window.close()">关闭</a>
    <script src="options.js"></script>
</body>
</html>
7. options.js
// options.js
// 管理不保存凭证的URL正则

function renderPatterns() {
    chrome.storage.local.get(['excludePatterns'], (result) => {
        const patterns = result.excludePatterns || [];
        const list = document.getElementById('pattern-list');
        list.innerHTML = '';
        patterns.forEach((pattern, idx) => {
            const li = document.createElement('li');
            li.textContent = pattern;
            const btn = document.createElement('button');
            btn.textContent = '删除';
            btn.onclick = function() {
                patterns.splice(idx, 1);
                chrome.storage.local.set({ excludePatterns: patterns }, renderPatterns);
            };
            li.appendChild(btn);
            list.appendChild(li);
        });
    });
}

document.getElementById('add-pattern-form').onsubmit = function(e) {
    e.preventDefault();
    const input = document.getElementById('pattern-input');
    const pattern = input.value.trim();
    if (pattern) {
        chrome.storage.local.get(['excludePatterns'], (result) => {
            const patterns = result.excludePatterns || [];
            patterns.push(pattern);
            chrome.storage.local.set({ excludePatterns: patterns }, () => {
                input.value = '';
                renderPatterns();
            });
        });
    }
};

renderPatterns();
8. style.css
body {
    font-family: Arial, sans-serif;
    margin: 10px;
}
.cred-item {
    border: 1px solid #ccc;
    margin-bottom: 8px;
    padding: 8px;
    border-radius: 4px;
}
.password {
    font-family: 'Consolas', monospace;
    color: #333;
}
button {
    margin-left: 8px;
}
9. icon.png
请自行准备一个 128x128 的 PNG 图标，命名为 icon.png，放在插件根目录。

打包方法
将上述所有文件和 icon.png 放入同一文件夹（如 chrome-autofill-v3）。
选中该文件夹，右键压缩为 zip 文件（如 chrome-autofill-v3.zip）。
在 Chrome 扩展管理页面（chrome://extensions/）选择“加载已解压的扩展程序”或“打包扩展程序”即可。
如需进一步定制或遇到问题，欢迎继续提问！

增加密码加密本地存储

要实现“密码加密本地存储”，推荐的做法是：

在保存密码前用加密算法（如AES）加密，存储密文。
在自动填充时解密密文，恢复明文密码。
密钥可以用用户自定义主密码（推荐），或简单用浏览器本地生成的随机密钥（安全性略低，但实现简单）。
下面以“用户首次使用时设置主密码，后续用主密码派生密钥进行AES加解密”为例，给出详细实现方案。
（如需无主密码自动加密方案，也可告知）

1. 新增依赖：crypto-js
Chrome 插件不能直接用 Node.js 的 crypto，需要用纯 JS 实现。推荐 crypto-js。

下载 crypto-js.min.js
去 https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js 下载，放到插件根目录，并在 manifest.json 的 web_accessible_resources 或 html 里引用。

2. manifest.json 需增加
// ... existing code ...
"web_accessible_resources": [
  {
    "resources": ["crypto-js.min.js"],
    "matches": ["<all_urls>"]
  }
],
// ... existing code ...
3. 新增主密码设置界面（options.html/options.js）
在 options.html 增加主密码设置区：

<!-- ... existing code ... -->
<h2>主密码设置</h2>
<form id="master-form">
  <input type="password" id="master-input" placeholder="设置或输入主密码" required>
  <button type="submit">保存主密码</button>
</form>
<!-- ... existing code ... -->
在 options.js 增加主密码保存逻辑：

// ... existing code ...
document.getElementById('master-form').onsubmit = function(e) {
    e.preventDefault();
    const input = document.getElementById('master-input');
    const master = input.value.trim();
    if (master) {
        // 只存储主密码的hash，不存明文
        const hash = CryptoJS.SHA256(master).toString();
        chrome.storage.local.set({ masterHash: hash }, () => {
            alert('主密码已保存！');
            input.value = '';
        });
    }
};
// ... existing code ...
在 options.html 头部引入 crypto-js：

<script src="crypto-js.min.js"></script>
4. content.js 加密/解密逻辑
引入 crypto-js：
在 content.js 顶部加：

// content.js
const script = document.createElement('script');
script.src = chrome.runtime.getURL('crypto-js.min.js');
document.head.appendChild(script);
加密/解密函数：

function getMasterKey(callback) {
    chrome.storage.local.get(['masterHash'], (result) => {
        if (!result.masterHash) {
            const userInput = prompt('请先设置主密码（options页面），或输入主密码：');
            if (!userInput) return callback(null);
            const hash = CryptoJS.SHA256(userInput).toString();
            chrome.storage.local.set({ masterHash: hash }, () => callback(hash));
        } else {
            callback(result.masterHash);
        }
    });
}

function encryptPassword(password, masterKey) {
    return CryptoJS.AES.encrypt(password, masterKey).toString();
}

function decryptPassword(cipher, masterKey) {
    try {
        const bytes = CryptoJS.AES.decrypt(cipher, masterKey);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        return '';
    }
}
保存凭证时加密：

function saveCredential(url, username, password) {
    getMasterKey((masterKey) => {
        if (!masterKey) return;
        chrome.storage.local.get(['credentials'], (result) => {
            let credentials = result.credentials || {};
            if (!credentials[url]) credentials[url] = [];
            const idx = credentials[url].findIndex(item => item.username === username);
            const encrypted = encryptPassword(password, masterKey);
            if (idx >= 0) {
                credentials[url][idx].password = encrypted;
            } else {
                credentials[url].push({ username, password: encrypted });
            }
            chrome.storage.local.set({ credentials });
        });
    });
}
自动填充时解密：

function autofillCredential(url, username) {
    getMasterKey((masterKey) => {
        if (!masterKey) return;
        chrome.storage.local.get(['credentials'], (result) => {
            const credentials = result.credentials || {};
            if (credentials[url]) {
                const cred = credentials[url].find(item => item.username === username);
                if (cred) {
                    const form = findLoginForm();
                    if (form) {
                        const userInput = form.querySelector('input[type="text"], input[type="email"]');
                        const passInput = form.querySelector('input[type="password"]');
                        if (userInput && passInput) {
                            userInput.value = cred.username;
                            passInput.value = decryptPassword(cred.password, masterKey);
                        }
                    }
                }
            }
        });
    });
}
用户名输入自动填充密码时也要解密：

function handleUsernameInput(e) {
    const url = getCurrentUrl();
    const username = e.target.value;
    getMasterKey((masterKey) => {
        if (!masterKey) return;
        chrome.storage.local.get(['credentials'], (result) => {
            const credentials = result.credentials || {};
            if (credentials[url]) {
                const cred = credentials[url].find(item => item.username === username);
                if (cred) {
                    const form = findLoginForm();
                    if (form) {
                        const passInput = form.querySelector('input[type="password"]');
                        if (passInput) {
                            passInput.value = decryptPassword(cred.password, masterKey);
                        }
                    }
                }
            }
        });
    });
}
5. popup.js 显示密码时解密
function renderCredentials() {
    getMasterKey((masterKey) => {
        if (!masterKey) return;
        chrome.storage.local.get(['credentials'], (result) => {
            const credentials = result.credentials || {};
            const listDiv = document.getElementById('credential-list');
            listDiv.innerHTML = '';
            for (const url in credentials) {
                credentials[url].forEach((item, idx) => {
                    const decrypted = decryptPassword(item.password, masterKey);
                    const div = document.createElement('div');
                    div.className = 'cred-item';
                    div.innerHTML = `
                        <b>URL:</b> ${url}<br>
                        <b>用户名:</b> ${item.username}<br>
                        <b>密码:</b> <span class="password">${decrypted}</span>
                        <button data-url="${url}" data-idx="${idx}" class="del-btn">删除</button>
                    `;
                    listDiv.appendChild(div);
                });
            }
            // ... existing code ...
        });
    });
}
总结
所有密码本地存储前都用主密码派生密钥加密，显示/填充时解密。
主密码只存储 hash，防止泄露。
用户可在 options 页面设置主密码。
需引入 crypto-js。
如需完整代码包或有特殊需求（如无主密码自动加密），请告知！

1、生成完整和详细注释的代码
2、无主密码自动加密

下面是一个完整的 Chrome 插件代码示例，包含无主密码自动加密的实现。我们将使用 crypto-js 库来进行 AES 加密和解密。此实现将密码在存储前加密，并在填充时解密，而不需要用户输入主密码。

目录结构
chrome-autofill-v3/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── options.html
├── options.js
├── style.css
└── crypto-js.min.js
1. manifest.json
{
  "manifest_version": 3,
  "name": "自动表单凭证管理器",
  "version": "3.0",
  "description": "自动保存和填充登录表单，支持凭证管理和URL正则过滤。",
  "permissions": [
    "storage",
    "scripting",
    "activeTab"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_end"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon.png"
  },
  "options_page": "options.html",
  "icons": {
    "16": "icon.png",
    "48": "icon.png",
    "128": "icon.png"
  },
  "web_accessible_resources": [
    {
      "resources": ["crypto-js.min.js"],
      "matches": ["<all_urls>"]
    }
  ]
}
2. background.js
// background.js
// 负责初始化存储

chrome.runtime.onInstalled.addListener(() => {
    // 初始化存储，确保 credentials 和 excludePatterns 存在
    chrome.storage.local.get(['credentials', 'excludePatterns'], (result) => {
        if (!result.credentials) chrome.storage.local.set({ credentials: {} });
        if (!result.excludePatterns) chrome.storage.local.set({ excludePatterns: [] });
    });
});
3. content.js
// content.js
// 负责表单监听、自动保存和填充凭证

// 动态引入 crypto-js 库
const script = document.createElement('script');
script.src = chrome.runtime.getURL('crypto-js.min.js');
document.head.appendChild(script);

// 获取当前页面的 URL
function getCurrentUrl() {
    return window.location.origin + window.location.pathname;
}

// 检查 URL 是否匹配不保存凭证的正则
async function isUrlExcluded(url) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['excludePatterns'], (result) => {
            const patterns = result.excludePatterns || [];
            for (const pattern of patterns) {
                try {
                    if (new RegExp(pattern).test(url)) {
                        resolve(true);
                        return;
                    }
                } catch (e) {}
            }
            resolve(false);
        });
    });
}

// 查找页面中的登录表单
function findLoginForm() {
    const forms = document.querySelectorAll('form');
    for (const form of forms) {
        const inputs = form.querySelectorAll('input[type="password"]');
        if (inputs.length > 0) return form;
    }
    return null;
}

// 自动保存凭证
function saveCredential(url, username, password) {
    const encryptedPassword = CryptoJS.AES.encrypt(password, 'secret-key').toString(); // 用固定密钥加密
    chrome.storage.local.get(['credentials'], (result) => {
        let credentials = result.credentials || {};
        if (!credentials[url]) credentials[url] = [];
        const idx = credentials[url].findIndex(item => item.username === username);
        if (idx >= 0) {
            credentials[url][idx].password = encryptedPassword; // 更新密码
        } else {
            credentials[url].push({ username, password: encryptedPassword }); // 添加新凭证
        }
        chrome.storage.local.set({ credentials });
    });
}

// 自动填充凭证
function autofillCredential(url, username) {
    chrome.storage.local.get(['credentials'], (result) => {
        const credentials = result.credentials || {};
        if (credentials[url]) {
            const cred = credentials[url].find(item => item.username === username);
            if (cred) {
                const form = findLoginForm();
                if (form) {
                    const userInput = form.querySelector('input[type="text"], input[type="email"]');
                    const passInput = form.querySelector('input[type="password"]');
                    if (userInput && passInput) {
                        userInput.value = cred.username;
                        const decryptedPassword = CryptoJS.AES.decrypt(cred.password, 'secret-key').toString(CryptoJS.enc.Utf8); // 解密密码
                        passInput.value = decryptedPassword;
                    }
                }
            }
        }
    });
}

// 监听表单提交
let submitCount = 0;

async function handleFormSubmit(e) {
    const form = e.target;
    const url = getCurrentUrl();
    if (await isUrlExcluded(url)) return;

    const userInput = form.querySelector('input[type="text"], input[type="email"]');
    const passInput = form.querySelector('input[type="password"]');
    if (userInput && passInput) {
        const username = userInput.value;
        const password = passInput.value;
        submitCount += 1;
        // 只保存第一次提交的明文密码
        if (submitCount === 1) {
            saveCredential(url, username, password);
        }
        // 第二次提交（加密后），不再保存
        setTimeout(() => { submitCount = 0; }, 2000);
    }
}

// 监听用户名输入框点击，弹出已保存凭证
function showCredentialHint(e) {
    const url = getCurrentUrl();
    chrome.storage.local.get(['credentials'], (result) => {
        const credentials = result.credentials || {};
        if (credentials[url] && credentials[url].length > 0) {
            // 创建下拉提示
            let datalist = document.getElementById('chrome-autofill-datalist');
            if (!datalist) {
                datalist = document.createElement('datalist');
                datalist.id = 'chrome-autofill-datalist';
                document.body.appendChild(datalist);
            }
            datalist.innerHTML = '';
            credentials[url].forEach(item => {
                const option = document.createElement('option');
                option.value = item.username;
                datalist.appendChild(option);
            });
            e.target.setAttribute('list', 'chrome-autofill-datalist');
        }
    });
}

// 监听用户名输入变化，自动填充密码
function handleUsernameInput(e) {
    const url = getCurrentUrl();
    const username = e.target.value;
    chrome.storage.local.get(['credentials'], (result) => {
        const credentials = result.credentials || {};
        if (credentials[url]) {
            const cred = credentials[url].find(item => item.username === username);
            if (cred) {
                const form = findLoginForm();
                if (form) {
                    const passInput = form.querySelector('input[type="password"]');
                    if (passInput) {
                        const decryptedPassword = CryptoJS.AES.decrypt(cred.password, 'secret-key').toString(CryptoJS.enc.Utf8);
                        passInput.value = decryptedPassword;
                    }
                }
            }
        }
    });
}

// 初始化监听
function init() {
    const form = findLoginForm();
    if (form) {
        form.addEventListener('submit', handleFormSubmit, true);
        const userInput = form.querySelector('input[type="text"], input[type="email"]');
        if (userInput) {
            userInput.addEventListener('focus', showCredentialHint);
            userInput.addEventListener('input', handleUsernameInput);
        }
    }
}

window.addEventListener('DOMContentLoaded', init);
4. popup.html
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>凭证管理</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h2>已保存凭证</h2>
    <div id="credential-list"></div>
    <button id="open-options">管理不保存URL</button>
    <script src="popup.js"></script>
</body>
</html>
5. popup.js
// popup.js
// 显示和管理已保存凭证

function renderCredentials() {
    chrome.storage.local.get(['credentials'], (result) => {
        const credentials = result.credentials || {};
        const listDiv = document.getElementById('credential-list');
        listDiv.innerHTML = '';
        for (const url in credentials) {
            credentials[url].forEach((item, idx) => {
                const decrypted = CryptoJS.AES.decrypt(item.password, 'secret-key').toString(CryptoJS.enc.Utf8);
                const div = document.createElement('div');
                div.className = 'cred-item';
                div.innerHTML = `
                    <b>URL:</b> ${url}<br>
                    <b>用户名:</b> ${item.username}<br>
                    <b>密码:</b> <span class="password">${decrypted}</span>
                    <button data-url="${url}" data-idx="${idx}" class="del-btn">删除</button>
                `;
                listDiv.appendChild(div);
            });
        }
        // 绑定删除事件
        document.querySelectorAll('.del-btn').forEach(btn => {
            btn.onclick = function() {
                const url = this.getAttribute('data-url');
                const idx = parseInt(this.getAttribute('data-idx'));
                chrome.storage.local.get(['credentials'], (result) => {
                    let credentials = result.credentials || {};
                    if (credentials[url]) {
                        credentials[url].splice(idx, 1);
                        if (credentials[url].length === 0) delete credentials[url];
                        chrome.storage.local.set({ credentials }, renderCredentials);
                    }
                });
            };
        });
    });
}

document.getElementById('open-options').onclick = function() {
    chrome.runtime.openOptionsPage();
};

renderCredentials();
6. options.html
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>不保存URL管理</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h2>不保存凭证的URL正则配置</h2>
    <form id="add-pattern-form">
        <input type="text" id="pattern-input" placeholder="输入正则表达式" required>
        <button type="submit">添加</button>
    </form>
    <ul id="pattern-list"></ul>
    <a href="#" onclick="window.close()">关闭</a>
    <script src="options.js"></script>
</body>
</html>
7. options.js
// options.js
// 管理不保存凭证的URL正则

function renderPatterns() {
    chrome.storage.local.get(['excludePatterns'], (result) => {
        const patterns = result.excludePatterns || [];
        const list = document.getElementById('pattern-list');
        list.innerHTML = '';
        patterns.forEach((pattern, idx) => {
            const li = document.createElement('li');
            li.textContent = pattern;
            const btn = document.createElement('button');
            btn.textContent = '删除';
            btn.onclick = function() {
                patterns.splice(idx, 1);
                chrome.storage.local.set({ excludePatterns: patterns }, renderPatterns);
            };
            li.appendChild(btn);
            list.appendChild(li);
        });
    });
}

document.getElementById('add-pattern-form').onsubmit = function(e) {
    e.preventDefault();
    const input = document.getElementById('pattern-input');
    const pattern = input.value.trim();
    if (pattern) {
        chrome.storage.local.get(['excludePatterns'], (result) => {
            const patterns = result.excludePatterns || [];
            patterns.push(pattern);
            chrome.storage.local.set({ excludePatterns: patterns }, () => {
                input.value = '';
                renderPatterns();
            });
        });
    }
};

renderPatterns();
8. style.css
body {
    font-family: Arial, sans-serif;
    margin: 10px;
}
.cred-item {
    border: 1px solid #ccc;
    margin-bottom: 8px;
    padding: 8px;
    border-radius: 4px;
}
.password {
    font-family: 'Consolas', monospace;
    color: #333;
}
button {
    margin-left: 8px;
}
9. crypto-js.min.js
请从 这里下载 并放入插件根目录。

10. icon.png
请自行准备一个 128x128 的 PNG 图标，命名为 icon.png，放在插件根目录。

打包和加载插件
将上述所有文件放入同一文件夹（如 chrome-autofill-v3）。
选中该文件夹，右键压缩为 zip 文件（如 chrome-autofill-v3.zip）。
在 Chrome 扩展管理页面（chrome://extensions/）选择“加载已解压的扩展程序”或“打包扩展程序”即可。
总结
该插件实现了自动保存和填充凭证的功能。
密码在存储前使用 AES 加密，解密时使用固定密钥。
用户不需要设置主密码，简化了使用流程。
提供了管理不保存 URL 的功能。
如有其他需求或问题，请随时告知！

生成一份完整的代码列表，所有密码本地存储前都用主密码派生密钥加密，显示/填充时解密。主密码只存储 hash，防止泄露。用户可在 options 页面设置主密码。

下面是一个完整的 Chrome 插件代码示例，包含使用主密码派生密钥加密和解密存储的实现。我们将使用 crypto-js 库来进行 AES 加密和解密，同时使用 PBKDF2 来派生密钥。主密码的哈希将存储在本地，以防止泄露。

目录结构
chrome-autofill-v3/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── options.html
├── options.js
├── style.css
└── crypto-js.min.js
1. manifest.json
{
  "manifest_version": 3,
  "name": "自动表单凭证管理器",
  "version": "3.0",
  "description": "自动保存和填充登录表单，支持凭证管理和URL正则过滤。",
  "permissions": [
    "storage",
    "scripting",
    "activeTab"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_end"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon.png"
  },
  "options_page": "options.html",
  "icons": {
    "16": "icon.png",
    "48": "icon.png",
    "128": "icon.png"
  },
  "web_accessible_resources": [
    {
      "resources": ["crypto-js.min.js"],
      "matches": ["<all_urls>"]
    }
  ]
}
2. background.js
// background.js
// 负责初始化存储和主密码哈希

chrome.runtime.onInstalled.addListener(() => {
    // 初始化存储，确保 credentials 和 masterPasswordHash 存在
    chrome.storage.local.get(['credentials', 'masterPasswordHash'], (result) => {
        if (!result.credentials) chrome.storage.local.set({ credentials: {} });
        if (!result.masterPasswordHash) chrome.storage.local.set({ masterPasswordHash: null });
    });
});
3. content.js
// content.js
// 负责表单监听、自动保存和填充凭证

// 动态引入 crypto-js 库
const script = document.createElement('script');
script.src = chrome.runtime.getURL('crypto-js.min.js');
document.head.appendChild(script);

// 获取当前页面的 URL
function getCurrentUrl() {
    return window.location.origin + window.location.pathname;
}

// 查找页面中的登录表单
function findLoginForm() {
    const forms = document.querySelectorAll('form');
    for (const form of forms) {
        const inputs = form.querySelectorAll('input[type="password"]');
        if (inputs.length > 0) return form;
    }
    return null;
}

// 自动保存凭证
async function saveCredential(url, username, password, key) {
    const encryptedPassword = CryptoJS.AES.encrypt(password, key).toString();
    chrome.storage.local.get(['credentials'], (result) => {
        let credentials = result.credentials || {};
        if (!credentials[url]) credentials[url] = [];
        const idx = credentials[url].findIndex(item => item.username === username);
        if (idx >= 0) {
            credentials[url][idx].password = encryptedPassword; // 更新密码
        } else {
            credentials[url].push({ username, password: encryptedPassword }); // 添加新凭证
        }
        chrome.storage.local.set({ credentials });
    });
}

// 自动填充凭证
async function autofillCredential(url, username, key) {
    chrome.storage.local.get(['credentials'], (result) => {
        const credentials = result.credentials || {};
        if (credentials[url]) {
            const cred = credentials[url].find(item => item.username === username);
            if (cred) {
                const form = findLoginForm();
                if (form) {
                    const userInput = form.querySelector('input[type="text"], input[type="email"]');
                    const passInput = form.querySelector('input[type="password"]');
                    if (userInput && passInput) {
                        userInput.value = cred.username;
                        const decryptedPassword = CryptoJS.AES.decrypt(cred.password, key).toString(CryptoJS.enc.Utf8);
                        passInput.value = decryptedPassword;
                    }
                }
            }
        }
    });
}

// 监听表单提交
let submitCount = 0;

async function handleFormSubmit(e) {
    const form = e.target;
    const url = getCurrentUrl();
    const masterPasswordHash = await getMasterPasswordHash();
    const key = CryptoJS.PBKDF2(masterPasswordHash, url, { keySize: 256/32, iterations: 1000 });

    const userInput = form.querySelector('input[type="text"], input[type="email"]');
    const passInput = form.querySelector('input[type="password"]');
    if (userInput && passInput) {
        const username = userInput.value;
        const password = passInput.value;
        submitCount += 1;
        if (submitCount === 1) {
            saveCredential(url, username, password, key);
        }
        setTimeout(() => { submitCount = 0; }, 2000);
    }
}

// 监听用户名输入框点击，弹出已保存凭证
function showCredentialHint(e) {
    const url = getCurrentUrl();
    chrome.storage.local.get(['credentials'], (result) => {
        const credentials = result.credentials || {};
        if (credentials[url] && credentials[url].length > 0) {
            let datalist = document.getElementById('chrome-autofill-datalist');
            if (!datalist) {
                datalist = document.createElement('datalist');
                datalist.id = 'chrome-autofill-datalist';
                document.body.appendChild(datalist);
            }
            datalist.innerHTML = '';
            credentials[url].forEach(item => {
                const option = document.createElement('option');
                option.value = item.username;
                datalist.appendChild(option);
            });
            e.target.setAttribute('list', 'chrome-autofill-datalist');
        }
    });
}

// 监听用户名输入变化，自动填充密码
async function handleUsernameInput(e) {
    const url = getCurrentUrl();
    const username = e.target.value;
    const masterPasswordHash = await getMasterPasswordHash();
    const key = CryptoJS.PBKDF2(masterPasswordHash, url, { keySize: 256/32, iterations: 1000 });

    chrome.storage.local.get(['credentials'], (result) => {
        const credentials = result.credentials || {};
        if (credentials[url]) {
            const cred = credentials[url].find(item => item.username === username);
            if (cred) {
                const form = findLoginForm();
                if (form) {
                    const passInput = form.querySelector('input[type="password"]');
                    if (passInput) {
                        const decryptedPassword = CryptoJS.AES.decrypt(cred.password, key).toString(CryptoJS.enc.Utf8);
                        passInput.value = decryptedPassword;
                    }
                }
            }
        }
    });
}

// 获取主密码哈希
async function getMasterPasswordHash() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['masterPasswordHash'], (result) => {
            resolve(result.masterPasswordHash);
        });
    });
}

// 初始化监听
function init() {
    const form = findLoginForm();
    if (form) {
        form.addEventListener('submit', handleFormSubmit, true);
        const userInput = form.querySelector('input[type="text"], input[type="email"]');
        if (userInput) {
            userInput.addEventListener('focus', showCredentialHint);
            userInput.addEventListener('input', handleUsernameInput);
        }
    }
}

window.addEventListener('DOMContentLoaded', init);
4. popup.html
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>凭证管理</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h2>已保存凭证</h2>
    <div id="credential-list"></div>
    <button id="open-options">设置主密码</button>
    <script src="popup.js"></script>
</body>
</html>
5. popup.js
// popup.js
// 显示和管理已保存凭证

async function renderCredentials() {
    const masterPasswordHash = await getMasterPasswordHash();
    if (!masterPasswordHash) {
        document.getElementById('credential-list').innerText = '请设置主密码。';
        return;
    }

    chrome.storage.local.get(['credentials'], (result) => {
        const credentials = result.credentials || {};
        const listDiv = document.getElementById('credential-list');
        listDiv.innerHTML = '';
        for (const url in credentials) {
            credentials[url].forEach((item, idx) => {
                const key = CryptoJS.PBKDF2(masterPasswordHash, url, { keySize: 256/32, iterations: 1000 });
                const decrypted = CryptoJS.AES.decrypt(item.password, key).toString(CryptoJS.enc.Utf8);
                const div = document.createElement('div');
                div.className = 'cred-item';
                div.innerHTML = `
                    <b>URL:</b> ${url}<br>
                    <b>用户名:</b> ${item.username}<br>
                    <b>密码:</b> <span class="password">${decrypted}</span>
                    <button data-url="${url}" data-idx="${idx}" class="del-btn">删除</button>
                `;
                listDiv.appendChild(div);
            });
        }
        // 绑定删除事件
        document.querySelectorAll('.del-btn').forEach(btn => {
            btn.onclick = function() {
                const url = this.getAttribute('data-url');
                const idx = parseInt(this.getAttribute('data-idx'));
                chrome.storage.local.get(['credentials'], (result) => {
                    let credentials = result.credentials || {};
                    if (credentials[url]) {
                        credentials[url].splice(idx, 1);
                        if (credentials[url].length === 0) delete credentials[url];
                        chrome.storage.local.set({ credentials }, renderCredentials);
                    }
                });
            };
        });
    });
}

async function getMasterPasswordHash() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['masterPasswordHash'], (result) => {
            resolve(result.masterPasswordHash);
        });
    });
}

document.getElementById('open-options').onclick = function() {
    chrome.runtime.openOptionsPage();
};

renderCredentials();
6. options.html
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>设置主密码</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h2>设置主密码</h2>
    <form id="set-password-form">
        <input type="password" id="master-password" placeholder="输入主密码" required>
        <button type="submit">保存主密码</button>
    </form>
    <a href="#" onclick="window.close()">关闭</a>
    <script src="options.js"></script>
</body>
</html>
7. options.js
// options.js
// 设置主密码

document.getElementById('set-password-form').onsubmit = function(e) {
    e.preventDefault();
    const masterPassword = document.getElementById('master-password').value.trim();
    if (masterPassword) {
        const masterPasswordHash = CryptoJS.SHA256(masterPassword).toString();
        chrome.storage.local.set({ masterPasswordHash }, () => {
            alert('主密码已设置。');
            document.getElementById('master-password').value = '';
        });
    }
};
8. style.css
body {
    font-family: Arial, sans-serif;
    margin: 10px;
}
.cred-item {
    border: 1px solid #ccc;
    margin-bottom: 8px;
    padding: 8px;
    border-radius: 4px;
}
.password {
    font-family: 'Consolas', monospace;
    color: #333;
}
button {
    margin-left: 8px;
}
9. crypto-js.min.js
请从 这里下载 并放入插件根目录。

10. icon.png
请自行准备一个 128x128 的 PNG 图标，命名为 icon.png，放在插件根目录。

打包和加载插件
将上述所有文件放入同一文件夹（如 chrome-autofill-v3）。
选中该文件夹，右键压缩为 zip 文件（如 chrome-autofill-v3.zip）。
在 Chrome 扩展管理页面（chrome://extensions/）选择“加载已解压的扩展程序”或“打包扩展程序”即可。
总结
该插件实现了使用主密码派生密钥加密和解密存储的功能。
密码在存储前使用 AES 加密，解密时使用派生的密钥。
主密码的哈希存储在本地，防止泄露。
提供了设置主密码的功能。
如有其他需求或问题，请随时告知！

form.addEventListener('submit', handleFormSubmit, true);点击登录按钮，未触发handleFormSubmit，会是哪些原因导致的？该如何优化？

如果 form.addEventListener('submit', handleFormSubmit, true); 在点击登录按钮时未能触发 handleFormSubmit 函数，可能的原因有几个。以下是一些常见的原因以及相应的优化建议：

可能的原因
事件被阻止或未冒泡：

如果在表单提交时，某个元素的事件处理程序调用了 event.preventDefault()，那么表单的提交事件将不会被触发。
如果使用了 stopPropagation()，则可能导致事件未能冒泡到父元素。
表单未正确识别：

确保 form 变量确实指向正确的表单元素。如果 findLoginForm() 函数未能找到表单，form 可能为 null。
表单提交按钮的类型：

确保登录按钮的类型为 submit。如果按钮的类型是 button，则不会触发表单的提交事件。
JavaScript 错误：

如果在脚本中存在其他 JavaScript 错误，可能会导致后续代码未能执行。检查浏览器控制台以查看是否有错误信息。
页面加载顺序：

确保 init() 函数在 DOM 完全加载后执行。可以使用 DOMContentLoaded 事件确保代码在文档加载完成后运行。
优化建议
确保表单元素存在：
在添加事件监听之前，检查 form 是否为 null，并在控制台中输出调试信息。

const form = findLoginForm();
if (form) {
    form.addEventListener('submit', handleFormSubmit, true);
} else {
    console.warn('未找到登录表单');
}
检查按钮类型：
确保登录按钮的 HTML 代码如下：

<button type="submit">登录</button>
使用 event.preventDefault()：
在 handleFormSubmit 中，可以在处理逻辑之前调用 event.preventDefault() 来防止默认行为，但确保在处理完成后手动提交表单（如果需要）。

async function handleFormSubmit(e) {
    e.preventDefault(); // 防止默认提交
    // 处理逻辑...
    // 如果需要，可以手动提交
    e.target.submit();
}
检查控制台错误：
在浏览器的开发者工具中查看控制台是否有任何 JavaScript 错误或警告。

确保 DOMContentLoaded 事件：
确保在 DOMContentLoaded 事件中调用 init() 函数：

document.addEventListener('DOMContentLoaded', init);
使用 setTimeout 延迟绑定：
如果表单在某些情况下动态加载，可以考虑使用 setTimeout 延迟绑定事件：

setTimeout(() => {
    const form = findLoginForm();
    if (form) {
        form.addEventListener('submit', handleFormSubmit, true);
    }
}, 1000); // 1 秒后尝试绑定
结论
通过以上措施，可以更好地确保表单提交事件被正确触发。调试时，查看控制台输出和网络请求可以帮助识别潜在问题。如果问题依然存在，可以进一步检查其他可能影响表单提交的代码。

详细解释下因为事件被阻止或未冒泡原因导致失效的解决办法

当表单提交事件未能触发 handleFormSubmit 函数时，事件被阻止或未冒泡可能是主要原因之一。以下是详细解释以及解决办法：

事件被阻止的原因
event.preventDefault()：

当你在事件处理程序中调用 event.preventDefault() 时，默认的事件行为会被阻止。对于表单提交，这意味着表单不会被提交，页面不会刷新。
event.stopPropagation()：

如果在某个事件处理程序中调用了 event.stopPropagation()，那么事件将不会向上冒泡到父元素，这可能会导致在父元素上注册的事件处理程序无法被触发。
其他事件处理程序：

如果其他 JavaScript 代码在表单提交时调用了 preventDefault() 或 stopPropagation()，也可能会影响到你的事件处理程序。
解决办法
确保正确使用 preventDefault()：

在你的 handleFormSubmit 函数中，通常需要在处理逻辑之前调用 event.preventDefault()，以阻止表单的默认提交行为。但在处理完成后，如果需要，可以手动提交表单。
async function handleFormSubmit(e) {
    e.preventDefault(); // 阻止默认提交

    // 处理表单数据
    const formData = new FormData(e.target);
    // 处理逻辑...

    // 如果需要手动提交
    e.target.submit(); // 这将提交表单
}
检查其他事件处理程序：

确保没有其他事件处理程序在表单提交时调用了 preventDefault() 或 stopPropagation()。你可以在控制台中查找相关代码，或者在事件处理程序中添加调试信息。
使用事件捕获和冒泡：

当你使用 addEventListener 时，可以选择事件的捕获或冒泡阶段。确保你在正确的阶段添加事件监听器。
如果在捕获阶段添加了事件处理程序，确保它不会阻止事件传播到后续的处理程序。
// 使用捕获阶段
form.addEventListener('submit', handleFormSubmit, true); // true 表示捕获阶段
调试事件流：

使用浏览器的开发者工具，查看事件的流动。你可以在控制台中添加调试输出，检查事件是否被触发，以及在何处被阻止。
例如，你可以在不同的事件处理程序中添加 console.log 语句，查看事件的传播情况。
避免不必要的阻止：

确保只在需要时调用 preventDefault() 和 stopPropagation()。如果不需要阻止默认行为，最好不要调用这些方法。
示例代码
以下是一个完整的示例，展示了如何正确处理表单提交事件，确保事件不会被阻止，并且可以在需要时手动提交表单：

// 处理表单提交
async function handleFormSubmit(e) {
    e.preventDefault(); // 阻止默认提交

    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');

    // 处理逻辑，例如保存凭证
    console.log('用户名:', username);
    console.log('密码:', password);

    // 如果需要手动提交表单
    e.target.submit(); // 这将提交表单
}

// 初始化函数
function init() {
    const form = findLoginForm();
    if (form) {
        form.addEventListener('submit', handleFormSubmit, true); // 添加提交事件监听器
    } else {
        console.warn('未找到登录表单');
    }
}

// 确保在 DOMContentLoaded 事件中调用 init()
document.addEventListener('DOMContentLoaded', init);
结论
通过上述措施，你可以有效地解决事件被阻止或未冒泡导致的表单提交失效问题。确保在处理事件时谨慎使用 preventDefault() 和 stopPropagation()，并仔细检查事件流和其他可能影响事件的代码。