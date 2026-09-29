const RPCS = {
  mainnet: "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
};
const els = Object.fromEntries(
  [...document.querySelectorAll("[id]")].map((el) => [el.id, el])
);
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;
const DBC_PROGRAM = "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";
const lamports = (n) => ((Number(n) || 0) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 9 }) + " SOL";
const short = (s, n = 8) => !s ? "—" : s.length <= n * 2 + 3 ? s : s.slice(0, n) + "…" + s.slice(-n);
const fmt = (n) => Number.isFinite(Number(n)) ? Number(n).toLocaleString() : "—";
const isoTime = (seconds) => seconds ? new Date(seconds * 1000).toLocaleString() : "—";

function endpoint() {
  const mode = els.networkSelect.value;
  if (mode === "custom") return els.customRpc.value.trim();
  return RPCS[mode];
}
function escapeHtml(value) {
  const map = { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" };
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => map[c]);
}
function setRpcStatus(text, type = "") {
  els.rpcStatus.className = "status-pill " + type;
  els.rpcStatus.innerHTML = '<span class="dot"></span>' + escapeHtml(text);
}
function showMessage(el, text, type = "info") {
  el.textContent = text;
  el.className = "message " + type;
}
function hideMessage(el) { el.className = "message hidden"; }

async function rpc(method, params, url = endpoint()) {
  if (!url) throw new Error("Choose or enter an RPC endpoint.");
  setRpcStatus("RPC connecting", "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("RPC HTTP " + res.status);
    const body = await res.json();
    if (body.error) throw new Error(body.error.message || "RPC returned an error.");
    setRpcStatus("RPC live", "live");
    return body.result;
  } catch (err) {
    setRpcStatus("RPC error", "error");
    if (err.name === "AbortError") throw new Error("RPC request timed out.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
function validSignature(s) { return BASE58.test(s) && s.length >= 80 && s.length <= 100; }
function validAddress(s) { return BASE58.test(s) && s.length >= 32 && s.length <= 50; }
function accountKeyList(tx) {
  const raw = tx && tx.transaction && tx.transaction.message && tx.transaction.message.accountKeys || [];
  return raw.map((k) => typeof k === "string" ? k : (k.pubkey || String(k)));
}
function programIdOf(ix, keys) {
  if (ix && ix.programId) return typeof ix.programId === "string" ? ix.programId : String(ix.programId);
  if (ix && Number.isInteger(ix.programIdIndex)) return keys[ix.programIdIndex] || "index:" + ix.programIdIndex;
  return ix && ix.program ? ix.program : "Unknown program";
}

function metric(label, value, sub = "", tone = "") {
  return '<div class="metric">' +
    '<span class="metric-label">' + escapeHtml(label) + '</span>' +
    '<span class="metric-value ' + tone + '">' + escapeHtml(value) + '</span>' +
    '<span class="metric-sub">' + escapeHtml(sub) + '</span></div>';
}
function listRow(title, sub = "", side = "") {
  return '<div class="list-row"><div class="list-main">' +
    '<div class="list-title">' + escapeHtml(title) + '</div>' +
    (sub ? '<div class="list-sub">' + escapeHtml(sub) + '</div>' : '') +
    '</div>' + (side ? '<div class="list-side">' + escapeHtml(side) + '</div>' : '') + '</div>';
}
function parseTimeline(logs = []) {
  const rows = [];
  let depth = 0;
  for (const line of logs) {
    const invoke = line.match(/^Program (\S+) invoke \[(\d+)\]/);
    const ok = line.match(/^Program (\S+) success/);
    const fail = line.match(/^Program (\S+) failed: (.*)$/);
    if (invoke) {
      depth = Number(invoke[2]) || depth + 1;
      rows.push({ depth, program: invoke[1], event: "invoke", cls: "" });
    } else if (fail) {
      rows.push({ depth, program: fail[1], event: "failed · " + fail[2], cls: "fail" });
      depth = Math.max(0, depth - 1);
    } else if (ok) {
      rows.push({ depth, program: ok[1], event: "success", cls: "success" });
      depth = Math.max(0, depth - 1);
    }
  }
  return rows;
}

function renderTransaction(tx, example = false) {
  const meta = tx && tx.meta || {};
  const keys = accountKeyList(tx);
  const msg = tx && tx.transaction && tx.transaction.message || {};
  const instructions = msg.instructions || [];
  const logs = meta.logMessages || [];
  const ok = meta.err == null;
  const compute = meta.computeUnitsConsumed;
  const fee = meta.fee;
  const version = tx && tx.version != null ? tx.version : "legacy";
  els.txSummary.innerHTML = [
    metric("Status", example ? "Example" : (ok ? "Success" : "Failed"),
      example ? "illustrative dataset" : (ok ? "execution completed" : JSON.stringify(meta.err)),
      example ? "" : (ok ? "good" : "bad")),
    metric("Slot", fmt(tx && tx.slot), "version " + version),
    metric("Fee", Number.isFinite(Number(fee)) ? lamports(fee) : "—",
      Number.isFinite(Number(fee)) ? fmt(fee) + " lamports" : "not returned"),
    metric("Compute", compute != null ? fmt(compute) : "—",
      compute != null ? "units consumed" : "not returned"),
    metric("Block time", isoTime(tx && tx.blockTime),
      tx && tx.blockTime ? "local time" : "not returned")
  ].join("");
  const timeline = parseTimeline(logs);
  els.timelineCount.textContent = timeline.length + " events";
  els.timeline.innerHTML = timeline.length ? timeline.map((r) =>
    '<div class="timeline-row ' + r.cls + '">' +
    '<span class="depth">' + escapeHtml(r.depth) + '</span>' +
    '<span class="program" title="' + escapeHtml(r.program) + '">' + escapeHtml(short(r.program, 10)) + '</span>' +
    '<span class="event">' + escapeHtml(r.event) + '</span></div>'
  ).join("") : listRow("No invoke/success/failure log pairs returned.");

  els.instructionCount.textContent = instructions.length + " top-level";
  els.instructions.innerHTML = instructions.length ? instructions.map((ix, i) => {
    const pid = programIdOf(ix, keys);
    const parsed = ix && ix.parsed && ix.parsed.type || ix && ix.program || "raw instruction";
    const accountCount = Array.isArray(ix && ix.accounts) ? ix.accounts.length + " accts" : "";
    return listRow("#" + i + " · " + parsed, pid, accountCount);
  }).join("") : listRow("No top-level instructions returned.");
  els.logs.textContent = logs.length ? logs.join("\n") : "No program logs returned by this RPC response.";
  els.accountKeyCount.textContent = keys.length + " keys";
  els.accountKeys.innerHTML = keys.length ? keys.map((k, i) =>
    listRow(i + ". " + k, i === 0 ? "fee payer / first key" : "")
  ).join("") : listRow("No account keys returned.");

  const pre = meta.preBalances || [];
  const post = meta.postBalances || [];
  const deltas = keys.map((key, i) => ({
    key,
    delta: (Number(post[i]) || 0) - (Number(pre[i]) || 0),
  })).filter((x) => x.delta !== 0);
  els.balanceDeltas.innerHTML = deltas.length ? deltas.map((x) =>
    listRow(
      short(x.key, 10),
      (x.delta > 0 ? "+" : "") + fmt(x.delta) + " lamports",
      (x.delta > 0 ? "+" : "") + (x.delta / 1e9).toFixed(9) + " SOL"
    )
  ).join("") : listRow("No native SOL balance deltas to display.");
  els.txResult.classList.remove("hidden");
}
async function inspectSignature(signature) {
  const sig = signature.trim();
  if (!validSignature(sig)) throw new Error("That does not look like a valid Solana transaction signature.");
  const tx = await rpc("getTransaction", [sig, {
    encoding: "jsonParsed",
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed"
  }]);
  if (!tx) throw new Error("Transaction not found at this RPC/network.");
  remember(sig);
  return tx;
}

function remember(signature) {
  const key = "tracelens.recent";
  const current = JSON.parse(localStorage.getItem(key) || "[]");
  const next = [signature].concat(current.filter((s) => s !== signature)).slice(0, 12);
  localStorage.setItem(key, JSON.stringify(next));
}
async function runInspect() {
  hideMessage(els.txMessage);
  els.txResult.classList.add("hidden");
  els.inspectBtn.disabled = true;
  els.inspectBtn.textContent = "Inspecting…";
  try {
    const tx = await inspectSignature(els.txSignature.value);
    renderTransaction(tx);
    showMessage(els.txMessage, "Live transaction loaded from the selected Solana RPC.", "success");
  } catch (err) {
    showMessage(els.txMessage, err.message || "Unable to inspect transaction.", "error");
  } finally {
    els.inspectBtn.disabled = false;
    els.inspectBtn.textContent = "Inspect";
  }
}
async function runAccount() {
  hideMessage(els.accountMessage);
  els.accountResult.classList.add("hidden");
  const address = els.accountAddress.value.trim();
  if (!validAddress(address)) {
    showMessage(els.accountMessage, "That does not look like a valid Solana public account address.", "error");
    return;
  }
  els.accountBtn.disabled = true;
  els.accountBtn.textContent = "Inspecting…";

  try {
    const info = await rpc("getAccountInfo", [address, { encoding: "jsonParsed", commitment: "confirmed" }]);
    if (!info || !info.value) throw new Error("Account was not found on the selected network.");
    const v = info.value;
    let dataSize = "—";
    if (Array.isArray(v.data) && typeof v.data[0] === "string") {
      dataSize = Math.floor(v.data[0].length * 0.75) + " B approx.";
    } else if (v.data && v.data.space != null) {
      dataSize = fmt(v.data.space) + " B";
    }
    els.accountResult.innerHTML = [
      metric("Owner program", short(v.owner, 10), v.owner || ""),
      metric("Balance", lamports(v.lamports), fmt(v.lamports) + " lamports"),
      metric("Executable", v.executable ? "Yes" : "No", "account flag"),
      metric("Rent epoch", v.rentEpoch != null ? fmt(v.rentEpoch) : "—", "RPC metadata"),
      metric("Data size", dataSize, "encoded/parsed data")
    ].join("");
    els.accountResult.classList.remove("hidden");
    showMessage(els.accountMessage, "Live account metadata loaded.", "success");
  } catch (err) {
    showMessage(els.accountMessage, err.message || "Unable to inspect account.", "error");
  } finally {
    els.accountBtn.disabled = false;
    els.accountBtn.textContent = "Inspect account";
  }
}

function txUsesProgram(tx, programId) {
  const keys = accountKeyList(tx);
  const logs = tx && tx.meta && tx.meta.logMessages || [];
  return keys.includes(programId) || logs.some((line) => line.includes(programId));
}
function dbcInstructionLabel(tx) {
  const logs = tx && tx.meta && tx.meta.logMessages || [];
  for (const line of logs) {
    const match = line.match(/^Program log: Instruction: ([A-Za-z0-9_ -]+)/);
    if (match) return match[1].trim();
  }
  return txUsesProgram(tx, DBC_PROGRAM) ? "DBC program call" : "Related account activity";
}
async function runDbc() {
  hideMessage(els.dbcMessage);
  els.dbcResult.classList.add("hidden");
  const address = els.dbcAddress.value.trim();
  if (!validAddress(address)) {
    showMessage(els.dbcMessage, "That does not look like a valid Solana public account address.", "error");
    return;
  }

  els.dbcBtn.disabled = true;
  els.dbcBtn.textContent = "Inspecting…";

  try {
    const account = await rpc("getAccountInfo", [address, { encoding: "base64", commitment: "confirmed" }]);
    if (!account || !account.value) throw new Error("Account was not found on the selected network.");

    const owner = typeof account.value.owner === "string" ? account.value.owner : String(account.value.owner || "");
    const programOwned = owner === DBC_PROGRAM;
    const signatures = await rpc("getSignaturesForAddress", [address, { limit: 6, commitment: "confirmed" }]);
    const rows = [];

    for (const entry of signatures || []) {
      try {
        const tx = await rpc("getTransaction", [entry.signature, {
          encoding: "jsonParsed",
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed"
        }]);
        if (!tx) continue;
        rows.push({
          signature: entry.signature,
          dbc: txUsesProgram(tx, DBC_PROGRAM),
          label: dbcInstructionLabel(tx),
          ok: tx.meta && tx.meta.err == null,
          blockTime: tx.blockTime
        });
      } catch {
        rows.push({
          signature: entry.signature,
          dbc: false,
          label: "RPC detail unavailable",
          ok: entry.err == null,
          blockTime: entry.blockTime
        });
      }
    }

    const dbcCalls = rows.filter((row) => row.dbc).length;
    const latest = rows.length ? isoTime(rows[0].blockTime) : "—";
    els.dbcSummary.innerHTML = [
      metric("Owner", programOwned ? "Meteora DBC" : "Other program", short(owner, 10), programOwned ? "good" : "bad"),
      metric("Program", short(DBC_PROGRAM, 10), "official DBC program"),
      metric("Recent txs", String(rows.length), "latest signatures sampled"),
      metric("DBC calls", String(dbcCalls), "program present in sampled txs"),
      metric("Latest activity", latest, "selected RPC")
    ].join("");

    els.dbcTxCount.textContent = rows.length + " sampled";
    els.dbcTransactions.innerHTML = rows.length ? rows.map((row) =>
      listRow(
        row.label,
        short(row.signature, 11) + " · " + isoTime(row.blockTime),
        (row.ok ? "success" : "failed") + (row.dbc ? " · DBC" : "")
      )
    ).join("") : listRow("No recent signatures returned for this account.");

    const signals = [];
    signals.push(listRow(
      programOwned ? "Program ownership verified" : "Account is not owned by the DBC program",
      programOwned
        ? "getAccountInfo owner matches Meteora's published Dynamic Bonding Curve program."
        : "This may be a related mint, vault, or unrelated account; verify the address before drawing DBC conclusions.",
      programOwned ? "verified" : "check"
    ));
    signals.push(listRow(
      dbcCalls ? "DBC execution observed" : "No DBC invocation in sampled transactions",
      dbcCalls
        ? dbcCalls + " of " + rows.length + " sampled transactions reference the DBC program."
        : "TraceLens only classifies what the selected RPC returned in the recent sample.",
      dbcCalls ? "live" : "sample"
    ));
    signals.push(listRow(
      "Read-only inspection",
      "No wallet connection, signing, pool creation, or transaction submission.",
      "safe"
    ));
    els.dbcSignals.innerHTML = signals.join("");

    els.dbcResult.classList.remove("hidden");
    showMessage(
      els.dbcMessage,
      programOwned
        ? "Live Meteora DBC account data loaded from Solana."
        : "Live account data loaded, but the owner does not match the Meteora DBC program.",
      programOwned ? "success" : "info"
    );
  } catch (err) {
    showMessage(els.dbcMessage, err.message || "Unable to inspect the DBC account.", "error");
  } finally {
    els.dbcBtn.disabled = false;
    els.dbcBtn.textContent = "Inspect DBC";
  }
}

async function runCompare() {
  hideMessage(els.compareMessage);
  els.compareResult.classList.add("hidden");
  const a = els.compareA.value.trim();
  const b = els.compareB.value.trim();
  if (!validSignature(a) || !validSignature(b)) {
    showMessage(els.compareMessage, "Enter two valid Solana transaction signatures.", "error");
    return;
  }
  els.compareBtn.disabled = true;
  els.compareBtn.textContent = "Comparing…";

  try {
    const pair = await Promise.all([inspectSignature(a), inspectSignature(b)]);
    const stats = (tx) => ({
      status: tx.meta && tx.meta.err == null ? "Success" : "Failed",
      fee: tx.meta && tx.meta.fee != null ? lamports(tx.meta.fee) : "—",
      compute: tx.meta && tx.meta.computeUnitsConsumed != null ? fmt(tx.meta.computeUnitsConsumed) : "—",
      instructions: tx.transaction && tx.transaction.message && tx.transaction.message.instructions ? tx.transaction.message.instructions.length : 0,
      logs: tx.meta && tx.meta.logMessages ? tx.meta.logMessages.length : 0,
      slot: fmt(tx.slot),
    });
    const A = stats(pair[0]), B = stats(pair[1]);
    const rows = [
      ["Status", A.status, B.status],
      ["Fee", A.fee, B.fee],
      ["Compute units", A.compute, B.compute],
      ["Instructions", A.instructions, B.instructions],
      ["Log lines", A.logs, B.logs],
      ["Slot", A.slot, B.slot]
    ];
    let html = '<table class="compare-table"><thead><tr><th>Metric</th><th>A · ' + escapeHtml(short(a, 6)) +
      '</th><th>B · ' + escapeHtml(short(b, 6)) + '</th></tr></thead><tbody>';
    html += rows.map((r) => '<tr><td>' + escapeHtml(r[0]) + '</td><td>' + escapeHtml(r[1]) +
      '</td><td>' + escapeHtml(r[2]) + '</td></tr>').join("");
    html += "</tbody></table>";
    els.compareResult.innerHTML = html;
    els.compareResult.classList.remove("hidden");
    showMessage(els.compareMessage, "Both transactions loaded from the selected RPC.", "success");
  } catch (err) {
    showMessage(els.compareMessage, err.message || "Unable to compare transactions.", "error");
  } finally {
    els.compareBtn.disabled = false;
    els.compareBtn.textContent = "Compare";
  }
}

const exampleTx = {
  slot: 307445101,
  blockTime: Math.floor(Date.now() / 1000) - 420,
  version: 0,
  transaction: {
    message: {
      accountKeys: [
        { pubkey: "ExampleFeePayer111111111111111111111111111111" },
        { pubkey: "11111111111111111111111111111111" },
        { pubkey: "ComputeBudget111111111111111111111111111111" }
      ],
      instructions: [
        { program: "system", programId: "11111111111111111111111111111111", parsed: { type: "transfer" }, accounts: [0,1] },
        { program: "compute-budget", programId: "ComputeBudget111111111111111111111111111111", parsed: { type: "setComputeUnitLimit" }, accounts: [] }
      ]
    }
  },
  meta: {
    err: null,
    fee: 5000,
    computeUnitsConsumed: 18342,
    preBalances: [2500000000, 1000000000, 1],
    postBalances: [2498995000, 1001000000, 1],
    logMessages: [
      "Program 11111111111111111111111111111111 invoke [1]",
      "Program log: Instruction: Transfer",
      "Program 11111111111111111111111111111111 success",
      "Program ComputeBudget111111111111111111111111111111 invoke [1]",
      "Program ComputeBudget111111111111111111111111111111 success"
    ]
  }
};
function loadExample() {
  renderTransaction(exampleTx, true);
  showMessage(els.txMessage, "Example mode: illustrative local data only — not a live on-chain transaction.", "info");
  location.hash = "#inspect";
}

els.networkSelect.addEventListener("change", () => {
  els.customRpcWrap.classList.toggle("hidden", els.networkSelect.value !== "custom");
  setRpcStatus("RPC idle", "");
});
els.inspectBtn.addEventListener("click", runInspect);
els.accountBtn.addEventListener("click", runAccount);
els.dbcBtn.addEventListener("click", runDbc);
els.compareBtn.addEventListener("click", runCompare);
els.loadExampleHero.addEventListener("click", loadExample);
els.copyLogsBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(els.logs.textContent || "");
    els.copyLogsBtn.textContent = "Copied";
    setTimeout(() => { els.copyLogsBtn.textContent = "Copy logs"; }, 1200);
  } catch {
    els.copyLogsBtn.textContent = "Copy failed";
  }
});
els.txSignature.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runInspect();
});
els.accountAddress.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runAccount();
});
els.dbcAddress.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runDbc();
});
setRpcStatus("RPC idle", "");

