import OpenAI from "openai";
import { db } from "../../../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

const openai = new OpenAI(process.env.OPENAI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Get user session
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user?.email) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const userId = session.user.email;

  // Fetch expenses from Firestore
  let expenses = [];
  try {
    const q = query(collection(db, "expenses"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    expenses = snapshot.docs.map(doc => doc.data());
  } catch (e) {
    // If Firestore fails, continue with empty expenses
    expenses = [];
  }

  // Fetch budgets from Firestore
  let budgets = [];
  try {
    const q = query(collection(db, "budgets"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    budgets = snapshot.docs.map(doc => doc.data());
  } catch (e) {
    budgets = [];
  }

  const { messages } = req.body;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are an expert, friendly, and proactive personal finance assistant. Your job is to help users understand, manage, and improve their finances using their budgets and expenses. Always use the user's data to provide personalized, actionable insights, summaries, and suggestions. If a question is vague, ask clarifying questions. If a question is unrelated to finance, respond: 'I specialize in finance. Please ask me about budgets, expenses, or savings.'\n\n" +
            "Instructions:\n" +
            "- Analyze the user's budgets and expenses to identify trends, anomalies, and opportunities for improvement.\n" +
            "- Summarize the user's financial health and offer practical advice or next steps.\n" +
            "- When possible, use bullet points, tables, or concise explanations for clarity.\n" +
            "- If calculations are needed, show your work step by step.\n" +
            "- Always be clear, supportive, and professional.\n\n" +
            `User's spending data: ${JSON.stringify(expenses)}\nUser's budgets: ${JSON.stringify(budgets)}\n`,
        },
        ...messages,
      ],
    });
    res.status(200).json({ reply: response.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: "AI failed to respond" });
  }
}
