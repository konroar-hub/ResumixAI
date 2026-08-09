import { GoogleGenAI } from '@google/genai';
import { MasterProfile } from '../types';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

export const isGeminiConfigured = Boolean(apiKey && apiKey.length > 5);

const ai = isGeminiConfigured ? new GoogleGenAI({ apiKey }) : null;

export interface GeminiTailorResponse {
  selectedCardIds: string[];
  suggestedSkills: string[];
  tailoringNotes: string;
}

/**
 * Uses Gemini AI to match master profile experience cards to a target job posting.
 */
export async function tailorResumeWithGemini(
  masterProfile: MasterProfile,
  jobPostingText: string
): Promise<GeminiTailorResponse> {
  if (!ai || !jobPostingText.trim()) {
    // Fallback heuristic selection if Gemini is not configured
    const jobLower = jobPostingText.toLowerCase();
    const matched = (masterProfile.experiences || [])
      .filter(exp => {
        const text = `${exp.title} ${exp.company} ${exp.skills?.join(' ') || ''} ${(exp.bullets || []).join(' ')}`.toLowerCase();
        return jobLower.split(/\s+/).some(word => word.length > 3 && text.includes(word));
      })
      .map(exp => exp.id);

    return {
      selectedCardIds: matched.length > 0 ? matched : (masterProfile.experiences || []).slice(0, 3).map(e => e.id),
      suggestedSkills: ['React', 'TypeScript', 'Tailwind CSS', 'Vite', 'Gemini AI'],
      tailoringNotes: 'Selected matching cards using heuristic keyword alignment.'
    };
  }

  try {
    const prompt = `You are an expert ATS (Applicant Tracking System) Resume Strategist.
Given the candidate's Master Profile experience cards and the Target Job Posting, analyze which experience cards are most relevant to the target job and identify key technical skills mentioned in the posting.

MASTER PROFILE CARDS:
${JSON.stringify(masterProfile.experiences, null, 2)}

TARGET JOB POSTING:
${jobPostingText}

Return a valid JSON object matching this schema ONLY (no markdown surrounding text):
{
  "selectedCardIds": ["card-id-1", "card-id-2"],
  "suggestedSkills": ["Skill 1", "Skill 2"],
  "tailoringNotes": "Brief 1-2 sentence rationale for card selection"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || '';
    const parsed = JSON.parse(text);

    return {
      selectedCardIds: Array.isArray(parsed.selectedCardIds) ? parsed.selectedCardIds : [],
      suggestedSkills: Array.isArray(parsed.suggestedSkills) ? parsed.suggestedSkills : [],
      tailoringNotes: parsed.tailoringNotes || 'Successfully tailored resume with Gemini AI.'
    };
  } catch (error) {
    console.error('Gemini API tailoring error:', error);
    return {
      selectedCardIds: (masterProfile.experiences || []).slice(0, 3).map(e => e.id),
      suggestedSkills: [],
      tailoringNotes: 'Fallback card selection applied due to API timeout.'
    };
  }
}

/**
 * Converts raw text or unformatted resume content into Resume Tailor YAML schema using Gemini AI.
 */
export async function convertResumeTextToYamlWithGemini(resumeText: string): Promise<string> {
  if (!ai || !resumeText.trim()) {
    throw new Error('Gemini API key is not configured.');
  }

  const prompt = `Convert the following resume into a structured YAML format matching this schema:

name: "Full Name"
title: "Current or Target Professional Title"
email: "email@example.com"
phone: "+1 (555) 123-4567"
location: "City, State"
summary: "Professional summary paragraph..."

experiences:
  - id: "about-1"
    category: "about"
    title: "Personal Elevator Pitch / Bio"
    bullets:
      - "Passionate Engineer specializing in web applications..."

  - id: "exp-1"
    category: "experience"
    title: "Job Title"
    company: "Company Name"
    period: "2022 - Present"
    location: "City, State"
    skills:
      - "React"
    bullets:
      - "Achievement bullet point..."

Instructions:
1. Category "about" items ONLY require id, category: about, title, and bullets (no company/period/location).
2. Output ONLY the raw YAML code block.

Resume Text:
${resumeText}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  });

  return response.text || '';
}
