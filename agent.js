class LlmAgent {
  constructor() {
    this.messages = [];
    this.chatWin = document.getElementById("chat-window");
  }

  appendMessage(role, text) {
    const div = document.createElement("div");
    div.className = `chat-message ${role}`;
    div.innerText = text;
    this.chatWin.appendChild(div);
    this.chatWin.scrollTop = this.chatWin.scrollHeight;
  }

  userSend() {
    const input = document.getElementById("user-input");
    const text = input.value.trim();
    if (!text) return;
    this.appendMessage("user", text);
    this.messages.push({ role: "user", content: text });
    input.value = "";
    this.agentLoop();
  }

  async agentLoop() {
    const provider = document.getElementById("provider").value;
    const model = document.getElementById("model").value;
    const apiKey = document.getElementById("api-key").value;

    const resp = await fetch("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, model, api_key: apiKey, messages: this.messages })
    });
    const data = await resp.json();

    if (data.output) {
      this.appendMessage("agent", data.output);
      this.messages.push({ role: "assistant", content: data.output });
    }
    if (data.tool_calls) {
      for (let tc of data.tool_calls) {
        const result = await this.executeTool(tc);
        this.messages.push({ role: "tool", content: JSON.stringify(result) });
      }
      this.agentLoop(); // loop again
    }
  }

  async executeTool(tc) {
    if (tc.name === "web_search") return this.executeWebSearch(tc.arguments);
    if (tc.name === "execute_code") return this.executeCode(tc.arguments);
    return { error: "Unknown tool" };
  }

  async executeWebSearch(args = {}) {
    const q = args.query || "";
    const key = document.getElementById("api-key").value;
    const cx = document.getElementById("google_cx").value;
    if (!q || !key || !cx) return { error: "Missing query or API key/cx" };
    try {
      const url = `/search?q=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}`;
      const resp = await fetch(url);
      return await resp.json();
    } catch (e) {
      return { error: e.message };
    }
  }

  async executeCode(args = {}) {
    const code = args.code || "";
    if (!code) return { error: "No code provided" };
    return await new Promise(resolve => {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.sandbox = "allow-scripts";
      document.body.appendChild(iframe);
      const wrapped = `
        (async function(){
          try {
            let result = await (async()=>{${code}})();
            parent.postMessage({__sandbox:true, ok:true, output: String(result)}, "*");
          } catch(err){
            parent.postMessage({__sandbox:true, ok:false, error:String(err)}, "*");
          }
        })();
      `;
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write("<script>" + wrapped + "<\/script>");
      doc.close();
      window.addEventListener("message", function handler(ev){
        if (!ev.data.__sandbox) return;
        window.removeEventListener("message", handler);
        iframe.remove();
        resolve(ev.data);
      });
      setTimeout(() => resolve({ error: "timeout" }), 5000);
    });
  }
}
