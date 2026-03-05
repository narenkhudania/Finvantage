import { FinanceState } from "../types";
import { supabase } from "./supabase";

const baseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export const getFinancialAdvice = async (_state: FinanceState, userPrompt: string) => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const response = await fetch(`${baseUrl}/api/ai-advice`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt: userPrompt,
        requestId:
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      return (
        errorPayload?.error ||
        "Error: Could not reach the financial intelligence service."
      );
    }

    const data = (await response.json()) as { text?: string };
    return data.text || "I'm sorry, I couldn't generate advice at this time.";
  } catch (error) {
    console.error("AI advice request failed:", error);
    return "Error: Could not reach the financial intelligence service.";
  }
};
