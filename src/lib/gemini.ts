import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini AI SDK if API key is provided
const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

interface AnalysisResult {
  isBlock: boolean;
  summary: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'OTK' | 'BLOCKED' | 'DONE' | null;
  explanation: string;
}

/**
 * Analyzes a text message from an engineer using Gemini AI, falling back to rule-based parsing if API key is missing.
 */
export async function analyzeReport(text: string): Promise<AnalysisResult> {
  if (!text) {
    return {
      isBlock: false,
      summary: '',
      status: null,
      explanation: 'Empty message'
    };
  }

  // Check if real Gemini API key is available
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: 'application/json' },
      });

      const prompt = `
        Ты — ИИ-ассистент в системе управления проектами ТОО «АзияЭнергоАвтоматика».
        Проанализируй текстовое сообщение инженера с объекта и верни структурированный JSON.
        
        Текст сообщения: "${text}"
        
        Формат ответа JSON:
        {
          "isBlock": true/false (true, если инженер сообщает о критической проблеме, нехватке материалов, задержках, срывах или о том, что работа остановилась/заблокирована),
          "summary": "Краткая суть проблемы на русском языке до 10 слов" (если isBlock true; иначе пустая строка),
          "status": "PENDING" | "IN_PROGRESS" | "OTK" | "BLOCKED" | "DONE" | null (определи, просит ли инженер изменить статус задачи. Например: "начал сборку" -> "IN_PROGRESS", "шкаф собран, передаю на проверку/ОТК" -> "OTK", "закончил пусконаладку/все готово" -> "DONE", "стоим из-за комплектующих/проблема" -> "BLOCKED". Если смены статуса нет, верни null),
          "explanation": "Краткое объяснение решения на русском языке"
        }
      `;

      const response = await model.generateContent(prompt);
      const responseText = response.response.text();
      return JSON.parse(responseText) as AnalysisResult;
    } catch (error) {
      console.error('Gemini API call failed, falling back to local parsing:', error);
    }
  }

  // Fallback Rule-Based Parser (if API key is missing or failed)
  const lowerText = text.toLowerCase();
  let isBlock = false;
  let summary = '';
  let status: AnalysisResult['status'] = null;
  let explanation = 'Смоделировано локальным парсером (ключ GEMINI_API_KEY не задан)';

  // Check for block words
  const blockKeywords = [
    'проблема', 'стоим', 'не приехал', 'задержка', 'сломал',
    'блок', 'сгорел', 'ошибка', 'не работает', 'задерживается',
    'не привезли', 'не хватает', 'нет кабеля', 'нет клемм', 'остановилась'
  ];

  for (const kw of blockKeywords) {
    if (lowerText.includes(kw)) {
      isBlock = true;
      status = 'BLOCKED';
      summary = `Обнаружена проблема: "${text.substring(0, 40)}${text.length > 40 ? '...' : ''}"`;
      break;
    }
  }

  if (!isBlock) {
    if (lowerText.includes('готов') || lowerText.includes('закончил') || lowerText.includes('сдал') && !lowerText.includes('отк')) {
      status = 'DONE';
    } else if (lowerText.includes('отк') || lowerText.includes('проверк')) {
      status = 'OTK';
    } else if (lowerText.includes('работ') || lowerText.includes('начал') || lowerText.includes('приступил')) {
      status = 'IN_PROGRESS';
    }
  }

  return {
    isBlock,
    summary,
    status,
    explanation
  };
}
