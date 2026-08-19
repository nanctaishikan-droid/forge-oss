// ComfyUI (127.0.0.1:8188) とやりとりする薄いクライアント。
// hf-preview/h3-lab/submit.py の /prompt→/history パターンをTSに移植したもの。

export const COMFY_HOST = process.env.COMFY_HOST || "http://127.0.0.1:8188";

export interface ComfyOutputFile {
  filename: string;
  subfolder: string;
  type: string;
}

// ワークフロー(API形式)を投げて prompt_id を得る
export async function submitPrompt(workflow: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${COMFY_HOST}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ComfyUI /prompt 失敗 (${res.status}): ${text.slice(0, 800)}`);
  }
  const data = (await res.json()) as { prompt_id?: string; error?: unknown };
  if (!data.prompt_id) {
    throw new Error(`prompt_id が返りませんでした: ${JSON.stringify(data).slice(0, 800)}`);
  }
  return data.prompt_id;
}

export interface HistoryResult {
  found: boolean;
  status?: string; // "success" | "error" など
  error?: string;
  audio?: ComfyOutputFile[];
}

// /history/{id} を見て状態と生成ファイルを返す
export async function getHistory(promptId: string): Promise<HistoryResult> {
  const res = await fetch(`${COMFY_HOST}/history/${promptId}`, { cache: "no-store" });
  if (!res.ok) return { found: false };
  const data = (await res.json()) as Record<string, any>;
  const entry = data[promptId];
  if (!entry) return { found: false };

  const st = entry.status || {};
  const statusStr: string = st.status_str || "";
  let error: string | undefined;
  for (const m of st.messages || []) {
    if (m[0] === "execution_error" || m[0] === "execution_interrupted") {
      error = JSON.stringify(m[1]).slice(0, 1500);
    }
  }

  // audio 出力を集める
  const audio: ComfyOutputFile[] = [];
  const outputs = entry.outputs || {};
  for (const nodeId of Object.keys(outputs)) {
    const out = outputs[nodeId];
    for (const a of out.audio || []) {
      if (a.type === "output") audio.push(a);
    }
  }
  return { found: true, status: statusStr, error, audio };
}

export interface SystemStats {
  ok: boolean;
  gpu?: string;
  vramFreeGB?: number;
  vramTotalGB?: number;
  error?: string;
}

export async function systemStats(): Promise<SystemStats> {
  try {
    const res = await fetch(`${COMFY_HOST}/system_stats`, { cache: "no-store" });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const d = (await res.json()) as any;
    const dev = d.devices?.[0] || {};
    return {
      ok: true,
      gpu: dev.name,
      vramFreeGB: dev.vram_free ? dev.vram_free / 2 ** 30 : undefined,
      vramTotalGB: dev.vram_total ? dev.vram_total / 2 ** 30 : undefined,
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// 指定モデルの重みが ComfyUI に入っているか（checkpoints一覧）
export async function availableCheckpoints(): Promise<string[]> {
  try {
    const res = await fetch(`${COMFY_HOST}/object_info/CheckpointLoaderSimple`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const d = (await res.json()) as any;
    const list = d?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// LoRA 一覧（自分の音色モデル選択用）
export async function availableLoras(): Promise<string[]> {
  try {
    const res = await fetch(`${COMFY_HOST}/object_info/LoraLoaderModelOnly`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const d = (await res.json()) as any;
    const list = d?.LoraLoaderModelOnly?.input?.required?.lora_name?.[0];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// text_encoders 一覧（Stable Audio の T5 判定用）
export async function availableTextEncoders(): Promise<string[]> {
  try {
    const res = await fetch(`${COMFY_HOST}/object_info/CLIPLoader`, { cache: "no-store" });
    if (!res.ok) return [];
    const d = (await res.json()) as any;
    const list = d?.CLIPLoader?.input?.required?.clip_name?.[0];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
