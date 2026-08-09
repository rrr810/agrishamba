// SokoShamba Shamba AI Edge Function
// The Gemini API key stays in Supabase Edge Function secrets.

declare const Deno: {
    env: {
      get(name: string): string | undefined;
    };
    serve(
      handler: (request: Request) => Response | Promise<Response>
    ): void;
  };
  
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  
  const SYSTEM_PROMPT = `You are Shamba AI, the farming assistant inside SokoShamba, a Kenyan agricultural marketplace.
  
  Rules:
  - Give short, practical and specific advice for Kenyan smallholder and commercial farmers.
  - Use Kenyan context: counties, KES, maize, sukuma wiki, ndengu, potatoes, vegetables, dairy, poultry, SACCOs and M-Pesa.
  - For prices, explain that prices change by market and day, and point users to the SokoShamba market prices page.
  - For sick animals or diseased crops, recommend a qualified local veterinarian or extension officer.
  - Do not invent exact statistics. Clearly say when an answer is an estimate.
  - Prefer clear English. You may use a brief Swahili greeting when appropriate.
  - Keep answers to 3-6 sentences unless the user asks for a detailed plan.
  - Mention relevant SokoShamba tools when useful: farm calculator, loan calculator, expense tracker, planting calendar, marketplace and advisory centre.`;
  
  const PREFERRED_MODELS = [
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-3-flash-preview"
  ];
  
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: cors });
    }
  
    try {
      const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  
      if (!apiKey) {
        return json(
          { error: "AI assistant is being configured. Try again soon." },
          503
        );
      }
  
      const body = await req.json();
      const message = String(body?.message || "").trim();
      const history = Array.isArray(body?.history) ? body.history : [];
  
      if (!message) {
        return json({ error: "Ask me something about farming." }, 400);
      }
  
      const models = await findModels(apiKey);
  
      if (!models.length) {
        return json(
          {
            error:
              "No Gemini model with generateContent access is available for this API key."
          },
          502
        );
      }
  
      const contents = [
        ...history.slice(-10).map((item) => ({
          role:
            item?.role === "ai" || item?.role === "model"
              ? "model"
              : "user",
          parts: [
            {
              text: String(item?.text || "").slice(0, 2000)
            }
          ]
        })),
        {
          role: "user",
          parts: [
            {
              text: message.slice(0, 2000)
            }
          ]
        }
      ];
  
      let lastError = "Gemini could not generate a response.";
  
      // Try available models until one works.
      for (const model of models) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
            model
          )}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              system_instruction: {
                parts: [
                  {
                    text: SYSTEM_PROMPT
                  }
                ]
              },
              contents,
              generationConfig: {
                temperature: 0.6,
                maxOutputTokens: 600
              }
            })
          }
        );
  
        const data = await response.json();
  
        const reply = data?.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) => part.text || "")
          .join("")
          .trim();
  
        if (response.ok && reply) {
          return json({
            reply,
            model
          });
        }
  
        lastError =
          data?.error?.message ||
          `Gemini request failed with HTTP ${response.status}.`;
  
        console.warn(`[gemini-chat] ${model} unavailable:`, lastError);
  
        if (
          /API key not valid|API_KEY_INVALID|permission denied|PERMISSION_DENIED/i.test(
            lastError
          )
        ) {
          break;
        }
      }
  
      console.error("[gemini-chat] all models failed:", lastError);
      return json({ error: lastError }, 502);
    } catch (error) {
      console.error("[gemini-chat] unexpected error:", error);
  
      return json(
        {
          error: "Something went wrong. Please try again."
        },
        500
      );
    }
  });
  
  async function findModels(apiKey: string): Promise<string[]> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
        apiKey
      )}`
    );
  
    const data = await response.json();
  
    if (!response.ok) {
      console.error(
        "[gemini-chat] model list error:",
        data?.error?.message || response.status
      );
      return [];
    }
  
    const available = (data?.models || [])
      .filter((item: { supportedGenerationMethods?: string[] }) =>
        item.supportedGenerationMethods?.includes("generateContent")
      )
      .map((item: { name: string }) =>
        item.name.replace(/^models\//, "")
      );
  
    const preferred = PREFERRED_MODELS.filter((name) =>
      available.includes(name)
    );
  
    const remaining = available.filter(
      (name) => !preferred.includes(name)
    );
  
    return [...preferred, ...remaining];
  }
  
  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        ...cors,
        "Content-Type": "application/json"
      }
    });
  }
  