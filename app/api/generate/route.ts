import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { buildOutreachPrompt } from "@/lib/prompts";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      accessKey,
      company,
      role,
      recruiter,
      background,
      reason,
      tone,
    } = body;

    if (!accessKey || !company || !role || !background) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Configuration OpenAI manquante." },
        { status: 500 }
      );
    }

    const supabase = createSupabaseAdmin();

    const { data: keyRow, error: keyError } = await supabase
      .from("access_keys")
      .select("*")
      .eq("key", accessKey)
      .eq("active", true)
      .single();

    if (keyError || !keyRow) {
      return NextResponse.json({ error: "Clé invalide." }, { status: 401 });
    }

    if (keyRow.credits_used >= keyRow.credits_limit) {
      return NextResponse.json(
        { error: "Tu n’as plus de crédits FirstReply." },
        { status: 402 }
      );
    }

    const prompt = buildOutreachPrompt({
      company,
      role,
      recruiter,
      background,
      reason,
      tone,
    });

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        {
          role: "system",
          content:
            "Tu es un expert en cold outreach pour étudiants. Tu écris court, humain, concret, sans promesses mensongères.",
        },
        { role: "user", content: prompt },
      ],
    });

    const output = completion.choices[0]?.message?.content ?? "";

    const { error: updateError } = await supabase
      .from("access_keys")
      .update({ credits_used: keyRow.credits_used + 1 })
      .eq("key", accessKey);

    if (updateError) {
      return NextResponse.json(
        { error: "Message généré, mais crédit non mis à jour." },
        { status: 500 }
      );
    }

    await supabase.from("generations").insert({
      access_key: accessKey,
      company,
      role,
      output,
    });

    return NextResponse.json({
      output,
      creditsRemaining: keyRow.credits_limit - keyRow.credits_used - 1,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur génération." }, { status: 500 });
  }
}
