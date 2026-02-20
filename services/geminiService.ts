import { FinanceState } from "../types";

const baseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export const getFinancialAdvice = async (state: FinanceState, userPrompt: string) => {
  try {
    const response = await fetch(`${baseUrl}/api/ai-advice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, prompt: userPrompt }),
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
