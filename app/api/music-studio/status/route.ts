import { NextResponse } from "next/server";
import {
  systemStats,
  availableCheckpoints,
  availableTextEncoders,
  availableLoras,
} from "@/lib/comfy";
import { irodoriHealth } from "@/lib/irodori";
import { ACE_CKPT, ACE15_CKPT, SAO_CKPT, SAO_T5 } from "@/lib/workflows";

export const dynamic = "force-dynamic";

// 動画用など、音楽と無関係なLoRAは選択肢から除外する
const LORA_EXCLUDE = /minimax|h3|wan|flux|sdxl|hunyuan|qwen/i;

// GET /api/music-studio/status … ComfyUI稼働状況とモデル導入状況
export async function GET() {
  const stats = await systemStats();
  const ckpts = await availableCheckpoints();
  const encoders = await availableTextEncoders();
  const loras = (await availableLoras()).filter((n) => !LORA_EXCLUDE.test(n));
  const irodori = await irodoriHealth();
  return NextResponse.json({
    comfy: stats,
    models: {
      ace: ckpts.includes(ACE_CKPT),
      ace15: ckpts.includes(ACE15_CKPT),
      // Stable Audio は checkpoint と T5 の両方が必要
      sao: ckpts.includes(SAO_CKPT) && encoders.includes(SAO_T5),
    },
    loras,
    irodori,
  });
}
