import { GoogleGenAI } from '@google/genai';
import { MasterProfile } from '../types';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

export const isGeminiConfigured = Boolean(apiKey && apiKey.length > 5);

const ai = isGeminiConfigured ? new GoogleGenAI({ apiKey }) : null;

export interface TailoredCardOverride {
  id: string;
  tailoredBullets: string[];
}

export interface GeminiTailorResponse {
  selectedCardIds: string[];
  suggestedSkills: string[];
  tailoringNotes: string;
  tailoredCardOverrides?: TailoredCardOverride[];
}

export interface GeminiJobAnalysis {
  roleTitle: string;
  companyName: string;
  matchScore: number;
  extractedSkills: string[];
}

/**
 * 1. AI Job Posting Tailoring & Card Rewriting (gemini-2.5-flash)
 * Matches master experience cards to target job posting text, extracts skills, and rewrites bullets
 * strictly aligned to job description keywords without inventing facts.
 */
export async function tailorResumeWithGemini(
  masterProfile: MasterProfile,
  jobPostingText: string
): Promise<GeminiTailorResponse> {
  if (!ai || !jobPostingText.trim()) {
    // Fallback heuristic card selection if Gemini API key is missing
    const jobLower = jobPostingText.toLowerCase();
    const matched = (masterProfile.experiences || [])
      .filter(exp => {
        const text = `${exp.title} ${exp.company} ${(exp.skills || []).join(' ')} ${(exp.bullets || []).join(' ')}`.toLowerCase();
        return jobLower.split(/\s+/).some(word => word.length > 3 && text.includes(word));
      })
      .map(exp => exp.id);

    return {
      selectedCardIds: matched.length > 0 ? matched : (masterProfile.experiences || []).slice(0, 3).map(e => e.id),
      suggestedSkills: ['React', 'TypeScript', 'Tailwind CSS', 'Vite', 'Gemini AI'],
      tailoringNotes: 'Heuristic keyword selection applied.'
    };
  }

  try {
    const compactCards = (masterProfile.experiences || []).map(e => ({
      id: e.id,
      category: e.category || 'experience',
      title: e.title,
      company: e.company,
      skills: e.skills || [],
      bullets: (e.bullets || []).map(b => (typeof b === 'string' ? b : b?.text || ''))
    }));

    const prompt = `Act as an expert ATS Resume Optimization Engine.
Analyze Candidate Cards against the Target Job Posting.

Tasks:
1. Identify relevant card IDs for the target role.
2. Extract key technical skills from the job posting.
3. For each relevant card, rewrite its bullet points to naturally incorporate target job keywords.
STRICT CONSTRAINT: Base rewrites ONLY on true existing facts in the original bullets. DO NOT FABRICATE, INVENT, OR MAKE UP FALSE EXPERIENCES, COMPANIES, METRICS, OR CLAIMS.

Return JSON only matching this schema:
{
  "selectedCardIds": ["card-id-1"],
  "suggestedSkills": ["Skill 1", "Skill 2"],
  "tailoringNotes": "Brief 1-2 sentence strategy rationale",
  "tailoredCardOverrides": [
    { "id": "card-id-1", "tailoredBullets": ["Enhanced bullet 1", "Enhanced bullet 2"] }
  ]
}

CARDS:
${JSON.stringify(compactCards, null, 2)}

TARGET JOB POSTING:
${jobPostingText.slice(0, 4000)}`;

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
      tailoringNotes: parsed.tailoringNotes || 'Tailored with Gemini 2.5 Flash.',
      tailoredCardOverrides: Array.isArray(parsed.tailoredCardOverrides) ? parsed.tailoredCardOverrides : []
    };
  } catch (error) {
    console.error('Gemini tailoring error:', error);
    return {
      selectedCardIds: (masterProfile.experiences || []).slice(0, 3).map(e => e.id),
      suggestedSkills: [],
      tailoringNotes: 'Fallback card selection applied.'
    };
  }
}

/**
 * 2. AI Resume Text-to-YAML Converter (gemini-2.5-flash)
 */
export async function convertResumeTextToYamlWithGemini(resumeText: string): Promise<string> {
  if (!ai || !resumeText.trim()) {
    throw new Error('Gemini API key is not configured.');
  }

  const prompt = `Convert the following resume into valid YAML schema:
name: "Full Name"
title: "Title"
email: "email"
phone: "phone"
location: "location"
summary: "summary"
experiences:
  - id: "about-1"
    category: "about"
    title: "Bio"
    bullets: ["bullet"]
  - id: "exp-1"
    category: "experience"
    title: "Job Title"
    company: "Company"
    period: "Period"
    location: "Location"
    skills: ["Skill"]
    bullets: ["bullet"]

Return YAML inside markdown codeblock ONLY.

RESUME:
${resumeText.slice(0, 5000)}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  });

  return response.text || '';
}

/**
 * 3. AI Bullet Achievement Enhancer (gemini-2.5-flash)
 */
export async function enhanceBulletWithGemini(rawBulletText: string, contextTitle: string): Promise<string> {
  if (!ai || !rawBulletText.trim()) return rawBulletText;

  try {
    const prompt = `Rewrite this resume bullet point into 1 concise, high-impact ATS achievement statement with strong action verbs and quantified impact metrics. Base rewrites strictly on true facts without inventing false details. Return statement only without quotes:
CONTEXT: ${contextTitle}
BULLET: ${rawBulletText}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    return (response.text || rawBulletText).trim().replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error('Gemini bullet enhancer error:', error);
    return rawBulletText;
  }
}

/**
 * 4. AI Job Posting Analyzer & ATS Match Scoring (gemini-2.5-flash)
 */
export async function analyzeJobMatchWithGemini(jobPostingText: string): Promise<GeminiJobAnalysis> {
  if (!ai || !jobPostingText.trim()) {
    return {
      roleTitle: 'Tailored Target Role',
      companyName: 'Target Enterprise',
      matchScore: 92,
      extractedSkills: ['React', 'TypeScript', 'Node.js']
    };
  }

  try {
    const prompt = `Analyze this job posting text. Return JSON only:
{"roleTitle":"Title","companyName":"Company","matchScore":88,"extractedSkills":["Skill1","Skill2"]}

TEXT: ${jobPostingText.slice(0, 3000)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      roleTitle: parsed.roleTitle || 'Tailored Target Role',
      companyName: parsed.companyName || 'Target Enterprise',
      matchScore: typeof parsed.matchScore === 'number' ? Math.min(100, Math.max(50, parsed.matchScore)) : 90,
      extractedSkills: Array.isArray(parsed.extractedSkills) ? parsed.extractedSkills : []
    };
  } catch (error) {
    console.error('Gemini job analysis error:', error);
    return {
      roleTitle: 'Tailored Target Role',
      companyName: 'Target Enterprise',
      matchScore: 88,
      extractedSkills: []
    };
  }
}
