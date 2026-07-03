import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const LLAMA_API_URL = 'https://api.llama-api.com/chat/completions';

export const generateSummary = async (collegeData) => {
  const prompt = `Based on the following data about a college, write a 2-3 paragraph summary highlighting its type, location, key rankings, placements, and facilities. Make it sound appealing to a prospective student.\n\nData: ${JSON.stringify(collegeData)}`;
  
  return generateCompletion([{ role: 'user', content: prompt }]);
};

export const generateChatResponse = async (messages, contextData) => {
  const systemPrompt = `You are a knowledgeable college counselor assistant. You help students compare and evaluate colleges.
Use the following context about colleges to answer the user's questions accurately.
Context:
${JSON.stringify(contextData)}

If the information is not in the context, do your best to answer from general knowledge but clarify that it's not from the database. Format output using markdown tables or bullet points where appropriate.`;

  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  return generateCompletion(apiMessages);
};

async function generateCompletion(messages) {
  try {
    const response = await axios.post(
      LLAMA_API_URL,
      {
        model: 'llama3-70b',
        messages: messages,
        stream: false
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LLAMA_API_KEY}`
        }
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Llama API Error:", error.response?.data || error.message);
    throw new Error('Failed to generate response from Llama API');
  }
}
